import { state, save, reset } from "./store.js?v=11151148";
import { AXES, Q1, Q2, Q3, prefsFromAnswers, rank, nudge, tasteType, typeBlurb, typeBars, explain } from "./reco.js?v=11151148";
import { createNav, swallowClick } from "./nav.js?v=11151148";
import { buzz, burst } from "./fx.js?v=11151148";
import { C, logoSVG, pourLogo, glyph, drinkArt, icon, stepGlass, reduceMotion, FOS } from "./brand.js?v=11151148";

// 화면 모습과 흐름은 안드로이드 앱(design/ui-refresh)과 같게 맞췄다.
// 웹에서만 정한 것: 예약하기(평가용 완료 알림), 후기, 내 기록, 아래 탭 막대.

const app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const won = (n) => n.toLocaleString("ko-KR") + "원";

/* ---------- 데이터 ---------- */
const load = (f) => fetch(`data/${f}?v=11151148`).then((r) => r.json());
const [DRINKS, BARS, CHIPS, SAMPLE_REVIEWS] = await Promise.all(
  ["drinks.json", "bars.json", "chips.json", "reviews.json"].map(load));
const drinkById = Object.fromEntries(DRINKS.map((d) => [d.id, d]));
const barById = Object.fromEntries(BARS.map((b) => [b.id, b]));

// 질문 문구는 앱과 같게.
const Q2_EFFECT = {
  bitter: "쓴맛이 강한 술은 추천 순위를 낮춰요",
  alcsmell: "알코올 느낌이 덜 도드라지는 술을 먼저 보여줘요",
  full: "탄산이 과하게 강한 술은 순위를 조정해요",
  same: "상위 추천에 다양한 주종이 고르게 섞이도록 구성해요",
  hangover: "도수가 높은 술(15% 초과)의 우선순위를 낮춰요",
  drunk: "가볍게 마시기 좋은 저도수 주류를 우선 추천해요",
  noisy: "차분히 맛과 향을 음미하기 좋은 주류를 탐색해요",
  none: "감점 조건 없이 좋아하는 음료 취향 중심으로 추천해요",
};
const Q3_SUB = {
  taste: "근처 바에서 10~30mL씩 가볍게 (가상 시음 시나리오)",
  home: "사기 전에 후기와 쉬운 맛 설명부터 살펴볼게요",
  friends: "함께 가볍게 나눠 마시기 좋은 청량한 술 위주로",
};
const BAR_TONES = ["#8B2744", "#B04A5E", "#6E3A5E", "#A85A3C"]; // 맛 막대 색 (와인, 로제, 자두, 호박)
const TINT = {
  와인: "#F6E3E8", 스파클링: "#F7EFD9", 맥주: "#F8ECD3", 전통주: "#F0EBDD", 사케: "#EEF0EA",
  위스키: "#F4E6DA", 브랜디: "#F4E6DA", 진: "#E9EFEC", 럼: "#E9EFEC", 데킬라: "#E9EFEC",
};
const UNPROVIDED = "정보 없음 (원본 데이터 미기재)";
const HEART_SPARKS = [C.primary, "#B04A5E", C.primaryContainer];

/* ---------- 바와 시음 메뉴 (앱 NearbyModels와 같은 계산) ---------- */
const minutesOf = (b) => parseInt(String(b.distance).replace(/\D/g, ""), 10) || 10;
const menusOf = (b) => b.pours.map((p) => ({ ...p, id: `${b.id}_${p.drinkId}_${p.ml}`, bar: b, drink: drinkById[p.drinkId] }));
const menuById = (id) => { const b = barById[String(id).split("_")[0]]; return b && menusOf(b).find((m) => m.id === id); };
const drinksOf = (b) => [...new Set(b.pours.map((p) => p.drinkId))].map((id) => drinkById[id]).filter(Boolean);
const catsOf = (b) => [...new Set(drinksOf(b).map((d) => d.category))];
function volRange(ms) {
  const v = ms.map((m) => m.ml);
  const a = Math.min(...v), z = Math.max(...v);
  return a === z ? `${a}mL` : `${a}~${z}mL`;
}
function priceRange(ms) {
  const v = ms.map((m) => m.price);
  const a = Math.min(...v), z = Math.max(...v);
  return a === z ? `예시 ${won(a)}` : `예시 ${won(a)} ~ ${won(z)}`;
}
const volNote = (m) => (m.ml >= 10 && m.ml <= 30 ? `소량 시음 (${m.ml}mL)` : `잔 단위 예외 시음 (${m.ml}mL · 원본 주석 기준)`);
const openedLabel = (m) => (m.openedDays === 0 ? "당일 개봉·즉석 조제 시나리오 (0일째)" : `개봉 ${m.openedDays}일째 시나리오`);
const statusNote = (m) => (m.lastToday ? "시나리오 표기: 오늘 소진 예정 예시 (실시간 재고 아님)" : "시나리오 표기: 일반 시음 예시 (실시간 재고 아님)");
const ABV_NOTE = {
  H4: "도수 구분 안내: 위스키 원액 도수는 약 40%이지만, 탄산수를 섞은 완성 하이볼 음료의 실제 음용 도수는 약 7~9%예요.",
  H5: "도수 구분 안내: '진토닉용'으로 표기된 런던 드라이 진이며, 표기된 도수(약 40~47%)와 맛 점수는 토닉워터를 섞기 전 진 원액 기준이에요.",
};
const barsFor = (id) => BARS.filter((b) => b.pours.some((p) => p.drinkId === id));
const CATEGORIES = [...new Set(BARS.flatMap((b) => catsOf(b)))];

/* ---------- 취향 유형 둘러보기 ---------- */
// 질문 없이 고를 수 있는 대표 유형 12개. 앞의 8개는 한 가지 맛이 뚜렷한 유형, 뒤의 4개는 섞인 유형.
const TYPES = [
  { id: "sweet", name: "단맛파", line: "디저트처럼 달콤한 술이 편해요", prefs: { sweet: 3, fruit: 1 } },
  { id: "sour", name: "상큼파", line: "새콤한 과일 맛에 먼저 손이 가요", prefs: { sour: 2, fruit: 3 } },
  { id: "fizz", name: "탄산파", line: "톡 쏘는 청량감이 제일 중요해요", prefs: { fizz: 3, sweet: 1 } },
  { id: "flower", name: "꽃향파", line: "한 모금에 꽃 향이 퍼지는 술이 좋아요", prefs: { flower: 3, fruit: 1 } },
  { id: "grain", name: "고소파", line: "구운 곡물처럼 고소한 맛이 좋아요", prefs: { grain: 3, body: 1 } },
  { id: "bitter", name: "쌉쌀파", line: "커피처럼 쌉쌀하고 나무 향이 은은한 쪽", prefs: { bitter: 2, wood: 2 } },
  { id: "body", name: "진한맛파", line: "묵직하고 존재감 있는 한 잔", prefs: { body: 3, alc: 2 } },
  { id: "smoke", name: "스모키파", line: "연기와 허브 향, 개성 강한 술", prefs: { smoke: 3, herb: 2 } },
  { id: "sweetfizz", name: "달콤 톡톡파", line: "달콤한데 톡 쏘기까지 하면 최고", mixed: true, prefs: { sweet: 2, fizz: 2, fruit: 1 } },
  { id: "fruitflower", name: "상큼 향긋파", line: "과일 향과 꽃 향이 함께 나는 가벼운 술", mixed: true, prefs: { fruit: 2, flower: 2, sour: 1 } },
  { id: "grainwood", name: "고소 은은파", line: "고소함 뒤에 나무 향이 은은하게 남는 술", mixed: true, prefs: { grain: 2, wood: 2, body: 1 } },
  { id: "all", name: "골고루 탐험파", line: "아직 모르겠다면 여러 종류부터 맛보기", mixed: true, prefs: { sweet: 1, sour: 1, bitter: 1, fizz: 1, body: 1, fruit: 1, flower: 1, grain: 1, wood: 1, herb: 1 } },
];
const typeById = (id) => TYPES.find((t) => t.id === id);
const typePrefs = (t) => Object.fromEntries(AXES.map((a) => [a, t.prefs[a] || 0]));
const presetType = () => (state.preset ? typeById(state.preset) : null);
const basePrefsNow = () => (presetType() ? typePrefs(presetType()) : prefsFromAnswers(state.answers.q1));

/* ---------- 상태 ---------- */
function ensureRecs() {
  if (!state.prefs) {
    state.prefs = state.basePrefs = basePrefsNow();
    state.fb = [];
    state.order = rank(DRINKS, state.prefs, state.answers.q2, state.answers.q3);
    save();
  }
  if (!state.order.length) state.order = rank(DRINKS, state.prefs, state.answers.q2, state.answers.q3);
}
// 결과 화면 순위 (처음 답 기준, 반응으로 바뀌지 않음)
const resultRank = () => rank(DRINKS, state.basePrefs || basePrefsNow(), state.answers.q2, state.answers.q3);
const typeName = () => presetType()?.name || (state.answers.q1.length ? tasteType(state.prefs || prefsFromAnswers(state.answers.q1)) : "골고루 탐험파");
const reasonText = (d) => explain(d, state.answers).why.join(" ");
const cautionText = (d) => explain(d, state.answers).risk[0] || "";

// 끌려요, 패스, 후기를 순서대로 기록해 두고 처음 취향에서 다시 계산한다.
// 그래서 끌려요나 패스를 취소하면 그 반응이 없었던 것처럼 취향이 돌아간다.
function recompute() {
  let p = state.basePrefs || state.prefs;
  for (const e of state.fb) { const d = drinkById[e.id]; if (d) p = nudge(p, d, e.v); }
  state.prefs = p;
}
function setFeedback(id, v, src = "feed") {
  if (!state.basePrefs) state.basePrefs = state.prefs || prefsFromAnswers(state.answers.q1);
  state.fb = state.fb.filter((e) => !(e.id === id && e.src !== "review"));
  state.liked = state.liked.filter((x) => x !== id);
  state.passed = state.passed.filter((x) => x !== id);
  if (v !== null) {
    state.fb.push({ id, v, src });
    (v ? state.liked : state.passed).push(id);
  }
  recompute();
  save();
}
let feedDirty = false; // 맛 카드나 후기에서 반응이 바뀌면 피드로 돌아갈 때 다음 잔 순서를 다시 정한다

