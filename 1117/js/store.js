// Everything the user does lives in this object and in localStorage.
const KEY = "hanmogeum.v1117"; // 11/17 보관본: 최신 버전과 기록이 섞이지 않게 따로 저장

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
  me: null, // 시연용 로그인 뒤 정해지는 { nick, level }
  feedIndex: 0,
  hintSeen: false,
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
  Object.assign(state, fresh());
  save();
}
