import { state, save, reset } from "./store.js";
import { Q1, Q2, Q3, AXES, AXIS_LABEL, prefsFromAnswers, rank, nudge, tasteType, typeBlurb, typeBars, explain } from "./reco.js";
import { bottle, drinkColor, shortName } from "./art.js";
import { createNav, swallowClick, EASE } from "./nav.js";
import { buzz, pop, burst } from "./fx.js";

const app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const typeName = () => (state.answers.q1.length ? tasteType(state.prefs) : "골고루 탐험파");
const won = (n) => n.toLocaleString("ko-KR") + "원";

/* ---------- data ---------- */
const load = (f) => fetch(`data/${f}`).then((r) => r.json());
const [DRINKS, BARS, CHIPS, SAMPLE_REVIEWS] = await Promise.all(
  ["drinks.json", "bars.json", "chips.json", "reviews.json"].map(load));
const drinkById = Object.fromEntries(DRINKS.map((d) => [d.id, d]));
const barById = Object.fromEntries(BARS.map((b) => [b.id, b]));
const BAR_COLOR = { B1: "var(--c-grain)", B2: "var(--c-flower)", B3: "var(--c-fruit)", B4: "var(--c-wood)" };
const AXIS_COLOR = {
  sweet: "#F4A08A", sour: "#F0B44C", bitter: "#A07A5A", fizz: "#8FC3E6", body: "#C08A5A", alc: "#8C1D2B",
  fruit: "#F49A84", flower: "#C7B0EA", grain: "#EBCB55", wood: "#D9A86C", smoke: "#ADA296", herb: "#8CCB66",
};

/* ---------- icons ---------- */
const I = {
  check: `<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.6 3.6 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.5 3.1 4.3 6.3C19.5 15.4 12 20 12 20z"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
  left: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5m6-6l-6 6 6 6"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>`,
  compass: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`,
  bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 4h12v17l-6-4-6 4z"/></svg>`,
  flip: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4"/></svg>`,
  mapPin: (c) => `<svg viewBox="0 0 28 34"><path d="M14 33S2 21.5 2 13a12 12 0 0 1 24 0c0 8.5-12 20-12 20z" fill="${c}" stroke="#5C3317" stroke-width="2"/><circle cx="14" cy="13" r="4.5" fill="#FFFDF8"/></svg>`,
};

/* ---------- router ---------- */
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
// Where a back drag lands when there is no history (opened from a shared link).
function parentOf(hash) {
  const { parts, q } = parse(hash);
  switch (parts[0]) {
    case "card": return "#/feed";
    case "bar": return q.get("drink") ? `#/nearby/${q.get("drink")}` : "#/nearby";
    case "review": return `#/card/${parts[1]}`;
    case "nearby": return parts[1] ? `#/card/${parts[1]}` : null;
    case "q": return Number(parts[1]) > 1 ? `#/q/${Number(parts[1]) - 1}` : "#/";
    case "result": return "#/q/3";
    default: return null;
  }
}

let feedKeep = null;
function dropFeed() {
  feedKeep?.el.remove();
  feedKeep = null;
}

// Back drag starts anywhere except on things with their own sideways gesture,
// or anywhere within the left edge strip.
function backFilter(e) {
  if (e.clientX - app.getBoundingClientRect().left < 28) return true;
  return !e.target.closest("[data-noswipe], input, textarea");
}

function build(hash) {
  const r = parse(hash);
  const key = r.parts[0] || "";
  if (key === "feed" && feedKeep?.el.isConnected) { feedKeep.show(); return feedKeep.el; }
  const fn = ROUTES[key] || welcome;
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

function ensureRecs() {
  if (!state.prefs) {
    state.prefs = prefsFromAnswers(state.answers.q1);
    state.order = rank(DRINKS, state.prefs, state.answers.q2, state.answers.q3);
    save();
  }
}

const ROUTES = {
  "": welcome, q: question, result, feed, card, nearby, bar, review, log,
};

/* ---------- helpers ---------- */
let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1900);
}

function tabbar(active) {
  const tab = (id, href, icon, label) =>
    `<a href="${href}" class="${active === id ? "on" : ""}" ${active === id ? 'aria-current="page"' : ""}><span class="ico">${icon}</span>${label}</a>`;
  return `<nav class="tabbar" aria-label="메뉴">
    ${tab("feed", "#/feed", I.compass, "탐색")}
    ${tab("nearby", "#/nearby", I.pin, "근처 한 잔")}
    ${tab("log", "#/log", I.bookmark, "내 기록")}
  </nav>`;
}

function reviewsFor(id) {
  return [...state.reviews.filter((r) => r.drinkId === id), ...SAMPLE_REVIEWS.filter((r) => r.drinkId === id)];
}
function topChip(list) {
  const c = {};
  list.forEach((r) => r.chips.forEach((x) => (c[x] = (c[x] || 0) + 1)));
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}
function poursFor(id) {
  return BARS.flatMap((b) => b.pours.filter((p) => p.drinkId === id).map((p) => ({ ...p, bar: b })));
}
const minutes = (s) => parseInt(String(s).replace(/\D/g, ""), 10) || 99;
function openNow(hours) {
  const [a, b] = hours.split("~").map((t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; });
  const d = new Date();
  const now = d.getHours() * 60 + d.getMinutes();
  const end = b <= a ? b + 1440 : b;
  return (now >= a && now < end) || (now + 1440 >= a && now + 1440 < end);
}
function bars(prefs, n = 4) {
  return typeBars(prefs, n).map((b) => `<div class="bar-row"><span>${b.label}</span>
    <span class="track"><span class="fill" style="display:block;width:${b.pct}%;background:${AXIS_COLOR[b.axis]}"></span></span>
    <span>${b.pct}%</span></div>`).join("");
}
function abvShort(d) {
  return d.abvLabel.includes(",") ? d.abvLabel.split(",")[1].replace("하이볼은 ", "하이볼 ").replace("약 ", "").trim() : d.abvLabel.replace("약 ", "");
}