/* ---------- 라우터 ---------- */
function parse(hash = location.hash) {
  const h = hash.replace(/^#/, "") || "/";
  const [path, qs] = h.split("?");
  return { path, parts: path.split("/").filter(Boolean), q: new URLSearchParams(qs || "") };
}
const TAB_ROOTS = ["feed", "nearby", "log"];
const isTabRoot = (path) => {
  const p = path.split("/").filter(Boolean);
  return p.length === 1 && TAB_ROOTS.includes(p[0]);
};
function parentOf(hash) {
  const { parts, q } = parse(hash);
  switch (parts[0]) {
    case "card": return "#/feed";
    case "nearby": return parts[1] ? "#/nearby" : null;
    case "bar": return q.get("drink") ? `#/nearby/${q.get("drink")}` : "#/nearby";
    case "try": return `#/bar/${parts[1]}`;
    case "review": return `#/card/${parts[1]}`;
    case "q": return Number(parts[1]) > 1 ? `#/q/${Number(parts[1]) - 1}` : "#/";
    case "result": return state.preset ? "#/types" : "#/q/3";
    case "types": return "#/";
    default: return null;
  }
}

let feedKeep = null;
function dropFeed() { feedKeep?.el.remove(); feedKeep = null; }
function backFilter(e) {
  if (e.clientX - app.getBoundingClientRect().left < 28) return true;
  return !e.target.closest("[data-noswipe], input, textarea, .hrow");
}
function build(hash) {
  const r = parse(hash);
  const key = r.parts[0] || "";
  if (key === "feed" && feedKeep?.el.isConnected) { feedKeep.show(); return feedKeep.el; }
  const fn = ROUTES[key] || start;
  const view = fn(r);
  if (!view) return null;
  const tpl = document.createElement("template");
  tpl.innerHTML = view.html.trim();
  const el = tpl.content.firstElementChild;
  app.append(el);
  view.mount?.(el);
  if (key === "feed") feedKeep = { el, show: () => view.show?.(el) };
  if (key && !isTabRoot(r.path)) nav.drag(el, { dir: "back", target: () => nav.prevHash(), filter: backFilter });
  return el;
}
const nav = createNav({ root: app, build, parentOf, isTabRoot, keep: (el) => el === feedKeep?.el });
const go = (hash, opts) => nav.go(hash, opts);
const back = (fallback) => nav.back(fallback);
const render = () => nav.refresh();

/* ---------- 공통 조각 ---------- */
const toastEl = document.createElement("div");
toastEl.className = "toast";
toastEl.setAttribute("role", "status");
app.append(toastEl);
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1900);
}

function tabbar(active) {
  const tab = (id, href, ico, label) =>
    `<a href="${href}" class="${active === id ? "on" : ""}" ${active === id ? 'aria-current="page"' : ""}><span class="ico">${ico}</span>${label}</a>`;
  return `<nav class="tabbar" aria-label="메뉴">
    ${tab("feed", "#/feed", icon.compass, "탐색")}
    ${tab("nearby", "#/nearby", icon.pinLine, "근처 한 잔")}
    ${tab("log", "#/log", icon.book, "내 기록")}
  </nav>`;
}
const topbar = (title, { backLabel = "뒤로", trailing = "", noBack = false } = {}) => `<header class="topbar">
  ${noBack ? "" : `<button class="icon-btn" data-back aria-label="${backLabel}">${icon.back()}</button>`}
  <h1 class="title ${noBack ? "pad-l" : ""}">${title}</h1>${trailing}</header>`;
const infoRow = (label, value, w72 = false) => `<div class="info-row ${w72 ? "w72" : ""}"><b>${esc(label)}</b><span>${esc(value)}</span></div>`;
const virtualNote = () => `<p class="virtual-note"><span class="i" aria-hidden="true">i</span>바·가격·개봉일은 평가용 가상 데이터예요. 실제 예약·결제는 없어요.</p>`;
function bindBack(el) { el.querySelector("[data-back]")?.addEventListener("click", () => back()); }

/* ---------- A. 시작 ---------- */
function start() {
  return {
    html: `<section class="screen start">
      <div class="sp"></div>
      ${logoSVG(136, { fill: 0 })}
      <div class="reveal"><div class="center">
        <h1 class="brand">한모금</h1>
        <p class="lead">소주 맥주 너머,<br>내 입맛의 첫 한 모금</p>
      </div></div>
      <div class="sp"></div>
      <div class="reveal late"><div class="actions">
        <a class="btn btn-p" href="#/q/1" data-startq>내 취향 찾기</a>
        <a class="btn-t" href="#/types">어떤 유형이 있는지 둘러보기</a>
      </div></div>
    </section>`,
    mount(el) {
      pourLogo(el.querySelector("svg.logo"), { fromSplash: true, onSettled: () => el.classList.add("on") });
      el.querySelector("[data-startq]").addEventListener("click", () => {
        state.answers = { q1: [], q2: [], q3: null };
        state.skipped = false;
        state.preset = null;
        save();
      });
    },
  };
}

/* ---------- A. 질문 3개 ---------- */
let justAnswered = false;
function question({ parts }) {
  const n = Math.min(3, Math.max(1, Number(parts[1]) || 1));
  const a = state.answers;
  const cfg = {
    1: { title: "평소 좋아하는\n음료는 뭐예요?", helper: "여러 개 골라도 좋아요.", skip: "건너뛰기" },
    2: { title: "소주나 맥주,\n어떤 점이 아쉬웠나요?", helper: "고른 만큼 추천에 반영돼요. 없으면 그냥 넘어가도 괜찮아요.", skip: "건너뛰기" },
    3: { title: "새로운 술,\n어떻게 만나고 싶어요?", helper: "한 병을 다 사기 전에, 10~30mL로 먼저 맛보는 방법도 있어요.", skip: "결과 바로 보기" },
  }[n];
  let opts = "";
  if (n === 1) {
    opts = `<div class="tiles" role="group" aria-label="좋아하는 음료">${Q1.map((o) => `<button class="sel tile press" role="checkbox" aria-checked="${a.q1.includes(o.id)}" data-id="${o.id}">
      <span class="glyph">${glyph(o.id, 32)}</span><span class="t-tm">${o.label}</span><span class="t-bm c-v">${o.sub}</span>
      <span class="badge" aria-hidden="true">${icon.check(14)}</span></button>`).join("")}</div>`;
  } else if (n === 2) {
    opts = `<div class="reasons" role="group" aria-label="아쉬웠던 점">${Q2.map((o) => `<button class="sel reason press" role="checkbox" aria-checked="${a.q2.includes(o.id)}" data-id="${o.id}">
      <span class="row"><span class="lbl">${o.label}</span><span class="dot" aria-hidden="true">${icon.check(14)}</span></span>
      <span class="eff"><p>→ ${Q2_EFFECT[o.id] || ""}</p></span></button>`).join("")}</div>`;
  } else {
    opts = `<div class="radios" role="radiogroup" aria-label="새로운 술을 만나는 방식">${Q3.map((o) => `<button class="sel radio-card press" role="radio" aria-checked="${a.q3 === o.id}" data-id="${o.id}">
      <span class="glyph">${glyph(o.id, 32)}</span>
      <span class="grow stack" style="gap:2px"><span class="t-tm">${o.label}</span><span class="t-bm c-v">${Q3_SUB[o.id] || o.sub}</span></span>
      <span class="ring" aria-hidden="true"><i></i></span></button>`).join("")}</div>`;
  }
  const label = () => {
    if (n === 1) return a.q1.length ? `다음 · ${a.q1.length}개 골랐어요` : "음료를 골라 주세요";
    if (n === 2) return a.q2.length ? `다음 · ${a.q2.length}개 반영할게요` : "선택 없이 다음으로";
    return a.q3 ? "내 취향 결과 보기" : "하나를 골라 주세요";
  };
  const enabled = () => (n === 1 ? a.q1.length > 0 : n === 2 ? true : !!a.q3);
  return {
    html: `<section class="screen">
      <div class="q-head">
        <div class="row"><button class="icon-btn" data-back aria-label="이전으로">${icon.back()}</button><span class="grow"></span>
          <button class="btn-t v" data-skip>${cfg.skip}</button></div>
        <div class="progress" role="img" aria-label="전체 3개 질문 중 ${n}번째"><i style="width:${((n - 1) / 3) * 100}%"></i></div>
      </div>
      <div class="scroll"><div class="q-body">
        <p class="t-ll c-p">질문 ${n}</p>
        <h1 class="t-hl pre">${cfg.title}</h1>
        <p class="t-bl c-v helper">${cfg.helper}</p>
        <div class="opts">${opts}</div>
      </div></div>
      <div class="bottom"><button class="btn btn-p" data-next></button></div>
    </section>`,
    mount(el) {
      bindBack(el);
      requestAnimationFrame(() => requestAnimationFrame(() => (el.querySelector(".progress i").style.width = `${(n / 3) * 100}%`)));
      const nb = el.querySelector("[data-next]");
      const sync = () => { nb.textContent = label(); nb.disabled = !enabled(); };
      sync();
      el.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => {
        const id = b.dataset.id;
        buzz(5);
        if (n === 1) a.q1 = a.q1.includes(id) ? a.q1.filter((x) => x !== id) : [...a.q1, id];
        else if (n === 2) {
          if (id === "none") a.q2 = a.q2.includes("none") ? [] : ["none"];
          else a.q2 = a.q2.includes(id) ? a.q2.filter((x) => x !== id) : [...a.q2.filter((x) => x !== "none"), id];
        } else a.q3 = id;
        state.skipped = false;
        state.preset = null;
        save();
        el.querySelectorAll("[data-id]").forEach((x) => {
          const v = x.dataset.id;
          x.setAttribute("aria-checked", n === 1 ? a.q1.includes(v) : n === 2 ? a.q2.includes(v) : a.q3 === v);
        });
        sync();
      }));
      nb.onclick = () => {
        if (n < 3) go(`#/q/${n + 1}`);
        else { justAnswered = true; go("#/result"); }
      };
      el.querySelector("[data-skip]").onclick = () => {
        if (n === 1) a.q1 = [];
        if (n === 2) a.q2 = [];
        save();
        if (n === 3) { justAnswered = true; go("#/result"); } else go(`#/q/${n + 1}`);
      };
    },
  };
}

