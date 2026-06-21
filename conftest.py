import sys
import os

# D:\claude\price_checker 를 sys.path에 추가 → scrapers/base.py 등의 'from models import ...' 해결
_pkg_dir = os.path.join(os.path.dirname(__file__), "price_checker")
if _pkg_dir not in sys.path:
    sys.path.insert(0, _pkg_dir)

# D:\claude 를 sys.path에 추가 → 'from price_checker.X import Y' 해결
_root_dir = os.path.dirname(__file__)
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)
