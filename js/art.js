// Flat illustrations: bottles per drink type, plus a color per drink.

const INK = "#5C3317";
const CREAM = "#FFF6E6";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function shortName(d) {
  return d.name.replace(/\s*\(.*\)\s*/, "").trim();
}

// Background color from the drink's strongest aroma family.
export function drinkColor(d) {
  const t = d.taste;
  const aromas = ["fruit", "flower", "grain", "wood", "smoke", "herb"];
  const top = aromas.reduce((a, b) => (t[b] > t[a] ? b : a));
  if (top === "fruit") {
    if (t.sour >= 4) return "var(--c-citrus)";
    if (t.body >= 3) return "var(--c-berry)";
    return "var(--c-fruit)";
  }
  if (top === "smoke") return "var(--c-smoke)";
  return `var(--c-${top})`;
}

function labelText(d) {
  // One word per line keeps the label text large on narrow bottles.
  const words = shortName(d).split(" ");
  if (words.length <= 3) return words;
  return [words.slice(0, 2).join(" "), words.slice(2).join(" ")];
}

function label(d, x, y, w, h, fill, color, sub) {
  const lines = labelText(d);
  const size = Math.min(17, (w - 8) / Math.max(...lines.map((l) => l.replace(/[0-9.]/g, "").length + l.replace(/[^0-9.]/g, "").length * 0.6)));
  const cy = y + h / 2 - (lines.length - 1) * size * 0.6 - (sub ? 6 : 0);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/>
    ${lines.map((l, i) => `<text x="${x + w / 2}" y="${cy + i * size * 1.2}" text-anchor="middle" dominant-baseline="middle" font-family="Jua, sans-serif" font-size="${size.toFixed(1)}" fill="${color}">${esc(l)}</text>`).join("")}
    ${sub ? `<text x="${x + w / 2}" y="${y + h - 12}" text-anchor="middle" font-family="Gothic A1, sans-serif" font-size="7" letter-spacing=".5" fill="${color}" opacity=".7">${esc(sub)}</text>` : ""}`;
}

function kind(d) {
  if (d.name.includes("하이볼")) return "highball";
  if (d.category === "와인") return d.taste.fizz >= 3 ? "sparkling" : "wine";
  if (d.category === "전통주") return d.id === "K2" ? "makgeolli" : "jar";
  if (d.category === "맥주") return "beer";
  if (d.category === "사케") return "sake";
  if (d.category === "진") return "gin";
  return "spirit";
}

const ORIGIN_EN = { "와인": "WINE", "전통주": "KOREAN TRADITIONAL", "위스키": "WHISKY", "진": "GIN", "럼": "RUM", "사케": "SAKE", "브랜디": "BRANDY", "데킬라": "TEQUILA", "맥주": "BEER" };

export function bottle(d, { title = true } = {}) {
  const k = kind(d);
  const sub = ORIGIN_EN[d.category] || "";
  const t = title ? `<title>${esc(shortName(d))} 병 그림</title>` : "";
  const open = `<svg viewBox="0 0 140 260" role="img" xmlns="http://www.w3.org/2000/svg">${t}`;
  switch (k) {
    case "wine":
    case "sparkling":
      return `${open}
        <rect x="58" y="6" width="24" height="${k === "sparkling" ? 22 : 14}" rx="3" fill="${k === "sparkling" ? "#D9A441" : "#3B2A1E"}"/>
        <path d="M60 18h20v52c0 14 26 22 26 50v126a10 10 0 0 1-10 10H44a10 10 0 0 1-10-10V120c0-28 26-36 26-50z" fill="${INK}"/>
        ${label(d, 42, 138, 56, 74, CREAM, INK, sub)}</svg>`;
    case "jar":
      return `${open}
        <rect x="56" y="40" width="28" height="12" rx="3" fill="${INK}"/>
        <path d="M60 52h20v14c34 10 46 40 46 86 0 52-20 98-56 98s-56-46-56-98c0-46 12-76 46-86z" fill="${CREAM}" stroke="${INK}" stroke-opacity=".12" stroke-width="2"/>
        ${label(d, 34, 126, 72, 72, "#F4D98A", INK, "KOREAN")}</svg>`;
    case "makgeolli":
      return `${open}
        <rect x="54" y="20" width="32" height="18" rx="4" fill="#3E7D4A"/>
        <path d="M58 38h24v16c20 6 26 18 26 34v158a8 8 0 0 1-8 8H40a8 8 0 0 1-8-8V88c0-16 6-28 26-34z" fill="#FBFAF4" stroke="${INK}" stroke-opacity=".12" stroke-width="2"/>
        ${label(d, 40, 130, 60, 70, "#3E7D4A", CREAM, "KOREAN")}</svg>`;
    case "sake":
      return `${open}
        <rect x="58" y="10" width="24" height="16" rx="3" fill="${INK}"/>
        <path d="M60 26h20v40c22 16 30 40 30 70v110a8 8 0 0 1-8 8H38a8 8 0 0 1-8-8V136c0-30 8-54 30-70z" fill="#E6EEF2" stroke="${INK}" stroke-opacity=".15" stroke-width="2"/>
        ${label(d, 42, 140, 56, 74, "#FFFDF8", INK, sub)}</svg>`;
    case "gin":
      return `${open}
        <rect x="54" y="16" width="32" height="18" rx="4" fill="${INK}"/>
        <path d="M60 34h20v18c22 4 28 14 28 30v164a10 10 0 0 1-10 10H42a10 10 0 0 1-10-10V82c0-16 6-26 28-30z" fill="#DDEFE3" stroke="${INK}" stroke-opacity=".15" stroke-width="2"/>
        ${label(d, 40, 120, 60, 84, "#FFFDF8", INK, sub)}</svg>`;
    case "beer":
      return `${open}
        <rect x="60" y="20" width="20" height="10" rx="3" fill="#D9A441"/>
        <path d="M62 30h16v50c14 10 20 22 20 40v126a10 10 0 0 1-10 10H52a10 10 0 0 1-10-10V120c0-18 6-30 20-40z" fill="#8A5A2B"/>
        ${label(d, 44, 136, 52, 72, CREAM, INK, sub)}</svg>`;
    case "highball":
      return `${open}
        <path d="M30 70h80l-8 176a10 10 0 0 1-10 10H48a10 10 0 0 1-10-10z" fill="rgba(255,253,248,.55)" stroke="${INK}" stroke-opacity=".25" stroke-width="2"/>
        <path d="M34 110h72l-6 136a8 8 0 0 1-8 8H48a8 8 0 0 1-8-8z" fill="#F2C46B"/>
        <circle cx="60" cy="150" r="4" fill="#FFF6E6" opacity=".8"/><circle cx="80" cy="180" r="3" fill="#FFF6E6" opacity=".8"/><circle cx="66" cy="210" r="5" fill="#FFF6E6" opacity=".8"/>
        <circle cx="96" cy="74" r="20" fill="#F7E05C" stroke="#E2C23A" stroke-width="3"/>
        <text x="70" y="40" text-anchor="middle" font-family="Jua, sans-serif" font-size="15" fill="${INK}">하이볼</text></svg>`;
    default: // spirit: square shouldered bottle
      return `${open}
        <rect x="56" y="10" width="28" height="20" rx="4" fill="#3B2A1E"/>
        <rect x="60" y="30" width="20" height="26" fill="${d.category === "데킬라" ? "#E8EEF0" : "#C98A3E"}"/>
        <path d="M44 56h52a14 14 0 0 1 14 14v176a10 10 0 0 1-10 10H40a10 10 0 0 1-10-10V70a14 14 0 0 1 14-14z" fill="${d.category === "데킬라" ? "#E8EEF0" : "#C98A3E"}" stroke="${INK}" stroke-opacity=".15" stroke-width="2"/>
        ${label(d, 40, 112, 60, 90, CREAM, INK, sub)}</svg>`;
  }
}
