import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Floating panel anchored to a trigger. Rendered in a portal so tables / scroll areas never clip it.
// Flips above the trigger when there is no room below, closes on outside click and Escape.
export default function Popover({ anchorRef, open, onClose, align = "left", className = "", role = "dialog", children }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  const place = useCallback(() => {
    const a = anchorRef.current;
    const p = ref.current;
    if (!a || !p) return;
    const r = a.getBoundingClientRect();
    const ph = p.offsetHeight;
    const pw = p.offsetWidth;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = ph > below && above > below;
    const top = up ? Math.max(8, r.top - ph - 6) : r.bottom + 6;
    let left = align === "right" ? r.right - pw : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    // grow out of the trigger: origin x = trigger centre, y = the edge facing the trigger
    const originX = Math.max(0, Math.min(r.left + r.width / 2 - left, pw));
    const next = { top: Math.round(top), left: Math.round(left), minWidth: Math.round(r.width), up, originX: Math.round(originX) };
    setPos((prev) =>
      prev && prev.top === next.top && prev.left === next.left && prev.minWidth === next.minWidth && prev.up === next.up && prev.originX === next.originX
        ? prev
        : next
    );
  }, [anchorRef, align]);

  // re-measure after every render while open (content height can change, e.g. 5 vs 6 calendar rows)
  useLayoutEffect(() => {
    if (open) place();
  });

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        anchorRef.current?.querySelector("button, [tabindex]")?.focus?.();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, onClose, place, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={ref}
      role={role}
      className={`ui-popover ${pos?.up ? "up" : ""} ${className}`}
      style={{
        position: "fixed",
        top: pos ? pos.top : -9999,
        left: pos ? pos.left : -9999,
        minWidth: pos ? pos.minWidth : undefined,
        transformOrigin: pos ? `${pos.originX}px ${pos.up ? "100%" : "0"}` : undefined,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body
  );
}
