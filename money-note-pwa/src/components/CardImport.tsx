import { useRef, useState } from 'react'
import { read, utils } from 'xlsx'
import { Upload, CheckSquare, Square, AlertCircle } from 'lucide-react'
import dayjs from 'dayjs'
import { gasPost } from '@/api/client'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { BottomSheet } from '@/components/ui/BottomSheet'

const MEMBERS = ['남편', '아내', '공동']

interface ParsedRow {
  id: string
  date: string
  detail: string
  amount: number
  member: string
  selected: boolean
  installmentType: '일시불' | '할부'
  installmentMonths: number // 할부 개월수 (일시불이면 0)
}

// 삼성카드 xlsx 파싱: 두번째 시트, 1행=헤더
function parseSamsungCard(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = read(data, { type: 'array' })

        // 두번째 시트 (이용내역 상세)
        const ws = wb.Sheets[wb.SheetNames[1] ?? wb.SheetNames[0]]
        const rows: unknown[][] = utils.sheet_to_json(ws, { header: 1, defval: '' })

        // 헤더 행 제외, 빈 행 제외
        const result: ParsedRow[] = rows
          .slice(1)
          .filter((r) => r[2] && r[4] && r[5])
          .map((r, i) => {
            const rawDate = String(r[2]).trim()
            const date = rawDate.replace(/\./g, '-')
            const detail = String(r[4]).trim()
            const amount = Number(r[5]) || 0
            const instType: '할부' | '일시불' = String(r[6] ?? '').includes('할부') ? '할부' : '일시불'
            const instMonths = instType === '할부' ? (parseInt(String(r[7] ?? '0')) || 0) : 0
            return {
              id: `import_${i}`,
              date,
              detail,
              amount,
              member: MEMBERS[0],
              selected: true,
              installmentType: instType,
              installmentMonths: instMonths,
            }
          })
          .filter((r) => r.amount > 0 && r.date.match(/^\d{4}-\d{2}-\d{2}$/))

        resolve(result)
      } catch (err) {
        reject(new Error('파일 파싱 실패: ' + (err as Error).message))
      }
    }
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsArrayBuffer(file)
  })
}