/* ---------- A. 유형 둘러보기 ---------- */
function types() {
  const row = (t) => {
    const picks = rank(DRINKS, typePrefs(t)).slice(0, 3).map((id) => drinkById[id]);
    return `<button class="type-row press" data-type="${t.id}" aria-label="${esc(t.name)}. ${esc(t.line)}. 대표 술 ${picks.map((d) => esc(d.name)).join(", ")}. 이 유형으로 추천 보기">
      <span class="arts" aria-hidden="true">${picks.map((d) => drinkArt(d, 22, 52)).join("")}</span>
      <span class="grow stack" style="gap:2px"><span class="t-tm">${esc(t.name)}</span><span class="t-bm c-v">${esc(t.line)}</span>
        <span class="t-bs c-p">${picks.map((d) => esc(d.name.replace(/\s*\(.*\)/, ""))).join(" · ")}</span></span>
      <span class="c-v" aria-hidden="true">${icon.chevronRight(18, 18)}</span></button>`;
  };
  return {
    html: `<section class="screen">
      ${topbar("취향 유형 둘러보기", { backLabel: "처음 화면으로" })}
      <div class="scroll"><div class="pad" style="padding-top:8px;padding-bottom:32px">
        <p class="t-bl c-v">질문 없이, 끌리는 유형을 골라 추천부터 볼 수 있어요.</p>
        <h2 class="t-ll c-v" style="margin-top:28px">한 가지 맛이 뚜렷한 유형</h2>
        <div>${TYPES.filter((t) => !t.mixed).map(row).join("")}</div>
        <h2 class="t-ll c-v" style="margin-top:32px">여러 맛이 섞인 유형</h2>
        <div>${TYPES.filter((t) => t.mixed).map(row).join("")}</div>
        <a class="btn btn-p" href="#/q/1" data-startq style="margin-top:32px">질문으로 내 유형 찾기</a>
      </div></div>
    </section>`,
    mount(el) {
      bindBack(el);
      el.querySelectorAll("[data-type]").forEach((b) => (b.onclick = () => {
        state.answers = { q1: [], q2: [], q3: null };
        state.preset = b.dataset.type;
        state.skipped = false;
        state.basePrefs = null;
        save();
        go("#/result");
      }));
      el.querySelector("[data-startq]").addEventListener("click", () => {
        state.answers = { q1: [], q2: [], q3: null };
        state.preset = null;
        save();
      });
    },
  };
}

