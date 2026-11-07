"""Convert data/source/hanmogeum-data.xlsx into the JSON files the app reads.

Usage (from the repo root):
    python3 -m venv .venv && .venv/bin/pip install openpyxl
    .venv/bin/python tools/xlsx_to_json.py
"""
import json
import pathlib
import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "source" / "hanmogeum-data.xlsx"
OUT = ROOT / "data"

AXES = ["sweet", "sour", "bitter", "fizz", "body", "alc",
        "fruit", "flower", "grain", "wood", "smoke", "herb"]
AXIS_COLS = ["단맛", "신맛", "쓴맛", "탄산", "바디감", "알코올 느낌",
             "과일 향", "꽃 향", "곡물 향", "나무 향", "연기 향", "허브 향"]


def rows(ws):
    it = ws.iter_rows(values_only=True)
    head = [h for h in next(it)]
    for r in it:
        if r[0] is None or all(c is None for c in r):
            continue
        d = dict(zip(head, r))
        yield d


def main():
    wb = openpyxl.load_workbook(SRC, data_only=True)

    drinks = []
    for d in rows(wb["술 목록"]):
        if not str(d["ID"]).strip() or d.get("이름") is None:
            continue
        drinks.append({
            "id": d["ID"],
            "category": d["분류"],
            "name": d["이름"],
            "origin": d["산지"],
            "abvLabel": d["도수 표기"],
            "abv": float(d["도수 숫자"]),
            "taste": {a: int(d[c] or 0) for a, c in zip(AXES, AXIS_COLS)},
            "oneLine": d["비유 한 줄"],
            "aroma": d["향"],
            "flavor": d["맛"],
            "feel": d["느낌"],
            "vsSoju": d["소주와 비교"],
            "ingredients": d["원료"],
            "process": d["만드는 방법"],
            "aging": d["숙성"],
            "glossary": d["쉬운 용어 설명"],
            "caution": d["아쉬울 수 있는 점"],
            "verified": d.get("확인 상태") == "확인 완료",
            "sourceUrl": d.get("출처 URL"),
        })

    bars = {}
    for d in rows(wb["샘플 바 (가상)"]):
        if d.get("바 이름") is None:
            continue
        b = bars.setdefault(d["바 ID"], {
            "id": d["바 ID"], "name": d["바 이름"], "area": d["지역"],
            "distance": d["거리"], "hours": d["영업시간"], "pours": [],
        })
        b["pours"].append({
            "drinkId": d["술 ID"], "ml": int(d["용량(mL)"]),
            "price": int(d["가격(원)"]), "openedDays": int(d["개봉 며칠째"]),
            "lastToday": d["오늘 소진 예정"] == "예",
        })

    ws = wb["후기 칩과 샘플 후기"]
    chips, reviews, mode = [], [], "chips"
    for r in ws.iter_rows(values_only=True):
        if r[0] is None:
            continue
        if r[0] == "후기 칩":
            continue
        if str(r[0]).startswith("샘플 후기"):
            mode = "skip"
            continue
        if r[0] == "술 ID":
            mode = "reviews"
            continue
        if mode == "chips":
            chips.append({"label": r[0], "axis": r[1]})
        elif mode == "reviews":
            reviews.append({
                "drinkId": r[0],
                "chips": [c.strip() for c in str(r[1]).split(",") if c.strip()],
                "text": r[2], "reaction": r[3], "sample": True,
            })

    def dump(name, obj):
        (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{name}: {len(obj)}")

    dump("drinks.json", drinks)
    dump("bars.json", list(bars.values()))
    dump("chips.json", chips)
    dump("reviews.json", reviews)


if __name__ == "__main__":
    main()
