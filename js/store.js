// Everything the user does lives in this object and in localStorage.
const KEY = "hanmogeum.v1";

const fresh = () => ({
  answers: { q1: [], q2: [], q3: null },
  prefs: null,
  order: [],
  liked: [],
  passed: [],
  reviews: [],
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
