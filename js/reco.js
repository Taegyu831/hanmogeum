// Rule based recommendation. Mirrors the sheets "답변 변환표", "점수 계산 규칙"
// and "설명 문구 틀" in data/source/hanmogeum-data.xlsx.

export const AXES = ["sweet", "sour", "bitter", "fizz", "body", "alc",
  "fruit", "flower", "grain", "wood", "smoke", "herb"];

export const AXIS_LABEL = {
  sweet: "단맛", sour: "신맛", bitter: "쓴맛", fizz: "탄산", body: "바디감", alc: "알코올 느낌",
  fruit: "과일", flower: "꽃", grain: "곡물", wood: "나무", smoke: "연기", herb: "허브",
};

// Q1: familiar drinks. Each adds to the preference vector.
export const Q1 = [
  { id: "americano", label: "아메리카노", sub: "쌉싸름하고 고소해요", color: "var(--c-wood)", add: { bitter: 2, grain: 1, wood: 2, body: 1 } },
  { id: "peachtea", label: "복숭아 아이스티", sub: "달콤하고 향긋해요", color: "var(--c-fruit)", add: { sweet: 2, fruit: 2, flower: 1 } },
  { id: "soda", label: "탄산음료", sub: "톡톡 시원해요", color: "var(--c-citrus)", add: { fizz: 3, sweet: 1 } },
  { id: "latte", label: "우유·라떼", sub: "부드럽고 고소해요", color: "var(--c-grain)", add: { sweet: 1, body: 2, grain: 2 } },
  { id: "juice", label: "과일주스", sub: "새콤달콤해요", color: "var(--c-berry)", add: { sour: 1, fruit: 3, sweet: 1 } },
  { id: "herbtea", label: "허브티", sub: "은은한 풀 향이에요", color: "var(--c-herb)", add: { herb: 3, flower: 1 } },
];

// Q2: what was off about soju and beer. Penalties.
export const Q2 = [
  { id: "bitter", label: "너무 써요" },
  { id: "alcsmell", label: "알코올 향이 세요" },
  { id: "full", label: "금방 배불러요" },
  { id: "same", label: "맛이 다 비슷해요" },
  { id: "hangover", label: "다음 날이 걱정돼요" },
  { id: "drunk", label: "빨리 취해요" },
  { id: "noisy", label: "분위기가 시끄러워요" },
  { id: "none", label: "특별히 없어요" },
];

// Q3: how to meet a new drink. Changes emphasis, not much scoring.
export const Q3 = [
  { id: "taste", label: "일단 한 잔만 맛볼래요", sub: "근처 바에서 10~30mL씩 가볍게" },
  { id: "home", label: "집에서 천천히 마셔볼래요", sub: "사기 전에 후기와 맛 설명부터 볼게요" },
  { id: "friends", label: "친구들과 같이 가볼래요", sub: "함께 나눠 마시기 좋은 술 위주로" },
];

export function emptyPrefs() {
  return Object.fromEntries(AXES.map((a) => [a, 0]));
}

export function prefsFromAnswers(q1) {
  const p = emptyPrefs();
  const picks = q1.length ? q1 : Q1.map((q) => q.id); // skipped: a little of everything
  for (const id of picks) {
    const q = Q1.find((x) => x.id === id);
    if (!q) continue;
    for (const [a, v] of Object.entries(q.add)) p[a] += v;
  }
  if (!q1.length) for (const a of AXES) p[a] = p[a] / Q1.length;
  return p;
}

export function scoreDrink(d, prefs, q2 = [], q3 = null) {
  let s = 0;
  for (const a of AXES) s += d.taste[a] * prefs[a];
  const t = d.taste;
  if (q2.includes("bitter")) s -= t.bitter >= 4 ? 6 : t.bitter === 3 ? 2 : 0;
  if (q2.includes("alcsmell")) s -= t.alc >= 4 ? 4 : t.alc === 3 ? 1 : 0;
  if (q2.includes("full") && t.fizz >= 4) s -= 2;
  if ((q2.includes("hangover") || q2.includes("drunk")) && d.abv > 15) s -= 15;
  if (q3 === "friends" && t.fizz >= 3 && d.abv <= 15) s += 1;
  return Math.round(s * 10) / 10;
}

export function rank(drinks, prefs, q2 = [], q3 = null) {
  const scored = drinks
    .map((d) => ({ d, s: scoreDrink(d, prefs, q2, q3) }))
    .sort((a, b) => b.s - a.s);
  if (q2.includes("same")) diversify(scored, 5, 2);
  return scored.map((x) => x.d.id);
}

// Keep at most `max` of one category inside the top `n`.
function diversify(list, n, max) {
  for (let i = 0; i < n && i < list.length; i++) {
    const count = list.slice(0, i).filter((x) => x.d.category === list[i].d.category).length;
    if (count >= max) {
      const j = list.findIndex((x, k) => k > i &&
        list.slice(0, i).filter((y) => y.d.category === x.d.category).length < max);
      if (j > 0) list.splice(i, 0, list.splice(j, 1)[0]);
    }
  }
}

