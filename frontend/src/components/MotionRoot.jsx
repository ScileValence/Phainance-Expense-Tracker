import React, { useEffect, useLayoutEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { initMotion, reducedMotion, rubber } from "../utils/motion";

const seen = new Set();

// Thin progress bar: only shows if a request takes longer than ~120ms, so quick responses stay silent
// and slow ones still tell you the app is working (Doherty threshold).
function NetworkBar() {
  const [phase, setPhase] = useState("idle"); // idle | on | done

  useEffect(() => {
    let timer = 0;
    let visible = false;
    const onChange = (e) => {
      if (e.detail > 0) {
        if (!timer && !visible) {
          timer = setTimeout(() => {
            visible = true;
            setPhase("on");
          }, 120);
        }
      } else {
        clearTimeout(timer);
        timer = 0;
        if (visible) {
          visible = false;
          setPhase("done");
          setTimeout(() => setPhase("idle"), 260);
        }
      }
    };
    window.addEventListener("net:inflight", onChange);
    return () => window.removeEventListener("net:inflight", onChange);
  }, []);

  return <div className={`net-bar ${phase}`} aria-hidden="true" />;
}

export default function MotionRoot() {
  const { pathname } = useLocation();

  useEffect(() => {
    initMotion();
  }, []);

  // Entrance animation only the FIRST time a screen is opened in a session (frequency of use):
  // revisits are instant. Items come in one after another (staggering).
  useLayoutEffect(() => {
    if (seen.has(pathname)) return;
    const firstScreen = seen.size === 0;
    seen.add(pathname);
    const page = document.querySelector(".page");
    const side = firstScreen ? document.querySelector(".sidebar") : null;
    page?.classList.add("intro");
    side?.classList.add("intro");
    const t = setTimeout(() => {
      page?.classList.remove("intro");
      side?.classList.remove("intro");
    }, 900);
    return () => clearTimeout(t);
  }, [pathname]);

  // Rubber banding: on touch screens, pulling past the top or bottom stretches the page and springs back.
  useEffect(() => {
    if (!window.matchMedia?.("(pointer: coarse)").matches || reducedMotion()) return undefined;
    let startY = 0;
    let pulling = false;
    let el = null;

    const edges = () => ({
      top: window.scrollY <= 0,
      bottom: Math.ceil(window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 1,
    });
    const onStart = (e) => {
      startY = e.touches[0].clientY;
      pulling = false;
    };
    const onMove = (e) => {
      if (document.body.style.overflow === "hidden" || e.target.closest?.(".table-wrap, .ui-popover, .settings-dialog")) return;
      const dy = e.touches[0].clientY - startY;
      const { top, bottom } = edges();
      if ((dy > 0 && top) || (dy < 0 && bottom)) {
        el = el || document.querySelector(".page");
        if (!el) return;
        if (e.cancelable) e.preventDefault();
        pulling = true;
        const d = dy > 0 ? rubber(dy) : -rubber(-dy);
        el.style.transition = "none";
        el.style.transformOrigin = dy > 0 ? "top center" : "bottom center";
        el.style.transform = `translateY(${d}px) scaleY(${1 + Math.abs(d) / 900})`;
      }
    };
    const onEnd = () => {
      if (!pulling || !el) return;
      pulling = false;
      el.style.transition = "transform 280ms cubic-bezier(.34,1.56,.64,1)";
      el.style.transform = "";
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return <NetworkBar />;
}
