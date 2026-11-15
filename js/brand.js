// 앱(안드로이드)과 똑같은 그림: 로고, 질문 아이콘, 술병 일러스트, 작은 아이콘.
// 좌표와 색은 앱 코드(ui/brand/*.kt)를 그대로 옮겼다.

export const C = {
  primary: "#8B2744",
  primaryContainer: "#F6E1E9",
  onPrimaryContainer: "#5E1C34",
  bg: "#FFF9F5",
  surface: "#FFFFFF",
  surfaceVariant: "#F5EFF1",
  onSurface: "#2B2430",
  onSurfaceVariant: "#655B62",
  outline: "#D9C9CF",
  divider: "#E9DEE2",
  accent: "#A4602A",
  accentContainer: "#F7E5D3",
};

const reduce = matchMedia("(prefers-reduced-motion: reduce)");
export const reduceMotion = () => reduce.matches;

/* ---------- 움직임 도구 ---------- */
// cubic-bezier 곡선 (FastOutSlowIn = .4,0,.2,1)
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= (sx(t) - x) / d;
    }
    return sy(Math.min(1, Math.max(0, t)));
  };
}
export const FOS = bezier(0.4, 0, 0.2, 1);
const tween = (t, start, dur, from, to, ease = FOS) =>
  t <= start ? from : t >= start + dur ? to : from + (to - from) * ease((t - start) / dur);

// 질량 1, stiffness k, 감쇠비 z 인 스프링을 미리 계산해 시간에 따른 값을 돌려준다.
function springCurve(from, to, k, z, ms = 2400) {
  const c = 2 * z * Math.sqrt(k);
  const pts = [];
  let x = from, v = 0;
  const dt = 1 / 240;
  for (let t = 0; t <= ms / 1000; t += dt) {
    pts.push(x);
    const a = -k * (x - to) - c * v;
    v += a * dt;
    x += v * dt;
  }
  return (msT) => {
    const i = Math.floor((msT / 1000) / dt);
    return i >= pts.length ? to : pts[Math.max(0, i)];
  };
}

/* ---------- 로고 ---------- */
let uid = 0;
const BOWL = "M-38 -62L38 -62Q40 -6 0 2Q-40 -6 -38 -62Z";

function surfacePath(level, amp, phase) {
  let d = "M-70 70";
  for (let x = -70; x <= 70; x += 4) d += `L${x} ${(level + amp * Math.sin(x / 11 + phase)).toFixed(2)}`;
  return d + "L70 70Z";
}

function logoFrame(f) {
  const { fill, tilt, phase, amp, morph } = f;
  const inset = 10.6 * morph;
  const radius = 30 + ((60 + 10.6) - 30) * morph;
  const level = 4 + (-23 - 4) * fill;
  return { inset, radius, level, tilt, liquid: fill > 0.001 ? surfacePath(level, amp, phase) : "" , phase, amp };
}

/** 로고 SVG. size는 px. anim이 true면 시작 화면처럼 잔이 기울며 차오른다. */
export function logoSVG(size = 40, { label = "한모금 로고", fill = 1 } = {}) {
  const id = `lg${++uid}`;
  const f = logoFrame({ fill, tilt: 0, phase: 0, amp: 0, morph: 0 });
  return `<svg class="logo" data-logo="${id}" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="${label}" style="overflow:visible">
    <rect class="tile" x="${-f.inset}" y="${-f.inset}" width="${120 + 2 * f.inset}" height="${120 + 2 * f.inset}" rx="${f.radius}" fill="${C.primary}"/>
    <g transform="translate(60 69)">
      <g class="glass" transform="rotate(0 0 22)">
        <clipPath id="${id}"><path d="${BOWL}"/></clipPath>
        <g clip-path="url(#${id})"><g class="liq" transform="rotate(0 0 -24)"><path d="${f.liquid}" fill="${C.primaryContainer}"/></g></g>
        <path d="${BOWL}" fill="none" stroke="${C.bg}" stroke-width="8" stroke-linejoin="round"/>
        <path d="M0 2V40M-20 44H20" stroke="${C.bg}" stroke-width="8" stroke-linecap="round"/>
      </g>
    </g>
  </svg>`;
}

