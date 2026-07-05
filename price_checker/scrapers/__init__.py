import sys
import os
# scrapers 패키지가 임포트될 때 price_checker 폴더를 sys.path에 추가
_pkg_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _pkg_root not in sys.path:
    sys.path.insert(0, _pkg_root)