/* ---------- A. 결과 ---------- */
function result() {
  const a = state.answers;
  state.basePrefs = basePrefsNow();
  const top5 = resultRank().slice(0, 5);
  // 결과 화면에서 누른 하트만 남기고(피드로 이어짐), 이전 피드 반응은 새 취향에서 다시 시작한다.
  state.fb = state.fb.filter((e) => e.src === "result" && top5.includes(e.id));
  state.liked = state.liked.filter((id) => state.fb.some((e) => e.id === id));
  state.passed = [];
  recompute();
  state.order = rank(DRINKS, state.prefs, a.q2, a.q3);
  state.feedIndex = 0;
  save();
  dropFeed();
  const analyzing = justAnswered && !reduceMotion();
  justAnswered = false;
  const base = state.basePrefs;
  const barsData = typeBars(base, 4);
  const picks = [
    ...Q1.filter((o) => a.q1.includes(o.id)).map((o) => o.label),
    ...Q2.filter((o) => a.q2.includes(o.id)).map((o) => o.label),
    ...Q3.filter((o) => o.id === a.q3).map((o) => o.label),
  ];
  const recCard = (id, i) => {
    const d = drinkById[id];
    const liked = state.liked.includes(id);
    const why = reasonText(d), caution = cautionText(d);
    return `<button class="rec press" data-rec="${id}" aria-pressed="${liked}" aria-label="${i + 1}위 ${esc(d.name)}, 눌러서 끌림 표시">
      <span class="row gap16" style="align-items:flex-start">
        ${drinkArt(d)}
        <span class="grow stack" style="gap:2px">
          <span class="t-ll c-p">${i + 1}위</span>
          <span class="t-tm">${esc(d.name)}</span>
          <span class="t-bm c-v">${esc(d.category)} · ${esc(d.abvLabel)}</span>
          <span class="t-bm c-p" style="font-weight:500;margin-top:2px">“${esc(d.oneLine)}”</span>
        </span>
        <span class="pop-heart" aria-hidden="true">${icon.heart(true, 28)}</span>
      </span>
      ${why ? `<span class="t-bm">${esc(why)}</span>` : ""}
      ${caution ? `<span class="t-bs c-v">참고: ${esc(caution)}</span>` : ""}
    </button>`;
  };
  const content = `<div class="stack" style="flex:1;min-height:0" data-content>
    <div class="topbar"><button class="icon-btn" data-back aria-label="이전 질문으로">${icon.back()}</button><span class="grow"></span></div>
    <div class="scroll"><div class="pad" style="padding-top:8px;padding-bottom:32px">
      <p class="t-ll c-p">${presetType() ? "둘러보기로 고른 유형" : "나의 취향 유형"}</p>
      <h1 class="t-hl" style="font-size:34px;line-height:42px;margin-top:4px">${esc(typeName())}</h1>
      <p class="t-bl c-v" style="margin-top:8px">${esc(typeBlurb(base))}</p>
      <div class="card taste-bars" style="margin-top:24px">
        <p class="t-tm">내가 끌리는 맛</p>
        ${barsData.map((b, i) => `<div class="tbar" role="img" aria-label="${b.label} ${b.pct}퍼센트">
          <div class="row"><span class="t-bl" style="font-weight:500">${b.label}</span><span class="t-bm c-v" data-pct="${b.pct}">0%</span></div>
          <div class="track"><div class="fill" style="background:${BAR_TONES[i % 4]};transition-delay:${120 * i + 150}ms" data-w="${b.pct}"></div></div></div>`).join("")}
      </div>
      ${picks.length ? `<p class="t-ll c-v" style="margin-top:24px">내가 고른 답</p><p class="t-bl" style="margin-top:4px">${picks.map(esc).join(" · ")}</p>` : ""}
      <h2 class="t-tl" style="margin-top:32px">나에게 맞는 첫 한 모금</h2>
      <p class="t-bm c-v" style="margin-top:4px">끌리는 술을 눌러 하트를 남겨 두세요.</p>
      <div class="stack gap12" style="margin-top:12px">${top5.map(recCard).join("")}</div>
    </div></div>
    <div class="bottom" style="padding-bottom:calc(4px + env(safe-area-inset-bottom))">
      <a class="btn btn-p" href="#/feed" data-go-feed>이 취향으로 추천 보기</a>
      <div class="row" style="justify-content:space-evenly">
        <a class="btn-t v" href="#/q/1">취향 다시 고르기</a>
        <button class="btn-t v" data-restart>처음으로</button>
      </div>
    </div>
  </div>`;
  const analyzingHTML = `<div class="stack analyzing" style="flex:1" aria-live="polite">
    ${logoSVG(104, { fill: 0 })}
    <p class="t-tm center">고른 답으로<br>취향을 분석하고 있어요</p></div>`;

  const mountContent = (el) => {
    bindBack(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.querySelectorAll(".fill").forEach((f) => (f.style.width = `${f.dataset.w}%`));
      // 퍼센트 숫자도 막대와 함께 올라간다
      el.querySelectorAll("[data-pct]").forEach((s, i) => {
        const target = Number(s.dataset.pct);
        if (reduceMotion()) { s.textContent = `${target}%`; return; }
        const t0 = performance.now() + 120 * i + 150;
        const tick = (now) => {
          const p = Math.min(1, Math.max(0, (now - t0) / 700));
          s.textContent = `${Math.floor(FOS(p) * target)}%`;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }));
    el.querySelectorAll("[data-rec]").forEach((b) => (b.onclick = () => {
      const id = b.dataset.rec;
      const on = !state.liked.includes(id);
      setFeedback(id, on ? true : null, "result");
      b.setAttribute("aria-pressed", on);
      if (on) { buzz(10); burst(b.querySelector(".pop-heart"), app, HEART_SPARKS); }
    }));
    el.querySelector("[data-go-feed]").addEventListener("click", () => {
      state.order = rank(DRINKS, state.prefs, a.q2, a.q3);
      state.feedIndex = 0;
      save();
      dropFeed();
    });
    el.querySelector("[data-restart]").onclick = () => {
      Object.assign(state, { answers: { q1: [], q2: [], q3: null }, prefs: null, basePrefs: null, fb: [], liked: [], passed: [], order: [], feedIndex: 0, skipped: false, preset: null });
      save();
      dropFeed();
      go("#/", { replace: true, dir: "back" });
    };
  };
  return {
    html: `<section class="screen">${analyzing ? analyzingHTML : content}</section>`,
    mount(el) {
      if (!analyzing) { mountContent(el); return; }
      pourLogo(el.querySelector("svg.logo"), { fromSplash: false });
      setTimeout(() => {
        if (!el.isConnected) return;
        el.innerHTML = content;
        el.firstElementChild.classList.add("fade-in");
        mountContent(el);
      }, 1500);
    },
  };
}

/* ---------- B. 피드 (릴스) ---------- */
function reelHTML(d, i, total) {
  const fbState = state.liked.includes(d.id) ? "like" : state.passed.includes(d.id) ? "pass" : null;
  const n = barsFor(d.id).length;
  const why = reasonText(d);
  return `<div class="page" data-id="${d.id}" data-i="${i}">
    <div class="page-behind" aria-hidden="true">${icon.chevronLeft(22)}맛 카드</div>
    <article class="reel" style="--tint:${TINT[d.category] || C.surfaceVariant}" aria-label="${esc(d.name)}">
      <div class="top"><span class="cat">${esc(d.category)}</span><span class="grow"></span>
        <span class="count" aria-label="${total}잔 중 ${i + 1}번째">${i + 1} / ${total}</span></div>
      <div class="visual"><span class="glow" aria-hidden="true"></span>${drinkArt(d, 190, 250)}</div>
      <button class="swipe-cue" data-open aria-label="${esc(d.name)} 맛 카드 열기. 왼쪽으로 밀어도 열려요">
        <span class="hand">${icon.hand(22)}</span><span class="chev">${icon.chevronLeft(14)}${icon.chevronLeft(14)}</span><span>맛 카드</span></button>
      <div class="info">
        <h2 class="name">${esc(d.name)}</h2>
        <p class="meta">${esc(d.category)} · ${esc(d.abvLabel)}</p>
        <p class="one">“${esc(d.oneLine)}”</p>
        ${why ? `<p class="why">${esc(why)}</p>` : ""}
        ${n ? `<a class="near-link" href="#/nearby/${d.id}" aria-label="${esc(d.name)}, 근처 ${n}곳에서 맛볼 수 있어요. 바 보기">${icon.pin()}근처 ${n}곳에서 10~30mL로 맛보기${icon.chevronRight(16, 16)}</a>` : ""}
        ${i === 0 ? `<p class="first-hint">위로 넘기면 다음 잔 · 왼쪽으로 밀면 맛 카드</p>` : ""}
      </div>
      <div class="rail">
        <button class="rail-btn like" data-like aria-pressed="${fbState === "like"}" aria-label="${esc(d.name)} 끌려요"><span class="ic">${icon.heart(fbState === "like", 26)}</span><span class="lb">끌려요</span></button>
        <button class="rail-btn pass" data-pass aria-pressed="${fbState === "pass"}" aria-label="${esc(d.name)} 패스"><span class="ic">${icon.cross(20)}</span><span class="lb">패스</span></button>
      </div>
    </article>
  </div>`;
}
function endHTML() {
  const liked = state.liked.map((id) => drinkById[id]).filter(Boolean);
  return `<div class="page" data-end><div class="end-page">
    ${logoSVG(72)}
    <h2 class="t-hl" style="font-size:24px;line-height:32px">추천을 다 둘러봤어요</h2>
    <p class="t-bl c-v">${liked.length ? `끌린 술 ${liked.length}잔, 이제 근처에서 10~30mL로 맛볼 차례예요.` : "끌린 술이 없었다면 취향을 다시 골라 보거나, 근처 바에서 둘러보세요."}</p>
    ${liked.length ? `<div class="row gap8">${liked.slice(0, 4).map((d) => drinkArt(d, 48, 64)).join("")}</div>` : ""}
    <a class="btn btn-p" href="#/nearby">${liked.length ? "끌린 술 맛보러 가기" : "근처 바 둘러보기"}</a>
    <div class="row">${liked.length ? `<button class="btn-t" data-show-liked>끌린 술 보기</button>` : ""}<a class="btn-t v" href="#/q/1">취향 다시 고르기</a></div>
  </div></div>`;
}
function feedHead() {
  const top3 = typeBars(state.prefs, 3).map((b) => b.label).join("·");
  return `<header class="feed-head">
    ${logoSVG(30)}
    <div class="who"><h1 class="t-tm">나를 위한 한모금</h1><p class="t-bs c-v">${esc(typeName())} · ${esc(top3)}</p></div>
    <button class="head-btn" data-liked aria-label="끌린 술 ${state.liked.length}잔 보기">${icon.heart(state.liked.length > 0, 20)}<span data-n>${state.liked.length}</span></button>
    <a class="head-btn sm" href="#/nearby" aria-label="근처에서 한 잔, 주변 바 보기">${icon.pin()}근처</a>
    <a class="head-btn sm" href="#/q/1" style="color:var(--on-surface-v)">취향 다시</a>
  </header>`;
}
function feed() {
  ensureRecs();
  const pages = () => state.order.map((id, i) => reelHTML(drinkById[id], i, state.order.length)).join("") + endHTML();
  return {
    html: `<section class="screen">${feedHead()}<div class="pager" id="pager">${pages()}</div>${tabbar("feed")}</section>`,
    show(el) {
      el.querySelector(".feed-head").outerHTML = feedHead();
      el.querySelector(".feed-head [data-liked]").onclick = () => openLiked(el);
      if (feedDirty) { feedDirty = false; el._rerank?.(state.feedIndex); }
      el.querySelectorAll(".page[data-id]").forEach((p) => {
        const id = p.dataset.id;
        const like = p.querySelector("[data-like]");
        like.setAttribute("aria-pressed", state.liked.includes(id));
        like.querySelector(".ic").innerHTML = icon.heart(state.liked.includes(id), 26);
        p.querySelector("[data-pass]").setAttribute("aria-pressed", state.passed.includes(id));
      });
    },
    mount(el) {
      const pager = el.querySelector("#pager");
      const pageTop = (i) => pager.querySelector(`.page[data-i="${i}"]`)?.offsetTop ?? 0;
      requestAnimationFrame(() => (pager.scrollTop = pageTop(state.feedIndex)));
      let t;
      pager.addEventListener("scroll", () => {
        clearTimeout(t);
        t = setTimeout(() => {
          const cur = [...pager.querySelectorAll(".page[data-i]")].find((p) => Math.abs(p.offsetTop - pager.scrollTop) < p.clientHeight / 2);
          if (cur) { state.feedIndex = Number(cur.dataset.i); save(); }
        }, 120);
      });

      // 이미 본 잔은 그대로 두고, 다음 잔들만 지금 취향으로 다시 줄 세운다.
      const rerankAfter = (i) => {
        const headIds = state.order.slice(0, i + 1);
        const rest = DRINKS.filter((d) => !headIds.includes(d.id));
        let tail = rank(rest, state.prefs, state.answers.q2, state.answers.q3);
        tail = [...tail.filter((x) => !state.passed.includes(x)), ...tail.filter((x) => state.passed.includes(x))];
        state.order = [...headIds, ...tail];
        save();
        pager.querySelectorAll(".page").forEach((p) => { if (p.dataset.end !== undefined || Number(p.dataset.i) > i) p.remove(); });
        const tmp = document.createElement("div");
        tmp.innerHTML = state.order.map((id, k) => (k > i ? reelHTML(drinkById[id], k, state.order.length) : "")).join("") + endHTML();
        pager.append(...tmp.children);
        bind(pager);
      };
      el._rerank = rerankAfter;
      const updateCount = () => {
        const h = el.querySelector(".feed-head [data-liked]");
        h.querySelector("[data-n]").textContent = state.liked.length;
        h.firstElementChild.outerHTML = icon.heart(state.liked.length > 0, 20);
        h.setAttribute("aria-label", `끌린 술 ${state.liked.length}잔 보기`);
      };

      function bind(root) {
        root.querySelectorAll(".page[data-id]").forEach((p) => {
          if (p.dataset.bound) return;
          p.dataset.bound = 1;
          const id = p.dataset.id;
          const i = Number(p.dataset.i);
          const reel = p.querySelector(".reel");
          const like = p.querySelector("[data-like]"), pass = p.querySelector("[data-pass]");
          const open = () => { state.feedIndex = i; state.hintSeen = true; save(); go(`#/card/${id}`); };
          p.querySelector("[data-open]").onclick = open;
          dragReel(reel, open);

          like.onclick = () => {
            const on = !state.liked.includes(id);
            setFeedback(id, on ? true : null);
            like.setAttribute("aria-pressed", on);
            like.querySelector(".ic").innerHTML = icon.heart(on, 26);
            pass.setAttribute("aria-pressed", false);
            if (on) { buzz(12); burst(like.querySelector(".ic"), app, HEART_SPARKS); toast("끌린 맛을 다음 추천에 반영할게요"); }
            else toast("끌려요를 취소했어요");
            updateCount();
            rerankAfter(i);
          };
          pass.onclick = () => {
            if (state.passed.includes(id)) {
              setFeedback(id, null);
              pass.setAttribute("aria-pressed", false);
              toast("패스를 취소했어요");
              rerankAfter(i);
              return;
            }
            buzz(8);
            setFeedback(id, false);
            pass.setAttribute("aria-pressed", true);
            like.setAttribute("aria-pressed", false);
            like.querySelector(".ic").innerHTML = icon.heart(false, 26);
            updateCount();
            toast("비슷한 맛은 뒤로 미룰게요");
            rerankAfter(i);
            // 패스하면 다음 잔으로 넘어간다
            setTimeout(() => {
              const next = p.nextElementSibling;
              if (next) pager.scrollTo({ top: next.offsetTop, behavior: reduceMotion() ? "auto" : "smooth" });
            }, 320);
          };
        });
        root.querySelector("[data-show-liked]")?.addEventListener("click", () => openLiked(el));
      }
      bind(pager);
      el.querySelector(".feed-head [data-liked]").onclick = () => openLiked(el);

      // 첫 잔에서 한 번만: 카드를 살짝 왼쪽으로 밀었다 돌려놓아 '밀면 뭔가 있다'를 보여 준다.
      if (!state.hintSeen && !reduceMotion()) {
        const reel = pager.querySelector('.page[data-i="0"] .reel');
        setTimeout(() => {
          if (!reel?.isConnected || state.hintSeen) return;
          reel.style.transition = "transform 380ms cubic-bezier(.4,0,.2,1)";
          reel.style.transform = "translateX(-72px)";
          setTimeout(() => {
            reel.style.transition = "transform 700ms cubic-bezier(.3,1.5,.5,1)";
            reel.style.transform = "";
            state.hintSeen = true;
            save();
          }, 640);
        }, 900);
      }
    },
  };
}

// 카드를 왼쪽으로 밀면 손가락을 따라오고, 96px 넘게 밀면 맛 카드가 열린다. 오른쪽은 살짝만 버틴다.
function dragReel(reel, open) {
  let s = null;
  reel.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, a")) return;
    s = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, on: false };
  });
  reel.addEventListener("pointermove", (e) => {
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (!s.on) {
      if (Math.hypot(dx, dy) < 10) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) { s = null; return; }
      s.on = true;
      try { reel.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      reel.style.transition = "none";
    }
    s.dx = dx < 0 ? dx : dx * 0.25;
    reel.style.transform = `translateX(${s.dx}px)`;
  });
  const end = (e) => {
    if (!s || e.pointerId !== s.id) return;
    const { on, dx } = s;
    s = null;
    if (!on) return;
    swallowClick(reel);
    if (dx < -96 && e.type !== "pointercancel") {
      buzz(6);
      open();
      setTimeout(() => { reel.style.transition = "none"; reel.style.transform = ""; }, 420);
    } else {
      reel.style.transition = "transform 500ms cubic-bezier(.3,1.4,.5,1)";
      reel.style.transform = "";
    }
  };
  reel.addEventListener("pointerup", end);
  reel.addEventListener("pointercancel", end);
}

// 끌린 술 목록 (아래에서 올라오는 시트)
function openLiked(screen) {
  const liked = state.liked.map((id) => drinkById[id]).filter(Boolean);
  const sh = document.createElement("div");
  sh.className = "scrim";
  sh.innerHTML = `<div class="sheet-m" role="dialog" aria-modal="true" aria-labelledby="lk-t">
    <div class="grip" aria-hidden="true"></div>
    <div class="body">
      <h2 class="t-tl" id="lk-t">끌린 술 ${liked.length}잔</h2>
      ${liked.length ? `<p class="t-bm c-v">누르면 맛 카드로 가요.</p>
        ${liked.map((d) => `<a class="liked-row press" href="#/card/${d.id}">${drinkArt(d, 44, 58)}
          <span class="t"><p class="t-ts">${esc(d.name)}</p><p class="t-bs c-p">“${esc(d.oneLine)}”</p></span>
          <span class="c-p" style="display:grid">${icon.heart(true, 20)}</span></a>`).join("")}
        <a class="btn btn-p" href="#/nearby" style="margin-top:8px">끌린 술 맛보러 가기</a>`
      : `<p class="t-bl c-v" style="padding:16px 0">아직 없어요. 피드에서 끌려요를 누르면 여기에 모여요.</p>`}
    </div></div>`;
  screen.append(sh);
  buzz(6);
  sh.addEventListener("click", (e) => { if (e.target === sh || e.target.closest("a")) sh.remove(); });
}

