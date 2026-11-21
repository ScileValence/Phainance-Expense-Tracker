// Motion helpers: pointer origin, ripple, celebration burst, theme reveal.
// Rule of thumb used across the app: the more often something happens, the quieter it is.
//   every click   -> press feedback only (squash, ~100ms)
//   common        -> short state changes (<=200ms)
//   rare / peak   -> bigger moments (settings open, saved, paid)

export const reducedMotion = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// last place the person pressed: things grow out of here (origin awareness)
export const lastPoint = { x: window.innerWidth / 2, y: window.innerHeight / 2, t: 0 };

const setPoint = (x, y) => {
  lastPoint.x = x;
  lastPoint.y = y;
  lastPoint.t = Date.now();
};

export const centerOf = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

const RIPPLE_TARGETS = ".btn-primary, .btn-lime, .chip, .data-row";

function ripple(e) {
  const el = e.target.closest?.(RIPPLE_TARGETS);
  if (!el || el.disabled || reducedMotion()) return;
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2;
  const span = document.createElement("span");
  span.className = "ripple";
  span.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  el.appendChild(span);
  span.addEventListener("animationend", () => span.remove(), { once: true });
  setTimeout(() => span.remove(), 600);
}

let started = false;
export function initMotion() {
  if (started) return;
  started = true;
  document.addEventListener(
    "pointerdown",
    (e) => {
      setPoint(e.clientX, e.clientY);
      ripple(e);
    },
    true
  );
  // keyboard activation has no pointer: use the focused control's centre
  document.addEventListener(
    "click",
    (e) => {
      if (e.detail === 0 && e.target.getBoundingClientRect) {
        const c = centerOf(e.target);
        setPoint(c.x, c.y);
      }
    },
    true
  );
}

const COLORS = ["#c8f23c", "#6d5ef5", "#ff6b4a", "#ffb020", "#17a673"];

// Celebration: a ring plus confetti that flies on arcs (x and y use different easings, so paths curve).
export function burst(x, y, { count = 8, spread = 1 } = {}) {
  if (reducedMotion()) return;

  const ring = document.createElement("span");
  ring.className = "burst-ring";
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  document.body.appendChild(ring);
  ring
    .animate(
      [
        { transform: "translate(-50%,-50%) scale(.3)", opacity: 0.55 },
        { transform: "translate(-50%,-50%) scale(1.6)", opacity: 0 },
      ],
      { duration: 300, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" }
    )
    .finished.then(() => ring.remove());

  for (let i = 0; i < count; i++) {
    const outer = document.createElement("span");
    const inner = document.createElement("span");
    outer.className = "burst-x";
    inner.className = "burst-y";
    const size = 5 + Math.random() * 5;
    inner.style.cssText = `width:${size}px;height:${size}px;background:${COLORS[i % COLORS.length]};border-radius:${i % 3 === 0 ? "2px" : "50%"}`;
    outer.style.left = `${x}px`;
    outer.style.top = `${y}px`;
    outer.appendChild(inner);
    document.body.appendChild(outer);

    const side = (i / count - 0.5) * 2 + (Math.random() - 0.5) * 0.4; // fan out left to right
    const dx = side * (54 + Math.random() * 46) * spread;
    const up = (34 + Math.random() * 46) * spread;
    const fall = 18 + Math.random() * 30;
    const dur = 420 + Math.random() * 90;

    outer.animate([{ transform: "translateX(0)" }, { transform: `translateX(${dx}px)` }], {
      duration: dur,
      easing: "cubic-bezier(.2,.6,.3,1)",
      fill: "forwards",
    });
    inner
      .animate(
        [
          { transform: "translateY(0) scale(.6)", opacity: 1, easing: "cubic-bezier(.2,.7,.4,1)" },
          { transform: `translateY(${-up}px) scale(1.15)`, opacity: 1, offset: 0.45, easing: "cubic-bezier(.5,0,.9,.5)" },
          { transform: `translateY(${fall}px) scale(.3)`, opacity: 0 },
        ],
        { duration: dur, fill: "forwards" }
      )
      .finished.then(() => outer.remove());
  }
}

export const burstFrom = (el, opts) => {
  if (!el) return;
  const { x, y } = centerOf(el);
  burst(x, y, opts);
};

// Theme change that spreads out from where it was pressed (falls back to an instant switch).
export function revealTheme(apply) {
  const root = document.documentElement;
  if (!document.startViewTransition || reducedMotion()) {
    apply();
    return;
  }
  const { x, y } = lastPoint;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  root.classList.add("vt");
  const t = document.startViewTransition(() => apply());
  t.ready
    .then(() =>
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 300, easing: "cubic-bezier(.65,0,.35,1)", pseudoElement: "::view-transition-new(root)" }
      )
    )
    .catch(() => {});
  t.finished.finally(() => root.classList.remove("vt"));
}

// pull past the end and it resists more and more (asymptote = max)
export const rubber = (d, max = 64, k = 90) => max * (1 - Math.exp(-Math.max(d, 0) / k));
