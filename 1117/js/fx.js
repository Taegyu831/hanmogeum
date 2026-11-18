// Small feedback effects: haptic tick, pop, and a burst of dots.

const reduce = matchMedia("(prefers-reduced-motion: reduce)");

// Android Chrome vibrates; iOS Safari ignores this silently.
export function buzz(ms = 8) {
  try { navigator.vibrate?.(ms); } catch (e) { /* ignore */ }
}

export function pop(el, peak = 1.28) {
  if (reduce.matches) return;
  el.animate(
    [{ transform: "scale(1)" }, { transform: `scale(${peak})`, offset: 0.35 }, { transform: "scale(.94)", offset: 0.7 }, { transform: "scale(1)" }],
    { duration: 420, easing: "ease-out" });
}

export function burst(target, root, colors = ["#8C1D2B", "#E8963C", "#F9BAA6"]) {
  if (reduce.matches) return;
  const r = target.getBoundingClientRect();
  const a = root.getBoundingClientRect();
  const cx = r.left - a.left + r.width / 2;
  const cy = r.top - a.top + r.height / 2;
  const n = 9;
  for (let k = 0; k < n; k++) {
    const dot = document.createElement("i");
    dot.className = "spark";
    dot.style.left = `${cx}px`;
    dot.style.top = `${cy}px`;
    dot.style.background = colors[k % colors.length];
    root.append(dot);
    const ang = (k / n) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 30 + Math.random() * 16;
    dot.animate(
      [
        { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px)) scale(.2)`, opacity: 0 },
      ],
      { duration: 560, easing: "cubic-bezier(.2,.8,.2,1)" },
    ).finished.then(() => dot.remove(), () => dot.remove());
  }
}