/* ---------- A. onboarding ---------- */
function welcome() {
  if (state.prefs) { go("#/feed", { replace: true }); return null; }
  return {
    html: `<section class="screen">
      <div class="top"><p class="brand">한모금</p></div>
      <div class="welcome-art" aria-hidden="true">
        <div class="fc a">향긋한 꽃<br>같은 달콤함</div>
        <div class="fc b">복숭아 아이스티<br>같은 상큼함</div>
        <div class="fc c">고소한 누룽지<br>같은 부드러움</div>
      </div>
      <div class="pad" style="margin-top:auto">
        <h1 class="h1">소주 맥주 너머,<br>내 입맛의 첫 한 모금</h1>
        <p class="sub">어려운 용어는 빼고, 좋아하는 맛에서 시작해요.</p>
      </div>
      <div class="bottom">
        <a class="btn btn-primary" href="#/q/1">내 취향 찾기</a>
        <button class="btn btn-secondary" data-skip>먼저 둘러볼게요</button>
      </div>
    </section>`,
    mount(el) {
      el.querySelector("[data-skip]").onclick = () => { ensureRecs(); go("#/feed"); };
    },
  };
}

function progress(n) {
  return `<div class="progress" aria-label="${n}/3 단계">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}
    <a class="skip" href="${n < 3 ? `#/q/${n + 1}` : "#/result"}">건너뛰기</a></div>`;
}

function question({ parts }) {
  const n = Number(parts[1]) || 1;
  const a = state.answers;
  if (n === 1) {
    return {
      html: `<section class="screen"><div class="top">${progress(1)}</div>
        <div class="scroll pad">
          <h1 class="h1">평소 좋아하는<br>음료는 뭐예요?</h1>
          <p class="sub">여러 개 골라도 좋아요</p>
          <div class="grid2">${Q1.map((q) => `<button class="tile" style="background:${q.color}" data-id="${q.id}" aria-pressed="${a.q1.includes(q.id)}">
            <span class="check">${I.check}</span><b>${q.label}</b><small>${q.sub}</small></button>`).join("")}</div>
        </div>
        <div class="bottom"><button class="btn btn-primary" data-next ${a.q1.length ? "" : "disabled"}>다음</button></div></section>`,
      mount(el) {
        el.querySelectorAll(".tile").forEach((b) => (b.onclick = () => {
          const id = b.dataset.id;
          a.q1 = a.q1.includes(id) ? a.q1.filter((x) => x !== id) : [...a.q1, id];
          b.setAttribute("aria-pressed", a.q1.includes(id));
          el.querySelector("[data-next]").disabled = !a.q1.length;
          save();
        }));
        el.querySelector("[data-next]").onclick = () => go("#/q/2");
      },
    };
  }
  if (n === 2) {
    return {
      html: `<section class="screen"><div class="top">${progress(2)}</div>
        <div class="scroll pad">
          <h1 class="h1">소주나 맥주,<br>어떤 점이 아쉬웠나요?</h1>
          <p class="sub">솔직하게 골라주세요. 비슷한 맛은 빼고 추천해요.</p>
          <div class="chips" style="margin-top:22px">${Q2.map((q) => `<button class="chip" data-id="${q.id}" aria-pressed="${a.q2.includes(q.id)}">${q.label}</button>`).join("")}</div>
        </div>
        <div class="bottom"><button class="btn btn-primary" data-next>다음</button></div></section>`,
      mount(el) {
        el.querySelectorAll(".chip").forEach((b) => (b.onclick = () => {
          const id = b.dataset.id;
          if (id === "none") a.q2 = a.q2.includes("none") ? [] : ["none"];
          else a.q2 = a.q2.includes(id) ? a.q2.filter((x) => x !== id) : [...a.q2.filter((x) => x !== "none"), id];
          el.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", a.q2.includes(c.dataset.id)));
          save();
        }));
        el.querySelector("[data-next]").onclick = () => go("#/q/3");
      },
    };
  }
  return {
    html: `<section class="screen"><div class="top">${progress(3)}</div>
      <div class="scroll pad">
        <h1 class="h1">새로운 술,<br>어떻게 만나고 싶어요?</h1>
        <p class="sub">한 병 사기 전에 먼저 맛볼 수도 있어요.</p>
        <div style="margin-top:22px">${Q3.map((q) => `<button class="option" data-id="${q.id}" aria-pressed="${a.q3 === q.id}">
          <span class="check">${I.check}</span><b>${q.label}</b><small>${q.sub}</small></button>`).join("")}</div>
      </div>
      <div class="bottom"><button class="btn btn-primary" data-next ${a.q3 ? "" : "disabled"}>분석 결과 보기</button></div></section>`,
    mount(el) {
      el.querySelectorAll(".option").forEach((b) => (b.onclick = () => {
        a.q3 = b.dataset.id;
        el.querySelectorAll(".option").forEach((o) => o.setAttribute("aria-pressed", o.dataset.id === a.q3));
        el.querySelector("[data-next]").disabled = false;
        save();
      }));
      el.querySelector("[data-next]").onclick = () => go("#/result");
    },
  };
}

