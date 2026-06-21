import os
import sys
from datetime import datetime

from PySide6.QtCore import Qt, QThread
from PySide6.QtGui import QFont, QColor
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QLineEdit, QCheckBox, QSpinBox,
    QDoubleSpinBox, QProgressBar, QTextEdit, QFileDialog,
    QGroupBox, QScrollArea, QFrame, QSizePolicy,
)

from price_checker.config import AppConfig
from price_checker.main import SearchWorker

# ── QSS 스타일시트 ─────────────────────────────────────────────────────────────
QSS = """
QMainWindow, QWidget#centralWidget {
    background-color: #FFF9FB;
}

/* 헤더 */
QWidget#header {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #FFB6C9, stop:1 #FFD6E4);
    border-radius: 0px;
}
QLabel#appTitle {
    color: #333333;
    font-size: 22px;
    font-weight: bold;
    font-family: '맑은 고딕';
}
QLabel#appSubtitle {
    color: #555555;
    font-size: 11px;
    font-family: '맑은 고딕';
}

/* 카드 */
QGroupBox {
    background-color: #FFFFFF;
    border: 1.5px solid #F3DDE5;
    border-radius: 12px;
    margin-top: 8px;
    font-size: 12px;
    font-weight: bold;
    font-family: '맑은 고딕';
    color: #444444;
    padding: 8px;
}
QGroupBox::title {
    subcontrol-origin: margin;
    left: 12px;
    padding: 0 4px;
    color: #FF7FA3;
}

/* 일반 라벨 */
QLabel {
    color: #333333;
    font-family: '맑은 고딕';
    font-size: 11px;
}

/* 입력창 */
QLineEdit {
    border: 1.5px solid #F3DDE5;
    border-radius: 8px;
    padding: 5px 10px;
    background: #FFFFFF;
    color: #333333;
    font-family: '맑은 고딕';
    font-size: 11px;
}
QLineEdit:focus {
    border-color: #FFB6C9;
}

/* 숫자 입력 */
QDoubleSpinBox, QSpinBox {
    border: 1.5px solid #F3DDE5;
    border-radius: 8px;
    padding: 4px 8px;
    background: #FFFFFF;
    color: #333333;
    font-family: '맑은 고딕';
}
QDoubleSpinBox:focus, QSpinBox:focus {
    border-color: #FFB6C9;
}

/* 체크박스 */
QCheckBox {
    color: #333333;
    font-family: '맑은 고딕';
    font-size: 11px;
    spacing: 6px;
}
QCheckBox::indicator {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1.5px solid #F3DDE5;
    background: #FFFFFF;
}
QCheckBox::indicator:checked {
    background: #FFB6C9;
    border-color: #FF7FA3;
}

/* 분홍 젤리 버튼 */
QPushButton#btnPink {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #FFB6C9, stop:1 #FF9AB8);
    color: #333333;
    border: none;
    border-radius: 10px;
    padding: 7px 16px;
    font-family: '맑은 고딕';
    font-size: 11px;
    font-weight: bold;
}
QPushButton#btnPink:hover {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #FFC8D6, stop:1 #FFB0CA);
}
QPushButton#btnPink:pressed {
    background: #FF7FA3;
}

/* 노랑 젤리 버튼 */
QPushButton#btnYellow {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #FFE79A, stop:1 #FFDA70);
    color: #333333;
    border: none;
    border-radius: 10px;
    padding: 7px 16px;
    font-family: '맑은 고딕';
    font-size: 11px;
    font-weight: bold;
}
QPushButton#btnYellow:hover {
    background: #FFECA0;
}
QPushButton#btnYellow:pressed {
    background: #FFC940;
}

/* 시작 버튼 (크고 진한 분홍) */
QPushButton#btnStart {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #FF7FA3, stop:1 #FF5C8A);
    color: #FFFFFF;
    border: none;
    border-radius: 12px;
    padding: 10px 28px;
    font-family: '맑은 고딕';
    font-size: 13px;
    font-weight: bold;
    min-width: 120px;
}
QPushButton#btnStart:hover {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #FF9AB8, stop:1 #FF7FA3);
}
QPushButton#btnStart:disabled {
    background: #DDDDDD;
    color: #AAAAAA;
}

/* 중지 버튼 */
QPushButton#btnStop {
    background: #F0F0F0;
    color: #777777;
    border: 1.5px solid #DDDDDD;
    border-radius: 12px;
    padding: 10px 20px;
    font-family: '맑은 고딕';
    font-size: 12px;
}
QPushButton#btnStop:hover {
    background: #FFE79A;
    border-color: #FFDA70;
    color: #333333;
}
QPushButton#btnStop:disabled {
    background: #F5F5F5;
    color: #CCCCCC;
    border-color: #EEEEEE;
}

/* 결과 열기 버튼 */
QPushButton#btnOpen {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #FFB6C9, stop:1 #FF9AB8);
    color: #333333;
    border: none;
    border-radius: 10px;
    padding: 8px 20px;
    font-family: '맑은 고딕';
    font-size: 12px;
    font-weight: bold;
}
QPushButton#btnOpen:disabled {
    background: #EEEEEE;
    color: #BBBBBB;
}

/* 진행률 바 */
QProgressBar {
    border: none;
    border-radius: 8px;
    background: #F3DDE5;
    height: 14px;
    text-align: center;
    color: #333333;
    font-family: '맑은 고딕';
    font-size: 10px;
}
QProgressBar::chunk {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #FFB6C9, stop:1 #FF7FA3);
    border-radius: 8px;
}

/* 로그창 */
QTextEdit#logBox {
    background: #FFFFFF;
    border: 1.5px solid #F3DDE5;
    border-radius: 10px;
    color: #333333;
    font-family: '맑은 고딕';
    font-size: 10px;
    padding: 6px;
}

/* 현재 상품 라벨 */
QLabel#currentItem {
    color: #FF7FA3;
    font-family: '맑은 고딕';
    font-size: 11px;
    font-weight: bold;
}
"""


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Jelly Price Checker")
        self.setMinimumSize(900, 650)
        self.resize(950, 700)

        self._worker: SearchWorker | None = None
        self._result_path: str = ""
        self._config = AppConfig()

        self._setup_ui()
        self.setStyleSheet(QSS)

    def _setup_ui(self):
        central = QWidget()
        central.setObjectName("centralWidget")
        self.setCentralWidget(central)
        root = QVBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # 헤더
        root.addWidget(self._make_header())

        # 스크롤 영역 (본문)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        scroll.setStyleSheet("QScrollArea { background: #FFF9FB; border: none; }")
        body = QWidget()
        body.setStyleSheet("background: #FFF9FB;")
        body_layout = QVBoxLayout(body)
        body_layout.setContentsMargins(20, 16, 20, 16)
        body_layout.setSpacing(12)

        body_layout.addWidget(self._make_file_card())
        body_layout.addWidget(self._make_settings_card())
        body_layout.addWidget(self._make_run_card())
        body_layout.addWidget(self._make_log_card())
        body_layout.addStretch()

        scroll.setWidget(body)
        root.addWidget(scroll)

    def _make_header(self) -> QWidget:
        header = QWidget()
        header.setObjectName("header")
        header.setFixedHeight(80)
        layout = QVBoxLayout(header)
        layout.setContentsMargins(24, 12, 24, 12)
        layout.setSpacing(2)

        title = QLabel("🍬 Jelly Price Checker")
        title.setObjectName("appTitle")
        subtitle = QLabel("상품명 기준으로 쿠팡/네이버 최저가를 한번에 정리해요")
        subtitle.setObjectName("appSubtitle")

        layout.addWidget(title)
        layout.addWidget(subtitle)
        return header

    def _make_file_card(self) -> QGroupBox:
        box = QGroupBox("📂 파일 선택")
        layout = QVBoxLayout(box)
        layout.setSpacing(10)

        # 입력 엑셀
        row1 = QHBoxLayout()
        self.inputPathEdit = QLineEdit()
        self.inputPathEdit.setPlaceholderText("입력 엑셀 파일을 선택하세요 (.xlsx / .xls)")
        self.inputPathEdit.setReadOnly(True)
        btn_input = QPushButton("엑셀 선택")
        btn_input.setObjectName("btnPink")
        btn_input.clicked.connect(self._select_input)
        row1.addWidget(QLabel("입력 파일:"))
        row1.addWidget(self.inputPathEdit, 1)
        row1.addWidget(btn_input)
        layout.addLayout(row1)

        # 저장 위치
        row2 = QHBoxLayout()
        self.outputDirEdit = QLineEdit()
        self.outputDirEdit.setPlaceholderText("결과 파일 저장 위치 (기본: 입력 파일과 동일)")
        self.outputDirEdit.setReadOnly(True)
        btn_output = QPushButton("폴더 선택")
        btn_output.setObjectName("btnYellow")
        btn_output.clicked.connect(self._select_output_dir)
        row2.addWidget(QLabel("저장 위치:"))
        row2.addWidget(self.outputDirEdit, 1)
        row2.addWidget(btn_output)
        layout.addLayout(row2)

        # 옵션
        self.headerCheck = QCheckBox("첫 행을 헤더로 사용")
        self.headerCheck.setChecked(True)
        layout.addWidget(self.headerCheck)
        return box

    def _make_settings_card(self) -> QGroupBox:
        box = QGroupBox("⚙️ 검색 설정")
        layout = QHBoxLayout(box)
        layout.setSpacing(20)

        # 딜레이
        col1 = QVBoxLayout()
        col1.addWidget(QLabel("요청 딜레이 (초)"))
        self.delaySpin = QDoubleSpinBox()
        self.delaySpin.setRange(1.0, 30.0)
        self.delaySpin.setValue(3.0)
        self.delaySpin.setSingleStep(0.5)
        col1.addWidget(self.delaySpin)
        layout.addLayout(col1)

        # 최대 후보 수
        col2 = QVBoxLayout()
        col2.addWidget(QLabel("최대 후보 수"))
        self.maxCandSpin = QSpinBox()
        self.maxCandSpin.setRange(3, 30)
        self.maxCandSpin.setValue(10)
        col2.addWidget(self.maxCandSpin)
        layout.addLayout(col2)

        # 체크박스
        col3 = QVBoxLayout()
        self.headlessCheck = QCheckBox("브라우저 숨기기 (headless)")
        self.headlessCheck.setChecked(False)
        self.coupangCheck = QCheckBox("쿠팡 검색 사용")
        self.coupangCheck.setChecked(True)
        self.naverCheck = QCheckBox("네이버 검색 사용")
        self.naverCheck.setChecked(True)
        col3.addWidget(self.headlessCheck)
        col3.addWidget(self.coupangCheck)
        col3.addWidget(self.naverCheck)
        layout.addLayout(col3)

        layout.addStretch()
        return box

    def _make_run_card(self) -> QGroupBox:
        box = QGroupBox("🚀 실행")
        layout = QVBoxLayout(box)
        layout.setSpacing(10)

        # 버튼 행
        btn_row = QHBoxLayout()
        self.btnStart = QPushButton("검색 시작")
        self.btnStart.setObjectName("btnStart")
        self.btnStart.clicked.connect(self._start_search)

        self.btnStop = QPushButton("중지")
        self.btnStop.setObjectName("btnStop")
        self.btnStop.setEnabled(False)
        self.btnStop.clicked.connect(self._stop_search)

        self.btnOpen = QPushButton("결과 엑셀 열기 🍬")
        self.btnOpen.setObjectName("btnOpen")
        self.btnOpen.setEnabled(False)
        self.btnOpen.clicked.connect(self._open_result)

        btn_row.addWidget(self.btnStart)
        btn_row.addWidget(self.btnStop)
        btn_row.addSpacing(20)
        btn_row.addWidget(self.btnOpen)
        btn_row.addStretch()
        layout.addLayout(btn_row)

        # 진행률
        self.progressBar = QProgressBar()
        self.progressBar.setValue(0)
        layout.addWidget(self.progressBar)

        # 현재 상품
        self.currentItemLabel = QLabel("대기 중...")
        self.currentItemLabel.setObjectName("currentItem")
        layout.addWidget(self.currentItemLabel)

        return box

    def _make_log_card(self) -> QGroupBox:
        box = QGroupBox("📋 로그")
        layout = QVBoxLayout(box)
        self.logBox = QTextEdit()
        self.logBox.setObjectName("logBox")
        self.logBox.setReadOnly(True)
        self.logBox.setMinimumHeight(180)
        layout.addWidget(self.logBox)
        return box

    # ── 슬롯 ──────────────────────────────────────────────────────────────────

    def _select_input(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "입력 엑셀 선택", "", "Excel Files (*.xlsx *.xls)"
        )
        if path:
            self.inputPathEdit.setText(path)
            if not self.outputDirEdit.text():
                self.outputDirEdit.setText(os.path.dirname(path))

    def _select_output_dir(self):
        path = QFileDialog.getExistingDirectory(self, "저장 위치 선택")
        if path:
            self.outputDirEdit.setText(path)

    def _start_search(self):
        input_path = self.inputPathEdit.text()
        if not input_path or not os.path.exists(input_path):
            self._log("입력 엑셀 파일을 먼저 선택해주세요.", "error")
            return
        output_dir = self.outputDirEdit.text() or os.path.dirname(input_path)

        config = AppConfig(
            delay_seconds=self.delaySpin.value(),
            headless=self.headlessCheck.isChecked(),
            max_candidates=self.maxCandSpin.value(),
            use_coupang=self.coupangCheck.isChecked(),
            use_naver=self.naverCheck.isChecked(),
        )

        self._worker = SearchWorker(
            input_path=input_path,
            output_dir=output_dir,
            has_header=self.headerCheck.isChecked(),
            config=config,
        )
        self._worker.progress.connect(self._on_progress)
        self._worker.log.connect(self._on_log)
        self._worker.finished.connect(self._on_finished)

        self.btnStart.setEnabled(False)
        self.btnStop.setEnabled(True)
        self.btnOpen.setEnabled(False)
        self.progressBar.setValue(0)
        self.logBox.clear()
        self._log("검색을 시작합니다...", "info")
        self._worker.start()

    def _stop_search(self):
        if self._worker:
            self._worker.stop()
        self.btnStop.setEnabled(False)

    def _on_progress(self, current: int, total: int):
        self.progressBar.setMaximum(total)
        self.progressBar.setValue(current)
        self.currentItemLabel.setText(f"처리 중: {current} / {total}")

    def _on_log(self, message: str, level: str):
        self._log(message, level)

    def _on_finished(self, path: str):
        self._result_path = path
        self.btnStart.setEnabled(True)
        self.btnStop.setEnabled(False)
        if path:
            self.btnOpen.setEnabled(True)
            self._log(f"✅ 조회가 완료되었어요 🍬 — {path}", "info")
            self.currentItemLabel.setText("조회 완료 🍬")
        else:
            self._log("⚠️ 완료되었으나 저장 파일이 없습니다.", "warn")
            self.currentItemLabel.setText("완료 (저장 실패)")

    def _open_result(self):
        if self._result_path and os.path.exists(self._result_path):
            os.startfile(self._result_path)

    def _log(self, message: str, level: str = "info"):
        colors = {"info": "#333333", "warn": "#E08000", "error": "#CC2244"}
        color = colors.get(level, "#333333")
        self.logBox.append(
            f'<span style="color:{color}; font-family:맑은 고딕; font-size:10pt;">'
            f'{message}</span>'
        )
        # 스크롤 맨 아래로
        sb = self.logBox.verticalScrollBar()
        sb.setValue(sb.maximum())
