import React, { useEffect, useRef, useState } from "react";
import { reducedMotion } from "../utils/motion";

// follow-through: the number overshoots a hair, then settles (slow in, slow out)
const ease = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

// Animates between values (starts from wherever it currently is, so it can be interrupted).
export default function CountUp({ value, format = String, duration = 300 }) {
  const [shown, setShown] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    const to = Number(value) || 0;
    if (reducedMotion() || Math.abs(to - current.current) < 0.005) {
      current.current = to;
      setShown(to);
      return undefined;
    }
    const from = current.current;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      current.current = from + (to - from) * ease(t);
      setShown(current.current);
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        current.current = to;
        setShown(to);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{format(shown)}</>;
}