/**
 * 앱 HanmogeumPourLogo와 같은 순서: 원형(시스템 시작 아이콘)에서 둥근 사각으로 바뀌고,
 * 잔이 기울며 와인이 차오르고, 똑바로 서며 찰랑이다 멈춘다. 1.4초 뒤 onSettled.
 */
export function pourLogo(svg, { fromSplash = true, onSettled = () => {} } = {}) {
  const tile = svg.querySelector(".tile");
  const glass = svg.querySelector(".glass");
  const liq = svg.querySelector(".liq");
  const path = liq.querySelector("path");
  const draw = (fr) => {
    const f = logoFrame(fr);
    tile.setAttribute("x", -f.inset); tile.setAttribute("y", -f.inset);
    tile.setAttribute("width", 120 + 2 * f.inset); tile.setAttribute("height", 120 + 2 * f.inset);
    tile.setAttribute("rx", f.radius);
    glass.setAttribute("transform", `rotate(${fr.tilt} 0 22)`);
    liq.setAttribute("transform", `rotate(${-fr.tilt} 0 -24)`);
    path.setAttribute("d", f.liquid);
  };
  if (reduce.matches) {
    draw({ fill: 1, tilt: 0, phase: 0, amp: 0, morph: 0 });
    onSettled();
    return;
  }
  // 기울기: 220ms 뒤 420ms 동안 -13도, 380ms 쉬고 스프링(감쇠 0.42, 강성 200)으로 0도
  const back = springCurve(-13, 0, 200, 0.42);
  const tiltAt = (t) => (t < 220 ? 0 : t < 640 ? tween(t, 220, 420, 0, -13) : t < 1020 ? -13 : back(t - 1020));
  const fillAt = (t) => tween(t, 380, 880, 0, 1);
  const sloshAt = (t) => (t < 1260 ? tween(t, 0, 400, 0, 1) : tween(t, 1260, 2200, 1, 0));
  const t0 = performance.now();
  let settled = false;
  const step = (now) => {
    const t = now - t0;
    draw({
      morph: fromSplash ? tween(t, 0, 620, 1, 0) : 0,
      tilt: tiltAt(t),
      fill: fillAt(t),
      phase: (Math.min(t, 3600) / 3600) * 6 * Math.PI,
      amp: 3.2 * sloshAt(t),
    });
    if (!settled && t >= 1400) { settled = true; onSettled(); }
    if (t < 3600 && svg.isConnected) requestAnimationFrame(step);
  };
  draw({ morph: fromSplash ? 1 : 0, tilt: 0, fill: 0, phase: 0, amp: 0 });
  requestAnimationFrame(step);
}

