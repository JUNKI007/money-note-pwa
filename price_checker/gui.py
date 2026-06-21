import os
import sys

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QLineEdit, QCheckBox, QSpinBox,
    QDoubleSpinBox, QProgressBar, QTextEdit, QFileDialog,
    QGroupBox, QScrollArea, QFrame,
)

from config import AppConfig
from main import SearchWorker

QSS = """
QMainWindow, QWidget#centralWidget {
    background-color: #F3F4F6;
}
QWidget#header {
    background-color: #1E3A5F;
}
QLabel#appTitle {
    color: #FFFFFF;
    font-size: 18px;
    font-weight: bold;
    font-family: '맑은 고딕';
}
QLabel#appSubtitle {
    color: #93C5FD;
    font-size: 11px;
    font-family: '맑은 고딕';
}
QGroupBox {
    background-color: #FFFFFF;
    border: 1px solid #D1D5DB;
    border-radius: 4px;
    margin-top: 10px;
    font-size: 11px;
    font-weight: bold;
    font-family: '맑은 고딕';
    color: #374151;
    padding: 6px;
}
QGroupBox::title {
    subcontrol-origin: margin;
    left: 10px;
    padding: 0 4px;
    color: #2563EB;
}
QLabel {
    color: #111827;
    font-family: '맑은 고딕';
    font-size: 11px;
}
QLabel#labelMuted {
    color: #6B7280;
    font-size: 10px;
}
QLineEdit {
    border: 1px solid #D1D5DB;
    border-radius: 3px;
    padding: 5px 8px;
    background: #FFFFFF;
    color: #111827;
    font-family: '맑은 고딕';
    font-size: 11px;
}
QLineEdit:focus {
    border-color: #2563EB;
}
QLineEdit:read-only {
    background: #F9FAFB;
    color: #374151;
}
QSpinBox, QDoubleSpinBox {
    border: 1px solid #D1D5DB;
    border-radius: 3px;
    padding: 4px 6px;
    background: #FFFFFF;
    color: #111827;
    font-family: '맑은 고딕';
    font-size: 11px;
}
QSpinBox:focus, QDoubleSpinBox:focus {
    border-color: #2563EB;
}
QCheckBox {
    color: #111827;
    font-family: '맑은 고딕';
    font-size: 11px;
    spacing: 6px;
}
QCheckBox::indicator {
    width: 15px;
    height: 15px;
    border-radius: 2px;
    border: 1px solid #D1D5DB;
    background: #FFFFFF;
}
QCheckBox::indicator:checked {
    background-color: #2563EB;
    border-color: #1D4ED8;
}
QPushButton {
    background-color: #E5E7EB;
    color: #374151;
    border: 1px solid #D1D5DB;
    border-radius: 3px;
    padding: 6px 14px;
    font-family: '맑은 고딕';
    font-size: 11px;
}
QPushButton:hover {
    background-color: #D1D5DB;
    border-color: #9CA3AF;
}
QPushButton#btnFile {
    background-color: #E5E7EB;
    color: #374151;
    border: 1px solid #D1D5DB;
    border-radius: 3px;
    padding: 5px 12px;
    font-family: '맑은 고딕';
    font-size: 11px;
    min-width: 70px;
}
QPushButton#btnFile:hover {
    background-color: #D1D5DB;
}
QPushButton#btnStart {
    background-color: #2563EB;
    color: #FFFFFF;
    border: 1px solid #1D4ED8;
    border-radius: 3px;
    padding: 8px 24px;
    font-family: '맑은 고딕';
    font-size: 12px;
    font-weight: bold;
    min-width: 110px;
    min-height: 36px;
}
QPushButton#btnStart:hover {
    background-color: #1D4ED8;
    border-color: #1E40AF;
}
QPushButton#btnStart:pressed {
    background-color: #1E40AF;
}
QPushButton#btnStart:disabled {
    background-color: #E5E7EB;
    color: #9CA3AF;
    border-color: #D1D5DB;
}
QPushButton#btnStop {
    background-color: #FFFFFF;
    color: #DC2626;
    border: 1px solid #DC2626;
    border-radius: 3px;
    padding: 8px 20px;
    font-family: '맑은 고딕';
    font-size: 11px;
    font-weight: bold;
    min-width: 80px;
    min-height: 36px;
}
QPushButton#btnStop:hover {
    background-color: #FEE2E2;
}
QPushButton#btnStop:disabled {
    background-color: #FFFFFF;
    color: #D1D5DB;
    border-color: #E5E7EB;
}
QPushButton#btnOpen {
    background-color: #FFFFFF;
    color: #2563EB;
    border: 1px solid #2563EB;
    border-radius: 3px;
    padding: 8px 20px;
    font-family: '맑은 고딕';
    font-size: 11px;
    font-weight: bold;
    min-width: 130px;
    min-height: 36px;
}
QPushButton#btnOpen:hover {
    background-color: #EFF6FF;
}
QPushButton#btnOpen:disabled {
    background-color: #FFFFFF;
    color: #D1D5DB;
    border-color: #E5E7EB;
}
QProgressBar {
    border: 1px solid #D1D5DB;
    border-radius: 3px;
    background: #F9FAFB;
    height: 16px;
    text-align: center;
    color: #374151;
    font-family: '맑은 고딕';
    font-size: 10px;
}
QProgressBar::chunk {
    background-color: #2563EB;
    border-radius: 2px;
}
QTextEdit#logBox {
    background: #FFFFFF;
    border: 1px solid #D1D5DB;
    border-radius: 3px;
    color: #111827;
    font-family: 'Consolas', '맑은 고딕';
    font-size: 10px;
    padding: 4px;
}
QLabel#statusLabel {
    color: #374151;
    font-family: '맑은 고딕';
    font-size: 11px;
}
"""


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Price Checker")
        self.setMinimumSize(780, 580)
        self.resize(860, 640)

        self._worker: SearchWorker | None = None
        self._result_path: str = ""
        self._custom_status: str = ""

        self._setup_ui()
        self.setStyleSheet(QSS)

    def _setup_ui(self):
        central = QWidget()
        central.setObjectName("centralWidget")
        self.setCentralWidget(central)
        root = QVBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        root.addWidget(self._make_header())

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        scroll.setStyleSheet("QScrollArea { background: #F3F4F6; border: none; }")
        body = QWidget()
        body.setStyleSheet("background: #F3F4F6;")
        body_layout = QVBoxLayout(body)
        body_layout.setContentsMargins(16, 14, 16, 14)
        body_layout.setSpacing(10)

        body_layout.addWidget(self._make_file_card())
        body_layout.addWidget(self._make_options_card())
        body_layout.addWidget(self._make_run_card())
        body_layout.addWidget(self._make_log_card())
        body_layout.addStretch()

        scroll.setWidget(body)
        root.addWidget(scroll)

        self._update_ui_state()

    def _make_header(self) -> QWidget:
        header = QWidget()
        header.setObjectName("header")
        header.setFixedHeight(64)
        layout = QVBoxLayout(header)
        layout.setContentsMargins(20, 10, 20, 10)
        layout.setSpacing(2)
        title = QLabel("Price Checker")
        title.setObjectName("appTitle")
        subtitle = QLabel("상품명 기준으로 네이버 가격비교 최저가를 조회합니다.")
        subtitle.setObjectName("appSubtitle")
        layout.addWidget(title)
        layout.addWidget(subtitle)
        return header

    def _make_file_card(self) -> QGroupBox:
        box = QGroupBox("파일 선택")
        layout = QVBoxLayout(box)
        layout.setSpacing(8)

        row1 = QHBoxLayout()
        self.inputPathEdit = QLineEdit()
        self.inputPathEdit.setPlaceholderText("입력 엑셀 파일 (.xlsx / .xls)  — A열: 상품코드, B열: 상품명")
        self.inputPathEdit.setReadOnly(True)
        btn_input = QPushButton("파일 선택")
        btn_input.setObjectName("btnFile")
        btn_input.clicked.connect(self._select_input)
        row1.addWidget(QLabel("입력 파일:"))
        row1.addWidget(self.inputPathEdit, 1)
        row1.addWidget(btn_input)
        layout.addLayout(row1)

        row2 = QHBoxLayout()
        self.outputDirEdit = QLineEdit()
        self.outputDirEdit.setPlaceholderText("저장 위치 (기본: 입력 파일과 동일 폴더)")
        self.outputDirEdit.setReadOnly(True)
        btn_output = QPushButton("폴더 선택")
        btn_output.setObjectName("btnFile")
        btn_output.clicked.connect(self._select_output_dir)
        row2.addWidget(QLabel("저장 위치:"))
        row2.addWidget(self.outputDirEdit, 1)
        row2.addWidget(btn_output)
        layout.addLayout(row2)

        self.headerCheck = QCheckBox("첫 행을 헤더로 사용")
        self.headerCheck.setChecked(True)
        layout.addWidget(self.headerCheck)

        self.inputPathEdit.textChanged.connect(self._update_ui_state)
        self.outputDirEdit.textChanged.connect(self._update_ui_state)
        return box

    def _make_options_card(self) -> QGroupBox:
        box = QGroupBox("조회 옵션")
        layout = QVBoxLayout(box)
        layout.setSpacing(10)

        # 기본 옵션 행
        row1 = QHBoxLayout()
        self.naverCheck = QCheckBox("네이버 가격비교 조회 사용")
        self.naverCheck.setChecked(True)
        row1.addWidget(self.naverCheck)
        row1.addStretch()
        layout.addLayout(row1)

        # 고급 옵션
        adv_box = QGroupBox("고급 옵션")
        adv_box.setStyleSheet(
            "QGroupBox { border: 1px dashed #D1D5DB; border-radius: 3px; "
            "margin-top: 6px; font-size: 10px; color: #6B7280; padding: 4px; } "
            "QGroupBox::title { color: #6B7280; }"
        )
        adv_layout = QHBoxLayout(adv_box)
        adv_layout.setSpacing(16)

        self.headlessCheck = QCheckBox("headless 모드 (브라우저 숨기기)")
        self.headlessCheck.setChecked(False)
        adv_layout.addWidget(self.headlessCheck)

        adv_layout.addWidget(QLabel("상품 간 대기 (초):"))

        self.delayMinSpin = QDoubleSpinBox()
        self.delayMinSpin.setRange(0.0, 60.0)
        self.delayMinSpin.setValue(5.0)
        self.delayMinSpin.setSingleStep(1.0)
        self.delayMinSpin.setFixedWidth(64)
        adv_layout.addWidget(QLabel("최소"))
        adv_layout.addWidget(self.delayMinSpin)

        self.delayMaxSpin = QDoubleSpinBox()
        self.delayMaxSpin.setRange(0.0, 60.0)
        self.delayMaxSpin.setValue(10.0)
        self.delayMaxSpin.setSingleStep(1.0)
        self.delayMaxSpin.setFixedWidth(64)
        adv_layout.addWidget(QLabel("최대"))
        adv_layout.addWidget(self.delayMaxSpin)

        adv_layout.addWidget(QLabel("수집 수 (최대):"))
        self.maxCandSpin = QSpinBox()
        self.maxCandSpin.setRange(5, 100)
        self.maxCandSpin.setValue(40)
        self.maxCandSpin.setFixedWidth(56)
        adv_layout.addWidget(self.maxCandSpin)

        adv_layout.addStretch()
        layout.addWidget(adv_box)

        self.naverCheck.stateChanged.connect(self._update_ui_state)
        return box

    def _make_run_card(self) -> QGroupBox:
        box = QGroupBox("실행")
        layout = QVBoxLayout(box)
        layout.setSpacing(8)

        btn_row = QHBoxLayout()
        self.btnStart = QPushButton("조회 시작")
        self.btnStart.setObjectName("btnStart")
        self.btnStart.clicked.connect(self._start_search)

        self.btnStop = QPushButton("중지")
        self.btnStop.setObjectName("btnStop")
        self.btnStop.setEnabled(False)
        self.btnStop.clicked.connect(self._stop_search)

        self.btnOpen = QPushButton("결과 파일 열기")
        self.btnOpen.setObjectName("btnOpen")
        self.btnOpen.setEnabled(False)
        self.btnOpen.clicked.connect(self._open_result)

        btn_row.addWidget(self.btnStart)
        btn_row.addWidget(self.btnStop)
        btn_row.addSpacing(16)
        btn_row.addWidget(self.btnOpen)
        btn_row.addStretch()
        layout.addLayout(btn_row)

        self.progressBar = QProgressBar()
        self.progressBar.setValue(0)
        layout.addWidget(self.progressBar)

        self.statusLabel = QLabel("")
        self.statusLabel.setObjectName("statusLabel")
        layout.addWidget(self.statusLabel)

        return box

    def _make_log_card(self) -> QGroupBox:
        box = QGroupBox("로그")
        layout = QVBoxLayout(box)
        self.logBox = QTextEdit()
        self.logBox.setObjectName("logBox")
        self.logBox.setReadOnly(True)
        self.logBox.setMinimumHeight(180)
        layout.addWidget(self.logBox)
        return box

    # ── 상태 관리 ──────────────────────────────────────────────────────────────

    def _update_ui_state(self, *_):
        is_running = self._worker is not None and self._worker.isRunning()

        input_path = self.inputPathEdit.text().strip()
        output_dir = self.outputDirEdit.text().strip()

        input_valid = (
            bool(input_path)
            and os.path.isfile(input_path)
            and input_path.lower().endswith((".xlsx", ".xls"))
        )
        output_valid = bool(output_dir) and os.path.isdir(output_dir)
        naver_on = self.naverCheck.isChecked()

        can_start = input_valid and output_valid and naver_on and not is_running

        if is_running:
            status = "조회 중입니다..."
        elif not input_path:
            status = "입력 엑셀 파일을 선택해주세요."
        elif not input_valid:
            status = "입력 파일을 확인해주세요. (.xlsx / .xls만 허용)"
        elif not output_valid:
            status = "저장 위치를 선택해주세요."
        elif not naver_on:
            status = "네이버 가격비교 조회를 활성화해주세요."
        else:
            status = "조회를 시작할 수 있습니다."

        if not self._custom_status:
            self.statusLabel.setText(status)

        self.btnStart.setEnabled(can_start)
        self.btnStop.setEnabled(is_running)

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
        input_path = self.inputPathEdit.text().strip()
        output_dir = self.outputDirEdit.text().strip() or os.path.dirname(input_path)

        delay_min = self.delayMinSpin.value()
        delay_max = max(self.delayMaxSpin.value(), delay_min)

        config = AppConfig(
            use_naver=self.naverCheck.isChecked(),
            playwright_headless=self.headlessCheck.isChecked(),
            delay_min=delay_min,
            delay_max=delay_max,
            max_candidates=self.maxCandSpin.value(),
        )

        if self._worker is not None:
            if self._worker.isRunning():
                self._worker.stop()
            self._worker.quit()
            self._worker.wait(3000)

        self._worker = SearchWorker(
            input_path=input_path,
            output_dir=output_dir,
            has_header=self.headerCheck.isChecked(),
            config=config,
        )
        self._worker.progress.connect(self._on_progress)
        self._worker.log.connect(self._on_log)
        self._worker.finished.connect(self._on_finished)

        self.btnOpen.setEnabled(False)
        self.progressBar.setValue(0)
        self.logBox.clear()
        self._custom_status = ""
        self._worker.start()
        self._update_ui_state()
        self._log("조회를 시작합니다.", "info")

    def _stop_search(self):
        if self._worker:
            self._worker.stop()
        self._update_ui_state()

    def _on_progress(self, current: int, total: int):
        self.progressBar.setMaximum(total)
        self.progressBar.setValue(current)
        self.statusLabel.setText(f"조회 중... ({current} / {total})")

    def _on_log(self, message: str, level: str):
        self._log(message, level)

    def _on_finished(self, path: str):
        self._result_path = path
        if path:
            self.btnOpen.setEnabled(True)
            self._log(f"조회가 완료되었습니다. 저장 위치: {path}", "info")
            self._custom_status = "조회가 완료되었습니다."
        else:
            self._log("완료되었으나 저장 파일이 없습니다.", "warn")
            self._custom_status = "완료 (저장 실패)"
        self._update_ui_state()
        self.statusLabel.setText(self._custom_status)

    def _open_result(self):
        if self._result_path and os.path.exists(self._result_path):
            os.startfile(self._result_path)

    def _log(self, message: str, level: str = "info"):
        colors = {"info": "#111827", "warn": "#B45309", "error": "#DC2626"}
        color = colors.get(level, "#111827")
        self.logBox.append(
            f'<span style="color:{color}; font-family:Consolas,맑은 고딕; font-size:10pt;">'
            f'{message}</span>'
        )
        sb = self.logBox.verticalScrollBar()
        sb.setValue(sb.maximum())