export function CardImport() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [sheet, setSheet] = useState(false)
  const [loading, setLoading] = useState(false)
  const [, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [defaultMember, setDefaultMember] = useState(MEMBERS[0])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const parsed = await parseSamsungCard(file)
      if (parsed.length === 0) {
        setError('인식된 거래가 없습니다. 삼성카드 이용내역 엑셀 파일인지 확인해주세요.')
        return
      }
      // 기본 구성원 적용
      setRows(parsed.map((r) => ({ ...r, member: defaultMember })))
      setSheet(true)
      setDone(false)
    } catch (err) {
      setError((err as Error).message)
    }
    e.target.value = ''
  }

  const toggle = (id: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)))

  const toggleAll = () => {
    const allSelected = rows.every((r) => r.selected)
    setRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })))
  }

  const setMemberAll = (member: string) => {
    setDefaultMember(member)
    setRows((prev) => prev.map((r) => ({ ...r, member })))
  }

  const handleImport = async () => {
    const selected = rows.filter((r) => r.selected)
    if (selected.length === 0) return

    setLoading(true)
    setProgress(0)

    try {
      const normalRows = selected.filter((r) => r.installmentType === '일시불')
      const installRows = selected.filter((r) => r.installmentType === '할부' && r.installmentMonths >= 2)

      // 일시불 → 일괄 거래 등록
      if (normalRows.length > 0) {
        const txList = normalRows.map((r) => ({
          date: r.date,
          member: r.member,
          flow_type: '마이너스',
          category: '',
          detail: r.detail,
          amount: r.amount,
          memo: '[카드가져오기]',
          transaction_type: '소비',
        }))
        await gasPost('bulkSaveTransactions', { transactions: txList })
      }

      // 할부 → 할부 원장에 등록
      for (const r of installRows) {
        await gasPost('addInstallment', {
          purchase_date: r.date,
          member: r.member,
          detail: r.detail,
          category: '',
          total_amount: r.amount,
          monthly_amount: Math.round(r.amount / r.installmentMonths),
          total_months: r.installmentMonths,
          memo: '[카드가져오기]',
        })
      }

      // 캐시 무효화
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })

      setProgress(100)
      setDone(true)
    } catch (err) {
      setError('가져오기 실패: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const selectedCount = rows.filter((r) => r.selected).length
  const totalAmount = rows.filter((r) => r.selected).reduce((s, r) => s + r.amount, 0)

  return (
    <>
      {/* 가져오기 버튼 */}
      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-2 w-full px-4 py-3 bg-white border border-dashed border-gray-200 rounded-2xl text-sm text-text-sub active:bg-gray-50"
      >
        <Upload size={16} className="text-blue-main" />
        <span>카드 이용내역 가져오기 (.xlsx)</span>
        <span className="ml-auto text-[10px] text-gray-300">삼성카드</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFile}
      />

      {error && (
        <div className="flex items-center gap-2 text-xs text-expense bg-red-50 px-3 py-2 rounded-xl">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* 미리보기 시트 */}
      <BottomSheet
        isOpen={sheet}
        onClose={() => { setSheet(false); setRows([]) }}
        title={done ? '가져오기 완료' : `카드 내역 미리보기 (${rows.length}건)`}
      >
        {done ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-3">✅</p>
            <p className="text-sm font-bold text-text-primary">{selectedCount}건 가져오기 완료</p>
            <p className="text-xs text-gray-400 mt-1">
              할부 건은 저축 탭 → 할부에서, 일시불은 내역 탭에서 카테고리를 설정해주세요
            </p>
            <Button
              fullWidth
              className="mt-6"
              onClick={() => { setSheet(false); setRows([]) }}
            >
              확인
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 구성원 선택 */}
            <div>
              <p className="text-xs text-text-sub mb-1.5">이 카드 사용자</p>
              <div className="flex gap-2">
                {MEMBERS.map((m) => (
                  <button
                    key={m}
                    className={`flex-1 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                      defaultMember === m ? 'bg-blue-main text-white' : 'bg-bg-app text-text-sub'
                    }`}
                    onClick={() => setMemberAll(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* 전체 선택 + 요약 */}
            <div className="flex items-center justify-between bg-bg-app rounded-xl px-3 py-2">
              <button
                onClick={toggleAll}
                className="flex items-center gap-1.5 text-xs text-text-sub"
              >
                {rows.every((r) => r.selected) ? (
                  <CheckSquare size={14} className="text-blue-main" />
                ) : (
                  <Square size={14} />
                )}
                전체 선택
              </button>
              <span className="text-xs text-text-sub">
                {selectedCount}건 /{' '}
                <span className="font-semibold text-expense">
                  {totalAmount.toLocaleString('ko-KR')}원
                </span>
              </span>
            </div>

            {/* 거래 목록 */}
            <div className="max-h-72 overflow-y-auto space-y-1 -mx-1 px-1">
              {rows.map((r) => (
                <button
                  key={r.id}
                  onClick={() => toggle(r.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    r.selected ? 'bg-blue-50' : 'bg-bg-app opacity-40'
                  }`}
                >
                  {r.selected ? (
                    <CheckSquare size={14} className="text-blue-main shrink-0" />
                  ) : (
                    <Square size={14} className="text-gray-300 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{r.detail}</p>
                    <p className="text-[10px] text-gray-400">
                      {dayjs(r.date).format('M/D')}
                      {r.installmentType === '할부' && r.installmentMonths > 0 ? (
                        <span className="ml-1 text-orange-500 font-medium">{r.installmentMonths}개월 할부</span>
                      ) : (
                        <span className="ml-1 text-gray-300">일시불</span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-expense shrink-0">
                    {r.amount.toLocaleString('ko-KR')}
                  </span>
                </button>
              ))}
            </div>

            {/* 안내 */}
            <p className="text-[10px] text-gray-400 bg-yellow-50 px-3 py-2 rounded-xl">
              카테고리는 비워두고 등록합니다. 내역 탭에서 가맹점을 보고 카테고리를 설정해주세요.
            </p>

            <Button
              fullWidth
              onClick={handleImport}
              disabled={loading || selectedCount === 0}
            >
              {loading
                ? `등록 중...`
                : `${selectedCount}건 가져오기`}
            </Button>
          </div>
        )}
      </BottomSheet>
    </>
  )
}