/* ---------- 질문 아이콘 (24 격자, 선 1.8) ---------- */
const G = {
  americano: [["f", "M5 12h11v3a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4z"], ["s", "M5 9h11v6a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4z"],
    ["s", "M16 11h1.5a2.5 2.5 0 0 1 0 5H16"], ["s", "M8.5 2.8c1 1 1 2.2 0 3.2M12 2.8c1 1 1 2.2 0 3.2"]],
  peachtea: [["f", "M7.8 11h8.4l-.8 9H8.6z"], ["s", "M7 6h10l-1.4 14H8.4z"], ["s", "M13 6l2-4"], ["s", "M9.6 12.6h2.6v2.6H9.6z"]],
  soda: [["f", "M7.6 9h8.8l-.9 11H8.5z"], ["s", "M7 5h10l-1.3 15H8.3z"], ["c", 10.2, 16, 1.1], ["c", 13.4, 12.2, 1.3], ["c", 11, 9.4, 0.8]],
  latte: [["f", "M4.5 9.5h12v1.5a6 6 0 0 1-12 0z"], ["s", "M4 9h13v2a6.5 6.5 0 0 1-13 0z"], ["s", "M17 10.2h1a2.3 2.3 0 0 1 0 4.6h-1.6"],
    ["s", "M3 20.5h15"], ["s", "M7.5 6.5c1-1.2 2-1.2 3 0s2 1.2 3 0"]],
  juice: [["f", "M7.7 12h8.6l-.7 8H8.4z"], ["s", "M7 8h10l-1.2 12H8.2z"], ["s", "M13.5 7.5a3.5 3.5 0 0 1 7 0z"],
    ["s", "M17 7.5V4.2M17 7.5l-2.2-2.2M17 7.5l2.2-2.2"]],
  herbtea: [["f", "M5 19C5 11 10.5 5 19.5 4.5 19.5 13 14 19 5 19z"], ["s", "M5 19C5 11 10.5 5 19.5 4.5 19.5 13 14 19 5 19z"], ["s", "M5 19l9-9"]],
  // 와인 면은 잔 둘레와 같은 원(중심 12,6 반지름 5)을 따라 그려서 테두리 밖으로 삐져나오지 않는다.
  taste: [["f", "M7.1 7h9.8A5 5 0 0 1 7.1 7z"], ["s", "M7 3h10v3A5 5 0 0 1 7 6z"],
    ["s", "M12 11V19.5M8.8 20.5h6.4"]],
  home: [["f", "M6 9.44L12 4.5l6 4.94V20H6z"], ["s", "M3.5 11.5L12 4.5l8.5 7"], ["s", "M6 10v10h12V10"], ["s", "M10 20v-5h4v5"]],
  friends: [["g", "rotate(-14 8 20)", [["f", "M4.8 12h6.4l-.6 7H5.4z"], ["s", "M4 7h8l-1.2 12H5.2z"]]],
    ["g", "rotate(14 16 20)", [["f", "M12.8 12h6.4l-.6 7h-5.2z"], ["s", "M12 7h8l-1.2 12h-5.6z"]]], ["s", "M12 1.8v2.2M8.6 2.8l1 1.6M15.4 2.8l-1 1.6"]],
};
function glyphParts(list, color) {
  return list.map((p) => {
    if (p[0] === "f") return `<path d="${p[1]}" fill="${color}" fill-opacity=".22"/>`;
    if (p[0] === "s") return `<path d="${p[1]}"/>`;
    if (p[0] === "c") return `<circle cx="${p[1]}" cy="${p[2]}" r="${p[3]}"/>`;
    return `<g transform="${p[1]}">${glyphParts(p[2], color)}</g>`;
  }).join("");
}
export function glyph(id, size = 36, color = C.primary) {
  const g = G[id];
  if (!g) return "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphParts(g, color)}</svg>`;
}

/* ---------- 술병 일러스트 (40 x 100 격자) ---------- */
const SPEC = {
  W1: ["wine", "#E8D48B"], W2: ["wine", "#E0D88F"], W3: ["wine", "#E9CF72"], W4: ["sparkling", "#EBD98F"],
  W5: ["wine", "#8E2235"], W6: ["wine", "#5A1424"], K1: ["round", "#D9A949"], K2: ["makgeolli", "#EFE8D8", 30],
  K3: ["slim", "#CFC86A"], K4: ["slim", "#E6EEF1"], K5: ["wine", "#5E1730"], K6: ["square", "#D7A33E"], K7: ["slim", "#EADFA8"],
  H1: ["square", "#C98A2E"], H2: ["square", "#B8792A"], H3: ["square", "#A8641F"], H4: ["highball", "#E6C870", 44],
  H5: ["square", "#DDEBF0"], H6: ["round", "#6A3B17"], H7: ["slim", "#EEF1EC"], H8: ["round", "#A85A1E"], H9: ["slim", "#EEF0EC"],
  H10: ["beer", "#F0CB6A", 44],
};
function specFor(d) {
  const s = SPEC[d.id];
  if (s) return { v: s[0], liquid: s[1], top: s[2] ?? 52 };
  const c = d.category;
  if (c === "와인") return { v: "wine", liquid: "#8E2235", top: 52 };
  if (c === "맥주") return { v: "beer", liquid: "#F0CB6A", top: 52 };
  if (["위스키", "브랜디", "럼"].includes(c)) return { v: "square", liquid: "#C98A2E", top: 52 };
  return { v: "slim", liquid: "#EADFA8", top: 52 };
}
const BODY = {
  wine: "M16 6H24V28C24 36 34 38 34 46V92Q34 96 30 96H10Q6 96 6 92V46C6 38 16 36 16 28Z",
  slim: "M15.5 8H24.5V24C24.5 31 31 33 31 41V92Q31 96 27 96H13Q9 96 9 92V41C9 33 15.5 31 15.5 24Z",
  square: "M16 10H24V26L32.5 33V92Q32.5 96 28.5 96H11.5Q7.5 96 7.5 92V33L16 26Z",
  round: "M17 8H23V36C32 40 36 51 36 65C36 84 30 96 20 96C10 96 4 84 4 65C4 51 8 40 17 36Z",
  makgeolli: "M14.5 14H25.5V21C31.5 23 33 27 33 33V90Q33 96 27 96H13Q7 96 7 90V33C7 27 8.5 23 14.5 21Z",
  beer: "M17 8H23V30C23 38 31 40 31 48V92Q31 96 27 96H13Q9 96 9 92V48C9 40 17 38 17 30Z",
  highball: "M7 30H33L30.5 95H9.5Z",
};
BODY.sparkling = BODY.wine;
const OUT = "rgba(43,36,48,.78)";
const darken = (hex, f = 0.6) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
};