// 끌려요 +0.3 x drink vector, 패스 -0.2 x drink vector.
export function nudge(prefs, drink, liked) {
  const k = liked ? 0.3 : -0.2;
  const p = { ...prefs };
  for (const a of AXES) p[a] = Math.max(0, Math.round((p[a] + k * drink.taste[a]) * 100) / 100);
  return p;
}

// Taste type name, e.g. "달콤 상큼 탄산파".
const TYPE_WORD = {
  fizz: ["톡톡", "탄산파"], sweet: ["달콤", "단맛파"], sour: ["새콤", "상큼파"],
  bitter: ["쌉쌀", "쌉쌀파"], body: ["묵직", "진한맛파"], alc: ["화끈", "독주파"],
  fruit: ["상큼", "과일향파"], flower: ["향긋", "꽃향파"], grain: ["고소", "고소파"],
  wood: ["은은", "나무향파"], smoke: ["스모키", "연기향파"], herb: ["싱그런", "허브향파"],
};
const TIE_ORDER = ["fizz", "grain", "herb", "body", "sweet", "fruit", "sour", "bitter", "flower", "wood", "smoke", "alc"];

export function tasteType(prefs) {
  const top = [...AXES].sort((a, b) => prefs[b] - prefs[a] || TIE_ORDER.indexOf(a) - TIE_ORDER.indexOf(b));
  const [n, a1, a2] = top;
  const adj = [a1, a2].filter((a) => prefs[a] > 0).map((a) => TYPE_WORD[a][0]);
  if (prefs[n] <= 0) return "골고루 탐험파";
  return [...adj, TYPE_WORD[n][1]].join(" ");
}

export function typeBlurb(prefs) {
  const t = prefs;
  const parts = [];
  if (t.sweet + t.fruit >= 3) parts.push("과일 향이 있는 부드러운 술");
  if (t.fizz >= 2) parts.push("톡 쏘는 탄산이 있는 술");
  if (t.bitter + t.wood >= 3) parts.push("쌉싸름하고 나무 향이 나는 술");
  if (t.grain >= 2) parts.push("고소한 곡물 향의 술");
  if (t.herb >= 2) parts.push("허브 향이 싱그러운 술");
  const head = parts.slice(0, 2).join(", ") || "여러 종류의 술";
  return `소주보다 ${head}부터 보여드릴게요.`;
}

// Top bars on the result screen: aroma and taste, normalized.
export function typeBars(prefs, n = 4) {
  const max = Math.max(...AXES.map((a) => prefs[a]), 1);
  return [...AXES].sort((a, b) => prefs[b] - prefs[a]).slice(0, n)
    .map((a) => ({ axis: a, label: AXIS_LABEL[a], pct: Math.round((prefs[a] / max) * 100) }));
}

// "왜 나에게 맞을까요?" and "아쉬울 수 있는 점".
export function explain(d, answers) {
  const why = [];
  const t = d.taste;
  const q1 = answers.q1 || [];
  const q2 = answers.q2 || [];
  // Q1 drink whose vector overlaps this drink the most.
  let best = null, bestS = 0;
  for (const id of q1) {
    const q = Q1.find((x) => x.id === id);
    if (!q) continue;
    let s = 0;
    for (const [a, v] of Object.entries(q.add)) s += v * t[a];
    if (s > bestS) { best = q; bestS = s; }
  }
  if (best && bestS >= 10) why.push(`${best.label}를 좋아한다고 하셨어요.`);
  if (q2.includes("bitter") && t.bitter <= 2) why.push("쓴맛이 거의 없어서 부담이 적어요.");
  if (q2.includes("alcsmell") && t.alc <= 2) why.push("알코올 향이 도드라지지 않아요.");
  if (d.abv <= 8) why.push("도수가 낮아서 가볍게 시작하기 좋아요.");
  if (!why.length) why.push(d.vsSoju);

  const risk = [];
  if (t.sweet === 5) risk.push("단맛이 부담스러운 날엔 아쉬울 수 있어요.");
  if (t.sour === 5) risk.push("새콤함이 강해서 처음엔 시게 느껴질 수 있어요.");
  if (t.bitter >= 4) risk.push("쌉쌀함이 낯설 수 있어요.");
  if (t.alc === 5) risk.push("도수가 높아서 조금씩 천천히 마시는 게 좋아요.");
  if (t.smoke >= 4) risk.push("연기 향이 강해서 호불호가 갈려요.");
  if (t.fizz === 0 && q1.includes("soda")) risk.push("탄산이 없어서 톡 쏘는 맛을 기대하면 아쉬워요.");
  if (!risk.length) risk.push(d.caution);
  return { why: why.slice(0, 2), risk: risk.slice(0, 1) };
}