function result() {
  const a = state.answers;
  state.prefs = prefsFromAnswers(a.q1);
  state.order = rank(DRINKS, state.prefs, a.q2, a.q3);
  state.feedIndex = 0;
  state.passed = [];
  save();
  dropFeed();
  const type = typeName();
  const words = type.split(" ");
  const title = words.length > 2 ? `${words.slice(0, -1).join(" ")}<br>${words.at(-1)}` : type;
  return {
    html: `<section class="screen" style="background:var(--mist)">
      <div class="scroll pad" style="padding-top:calc(20px + env(safe-area-inset-top))">
        <h1 class="h1">취향 분석 끝!</h1>
        <div class="result-card">
          <span class="pill" style="background:var(--c-fruit)">나는 이런 타입</span>
          <p class="h1" style="font-size:34px;margin-top:12px">${title}</p>
          <p class="sub">${typeBlurb(state.prefs)}</p>
          <div class="bars">${bars(state.prefs)}</div>
        </div>
        <p class="sub" style="margin-top:12px">처음 몇 개를 보는 동안 취향은 계속 다듬어져요.</p>
      </div>
      <div class="bottom"><a class="btn btn-primary" href="#/feed">첫 추천 5개 보러 가기</a></div>
    </section>`,
  };
}

/* ---------- B. feed and card ---------- */
function reelHTML(d, i, total) {
  const liked = state.liked.includes(d.id);
  const label = i < 5 ? `오늘의 탐색 ${i + 1}/5` : `더 둘러보기 ${i + 1}/${total}`;
  const showHint = !state.hintSeen && i === 0;
  return `<article class="reel" data-id="${d.id}" data-i="${i}" style="background:${drinkColor(d)}">
    <div class="reel-head"><span class="pill glass">${label}</span><a class="pill glass" href="#/log" data-type>${esc(typeName())}</a></div>
    <div class="reel-visual"><span class="halo"></span>${bottle(d)}</div>
    <button class="peek-edge" data-open aria-label="맛 카드 보기">${I.back}</button>
    ${showHint ? `<span class="hint-swipe" aria-hidden="true">왼쪽으로 밀어보세요</span>` : ""}
    <div class="reel-info">
      <div>
        <span class="pill glass">${esc(d.category)} · ${esc(abvShort(d))}</span>
        <h2 class="h1">${esc(d.oneLine)}</h2>
        <p class="lead">${esc(d.vsSoju)}</p>
      </div>
      <div class="reel-actions">
        <button data-like aria-pressed="${liked}"><span class="circle">${I.heart}</span>끌려요</button>
        <button data-pass><span class="circle">${I.x}</span>패스</button>
      </div>
    </div>
    <button class="pill glass peek-btn" data-open>밀어서 맛 카드 보기 ${I.left.replace("<svg", '<svg width="14" height="14"')}</button>
  </article>`;
}

function endHTML() {
  return `<article class="reel reel-end">
    <p class="h1">오늘의 다섯 잔,<br>다 둘러봤어요</p>
    <p class="sub" style="margin-bottom:18px">끌린 술은 근처 바에서 10~30mL로 먼저 맛볼 수 있어요.</p>
    <a class="btn btn-primary" href="#/nearby">근처에서 한 잔 찾기</a>
    <p class="sub">아래로 넘기면 더 둘러볼 수 있어요</p>
  </article>`;
}

let peeked = false;
function feed() {
  ensureRecs();
  const ids = state.order;
  const slides = () => ids.map((id, i) => reelHTML(drinkById[id], i, ids.length) + (i === 4 ? endHTML() : "")).join("");
  return {
    html: `<section class="screen"><div class="feed" id="feed">${slides()}</div>${tabbar("feed")}</section>`,
    // Runs when the kept feed comes back on stage.
    show(el) {
      el.querySelectorAll(".reel[data-id]").forEach((r) => {
        const b = r.querySelector("[data-like]");
        b.setAttribute("aria-pressed", state.liked.includes(r.dataset.id));
      });
      el.querySelectorAll("[data-type]").forEach((a) => (a.textContent = typeName()));
      if (state.hintSeen) el.querySelectorAll(".hint-swipe").forEach((h) => h.remove());
    },
    mount(el) {
      const f = el.querySelector("#feed");
      const slideTop = (i) => f.querySelector(`.reel[data-i="${i}"]`)?.offsetTop ?? 0;
      requestAnimationFrame(() => (f.scrollTop = slideTop(state.feedIndex)));

      let t;
      f.addEventListener("scroll", () => {
        clearTimeout(t);
        t = setTimeout(() => {
          const reels = [...f.querySelectorAll(".reel[data-i]")];
          const cur = reels.find((r) => Math.abs(r.offsetTop - f.scrollTop) < r.clientHeight / 2);
          if (cur) { state.feedIndex = Number(cur.dataset.i); save(); }
        }, 120);
      });

      const rerankAfter = (i) => {
        const head = state.order.slice(0, i + 1);
        const rest = DRINKS.filter((d) => !head.includes(d.id));
        let tail = rank(rest, state.prefs, state.answers.q2, state.answers.q3);
        tail = [...tail.filter((x) => !state.passed.includes(x)), ...tail.filter((x) => state.passed.includes(x))];
        state.order = [...head, ...tail];
        save();
        // Redraw only the slides below the current one.
        f.querySelectorAll(".reel").forEach((r) => {
          const ri = r.dataset.i === undefined ? 4.5 : Number(r.dataset.i);
          if (ri > i) r.remove();
        });
        const tmp = document.createElement("div");
        tmp.innerHTML = state.order.map((id, k) => (k > i ? reelHTML(drinkById[id], k, state.order.length) : "") + (k === 4 && k >= i ? endHTML() : "")).join("");
        f.append(...tmp.children);
        bind(f);
      };

      function bind(root) {
        root.querySelectorAll(".reel[data-id]").forEach((r) => {
          if (r.dataset.bound) return;
          r.dataset.bound = 1;
          const id = r.dataset.id;
          const i = Number(r.dataset.i);
          const seen = () => { state.hintSeen = true; state.feedIndex = i; save(); r.querySelector(".hint-swipe")?.remove(); };
          r.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => { seen(); go(`#/card/${id}`); }));
          nav.drag(r, { dir: "forward", target: () => `#/card/${id}`, onCommit: () => { seen(); buzz(6); } });

          r.querySelector("[data-like]").onclick = (e) => {
            const b = e.currentTarget;
            const circle = b.querySelector(".circle");
            if (state.liked.includes(id)) {
              state.liked = state.liked.filter((x) => x !== id);
              b.setAttribute("aria-pressed", false);
              pop(circle, 0.85);
              save();
              return;
            }
            state.liked.push(id);
            state.passed = state.passed.filter((x) => x !== id);
            state.prefs = nudge(state.prefs, drinkById[id], true);
            b.setAttribute("aria-pressed", true);
            pop(circle);
            burst(circle, app);
            buzz(12);
            toast("끌린 맛을 다음 추천에 반영할게요");
            rerankAfter(i);
          };

          r.querySelector("[data-pass]").onclick = (e) => {
            buzz(8);
            e.currentTarget.querySelector(".circle").animate(
              [{ transform: "rotate(0)" }, { transform: "rotate(90deg) scale(.9)" }, { transform: "rotate(90deg)" }],
              { duration: 220, easing: EASE });
            const art = r.querySelector(".reel-visual svg");
            // Scroll only after the fly-away ends; a running animation can stop Chrome's smooth scroll.
            art.animate(
              [{ transform: "none", opacity: 1 }, { transform: "translate(-80px, 30px) rotate(-18deg) scale(.85)", opacity: 0 }],
              { duration: 280, easing: "cubic-bezier(.5,0,.75,0)" });
            if (!state.passed.includes(id)) state.passed.push(id);
            state.liked = state.liked.filter((x) => x !== id);
            state.prefs = nudge(state.prefs, drinkById[id], false);
            toast("비슷한 맛은 뒤로 미룰게요");
            rerankAfter(i);
            const moveOn = () => {
              art.style.opacity = 0;
              const next = r.nextElementSibling;
              if (next) f.scrollTo({ top: next.offsetTop, behavior: "smooth" });
              setTimeout(() => (art.style.opacity = ""), 900);
            };
            setTimeout(moveOn, 290);
          };
        });
      }
      bind(f);

      // First visit: briefly show that the taste card sits on the right.
      if (!state.hintSeen && !peeked) {
        peeked = true;
        setTimeout(() => {
          const cur = state.order[state.feedIndex];
          if (nav.current()?.el === el && !state.hintSeen && cur) nav.peek(`#/card/${cur}`);
        }, 1200);
      }
    },
  };
}