/* ---------- B. 맛 카드 ---------- */
function card({ parts }) {
  ensureRecs();
  const d = drinkById[parts[1]];
  if (!d) { go("#/feed", { replace: true }); return null; }
  const pos = state.order.indexOf(d.id) + 1;
  const why = reasonText(d), caution = cautionText(d);
  const reviews = [...state.reviews.filter((r) => r.drinkId === d.id), ...SAMPLE_REVIEWS.filter((r) => r.drinkId === d.id)];
  const n = barsFor(d.id).length;
  const AX = [["sweet", "단맛"], ["sour", "신맛"], ["bitter", "쓴맛"], ["fizz", "탄산"], ["body", "바디감"], ["alc", "알코올 느낌"],
    ["fruit", "과일"], ["flower", "꽃"], ["grain", "곡물"], ["wood", "나무"], ["smoke", "연기"], ["herb", "허브"]];
  const fbRow = () => {
    const like = state.liked.includes(d.id), pass = state.passed.includes(d.id);
    return `<button class="fb-text" data-like aria-pressed="${like}" aria-label="${esc(d.name)} 끌려요"><span class="ic">${icon.heart(like, 20)}</span>끌려요</button><span class="sep"></span>
      <button class="fb-text" data-pass aria-pressed="${pass}" aria-label="${esc(d.name)} 패스"><span class="ic">${icon.cross(20, 22)}</span>패스</button>`;
  };
  return {
    html: `<section class="screen">
      ${topbar("맛 카드", { backLabel: "추천 피드로 돌아가기" })}
      <div class="scroll"><div class="pad stack" style="gap:24px;padding-bottom:32px">
        <div class="row gap16">${drinkArt(d, 104, 140)}
          <div class="stack gap4"><p class="t-ll c-p">${pos ? `피드 ${pos}번째 잔` : esc(d.category)}</p>
            <h2 class="t-hl" style="font-size:24px;line-height:32px">${esc(d.name)}</h2>
            <p class="t-bm c-v">${esc(d.category)} · ${esc(d.abvLabel)}</p></div></div>
        <p class="t-tm c-p" style="font-weight:500">“${esc(d.oneLine)}”</p>
        <div class="card stack gap12"><h3 class="t-tm">한눈에 보는 맛</h3>
          ${infoRow("향", d.aroma)}${infoRow("맛", d.flavor)}${infoRow("느낌", d.feel)}${infoRow("비교", d.vsSoju)}</div>
        <div class="card-pc stack gap4"><p class="t-ll c-p">왜 나에게 맞을까요?</p>
          <p class="t-bl c-pc">${esc(why)}</p>${caution ? `<p class="t-bm c-v">참고: ${esc(caution)}</p>` : ""}</div>
        <div class="card expand" style="padding:0" data-open="false">
          <button class="expand-head" data-toggle aria-expanded="false">
            <span class="grow stack"><span class="t-tm">더 자세히 알아보기</span><span class="t-bm c-v">원료 · 만드는 법 · 맛 점수</span></span>
            <span class="chev">${icon.chevronDown()}</span></button>
          <div class="expand-body"><div><div class="expand-inner"><hr>
            ${infoRow("원산지", d.origin)}${infoRow("도수", d.abvLabel)}${infoRow("원료", d.ingredients)}${infoRow("만드는 법", d.process)}
            ${infoRow("숙성", d.aging)}${infoRow("용어 풀이", d.glossary)}
            <p class="t-ll c-v" style="margin-top:4px">맛·향 강도 (0~5)</p>
            ${AX.map(([k, l]) => `<div class="score" role="img" aria-label="${l} 5점 중 ${d.taste[k]}점"><span>${l}</span>
              <span class="cells">${[1, 2, 3, 4, 5].map((x) => `<i class="${x <= d.taste[k] ? "on" : ""}"></i>`).join("")}</span><span>${d.taste[k]}</span></div>`).join("")}
            <p class="t-bs c-v">${d.verified ? "샘플 데이터의 확인 표시가 있는 항목이에요." : "사실 정보는 팀 확인 전 초안이에요. 제품별로 다를 수 있어요."}</p>
          </div></div></div>
        </div>
        <div class="stack gap8">
          <h3 class="t-tm">맛본 사람들의 후기 ${reviews.length}</h3>
          ${reviews.length ? reviews.slice(0, 4).map((r) => `<div class="review"><p class="t-ll c-p">${esc(r.reaction)}${r.chips?.length ? ` · ${esc(r.chips.join(", "))}` : ""}</p>
            ${r.text ? `<p class="t-bm" style="margin-top:2px">${esc(r.text)}</p>` : ""}${r.sample ? "" : `<p class="t-bs c-v" style="margin-top:2px">내가 남긴 후기</p>`}</div>`).join("")
          : `<p class="t-bm c-v">아직 후기가 없어요. 맛보고 첫 후기를 남겨 주세요.</p>`}
        </div>
      </div></div>
      <div class="bottom" style="padding-top:8px;padding-bottom:calc(8px + env(safe-area-inset-bottom))">
        <div class="fb-text-row" data-fb>${fbRow()}</div>
        ${n ? `<a class="btn btn-p" href="#/nearby/${d.id}">이 술을 맛볼 수 있는 곳</a>` : `<button class="btn btn-s" data-back2>다른 맛 찾아보기</button>`}
      </div>
    </section>`,
    mount(el) {
      bindBack(el);
      el.querySelector("[data-back2]")?.addEventListener("click", () => back());
      const ex = el.querySelector(".expand");
      el.querySelector("[data-toggle]").onclick = (e) => {
        const open = ex.dataset.open !== "true";
        ex.dataset.open = open;
        e.currentTarget.setAttribute("aria-expanded", open);
      };
      const row = el.querySelector("[data-fb]");
      const bindFb = () => {
        row.querySelector("[data-like]").onclick = () => {
          const on = !state.liked.includes(d.id);
          setFeedback(d.id, on ? true : null);
          feedDirty = true;
          if (on) { buzz(12); toast("끌린 맛을 다음 추천에 반영할게요"); } else toast("끌려요를 취소했어요");
          row.innerHTML = fbRow(); bindFb();
        };
        row.querySelector("[data-pass]").onclick = () => {
          const on = !state.passed.includes(d.id);
          setFeedback(d.id, on ? false : null);
          feedDirty = true;
          toast(on ? "비슷한 맛은 뒤로 미룰게요" : "패스를 취소했어요");
          row.innerHTML = fbRow(); bindFb();
        };
      };
      bindFb();
    },
  };
}

