// Everything the user does lives in this object and in localStorage.
const KEY = "hanmogeum.v1";

const fresh = () => ({
  answers: { q1: [], q2: [], q3: null },
  prefs: null,
  basePrefs: null,
  fb: [],
  order: [],
  liked: [],
  passed: [],
  reviews: [],
  reviewLikes: {},
  reservations: [],
  nick: null,
  preset: null,
  skipped: false,
  me: null, // 시연용 로그인 뒤 정해지는 { nick, level }
  feedIndex: 0,
  hintSeen: false,
  swipeSeen: false,
  feedView: "grid", // 탐색 보기: grid(기본) 또는 reels
  mine: true, // 탐색 그리드의 '내 취향' 필터
  cat: null, // 탐색 그리드의 주종 필터 (null = 전체)
  taste: { sweet: 0, sour: 0, fizz: 0 }, // 탐색 그리드의 맛 필터 (0 = 상관없음, 1~3 = 약함·보통·강함)
  tastings: [], // 끝까지 한 맛보기 체험 기록
  likeHintSeen: false, // 끌려요 위치 안내를 봤는지 // 릴스처럼 위로 넘기는 안내를 봤는지
});

export const state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch (e) { /* private mode or blocked storage */ }
  return fresh();
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

export function reset() {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, fresh());
  save();
}
