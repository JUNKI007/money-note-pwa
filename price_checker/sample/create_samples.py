"""샘플 입력 엑셀 생성 스크립트. python -m price_checker.sample.create_samples"""
import os
import pandas as pd

def create_sample_input():
    data = {
        "상품코드": ["A001", "A002", "A003", "A004", "A005"],
        "상품명": [
            "지오마 화이트머스크 600g",
            "지오마 피치코코 600g",
            "마르마르디 네롤리 핸드크림 50ml",
            "마르마르디 바닐라머스크 핸드크림 50ml",
            "라운드어라운드 그린티 수분크림 80ml",
        ],
    }
    out = os.path.join(os.path.dirname(__file__), "sample_input.xlsx")
    pd.DataFrame(data).to_excel(out, index=False)
    print(f"샘플 입력 파일 생성: {out}")

if __name__ == "__main__":
    create_sample_input()