function vessel(d) {
  const s = specFor(d);
  const id = `bt${++uid}`;
  const body = BODY[s.v];
  let o = `<clipPath id="${id}"><path d="${body}"/></clipPath>`;
  o += `<path d="${body}" fill="#fff" fill-opacity=".75"/>`;
  o += `<g clip-path="url(#${id})"><rect x="0" y="${s.top}" width="40" height="100" fill="${s.liquid}"/>`
    + `<rect x="10.5" y="30" width="2.6" height="58" fill="#fff" fill-opacity=".35"/></g>`;
  if (["wine", "slim", "square", "round", "beer"].includes(s.v)) {
    const top = s.v === "round" ? 58 : 60;
    const [l, r] = s.v === "wine" ? [9, 31] : s.v === "slim" || s.v === "beer" ? [11.5, 28.5] : s.v === "square" ? [10.5, 29.5] : [9, 31];
    o += `<rect x="${l}" y="${top}" width="${r - l}" height="20" rx="2" fill="${C.bg}"/>`
      + `<path d="M${l + 4} ${top + 8}H${r - 4}" stroke="${darken(s.liquid)}" stroke-width="1.6" stroke-linecap="round"/>`
      + `<path d="M${l + 6} ${top + 13}H${r - 6}" stroke="rgba(43,36,48,.35)" stroke-width="1.2" stroke-linecap="round"/>`;
  } else if (s.v === "makgeolli") {
    for (const y of [46, 54, 62]) o += `<path d="M8.5 ${y}H31.5" stroke="rgba(43,36,48,.3)" stroke-width="1.2"/>`;
    o += `<rect x="13.5" y="6" width="13" height="9" rx="2" fill="#2E7D4F"/><rect x="9" y="66" width="22" height="18" rx="2" fill="${C.bg}"/>`
      + `<path d="M13 74H27" stroke="#2E7D4F" stroke-width="1.6" stroke-linecap="round"/>`;
  } else if (s.v === "highball") {
    for (const [x, y, r] of [[15, 80, 1.4], [22, 66, 1.8], [18, 56, 1.1], [25, 84, 1.2]]) o += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" fill-opacity=".9"/>`;
    o += `<circle cx="30" cy="30" r="7" fill="#F2D24B"/><circle cx="30" cy="30" r="5" fill="#FFF4C2"/>`;
  }
  o += `<path d="${body}" fill="none" stroke="${OUT}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (s.v === "wine") o += `<rect x="15.5" y="6" width="9" height="9" fill="${C.primary}"/>`;
  else if (s.v === "sparkling") o += `<path d="M15 4H25V22C25 26 22 27 20 27C18 27 15 26 15 22Z" fill="#C9A646"/><path d="M16 18H24" stroke="${OUT}" stroke-width="1.2"/>`;
  else if (["slim", "square", "beer"].includes(s.v)) {
    const [x, w] = s.v === "slim" ? [15, 10] : s.v === "square" ? [15.5, 9] : [16.5, 7];
    o += `<rect x="${x}" y="3" width="${w}" height="7" rx="1.5" fill="#6B4A2B"/>`;
  } else if (s.v === "round") o += `<rect x="16.5" y="3" width="7" height="7" rx="1.5" fill="#6B4A2B"/>`;
  return o;
}

/** 앱 DrinkArtTile: 옅은 타일 위에 술병. 장식이라 화면 읽기에서 건너뛴다. */
export function drinkArt(d, w = 72, h = 96) {
  const cw = w * 0.6, ch = h - 12;
  return `<span class="art" style="width:${w}px;height:${h}px" aria-hidden="true"><svg width="${cw}" height="${ch}" viewBox="0 0 40 100">${vessel(d)}</svg></span>`;
}

// 크게 보이는 곳(피드, 맛 카드)에만 쓰는 실사 이미지. 작은 썸네일은 위의 그림을 그대로 쓴다.
// 사진은 ChatGPT로 만든 상표 없는 병 이미지를 술 ID별로 잘라 img/drinks에 둔 것.
export function drinkPhoto(d, w, h) {
  return `<span class="art photo" style="width:${w}px;height:${h}px" aria-hidden="true"><img src="img/drinks/${d.id}.webp" alt="" decoding="async"></span>`;
}

/* ---------- 작은 아이콘 ---------- */
const HEART = "M12 20.5C12 20.5 3.5 15.3 3.5 9.2C3.5 6.4 5.6 4.5 8 4.5C9.7 4.5 11.2 5.5 12 6.9C12.8 5.5 14.3 4.5 16 4.5C18.4 4.5 20.5 6.4 20.5 9.2C20.5 15.3 12 20.5 12 20.5Z";
export const icon = {
  heart: (filled, size = 24, color = "currentColor") =>
    `<svg class="i-heart" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART}" fill="${filled ? color : "none"}" stroke="${color}" stroke-width="1.9" stroke-linejoin="round"/></svg>`,
  back: (size = 22) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><path d="M65 20L30 50L65 80" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  check: (size = 14) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><path d="M20 52L42 74L82 28" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  cross: (size = 18, w = 13) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><path d="M25 25L75 75M75 25L25 75" stroke="currentColor" stroke-width="${w}" stroke-linecap="round"/></svg>`,
  hand: (size = 22) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12.5V5.2a1.6 1.6 0 0 1 3.2 0V11M12.2 10.2a1.6 1.6 0 0 1 3.2 0V11.6M15.4 11a1.6 1.6 0 0 1 3.2 0v3.6a6.4 6.4 0 0 1-6.4 6.4h-.8a5.4 5.4 0 0 1-4.5-2.4l-2.6-3.9a1.6 1.6 0 0 1 2.6-1.9L9 14.6" fill="#fff" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chevronLeft: (size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><path d="M62 20L34 50L62 80" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chevronRight: (size = 20, w = 20) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><path d="M38 22L66 50L38 78" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chevronDown: (size = 24) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><path d="M25 40L50 64L75 40" fill="none" stroke="currentColor" stroke-width="21" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  pin: (size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 1.5C5.9 1.5 3.5 3.9 3.5 7c0 4.1 5.5 9.5 5.5 9.5s5.5-5.4 5.5-9.5c0-3.1-2.4-5.5-5.5-5.5z" fill="currentColor"/><circle cx="9" cy="7" r="2.1" fill="#fff"/></svg>`,
  mapPin: (size = 26, color = C.primary) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C8 2 5 5 5 9c0 5.3 7 13 7 13s7-7.7 7-13c0-4-3-7-7-7z" fill="${color}"/><circle cx="12" cy="9" r="2.8" fill="#fff"/></svg>`,
  // 탭 막대용 (앱에는 없는 웹 탭이라 같은 선 스타일로 그림)
  compass: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor"/></svg>`,
  pinLine: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`,
  book: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z"/></svg>`,
};

/* 시음 단계 잔 (24 격자) */
export function stepGlass(fill, active) {
  const id = `sg${++uid}`;
  const top = 13.1 - (13.1 - 3) * fill;
  const stroke = active ? C.primary : C.outline;
  return `<svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
    <clipPath id="${id}"><path d="M6.8 3h10.4c.3 6.6-1.6 9.9-5.2 10.1C8.4 12.9 6.5 9.6 6.8 3z"/></clipPath>
    ${fill > 0.01 ? `<rect class="sg-liq" clip-path="url(#${id})" x="0" y="${top}" width="24" height="24" fill="${C.primary}" fill-opacity=".75"/>` : ""}
    <path d="M6.8 3h10.4c.3 6.6-1.6 9.9-5.2 10.1C8.4 12.9 6.5 9.6 6.8 3z" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M12 13.1V19.5M8.8 20.5h6.4" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;
}