/* ---------- C. 근처에서 한 모금 ---------- */
let nearbyCat = null;
function mapHTML(highlight, drinkId) {
  const maxMin = Math.max(...BARS.map(minutesOf), 1);
  const angles = [-38, 200, 128, 24];
  const R = 100 - 26; // 지도 높이(200)의 절반에서 26을 뺀 반지름
  const pins = BARS.map((b, i) => {
    const a = (angles[i % 4] * Math.PI) / 180;
    const r = R * (minutesOf(b) / maxMin);
    const x = r * Math.cos(a), y = r * Math.sin(a) - 14;
    const on = highlight.has(b.id);
    return `<a class="pin ${on ? "on" : ""}" href="#/bar/${b.id}${drinkId ? `?drink=${drinkId}` : ""}" style="left:calc(50% + ${x.toFixed(1)}px);top:calc(50% + ${y.toFixed(1)}px)"
      aria-label="${esc(b.name)}, ${esc(b.distance)}${on ? "" : ", 지금 조건과 안 맞음"}">${icon.mapPin(on ? 26 : 20, on ? C.primary : C.outline)}<span>${esc(b.name)}</span></a>`;
  }).join("");
  return `<div class="map">
    <svg class="ground" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 164C120 140 220 200 400 172V200H0Z" fill="#DDE7EE"/>
      <rect x="28" y="20" width="72" height="52" rx="9" fill="#E3EBDD"/>
      <g stroke="#fff"><path d="M0 96L400 84" stroke-width="6"/><path d="M184 0L216 200" stroke-width="6"/>
        <path d="M60 200L328 0" stroke-width="3.6"/><path d="M288 96L400 144" stroke-width="3.6"/></g>
    </svg>
    <svg class="ground" viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid meet" style="width:100px;height:100px;left:calc(50% - 50px);top:calc(50% - 50px)" aria-hidden="true">
      <circle class="me-pulse" r="5.3" fill="${C.primary}" fill-opacity=".25"/>
      <circle r="5" fill="#fff"/><circle r="3.4" fill="#2F6FDB"/>
    </svg>
    <span class="me-label" aria-hidden="true">나</span>
    ${pins}
    <span class="vm">가상 지도</span>
  </div>`;
}
function barCard(b, drink, cat) {
  const ms = menusOf(b);
  const dm = drink ? ms.filter((m) => m.drinkId === drink.id) : [];
  const hl = dm.length > 0;
  const matching = cat ? ms.filter((m) => m.drink?.category === cat) : ms;
  const drinks = drinksOf(b);
  return `<a class="bar-card press ${hl ? "hl" : ""}" href="#/bar/${b.id}${drink ? `?drink=${drink.id}` : ""}">
    <div class="row"><div class="grow stack" style="gap:2px"><span class="t-tm">${esc(b.name)}</span><span class="t-bm c-v">${esc(b.area)} · ${esc(b.distance)}</span></div>
      <span class="c-v" style="display:grid">${icon.chevronRight()}</span></div>
    ${hl ? `<div class="has-box stack" style="gap:2px"><span class="t-ll c-p">${esc(drink.name)} 있어요</span>
      <span class="t-bl" style="font-weight:500">${dm.map((m) => `${m.ml}mL ${won(m.price)}`).join("  ·  ")}</span></div>` : ""}
    <div class="arts">${drinks.slice(0, 5).map((x) => drinkArt(x, 40, 52)).join("")}${drinks.length > 5 ? `<span class="t-ll c-v">+${drinks.length - 5}</span>` : ""}</div>
    <p class="t-bm c-v">${catsOf(b).join("·")} · ${drinks.length}종${!hl && matching.length !== ms.length ? ` (조건에 맞는 메뉴 ${matching.length}개)` : ""} · ${volRange(ms)} · ${priceRange(ms)}</p>
  </a>`;
}
function drinkChip(d, label, n, liked = false) {
  return `<button class="drink-chip press" data-drink="${d.id}" ${n ? "" : "disabled"} aria-label="${liked ? "끌린 술" : label} ${esc(d.name)}, ${n ? `맛볼 수 있는 곳 ${n}곳` : "맛볼 수 있는 곳 없음"}">
    ${drinkArt(d, 56, 72)}<span class="nm">${esc(d.name)}</span><span class="t-bs ${n ? "c-p" : "c-v"}">${liked ? "♥" : label} · ${n ? `${n}곳` : "없음"}</span></button>`;
}
function nearby({ parts }) {
  ensureRecs();
  const drink = parts[1] ? drinkById[parts[1]] : null;
  const cat = drink ? null : nearbyCat;
  const list = BARS.filter((b) => (drink ? b.pours.some((p) => p.drinkId === drink.id) : cat ? catsOf(b).includes(cat) : true))
    .sort((a, b) => minutesOf(a) - minutesOf(b));
  const hl = new Set(list.map((b) => b.id));
  const rr = resultRank();
  const top = rr.slice(0, 5).map((id) => drinkById[id]);
  const liked = state.liked.map((id) => drinkById[id]).filter(Boolean);
  const rankOf = drink ? rr.indexOf(drink.id) + 1 : 0;
  const title = drink ? `맛볼 수 있는 곳 ${list.length}곳` : cat ? `${cat} 있는 곳 ${list.length}곳` : `주변 가상 바 ${list.length}곳`;
  return {
    html: `<section class="screen">
      ${topbar("근처에서 한 모금", { noBack: !drink, backLabel: "이전 화면으로 돌아가기" })}
      <div class="scroll"><div class="stack" style="gap:16px;padding-bottom:32px">
        ${drink ? `<div class="pad"><div class="card-pc row gap16">${drinkArt(drink, 60, 80)}
            <div class="grow stack" style="gap:2px"><span class="t-ll c-p">${rankOf ? `찾는 술 · 추천 ${rankOf}위` : "찾는 술"}</span>
              <h2 class="t-tm">${esc(drink.name)}</h2><span class="t-bm c-v">${esc(drink.category)} · ${esc(drink.abvLabel)}</span></div>
            <button class="btn-t" data-other aria-label="다른 술로 찾기. 지금은 ${esc(drink.name)}, ${list.length}곳">다른 술</button></div></div>
          <div class="pad">${mapHTML(hl, drink.id)}</div>`
        : `<p class="pad t-bl c-v">한 병이 부담될 때, 10~30mL로 먼저 맛볼 수 있는 곳이에요.</p>
          <div class="pad">${mapHTML(hl, null)}</div>
          ${liked.length ? `<div class="stack gap8"><h2 class="pad t-ts">끌린 술로 찾기</h2>
            <div class="hrow">${liked.map((d) => drinkChip(d, "", barsFor(d.id).length, true)).join("")}</div></div>` : ""}
          <div class="stack gap8"><h2 class="pad t-ts">내 추천 술로 찾기</h2>
            <div class="hrow">${top.map((d, i) => drinkChip(d, `${i + 1}위`, barsFor(d.id).length)).join("")}</div></div>
          <div class="stack gap8"><h2 class="pad t-ts">주종으로 찾기</h2>
            <div class="hrow" role="tablist" aria-label="주종">
              <button class="fpill" role="tab" data-cat="" aria-selected="${!cat}">${!cat ? icon.check(16) : ""}전체 ${BARS.length}</button>
              ${CATEGORIES.map((c) => `<button class="fpill" role="tab" data-cat="${esc(c)}" aria-selected="${cat === c}">${cat === c ? icon.check(16) : ""}${esc(c)} ${BARS.filter((b) => catsOf(b).includes(c)).length}</button>`).join("")}
            </div></div>`}
        <div class="pad stack gap4" style="padding-top:8px"><h2 class="t-tm">${title}</h2></div>
        ${list.length ? list.map((b) => `<div class="pad">${barCard(b, drink, cat)}</div>`).join("")
        : `<div class="pad"><div class="card empty-card"><h3 class="t-tm">조건에 맞는 가상 바가 없어요</h3>
            <p class="t-bl">고른 조건을 지우면 가상 바 ${BARS.length}곳을 모두 볼 수 있어요.</p><button class="btn btn-s" data-clear>전체 바 보기</button></div></div>`}
      </div></div>
      ${drink ? "" : tabbar("nearby")}
    </section>`,
    mount(el) {
      bindBack(el);
      el.querySelectorAll("[data-drink]").forEach((b) => (b.onclick = () => go(`#/nearby/${b.dataset.drink}`)));
      el.querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => {
        const c = b.dataset.cat || null;
        nearbyCat = c && nearbyCat === c ? null : c;
        buzz(5);
        const y = el.querySelector(".scroll").scrollTop;
        const x = b.parentElement.scrollLeft;
        render();
        const now = nav.current()?.el;
        now.querySelector(".scroll").scrollTop = y;
        const row = now.querySelector('[role="tablist"]');
        if (row) row.scrollLeft = x;
      }));
      el.querySelector("[data-clear]")?.addEventListener("click", () => { nearbyCat = null; render(); });
      el.querySelector("[data-other]")?.addEventListener("click", () => { nearbyCat = null; back("#/nearby"); });
    },
  };
}