let depth = 1;
function card({ parts }) {
  ensureRecs();
  const d = drinkById[parts[1]];
  if (!d) { go("#/feed", { replace: true }); return null; }
  const ex = explain(d, state.answers);
  const revs = reviewsFor(d.id);
  const top = topChip(revs);
  const pours = poursFor(d.id);
  const cheapest = pours.slice().sort((a, b) => a.price - b.price)[0];
  const near = new Set(pours.filter((p) => minutes(p.bar.distance) <= 10).map((p) => p.bar.id)).size;
  const mode = state.answers.q3;
  const liked = state.liked.includes(d.id);
  const country = d.origin.split(" ")[0];
  const sense = (k, c, v) => `<div class="sense"><i style="background:${c}">${k}</i><span>${esc(v)}</span></div>`;
  const make = (k, title, sub) => `<div class="make"><span class="tag">${k}</span><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;

  const deep = () => {
    if (depth < 2) return "";
    return `<div class="deep">
      <p style="margin-bottom:8px">맛 점수 (팀 기준 1~5)</p>
      ${AXES.map((a) => `<div class="bar-row"><span>${AXIS_LABEL[a]}</span><span class="track"><span class="fill" style="display:block;width:${d.taste[a] * 20}%"></span></span><span>${d.taste[a]}</span></div>`).join("")}
      <p class="src">산지 ${esc(d.origin)} · 도수 ${esc(d.abvLabel)}<br>${d.verified ? "출처 확인 완료" : "사실 정보는 팀 확인 전 초안이에요"}${d.sourceUrl ? ` · <a href="${esc(d.sourceUrl)}" target="_blank" rel="noopener" style="color:inherit">출처</a>` : ""}</p>
    </div>`;
  };
  const backBody = () => `
    ${make("원료", d.ingredients, depth >= 1 ? d.glossary : "")}
    ${make("제조", d.process, "")}
    ${make("숙성", d.aging, "")}`;

  const reviewList = revs.length
    ? revs.map((r) => `<div class="review"><div class="meta">
        ${r.sample ? `<span class="tag">직접 맛봄</span>` : `<span class="tag mine">내 후기 · 직접 맛봄</span>`}
        <span>${esc(r.reaction)}</span><span>· ${r.chips.map(esc).join(", ")}</span></div>
        ${r.text ? esc(r.text) : ""}</div>`).join("")
    : `<p class="empty">아직 직접 맛본 후기가 없어요.<br>근처에서 맛보고 첫 후기를 남겨주세요.</p>`;

  const ctaClass = mode === "home" ? "btn-secondary" : "btn-primary";
  const fromFeed = location.hash.startsWith("#/feed") || (nav.prevHash() || "").startsWith("#/feed");
  return {
    html: `<section class="screen card-screen" style="background:${drinkColor(d)}">
      <div class="card-top">
        <button class="icon-btn" data-back aria-label="뒤로">${I.back}</button><span>${fromFeed ? "피드로 돌아가기" : "돌아가기"}</span>
        <span class="spacer"></span>
        <button class="icon-btn" data-like aria-pressed="${liked}" aria-label="끌려요" style="color:${liked ? "var(--ruby)" : "inherit"}">${liked ? I.heart.replace('fill="none"', 'fill="currentColor"') : I.heart}</button>
      </div>
      <div class="scroll">
        <div class="flip" id="flip" data-noswipe>
          <div class="flip-inner">
            <div class="face front" role="button" tabindex="0" aria-label="카드 뒤집기">
              <span class="tag" style="background:${drinkColor(d)}">${esc(shortName(d))} · ${esc(country)} ${esc(d.category)} ${esc(abvShort(d))}</span>
              <h1 class="h1">${esc(d.oneLine)}</h1>
              ${sense("향", "var(--c-fruit)", d.aroma)}
              ${sense("맛", "var(--c-grain)", d.flavor)}
              ${sense("느낌", "var(--c-citrus)", d.feel)}
              <div class="box compare"><p class="label">내가 아는 술과 비교하면</p>${esc(d.vsSoju)}</div>
              <div class="box why"><p class="label">왜 나에게 맞을까요?</p>${ex.why.map(esc).join(" ")}<p class="risk">${esc(ex.risk[0])}</p></div>
              <p class="proof"><span class="dot">${I.check}</span>${revs.length ? `직접 맛본 후기 ${revs.length}개${top ? ` · '${esc(top)}'가 가장 많아요` : ""}` : "아직 직접 맛본 후기가 없어요"}</p>
              <p class="flip-hint">${I.flip} 카드를 탭하면 원료와 만드는 방법이 보여요</p>
            </div>
            <div class="face back" role="button" tabindex="0" aria-label="카드 뒤집기">
              <span class="tag">뒷면 · 만드는 이야기</span>
              <h2 class="h2">${esc(d.name)}</h2>
              <div id="backBody">${backBody()}</div>
              <div class="depth" data-noflip>
                <label for="depth">정보 깊이</label>
                <input id="depth" type="range" min="0" max="2" step="1" value="${depth}">
                <div class="ends"><span>쉽게</span><span>전문가처럼</span></div>
              </div>
              <div id="deep">${deep()}</div>
              <p class="flip-hint" style="color:inherit;opacity:.7">${I.flip} 탭하면 앞면으로</p>
            </div>
          </div>
        </div>
        <div class="reviews"><p class="section-title" style="margin-top:0">직접 맛본 후기</p>${reviewList}</div>
      </div>
      <div class="bottom">
        <a class="btn ${ctaClass}" href="#/nearby/${d.id}">근처에서 한 잔 맛보기</a>
        <p class="cta-sub">${cheapest ? `${cheapest.ml}mL ${won(cheapest.price)}부터 · 걸어서 10분 이내 ${near}곳` : "아직 맛볼 수 있는 곳이 없어요"}</p>
      </div>
    </section>`,
    mount(el) {
      const flip = el.querySelector("#flip");
      const inner = flip.querySelector(".flip-inner");
      // The angle keeps growing (0, 180, 360...) so every flip turns the same way as the finger.
      let angle = 0;
      const setAngle = (a, smooth = true) => {
        inner.style.transition = smooth ? "" : "none";
        inner.style.transform = `rotateY(${a}deg)`;
      };
      const settleFlip = () => {
        flip.classList.toggle("flipped", Math.round(angle / 180) % 2 !== 0);
        setAngle(angle);
      };
      const toggle = () => { angle += 180; settleFlip(); buzz(6); };
      let fd = null;
      flip.addEventListener("pointerdown", (e) => {
        if (e.target.closest("[data-noflip], a") || (e.pointerType === "mouse" && e.button !== 0)) return;
        fd = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false };
      });
      flip.addEventListener("pointermove", (e) => {
        if (!fd || e.pointerId !== fd.id) return;
        const dx = e.clientX - fd.x;
        const dy = e.clientY - fd.y;
        if (!fd.on) {
          if (Math.hypot(dx, dy) < 10) return;
          if (Math.abs(dx) < Math.abs(dy) * 1.2) { fd = null; return; }
          fd.on = true;
          try { flip.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        }
        setAngle(angle + Math.max(-180, Math.min(180, dx * 0.6)), false);
      });
      const flipEnd = (e) => {
        if (!fd || e.pointerId !== fd.id) return;
        const { on, x } = fd;
        fd = null;
        if (!on) return;
        swallowClick(flip);
        const turned = (e.clientX - x) * 0.6;
        if (e.type !== "pointercancel" && Math.abs(turned) > 50) { angle += turned < 0 ? -180 : 180; buzz(6); }
        settleFlip();
      };
      flip.addEventListener("pointerup", flipEnd);
      flip.addEventListener("pointercancel", flipEnd);
      el.querySelectorAll(".face").forEach((f) => {
        f.addEventListener("click", (e) => { if (!e.target.closest("[data-noflip], a")) toggle(); });
        f.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === f) { e.preventDefault(); toggle(); } });
      });
      el.querySelector("#depth").addEventListener("input", (e) => {
        depth = Number(e.target.value);
        el.querySelector("#backBody").innerHTML = backBody();
        el.querySelector("#deep").innerHTML = deep();
      });
      el.querySelector("[data-back]").onclick = () => back();
      const likeBtn = el.querySelector("[data-like]");
      likeBtn.onclick = () => {
        const on = !state.liked.includes(d.id);
        if (on) {
          state.liked.push(d.id);
          state.prefs = nudge(state.prefs, d, true);
          toast("끌린 맛을 다음 추천에 반영할게요");
          burst(likeBtn, app);
          buzz(12);
        } else {
          state.liked = state.liked.filter((x) => x !== d.id);
        }
        save();
        likeBtn.setAttribute("aria-pressed", on);
        likeBtn.style.color = on ? "var(--ruby)" : "inherit";
        likeBtn.innerHTML = on ? I.heart.replace('fill="none"', 'fill="currentColor"') : I.heart;
        pop(likeBtn, on ? 1.3 : 0.85);
      };
    },
  };
}

/* ---------- C. nearby, bar, review ---------- */
const PIN_POS = { B1: [62, 64], B2: [28, 47], B3: [80, 34], B4: [47, 26] };
const filters = { small: true, open: false, fresh: false };
let sheetSnap = "mid";

function nearby({ parts }) {
  const d = parts[1] ? drinkById[parts[1]] : null;
  const passes = (p) => (!filters.small || p.ml <= 30) && (!filters.fresh || p.openedDays <= 3) && (!filters.open || openNow(p.bar.hours));
  const list = BARS.map((b) => {
    const pours = b.pours.map((p) => ({ ...p, bar: b })).filter((p) => (!d || p.drinkId === d.id) && passes(p));
    return { b, pours };
  }).filter((x) => x.pours.length).sort((a, b) => minutes(a.b.distance) - minutes(b.b.distance));

  const map = `<svg class="streets" viewBox="0 0 390 760" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
    <rect width="390" height="760" fill="#F4E6CC"/>
    <path d="M250 0 C220 160 300 300 240 440 S200 600 230 760 L300 760 C270 600 280 500 310 420 S300 160 320 0z" fill="#B9DDEB"/>
    <rect x="0" y="330" width="90" height="170" rx="14" fill="#C5E3A9"/>
    <g stroke="#FFFDF8" stroke-width="14" fill="none" stroke-linecap="round">
      <path d="M-10 250 L400 210"/><path d="M60 -10 L120 770"/><path d="M180 -10 L170 770"/><path d="M-10 470 L400 420"/><path d="M300 -10 L390 220"/>
    </g>
    <g stroke="#FFFDF8" stroke-width="6" fill="none"><path d="M0 130 L390 100"/><path d="M240 220 L260 770"/><path d="M0 620 L180 340"/></g>
  </svg>`;
  const pins = BARS.map((b) => {
    const hit = list.find((x) => x.b.id === b.id);
    const [x, y] = PIN_POS[b.id] || [50, 50];
    const min = hit ? hit.pours.slice().sort((a, c) => a.price - c.price)[0] : null;
    return `<button class="pin ${hit ? "" : "dim"}" style="left:${x}%" data-y="${y}" data-bar="${b.id}" aria-label="${esc(b.name)}">
      ${hit ? `<span class="tagp">${d ? won(min.price) : esc(b.name)}</span>` : ""}${I.mapPin(hit ? "#F9BAA6" : "#FFFDF8")}</button>`;
  }).join("");

  const items = list.map(({ b, pours }) => {
    const p = pours.slice().sort((a, c) => a.price - c.price)[0];
    return `<button class="bar-item" data-bar="${b.id}">
      <span class="sw" style="background:${BAR_COLOR[b.id]}"></span>
      <span><b>${esc(b.name)}</b><small>${esc(b.area.split(" ").at(-1))} · ${esc(b.distance)}</small></span>
      <span class="price">${d ? `${p.ml}mL ${won(p.price)}` : `${pours.length}종`}<small>${d ? `개봉 ${p.openedDays}일째` : `${won(p.price)}부터`}</small></span>
    </button>`;
  }).join("");

  return {
    html: `<section class="screen nearby-screen">
      <div class="map">${map}${pins}<span class="me" data-y="82" aria-label="내 위치"></span>
        <div class="search">${I.search}<span>내 주변 · ${d ? `${esc(shortName(d))} 한 잔` : "한 잔 할 수 있는 곳"}</span>
          ${d ? `<a href="#/nearby" style="margin-left:auto;color:var(--muted)" aria-label="술 선택 해제">${I.x.replace("<svg", '<svg width="16" height="16"')}</a>` : ""}</div>
        <div class="filters">
          <button class="chip" data-f="small" aria-pressed="${filters.small}">10~30mL 소량</button>
          <button class="chip" data-f="open" aria-pressed="${filters.open}">지금 영업중</button>
          <button class="chip" data-f="fresh" aria-pressed="${filters.fresh}">개봉 3일 이내</button>
        </div>
      </div>
      <div class="sheet">
        <div class="sheet-head" role="button" tabindex="0" aria-label="목록 펼치기 접기"><div class="grip"></div>
          <p class="section-title" style="margin:0">${list.length ? `근처 ${list.length}곳에서 맛볼 수 있어요` : "조건에 맞는 곳이 없어요"}</p></div>
        <div class="sheet-body">${items || `<p class="empty">필터를 줄여보세요.</p>`}</div>
      </div>
      ${tabbar("nearby")}
    </section>`,
    mount(el) {
      el.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { filters[b.dataset.f] = !filters[b.dataset.f]; buzz(5); render(); }));

      // Bottom sheet with three resting heights. Drag the head, or tap it to switch.
      const sheet = el.querySelector(".sheet");
      const head = el.querySelector(".sheet-head");
      const avail = () => el.clientHeight - el.querySelector(".tabbar").offsetHeight;
      const snaps = () => ({ full: 124, mid: Math.round(el.clientHeight * 0.44), low: avail() - 88 });
      const place = (y, smooth) => {
        sheet.style.transition = smooth ? `top .34s ${EASE}` : "none";
        sheet.style.top = `${y}px`;
      };
      place(snaps()[sheetSnap], false);
      // Keep pins in the band that stays visible above the sheet at its middle height.
      const band = [150, snaps().mid - 24];
      el.querySelectorAll("[data-y]").forEach((p) => {
        p.style.top = `${band[0] + ((Number(p.dataset.y) - 20) / 65) * (band[1] - band[0])}px`;
      });
      let sd = null;
      head.addEventListener("pointerdown", (e) => {
        sd = { id: e.pointerId, y: e.clientY, top: sheet.offsetTop, ly: e.clientY, lt: e.timeStamp, v: 0, moved: false };
        try { head.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      });
      head.addEventListener("pointermove", (e) => {
        if (!sd || e.pointerId !== sd.id) return;
        const dy = e.clientY - sd.y;
        if (Math.abs(dy) > 4) sd.moved = true;
        const s = snaps();
        place(Math.min(s.low + 30, Math.max(s.full - 30, sd.top + dy)), false);
        const dt = e.timeStamp - sd.lt;
        if (dt > 0) sd.v = 0.7 * ((e.clientY - sd.ly) / dt) + 0.3 * sd.v;
        sd.ly = e.clientY;
        sd.lt = e.timeStamp;
      });
      const sheetEnd = (e) => {
        if (!sd || e.pointerId !== sd.id) return;
        const { moved, v } = sd;
        sd = null;
        const s = snaps();
        if (!moved) sheetSnap = sheetSnap === "mid" ? "full" : "mid";
        else {
          const aim = sheet.offsetTop + v * 160;
          sheetSnap = Object.entries(s).sort((a, b) => Math.abs(a[1] - aim) - Math.abs(b[1] - aim))[0][0];
        }
        place(s[sheetSnap], true);
        buzz(5);
      };
      head.addEventListener("pointerup", sheetEnd);
      head.addEventListener("pointercancel", sheetEnd);
      head.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        sheetSnap = sheetSnap === "mid" ? "full" : "mid";
        place(snaps()[sheetSnap], true);
      });
      el.querySelectorAll("[data-bar]").forEach((b) => (b.onclick = () => go(`#/bar/${b.dataset.bar}${d ? `?drink=${d.id}` : ""}`)));
    },
  };
}

