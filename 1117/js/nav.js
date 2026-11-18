// Screen stack for the prototype.
// Push slides the new screen in from the right, pop slides it back out,
// tab switches cross-fade. Drags move both screens with the finger and
// only commit the navigation when the finger is released far or fast enough.

const reduce = matchMedia("(prefers-reduced-motion: reduce)");
export const EASE = "cubic-bezier(.2,.8,.2,1)";
const NAV_KEY = "hanmogeum.nav";

const hashNow = () => location.hash || "#/";
const pathOf = (h) => h.replace(/^#/, "").split("?")[0] || "/";

// After a drag, the browser still fires a click on whatever was under the finger.
export function swallowClick(el) {
  const stop = (e) => { e.stopPropagation(); e.preventDefault(); };
  el.addEventListener("click", stop, { capture: true, once: true });
  setTimeout(() => el.removeEventListener("click", stop, { capture: true }), 120);
}

export function createNav({ root, build, parentOf, isTabRoot, keep }) {
  let depth = history.state?.depth ?? 0;
  let stack = readStack();
  let current = null; // { el, hash }
  let silentPop = false;
  let busy = false;

  function readStack() {
    try { return JSON.parse(sessionStorage.getItem(NAV_KEY)) || []; } catch (e) { return []; }
  }
  function writeStack() {
    try { sessionStorage.setItem(NAV_KEY, JSON.stringify(stack)); } catch (e) { /* ignore */ }
  }

  function clear(el) {
    el.style.transform = el.style.transition = el.style.filter = el.style.zIndex = "";
    el.classList.remove("on-top");
  }
  // Take a screen off stage. The feed is kept alive so its scroll position survives.
  function retire(el) {
    if (!el) return;
    clear(el);
    if (current && el === current.el) return;
    if (keep(el)) el.classList.add("kept");
    else el.remove();
  }
  function show(hash) {
    const el = build(hash);
    if (el) el.classList.remove("kept");
    return el;
  }

  // Two screens moving together. p is progress toward the destination (0..1).
  function pair(from, to, dir) {
    const top = dir === "forward" ? to : from;
    const under = dir === "forward" ? from : to;
    top.style.zIndex = 3;
    under.style.zIndex = 2;
    top.classList.add("on-top");
    busy = true;
    const api = {
      p: 0,
      set(p) {
        api.p = p;
        const cover = dir === "forward" ? p : 1 - p;
        top.style.transform = `translate3d(${(1 - cover) * 100}%,0,0)`;
        under.style.transform = `translate3d(${-28 * cover}%,0,0)`;
        under.style.filter = `brightness(${1 - 0.12 * cover})`;
      },
      settle(commit) {
        const end = commit ? 1 : 0;
        const ms = Math.round(Math.max(170, 380 * Math.abs(end - api.p)));
        for (const e of [top, under]) e.style.transition = `transform ${ms}ms ${EASE}, filter ${ms}ms ${EASE}`;
        top.getBoundingClientRect();
        api.set(end);
        return new Promise((res) => setTimeout(() => { clear(top); clear(under); busy = false; res(); }, ms + 30));
      },
    };
    return api;
  }

  function animate(from, to, kind) {
    if (reduce.matches || kind === "none") { retire(from); return; }
    if (kind === "fade") {
      to.style.zIndex = 3;
      from.style.zIndex = 2;
      to.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: EASE })
        .finished.catch(() => {}).then(() => { clear(to); retire(from); });
      return;
    }
    const t = pair(from, to, kind);
    t.set(0);
    t.settle(true).then(() => retire(from));
  }

  function render(dir = "none") {
    const hash = hashNow();
    const prev = current;
    const el = show(hash);
    if (!el) return; // the view redirected somewhere else
    current = { el, hash };
    if (!prev || prev.el === el) return;
    const kind = isTabRoot(pathOf(prev.hash)) && isTabRoot(pathOf(hash)) ? "fade" : dir;
    animate(prev.el, el, kind);
  }

  function go(hash, { replace = false, dir } = {}) {
    if (replace) history.replaceState({ depth }, "", hash);
    else { depth += 1; history.pushState({ depth }, "", hash); }
    stack = stack.slice(0, depth);
    stack[depth] = hash;
    writeStack();
    render(dir || (replace ? "none" : "forward"));
  }

  function back(fallback) {
    if (depth > 0) { history.back(); return; }
    const h = fallback || parentOf(hashNow());
    if (h) go(h, { replace: true, dir: "back" });
  }

  const prevHash = () => (depth > 0 && stack[depth - 1]) || parentOf(hashNow());

  window.addEventListener("popstate", (e) => {
    const d = e.state?.depth ?? 0;
    const dir = d < depth ? "back" : "forward";
    depth = d;
    stack[depth] = hashNow();
    writeStack();
    if (silentPop) { silentPop = false; return; }
    render(dir);
  });

  // In-app links go through the stack so every move gets a direction.
  root.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#/"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    const h = a.getAttribute("href");
    if (h !== hashNow()) go(h);
  });

  // Finger-following navigation. dir "forward" pulls the next screen in from
  // the right (drag left); dir "back" pushes the current screen away (drag right).
  function drag(surface, { dir, target, filter, onCommit }) {
    let s = null;
    surface.addEventListener("pointerdown", (e) => {
      if (busy || (e.pointerType === "mouse" && e.button !== 0)) return;
      if (filter && !filter(e)) return;
      s = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, lt: e.timeStamp, v: 0, t: null, decided: false };
    });
    surface.addEventListener("pointermove", (e) => {
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (!s.decided) {
        if (Math.hypot(dx, dy) < 10) return;
        s.decided = true;
        const horizontal = Math.abs(dx) > Math.abs(dy) * 1.2 && (dir === "forward" ? dx < 0 : dx > 0);
        const hash = horizontal && !busy && current?.el.contains(surface) ? target() : null;
        const to = hash ? show(hash) : null;
        if (!to) { s = null; return; }
        s.hash = hash;
        s.to = to;
        s.from = current.el;
        s.t = pair(current.el, to, dir);
        try { surface.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      const dt = e.timeStamp - s.lt;
      if (dt > 0) s.v = 0.7 * ((e.clientX - s.lx) / dt) + 0.3 * s.v;
      s.lx = e.clientX;
      s.lt = e.timeStamp;
      const p = Math.min(1, Math.max(0, (dir === "forward" ? -dx : dx) / root.clientWidth));
      s.t.set(p);
    });
    const end = (e) => {
      if (!s || e.pointerId !== s.id) return;
      const { t, to, from, hash, v } = s;
      s = null;
      if (!t) return;
      swallowClick(surface);
      const speed = dir === "forward" ? -v : v; // px per ms toward committing
      const commit = e.type !== "pointercancel" && (speed > 0.4 || (t.p > 0.4 && speed > -0.2));
      if (commit) {
        current = { el: to, hash };
        if (dir === "forward") {
          depth += 1;
          history.pushState({ depth }, "", hash);
          stack = stack.slice(0, depth);
          stack[depth] = hash;
          writeStack();
        } else if (depth > 0) {
          silentPop = true;
          history.back();
        } else {
          history.replaceState({ depth }, "", hash);
          stack[depth] = hash;
          writeStack();
        }
        onCommit?.();
      }
      t.settle(commit).then(() => retire(commit ? from : to));
    };
    surface.addEventListener("pointerup", end);
    surface.addEventListener("pointercancel", end);
  }

  // A short preview of the screen on the right, so people learn it is there.
  function peek(hash, amount = 0.16) {
    if (busy || reduce.matches || !current) return;
    const from = current.el;
    const to = show(hash);
    if (!to) return;
    const t = pair(from, to, "forward");
    t.set(0);
    for (const e of [from, to]) e.style.transition = `transform 420ms ${EASE}, filter 420ms ${EASE}`;
    to.getBoundingClientRect();
    t.set(amount);
    setTimeout(() => {
      t.set(0);
      setTimeout(() => { clear(from); busy = false; retire(to); }, 450);
    }, 650);
  }

  function start() {
    history.replaceState({ depth }, "");
    stack[depth] = hashNow();
    writeStack();
    render("none");
  }

  return {
    go, back, drag, peek, start, prevHash,
    refresh: () => render("none"),
    current: () => current,
  };
}