/* ---------- C. 바 정보 ---------- */
const barSel = {}; // 바마다 고른 메뉴를 기억한다
const barExpanded = new Set();
function bar({ parts, q }) {
  ensureRecs();
  const b = barById[parts[1]];
  if (!b) { go("#/nearby", { replace: true }); return null; }
  const ms = menusOf(b);
  const want = q.get("drink");
  if (want && menuById(barSel[b.id] || "")?.drinkId !== want) barSel[b.id] = ms.find((m) => m.drinkId === want)?.id || null;
  const focus = want ? drinkById[want] : null;
  const menuCard = (m) => {
    const d = m.drink;
    const sel = barSel[b.id] === m.id;
    const exp = barExpanded.has(m.id);
    const why = d ? reasonText(d) : "";
    return `<div class="menu" aria-checked="${sel}" data-expanded="${exp}" data-menu="${m.id}">
      <button class="pick" role="radio" aria-checked="${sel}" data-pick="${m.id}">
        ${d ? drinkArt(d, 48, 64) : ""}
        <span class="grow stack" style="gap:2px"><span class="t-ts" style="font-weight:500">${esc(d?.name || m.drinkId)}</span>
          <span class="t-bs c-v">${esc(d?.category || "주류")} · ${esc(d?.abvLabel || "도수 정보 없음")}</span>
          <span class="t-ll c-p">${m.ml}mL · ${won(m.price)}</span></span>
        <span class="ring ${sel ? "on" : ""}" aria-hidden="true" style="width:22px;height:22px"><i></i></span>
      </button>
      <div class="more"><div><div class="more-in">
        ${d ? `<p class="t-bl c-p">“${esc(d.oneLine)}”</p>` : ""}
        <p class="t-bs c-v">${volNote(m)} · ${openedLabel(m)}</p>
        <p class="t-bs c-v">${statusNote(m)}</p>
        ${ABV_NOTE[m.drinkId] ? `<p class="note-box">${ABV_NOTE[m.drinkId]}</p>` : ""}
        <button class="btn-t" data-exp="${m.id}" style="align-self:flex-start;padding:0">${exp ? "간단히 보기" : "원료·만드는 법 자세히"}</button>
        <div class="detail">${d ? `${infoRow("원산지", d.origin, true)}${infoRow("향", d.aroma, true)}${infoRow("맛", d.flavor, true)}${infoRow("느낌", d.feel, true)}
          ${infoRow("비교", d.vsSoju, true)}${infoRow("원료", d.ingredients, true)}${infoRow("만드는 법", d.process, true)}${infoRow("숙성", d.aging, true)}
          ${infoRow("용어 풀이", d.glossary, true)}${infoRow("주의", d.caution, true)}${why ? infoRow("추천 이유", why, true) : ""}
          <p class="t-bs c-v">${d.verified ? "출처 확인이 끝난 샘플 데이터예요." : "술 정보는 팀 확인 전 초안이고, 바·가격·개봉일은 평가용 가상 데이터예요."}</p>` : ""}</div>
      </div></div></div>
    </div>`;
  };
  const reserved = () => (state.reservations || []).some((r) => r.menuId === barSel[b.id]);
  const footer = () => {
    const m = barSel[b.id] ? menuById(barSel[b.id]) : null;
    return `<p class="t-bm c-v" aria-live="polite" style="margin-bottom:8px">${m ? `${esc(m.drink?.name)} · ${m.ml}mL · 예시 ${won(m.price)}` : "메뉴를 골라 주세요"}</p>
      <div class="btns"><button class="btn btn-s" data-reserve style="flex:1" ${m ? "" : "disabled"} ${m && reserved() ? 'aria-disabled="true"' : ""}>${m && reserved() ? "예약됨 ✓" : "예약하기"}</button>
      <button class="btn btn-p" data-try style="flex:2" ${m ? "" : "disabled"}>${m ? `${m.ml}mL 맛보기 체험` : "메뉴를 골라 주세요"}</button></div>`;
  };
  const focusMenu = focus && barSel[b.id] && menuById(barSel[b.id])?.drinkId === focus.id;
  return {
    html: `<section class="screen">
      ${topbar("바 정보", { backLabel: "주변 바 목록으로 돌아가기" })}
      <div class="scroll"><div class="pad stack" style="gap:24px;padding-bottom:32px">
        <div class="stack gap8">
          <h2 class="t-hl" style="font-size:26px;line-height:34px">${esc(b.name)}</h2>
          <p class="t-bl c-v">${esc(b.area)} · ${esc(b.distance)} · ${esc(b.hours)}</p>
          <p class="t-bm">${[...catsOf(b), volRange(ms), priceRange(ms)].map(esc).join(" · ")}</p>
          ${virtualNote()}
        </div>
        ${focusMenu ? `<div class="card-pc stack gap8"><p class="t-ll c-p">찾던 술이 있어요</p>
          <div class="row gap12">${drinkArt(focus, 48, 64)}<div class="grow stack" style="gap:2px"><span class="t-tm">${esc(focus.name)}</span>
            <span class="t-bm c-p">“${esc(focus.oneLine)}”</span></div></div>
          ${reasonText(focus) ? `<p class="t-bm">${esc(reasonText(focus))}</p>` : ""}
          <a class="btn-t" href="#/card/${focus.id}" style="align-self:flex-start;padding:0">맛 카드 보기 ${icon.chevronRight(16)}</a></div>` : ""}
        <div class="stack gap8"><h3 class="t-tm">시음 메뉴 ${ms.length}개</h3><p class="t-bm c-v">맛볼 메뉴를 하나 고르세요.</p>
          <div class="stack gap8" role="radiogroup" aria-label="시음 메뉴">${ms.map(menuCard).join("")}</div></div>
        <div class="stack gap8" style="background:rgba(245,239,241,.6);border-radius:20px;padding:16px">
          <h3 class="t-ts" style="font-weight:500">매장 정보</h3>
          ${infoRow("시간대", `${b.hours} (가상 설정값, 실제 영업 여부 아님)`, true)}${infoRow("주소", UNPROVIDED, true)}${infoRow("소개", UNPROVIDED, true)}
          ${infoRow("연락처", UNPROVIDED, true)}${infoRow("요약", `취급 주종: ${catsOf(b).join("·")} · 시음 주류 ${drinksOf(b).length}종(메뉴 ${ms.length}개) · 용량 ${volRange(ms)} · ${priceRange(ms)}`, true)}
        </div>
      </div></div>
      <div class="bottom" data-foot>${footer()}</div>
    </section>`,
    mount(el) {
      bindBack(el);
      const foot = el.querySelector("[data-foot]");
      const bindFoot = () => {
        foot.querySelector("[data-try]").onclick = () => { if (barSel[b.id]) go(`#/try/${b.id}?m=${barSel[b.id]}`); };
        foot.querySelector("[data-reserve]").onclick = () => {
          if (barSel[b.id] && !reserved()) reserve(el, b, menuById(barSel[b.id]), () => { foot.innerHTML = footer(); bindFoot(); });
        };
      };
      bindFoot();
      el.querySelectorAll("[data-pick]").forEach((p) => (p.onclick = () => {
        barSel[b.id] = p.dataset.pick;
        buzz(5);
        el.querySelectorAll(".menu").forEach((m) => {
          const on = m.dataset.menu === barSel[b.id];
          m.setAttribute("aria-checked", on);
          m.querySelector(".pick").setAttribute("aria-checked", on);
          m.querySelector(".ring").classList.toggle("on", on);
        });
        foot.innerHTML = footer();
        bindFoot();
      }));
      el.querySelectorAll("[data-exp]").forEach((x) => (x.onclick = () => {
        const id = x.dataset.exp;
        if (barExpanded.has(id)) barExpanded.delete(id); else barExpanded.add(id);
        x.closest(".menu").dataset.expanded = barExpanded.has(id);
        x.textContent = barExpanded.has(id) ? "간단히 보기" : "원료·만드는 법 자세히";
      }));
    },
  };
}
// 예약하기: 실제 예약은 없고 '예약 완료!' 알림만 보여 준다 (사용성 평가 과제 3)
function reserve(screen, b, m, done) {
  const pop = document.createElement("div");
  pop.className = "dialog-wrap";
  pop.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="rsv-t">
    <span class="ok">${icon.check(28)}</span>
    <h2 id="rsv-t" class="t-tl">예약 완료!</h2>
    <p class="t-bm c-v" style="margin-top:8px">${esc(b.name)} · ${esc(m.drink?.name)} ${m.ml}mL · 예시 ${won(m.price)}<br>오늘 ${esc(b.hours.split("~")[0])} 이후 방문하면 바로 준비해 드려요.</p>
    <p class="t-bs c-v" style="margin-top:10px">평가용 화면이라 실제 예약은 되지 않아요</p>
    <button class="btn btn-p" data-ok style="margin-top:16px">확인</button>
  </div>`;
  screen.append(pop);
  buzz(12);
  state.reservations = [...(state.reservations || []), { barId: b.id, drinkId: m.drinkId, ml: m.ml, menuId: m.id, at: Date.now() }];
  save();
  done();
  const ok = pop.querySelector("[data-ok]");
  ok.focus();
  ok.onclick = () => pop.remove();
  pop.addEventListener("click", (e) => { if (e.target === pop) pop.remove(); });
}

/* ---------- C. 맛보기 체험 (3단계) ---------- */
const STEPS = [
  { title: "시음 용량 및 가상 조건 확인", sub: "선택한 소량 시음 메뉴의 용량·예시 가격·도수 기준을 먼저 확인해요." },
  { title: "가상 한 모금 시음 체험", sub: "향·첫 모금의 맛·목넘김 순서로 이 술의 특징을 상상하며 살펴봐요." },
  { title: "가상 시음 완료 및 탐색 정리", sub: "체험한 시음 정보를 정리하고 다른 메뉴나 주변 바 탐색으로 돌아가요." },
];
function tasting({ parts, q }) {
  const b = barById[parts[1]];
  let m = q.get("m") && menuById(q.get("m"));
  if (!b || !m) { go("#/nearby", { replace: true }); return null; }
  let step = 1;
  let shown = [0, 0, 0]; // 잔에 지금 그려진 양 (다음 단계로 갈 때 여기서부터 차오른다)
  const ms = menusOf(b);
  const fills = () => [1, 2, 3].map((s) => (s < step ? 1 : s === step ? 0.55 : 0));
  const progress = () => `<div class="steps" role="img" aria-label="3단계 중 ${step}단계">${["조건 확인", "맛보기", "정리"].map((l, i) =>
    `<div class="${i + 1 === step ? "now" : ""}">${stepGlass(1, i + 1 <= step)}<span>${i + 1}. ${l}</span></div>`).join("")}</div>`;
  const header = () => `<div class="card row gap12">${drinkArt(m.drink, 48, 64)}
    <div class="grow stack" style="gap:2px"><span class="t-bs c-v">${esc(b.name)} · ${esc(b.distance)}</span><span class="t-tm">${esc(m.drink.name)}</span>
      <span class="t-bm c-p">${m.ml}mL · 예시 ${won(m.price)} · ${esc(m.drink.abvLabel)}</span></div></div>`;
  const body = () => {
    const d = m.drink;
    const why = reasonText(d);
    const same = ms.filter((x) => x.drinkId === m.drinkId);
    if (step === 1) {
      const opts = same.length > 1 ? same : [m];
      return `<div class="stack" style="gap:24px">
        <div class="stack gap8"><h3 class="t-ts" style="font-weight:500">용량</h3>
          <div class="row gap8" role="radiogroup" aria-label="용량" style="align-items:stretch">${opts.map((o) => `<button class="vol" role="radio" aria-checked="${o.id === m.id}" data-m="${o.id}">
            <span class="row"><span class="t-tm grow">${o.ml}mL</span><span class="ring ${o.id === m.id ? "on" : ""}" style="width:22px;height:22px"><i></i></span></span>
            <span class="t-bm c-p">${won(o.price)}</span><span class="t-bs c-v">${openedLabel(o)}</span></button>`).join("")}</div>
          ${opts.length === 1 ? `<p class="t-bs c-v">이 바에서는 한 가지 용량만 있어요.</p>` : ""}</div>
        <div class="card stack gap12"><h3 class="t-ts" style="font-weight:500">시음 조건</h3>
          ${infoRow("용량", volNote(m), true)}${infoRow("가격", `예시 ${won(m.price)} (실제 결제 없음)`, true)}${infoRow("도수", d.abvLabel, true)}
          ${infoRow("개봉", openedLabel(m), true)}${infoRow("비고", statusNote(m), true)}${ABV_NOTE[m.drinkId] ? `<p class="note-box">${ABV_NOTE[m.drinkId]}</p>` : ""}</div>
        <p class="t-bm c-v">왜 소량일까요? 병으로 사기 전에 ${m.ml}mL로 향과 맛을 먼저 확인해 실패 부담을 줄이는 가상 서비스예요.</p>
        ${ms.length > same.length ? `<div class="stack gap8"><h3 class="t-ts" style="font-weight:500">이 바의 다른 메뉴로 바꾸기</h3>
          <div class="fpills-wrap">${ms.map((o) => `<button class="fpill" data-m="${o.id}" aria-pressed="${o.id === m.id}">${o.id === m.id ? icon.check(16) : ""}${esc(o.drink?.name)} ${o.ml}mL</button>`).join("")}</div></div>` : ""}
      </div>`;
    }
    if (step === 2) {
      const steps = [["향 맡기", d.aroma], [`${m.ml}mL 중 첫 모금`, d.flavor], ["입안 느낌과 목넘김", d.feel], ["평소 마시던 술과 비교", d.vsSoju]];
      return `<div class="stack" style="gap:24px">
        <p class="t-tm c-p" style="font-weight:500">“${esc(d.oneLine)}”</p>
        <div class="timeline">${steps.map(([l, t], i) => `<div><span class="num"><b>${i + 1}</b>${i < 3 ? "<i></i>" : ""}</span>
          <span class="txt" style="${i === 3 ? "padding-bottom:0" : ""}"><span class="t-ll c-p">${esc(l)}</span><span class="t-bl">${esc(t)}</span></span></div>`).join("")}</div>
        ${why ? `<div class="card-pc stack gap4"><p class="t-ll c-p">내 취향과 닮은 점</p><p class="t-bl">${esc(why)}</p></div>` : ""}
        <div class="stack gap8">${infoRow("원료·제조", `${d.ingredients} · ${d.process}`, true)}${infoRow("숙성·용어", `${d.aging} (${d.glossary})`, true)}${infoRow("참고", d.caution, true)}</div>
      </div>`;
    }
    return `<div class="stack" style="gap:24px">
      <div class="row gap12"><span class="done-check">${icon.check(22)}</span><p class="t-tm grow">${esc(d.name)} ${m.ml}mL, 맛보기 끝!</p></div>
      <div class="card stack gap12">${infoRow("바", `${b.name} (${b.area} · ${b.distance})`, true)}${infoRow("술", `${d.name} (${d.category} · ${d.abvLabel})`, true)}
        ${infoRow("용량·가격", `${m.ml}mL · 예시 ${won(m.price)}`, true)}${infoRow("맛 인상", `“${d.oneLine}” 향: ${d.aroma} / 맛: ${d.flavor}`, true)}
        ${why ? infoRow("취향 이유", why, true) : ""}</div>
      <a class="btn btn-s" href="#/review/${d.id}?bar=${b.id}&ml=${m.ml}">맛본 후기 남기기</a>
      <p class="note-box">HCI 사용자 평가를 위한 시뮬레이션이에요. 실제 매장에 예약이나 주문이 들어가지 않았고, 결제도 일어나지 않았어요.</p>
    </div>`;
  };
  const foot = () => step === 1
    ? `<button class="btn btn-s" data-to-bar style="flex:1">바 정보로</button><button class="btn btn-p" data-next style="flex:2">다음</button>`
    : step === 2
      ? `<button class="btn btn-s" data-prev style="flex:1">이전</button><button class="btn btn-p" data-next style="flex:2">다음</button>`
      : `<button class="btn btn-s" data-prev style="flex:1">이전</button><a class="btn btn-p" href="#/nearby" style="flex:2">다른 바 둘러보기</a>`;
  return {
    html: `<section class="screen">
      ${topbar("맛보기 체험", { trailing: `<a class="btn-t v" href="#/nearby">바 목록</a>` })}
      <div class="scroll"><div class="pad stack" style="gap:24px;padding-bottom:32px" data-body></div></div>
      <div class="bottom"><div class="btns" data-foot></div></div>
    </section>`,
    mount(el) {
      const host = el.querySelector("[data-body]");
      const scroller = el.querySelector(".scroll");
      const level = (f) => `${13.1 - (13.1 - 3) * f}px`;
      const draw = (dir = 0) => {
        host.innerHTML = `${progress()}${header()}<div class="${dir > 0 ? "step-in-f" : dir < 0 ? "step-in-b" : ""} stack gap16">
          <div class="stack gap4"><h2 class="t-tl">${STEPS[step - 1].title}</h2><p class="t-bm c-v">${STEPS[step - 1].sub}</p></div>${body()}</div>`;
        el.querySelector("[data-foot]").innerHTML = foot();
        // 잔이 단계에 맞게 차오른다
        const target = fills();
        const liqs = host.querySelectorAll(".steps .sg-liq");
        liqs.forEach((l, i) => { l.style.transition = "none"; l.style.y = level(shown[i]); });
        requestAnimationFrame(() => requestAnimationFrame(() => {
          liqs.forEach((l, i) => { l.style.transition = ""; l.style.y = level(target[i]); });
          shown = target;
        }));
        host.querySelectorAll("[data-m]").forEach((x) => (x.onclick = () => {
          m = menuById(x.dataset.m);
          barSel[b.id] = m.id;
          history.replaceState(history.state, "", `#/try/${b.id}?m=${m.id}`);
          buzz(5);
          draw(0);
        }));
        el.querySelector("[data-next]")?.addEventListener("click", () => { step += 1; scroller.scrollTo({ top: 0, behavior: "smooth" }); draw(1); });
        el.querySelector("[data-prev]")?.addEventListener("click", () => { step -= 1; scroller.scrollTo({ top: 0, behavior: "smooth" }); draw(-1); });
        el.querySelector("[data-to-bar]")?.addEventListener("click", () => back());
      };
      el.querySelector("[data-back]").onclick = () => { if (step > 1) { step -= 1; draw(-1); } else back(); };
      draw(0);
    },
  };
}