let going = false;
function bar({ parts, q }) {
  const b = barById[parts[1]];
  if (!b) { go("#/nearby", { replace: true }); return null; }
  const focus = q.get("drink");
  const groups = {};
  b.pours.forEach((p) => (groups[p.drinkId] ||= []).push(p));
  const ids = Object.keys(groups).sort((a, c) => (a === focus ? -1 : c === focus ? 1 : 0));
  const first = groups[ids[0]];
  let sel = { drinkId: ids[0], ml: first.filter((p) => p.ml <= 30).sort((a, c) => c.ml - a.ml)[0]?.ml ?? first[0].ml };
  going = false;

  const pourHTML = (id) => {
    const d = drinkById[id];
    const ps = groups[id];
    const opened = ps[0].openedDays;
    return `<div class="pour ${sel.drinkId === id ? "focus" : ""}">
      <div class="pour-head"><span class="d" style="background:${drinkColor(d)}"></span>
        <a href="#/card/${id}" style="color:inherit">${esc(shortName(d))}</a>
        <small>개봉 ${opened}일째${opened <= 2 ? " · 신선해요" : ""}${ps.some((p) => p.lastToday) ? " · 오늘 소진 예정" : ""}</small></div>
      <div class="chips">${ps.map((p) => `<button class="chip" data-d="${id}" data-ml="${p.ml}" aria-pressed="${sel.drinkId === id && sel.ml === p.ml}">${p.ml}mL ${won(p.price)}</button>`).join("")}</div>
    </div>`;
  };
  return {
    html: `<section class="screen">
      <div class="bar-hero" style="background:${BAR_COLOR[b.id]}">
        <span class="shape" style="width:220px;height:220px;right:-40px;top:-60px;background:rgba(255,253,248,.45)"></span>
        <span class="shape" style="width:160px;height:160px;left:40px;bottom:-90px;background:rgba(92,51,23,.12)"></span>
        <button class="icon-btn" data-back aria-label="뒤로">${I.back}</button>
      </div>
      <div class="scroll pad">
        <h1 class="h2" style="font-size:24px">${esc(b.name)} · ${esc(b.area.split(" ").at(-1).replace("동", ""))}</h1>
        <p class="sub">${esc(b.area)} · ${esc(b.distance)} · 오늘 ${esc(b.hours)} ${openNow(b.hours) ? "· 영업중" : "· 영업 전"}</p>
        <p class="section-title">지금 맛볼 수 있는 잔</p>
        <div id="pours">${ids.map(pourHTML).join("")}</div>
        <div id="going"></div>
      </div>
      <div class="bottom">
        <button class="btn btn-primary" data-go>길 찾기</button>
        <p class="note">주문과 결제는 매장에서 해요</p>
      </div>
    </section>`,
    mount(el) {
      el.querySelector("[data-back]").onclick = () => back("#/nearby");
      const bindChips = () => el.querySelectorAll("[data-ml]").forEach((c) => (c.onclick = () => {
        sel = { drinkId: c.dataset.d, ml: Number(c.dataset.ml) };
        el.querySelector("#pours").innerHTML = ids.map(pourHTML).join("");
        bindChips();
        if (going) showGoing();
      }));
      bindChips();
      const showGoing = () => {
        const d = drinkById[sel.drinkId];
        el.querySelector("#going").innerHTML = `<div class="going"><b>${esc(b.name)}로 가는 중이에요</b><br>
          실제 서비스에서는 지도 앱으로 길을 안내해요. ${esc(shortName(d))} ${sel.ml}mL를 맛본 뒤 아래 버튼으로 후기를 남겨주세요.</div>`;
      };
      el.querySelector("[data-go]").onclick = (e) => {
        if (!going) {
          going = true;
          showGoing();
          e.currentTarget.textContent = "맛보고 왔어요, 후기 남기기";
          el.querySelector(".scroll").scrollTo({ top: 9999, behavior: "smooth" });
        } else {
          go(`#/review/${sel.drinkId}?bar=${b.id}&ml=${sel.ml}`);
        }
      };
    },
  };
}

