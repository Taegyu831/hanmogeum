"""배포 전에 실행: 파일 주소에 버전 번호를 붙여 휴대폰 브라우저가 예전 파일을 쓰지 않게 한다.

GitHub Pages는 파일을 10분간 캐시하게 해서, 새로고침해도 예전 화면이 남을 수 있다.
사용법: python3 tools/bump_version.py  (그다음 커밋하고 push)
"""
import re
import time
from pathlib import Path

root = Path(__file__).resolve().parent.parent
v = time.strftime("%m%d%H%M")

html = root / "index.html"
s = html.read_text()
s = re.sub(r'(css/style\.css|js/app\.js)(\?v=\w+)?"', rf'\1?v={v}"', s)
html.write_text(s)

app = root / "js" / "app.js"
s = app.read_text()
s = re.sub(r'from "\./(\w+)\.js(\?v=\w+)?"', rf'from "./\1.js?v={v}"', s)
s = re.sub(r"`data/\$\{f\}(\?v=\w+)?`", f"`data/${{f}}?v={v}`", s)
app.write_text(s)
print("version", v)
