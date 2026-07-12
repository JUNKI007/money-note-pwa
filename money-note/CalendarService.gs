// ============================================================
// CalendarService.gs — 캘린더 일정 CRUD + Google Calendar 연동
// ============================================================

const EVENT_PREFIX = 'E';

/**
 * Google Calendar ID가 설정된 경우에만 CalendarApp 반환
 * 설정되지 않았거나 오류 시 null 반환
 */
function _getCalendarApp() {
  const calId = PropertiesService.getScriptProperties().getProperty('CALENDAR_ID');
  if (!calId) return null;
  try {
    return CalendarApp.getCalendarById(calId);
  } catch (e) {
    return null;
  }
}

/**
 * 일정 추가
 * @param {Object} data - {title, start_date, start_time?, end_date?, end_time?,
 *   is_all_day?, member_scope?, category?, color?, reminder_minutes?,
 *   location?, memo?, linked_transaction_type?, linked_loan_id?,
 *   linked_saving_goal_id?, linked_amount?, created_by}
 * @returns {{success: boolean, data: Object}}
 */
function addCalendarEvent(data) {
  try {
    const err = validateRequired(data, ['title', 'start_date', 'created_by']);
    if (err) return errorResponse(err);

    const now = formatDateTime();

    // Google Calendar에 이벤트 추가 (실패해도 시트 저장은 진행)
    let googleEventId = '';
    const cal = _getCalendarApp();
    if (cal) {
      try {
        const startDt = new Date(data.start_date + (data.start_time ? 'T' + data.start_time : 'T00:00:00'));
        if (data.is_all_day !== false) {
          // 종일 일정
          const gcEvent = cal.createAllDayEvent(data.title, startDt);
          googleEventId = gcEvent.getId();
          if (data.reminder_minutes) gcEvent.addPopupReminder(parseInt(data.reminder_minutes));
          if (data.location) gcEvent.setLocation(data.location);
          if (data.memo) gcEvent.setDescription(data.memo);
        } else {
          // 시간 지정 일정
          const endDt = data.end_date
            ? new Date(data.end_date + (data.end_time ? 'T' + data.end_time : 'T23:59:59'))
            : new Date(startDt.getTime() + 60 * 60 * 1000);
          const gcEvent = cal.createEvent(data.title, startDt, endDt);
          googleEventId = gcEvent.getId();
          if (data.reminder_minutes) gcEvent.addPopupReminder(parseInt(data.reminder_minutes));
          if (data.location) gcEvent.setLocation(data.location);
          if (data.memo) gcEvent.setDescription(data.memo);
        }
      } catch (e) {
        // Google Calendar 실패해도 시트 저장 계속 진행
      }
    }

    const event = {
      event_id:                generateId(EVENT_PREFIX),
      google_event_id:         googleEventId,
      title:                   data.title,
      start_date:              data.start_date,
      start_time:              data.start_time || '',
      end_date:                data.end_date || data.start_date,
      end_time:                data.end_time || '',
      is_all_day:              data.is_all_day !== false,
      member_scope:            data.member_scope || '전체',
      category:                data.category || '기타',
      color:                   data.color || '',
      reminder_minutes:        data.reminder_minutes || '',
      location:                data.location || '',
      memo:                    data.memo || '',
      linked_transaction_type: data.linked_transaction_type || '',
      linked_loan_id:          data.linked_loan_id || '',
      linked_saving_goal_id:   data.linked_saving_goal_id || '',
      linked_amount:           data.linked_amount != null ? data.linked_amount : '',
      created_by:              data.created_by,
      created_at:              now,
      updated_at:              now,
      is_deleted:              false
    };

    appendRow('CALENDAR_EVENTS', event);
    return successResponse(event);
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * 일정 목록 조회
 * @param {Object} filters - {yearMonth?: 'YYYY-MM', member_scope?: string}
 * @returns {{success: boolean, data: Object[]}}
 */
function getCalendarEvents(filters) {
  try {
    filters = filters || {};
    let rows = getAllRows('CALENDAR_EVENTS');

    // 연월 필터 (start_date~end_date 범위가 해당 월과 겹치는 이벤트 포함)
    if (filters.yearMonth) {
      const monthStart = filters.yearMonth + '-01';
      const monthEnd = filters.yearMonth + '-31';
      rows = rows.filter(function(r) {
        const sd = _dateToStr(r.start_date);
        const ed = _dateToStr(r.end_date || r.start_date);
        return sd <= monthEnd && ed >= monthStart;
      });
    }

    // 멤버 범위 필터: '전체' 요청이 아닌 경우 해당 멤버 또는 '전체' 공개 일정만 반환
    if (filters.member_scope && filters.member_scope !== '전체') {
      rows = rows.filter(function(r) {
        return r.member_scope === '전체' || r.member_scope === filters.member_scope;
      });
    }

    // 날짜+시간 오름차순 정렬
    rows.sort(function(a, b) {
      const keyA = (a.start_date || '') + (a.start_time || '');
      const keyB = (b.start_date || '') + (b.start_time || '');
      return keyA.localeCompare(keyB);
    });

    return successResponse(rows);
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * 일정 수정
 * @param {string} event_id
 * @param {Object} updates - 수정할 필드들
 * @returns {{success: boolean, data: Object}}
 */
function updateCalendarEvent(event_id, updates) {
  try {
    const row = findRowBy('CALENDAR_EVENTS', 'event_id', event_id);
    if (!row) return errorResponse('일정을 찾을 수 없습니다: ' + event_id);
    if (row.is_deleted === true || row.is_deleted === 'TRUE' || row.is_deleted === 'true') {
      return errorResponse('삭제된 일정은 수정할 수 없습니다');
    }

    const now = formatDateTime();

    // 허용 필드만 패치
    const allowed = [
      'title', 'start_date', 'start_time', 'end_date', 'end_time',
      'is_all_day', 'member_scope', 'category', 'color',
      'reminder_minutes', 'location', 'memo', 'linked_amount'
    ];
    const patch = { updated_at: now };
    allowed.forEach(function(k) {
      if (updates[k] !== undefined) patch[k] = updates[k];
    });

    // Google Calendar 이벤트 동기화 (실패해도 시트 저장 계속 진행)
    if (row.google_event_id) {
      const cal = _getCalendarApp();
      if (cal) {
        try {
          const gcEvent = cal.getEventById(row.google_event_id);
          if (gcEvent) {
            if (patch.title !== undefined)    gcEvent.setTitle(patch.title);
            if (patch.memo !== undefined)     gcEvent.setDescription(patch.memo);
            if (patch.location !== undefined) gcEvent.setLocation(patch.location);
          }
        } catch (e) {
          // Google Calendar 실패 무시
        }
      }
    }

    updateRow('CALENDAR_EVENTS', row._rowIndex, patch);
    return successResponse(Object.assign({}, row, patch));
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * 일정 삭제 (소프트 삭제 + Google Calendar 삭제)
 * @param {string} event_id
 * @returns {{success: boolean, data: Object}}
 */
function deleteCalendarEvent(event_id) {
  try {
    const row = findRowBy('CALENDAR_EVENTS', 'event_id', event_id);
    if (!row) return errorResponse('일정을 찾을 수 없습니다: ' + event_id);
    if (row.is_deleted === true || row.is_deleted === 'TRUE' || row.is_deleted === 'true') {
      return errorResponse('이미 삭제된 일정입니다');
    }

    const now = formatDateTime();

    // Google Calendar 이벤트 삭제 (실패해도 시트 소프트 삭제는 진행)
    if (row.google_event_id) {
      const cal = _getCalendarApp();
      if (cal) {
        try {
          const gcEvent = cal.getEventById(row.google_event_id);
          if (gcEvent) gcEvent.deleteEvent();
        } catch (e) {
          // Google Calendar 삭제 실패 무시
        }
      }
    }

    updateRow('CALENDAR_EVENTS', row._rowIndex, {
      is_deleted: true,
      updated_at: now
    });
    return successResponse(Object.assign({}, row, { is_deleted: true, updated_at: now }));
  } catch (e) {
    return errorResponse(e.message);
  }
}
