import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

// Accordion section: fewer choices on screen at once (Hick's law). Height animates with CSS only,
// so it can be reversed mid-way.
export default function Collapse({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`acc ${open ? "open" : ""}`}>
      <button type="button" className="acc-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <h4>{title}</h4>
        <ChevronDown size={17} />
      </button>
      <div className="acc-body" inert={open ? undefined : ""}>
        <div className="acc-inner">{children}</div>
      </div>
    </section>
  );
}