/* ---------- C. 후기 ---------- */
function review({ parts, q }) {
  const d = drinkById[parts[1]];
  if (!d) { go("#/feed", { replace: true }); return null; }
  const b = barById[q.get("bar")];
  const ml = q.get("ml");
  const form = { reaction: null, chips: [], text: "" };
  const REACT = [["딱 내 취향", "다시 마실래요"], ["괜찮았어요", "한 번쯤 좋아요"], ["내 취향 아님", "다른 걸 볼래요"]];
  return {
    html: `<section class="screen">
      ${topbar("맛본 후기")}
      <div class="scroll"><div class="pad stack" style="gap:24px;padding-bottom:32px">
        <div class="card row gap12">${drinkArt(d, 48, 64)}<div class="grow stack" style="gap:2px">
          <span class="t-bs c-v">${b ? `${esc(b.name)} · ` : ""}${ml ? `${esc(ml)}mL` : "직접 맛본 후기"}</span><span class="t-tm">${esc(d.name)}</span></div></div>
        <div class="stack gap8"><h2 class="t-tm">내 입맛에 맞았어요?</h2>
          <div class="reacts" role="radiogroup" aria-label="내 입맛에 맞았는지">${REACT.map(([r, s]) => `<button class="sel react press" role="radio" aria-checked="false" data-r="${r}"><span class="t-ll">${r}</span><span class="t-bs c-v">${s}</span></button>`).join("")}</div></div>
        <div class="stack gap8"><h2 class="t-tm">어떤 맛이 느껴졌어요?</h2>
          <div class="chips">${CHIPS.map((c) => `<button class="fpill" data-c="${esc(c.label)}" aria-pressed="false">${esc(c.label)}</button>`).join("")}</div></div>
        <div class="stack gap8"><h2 class="t-tm">한 줄 후기 <span class="t-bs c-v">(선택)</span></h2>
          <textarea class="field" rows="2" maxlength="80" placeholder="예: 복숭아 아이스티인데 술이라 신기했어요"></textarea></div>
      </div></div>
      <div class="bottom"><button class="btn btn-p" data-submit disabled>후기 남기기</button>
        <p class="t-bs c-v center" style="margin-top:8px">남긴 후기는 맛 카드와 내 취향에 반영돼요</p></div>
    </section>`,
    mount(el) {
      bindBack(el);
      const submit = el.querySelector("[data-submit]");
      el.querySelectorAll("[data-r]").forEach((r) => (r.onclick = () => {
        form.reaction = r.dataset.r;
        el.querySelectorAll("[data-r]").forEach((x) => x.setAttribute("aria-checked", x === r));
        submit.disabled = false;
        buzz(5);
      }));
      el.querySelectorAll("[data-c]").forEach((c) => (c.onclick = () => {
        const v = c.dataset.c;
        form.chips = form.chips.includes(v) ? form.chips.filter((x) => x !== v) : [...form.chips, v];
        c.setAttribute("aria-pressed", form.chips.includes(v));
        c.innerHTML = `${form.chips.includes(v) ? icon.check(16) : ""}${esc(v)}`;
      }));
      submit.onclick = () => {
        form.text = el.querySelector("textarea").value.trim();
        state.reviews.unshift({ drinkId: d.id, barId: b?.id || null, ml: ml ? Number(ml) : null, ...form, date: new Date().toISOString() });
        const v = form.reaction === "딱 내 취향" ? true : form.reaction === "내 취향 아님" ? false : null;
        if (v !== null) {
          if (!state.basePrefs) state.basePrefs = state.prefs || prefsFromAnswers(state.answers.q1);
          state.fb.push({ id: d.id, v, src: "review" });
          recompute();
          feedDirty = true;
        }
        save();
        toast("후기가 맛 카드에 올라갔어요");
        go(`#/card/${d.id}`, { replace: true, dir: "back" });
      };
    },
  };
}

/* ---------- 내 기록 ---------- */
function log() {
  ensureRecs();
  const mini = (d, extra, href) => `<a class="mini press" href="${href || `#/card/${d.id}`}">${drinkArt(d, 44, 58)}
    <span class="grow stack" style="gap:2px;min-width:0"><span class="t-ts" style="font-weight:500">${esc(d.name)}</span><span class="t-bs c-v">${esc(extra)}</span></span>
    <span class="c-v" style="display:grid">${icon.chevronRight()}</span></a>`;
  const liked = state.liked.map((id) => drinkById[id]).filter(Boolean);
  const rsv = (state.reservations || []).filter((r) => drinkById[r.drinkId] && barById[r.barId]);
  return {
    html: `<section class="screen">
      ${topbar("내 기록", { noBack: true })}
      <div class="scroll"><div class="pad stack" style="gap:24px;padding-bottom:32px">
        <div class="card stack gap12">
          <p class="t-ll c-p">지금 내 취향</p>
          <h2 class="t-hl" style="font-size:26px;line-height:34px">${esc(typeName())}</h2>
          <p class="t-bm c-v">끌려요, 패스, 후기를 남길 때마다 조금씩 바뀌어요.</p>
          <div class="taste-bars">${typeBars(state.prefs, 4).map((b, i) => `<div class="tbar" role="img" aria-label="${b.label} ${b.pct}퍼센트">
            <div class="row"><span class="t-bl" style="font-weight:500">${b.label}</span><span class="t-bm c-v">${b.pct}%</span></div>
            <div class="track"><div class="fill" style="width:${b.pct}%;background:${BAR_TONES[i % 4]}"></div></div></div>`).join("")}</div>
          <a class="btn btn-s" href="#/q/1">취향 다시 찾기</a>
          <a class="btn-t" href="#/types" style="align-self:center">다른 유형 둘러보기</a>
        </div>
        <div><h2 class="t-tm" style="margin-bottom:8px">끌린 술 ${liked.length}</h2>
          ${liked.length ? liked.map((d) => mini(d, `“${d.oneLine}”`)).join("") : `<p class="t-bm c-v">피드에서 끌려요를 누르면 여기 모여요.</p>`}</div>
        <div><h2 class="t-tm" style="margin-bottom:8px">예약한 곳 ${rsv.length}</h2>
          ${rsv.length ? rsv.map((r) => mini(drinkById[r.drinkId], `${barById[r.barId].name} · ${r.ml}mL`, `#/bar/${r.barId}?drink=${r.drinkId}`)).join("") : `<p class="t-bm c-v">바 정보에서 예약하기를 누르면 여기 모여요.</p>`}</div>
        <div><h2 class="t-tm" style="margin-bottom:8px">직접 맛본 후기 ${state.reviews.length}</h2>
          ${state.reviews.length ? state.reviews.map((r) => mini(drinkById[r.drinkId], `${r.reaction}${r.barId ? ` · ${barById[r.barId].name}` : ""}${r.text ? ` · ${r.text}` : ""}`)).join("") : `<p class="t-bm c-v">맛보기 체험을 마치고 후기를 남기면 여기 쌓여요.</p>`}</div>
        <p class="center"><button class="btn-t v" data-reset>처음부터 다시 하기</button></p>
      </div></div>
      ${tabbar("log")}
    </section>`,
    mount(el) {
      el.querySelector("[data-reset]").onclick = () => {
        if (confirm("취향, 끌린 술, 예약, 후기를 모두 지울까요?")) { reset(); dropFeed(); go("#/", { replace: true, dir: "back" }); }
      };
    },
  };
}

const ROUTES = { "": start, q: question, types, result, feed, card, nearby, bar, try: tasting, review, log };
nav.start();