function review({ parts, q }) {
  const d = drinkById[parts[1]];
  if (!d) { go("#/feed", { replace: true }); return null; }
  const b = barById[q.get("bar")];
  const ml = q.get("ml");
  const form = { reaction: null, chips: [], text: "" };
  const REACT = [
    { id: "딱 내 취향", sub: "다시 마실래요", c: "var(--c-fruit)" },
    { id: "괜찮았어요", sub: "한 번쯤 좋아요", c: "var(--c-grain)" },
    { id: "내 취향 아님", sub: "다른 걸 볼래요", c: "var(--c-flower)" },
  ];
  return {
    html: `<section class="screen">
      <div class="top"><button class="icon-btn" data-back aria-label="뒤로" style="background:var(--mist)">${I.back}</button></div>
      <div class="scroll pad" style="padding-top:8px">
        <h1 class="h1">맛보고 오셨나요?</h1>
        <p class="done-line"><span class="proof" style="margin:0"><span class="dot">${I.check}</span></span>${esc(shortName(d))}${ml ? ` ${esc(ml)}mL` : ""}${b ? ` · ${esc(b.name)}` : ""}</p>
        <span class="tag" style="background:var(--mist);margin-top:10px">직접 맛본 후기로 등록돼요</span>
        <p class="section-title">내 입맛에 맞았어요?</p>
        <div class="reactions">${REACT.map((r) => `<button class="reaction" data-r="${r.id}" style="background:${r.c}" aria-pressed="false"><b>${r.id}</b><small>${r.sub}</small></button>`).join("")}</div>
        <p class="section-title">어떤 맛이 느껴졌어요?</p>
        <div class="chips">${CHIPS.map((c) => `<button class="chip" data-c="${esc(c.label)}" aria-pressed="false">${esc(c.label)}</button>`).join("")}</div>
        <p class="section-title">한 줄 후기 <span style="font-weight:400;color:var(--muted);font-size:12px">(선택)</span></p>
        <textarea class="field" rows="2" maxlength="80" placeholder="예: 복숭아 아이스티인데 술이라 신기했어요"></textarea>
      </div>
      <div class="bottom">
        <button class="btn btn-primary" data-submit disabled>후기 남기기</button>
        <p class="note">남긴 후기는 다음 사람의 맛 카드에 반영돼요</p>
      </div>
    </section>`,
    mount(el) {
      el.querySelector("[data-back]").onclick = () => back();
      const submit = el.querySelector("[data-submit]");
      el.querySelectorAll("[data-r]").forEach((r) => (r.onclick = () => {
        form.reaction = r.dataset.r;
        el.querySelectorAll("[data-r]").forEach((x) => x.setAttribute("aria-pressed", x === r));
        submit.disabled = false;
      }));
      el.querySelectorAll("[data-c]").forEach((c) => (c.onclick = () => {
        const v = c.dataset.c;
        form.chips = form.chips.includes(v) ? form.chips.filter((x) => x !== v) : [...form.chips, v];
        c.setAttribute("aria-pressed", form.chips.includes(v));
      }));
      submit.onclick = () => {
        form.text = el.querySelector("textarea").value.trim();
        state.reviews.unshift({ drinkId: d.id, barId: b?.id || null, ml: ml ? Number(ml) : null, ...form, date: new Date().toISOString() });
        if (form.reaction === "딱 내 취향") state.prefs = nudge(state.prefs || prefsFromAnswers([]), d, true);
        if (form.reaction === "내 취향 아님") state.prefs = nudge(state.prefs || prefsFromAnswers([]), d, false);
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
  const mini = (d, extra) => `<a class="mini" href="#/card/${d.id}" style="color:inherit;text-decoration:none">
    <span class="sw" style="background:${drinkColor(d)}">${bottle(d, { title: false })}</span>
    <span><b>${esc(shortName(d))}</b><small>${esc(extra)}</small></span><span style="color:var(--muted)">›</span></a>`;
  const liked = state.liked.map((id) => drinkById[id]).filter(Boolean);
  return {
    html: `<section class="screen">
      <div class="scroll pad" style="padding-top:calc(20px + env(safe-area-inset-top))">
        <h1 class="h1">내 기록</h1>
        <div class="log-card" style="margin-top:16px">
          <span class="pill" style="background:var(--c-fruit)">지금 내 취향</span>
          <p class="h1" style="font-size:26px;margin-top:10px">${esc(typeName())}</p>
          <p class="sub">끌려요, 패스, 후기를 남길 때마다 조금씩 바뀌어요.</p>
          <div class="bars">${bars(state.prefs, 5)}</div>
          <a class="btn btn-secondary" href="#/q/1" style="margin-top:16px;height:44px;font-size:14px">취향 다시 찾기</a>
        </div>
        <p class="section-title">끌린 술 ${liked.length}</p>
        ${liked.length ? liked.map((d) => mini(d, d.oneLine)).join("") : `<p class="empty">피드에서 하트를 누르면 여기 모여요.</p>`}
        <p class="section-title">직접 맛본 후기 ${state.reviews.length}</p>
        ${state.reviews.length ? state.reviews.map((r) => mini(drinkById[r.drinkId], `${r.reaction}${r.barId ? ` · ${barById[r.barId].name}` : ""}${r.text ? ` · ${r.text}` : ""}`)).join("") : `<p class="empty">근처 바에서 맛보고 후기를 남기면 여기 쌓여요.</p>`}
        <p class="sub" style="margin-top:28px;text-align:center">술, 바, 가격, 후기는 모두 샘플 데이터예요.<br><button class="link" data-reset>처음부터 다시 하기</button></p>
      </div>
      ${tabbar("log")}
    </section>`,
    mount(el) {
      el.querySelector("[data-reset]").onclick = () => {
        if (confirm("취향, 끌린 술, 후기를 모두 지울까요?")) { reset(); dropFeed(); go("#/", { replace: true, dir: "back" }); }
      };
    },
  };
}

nav.start();
