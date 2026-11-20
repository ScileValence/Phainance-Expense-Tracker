import React from "react";
import { colorFor } from "../../utils/palette";

// Category picker rendered as buttons (same look as the Source chips on the Income page).
// onChange receives { target: { name, value } } so existing form handlers keep working.
export default function CategoryChips({ categories, value, onChange, name = "categoryId", allowClear = false, ariaLabel = "Category" }) {
  const selected = String(value ?? "");

  return (
    <div className="chip-group" role="group" aria-label={ariaLabel}>
      {categories.map((cat) => {
        const on = selected === String(cat.id);
        const color = colorFor(cat.name);
        return (
          <button
            type="button"
            key={cat.id}
            className={`chip ${on ? "active" : ""}`}
            aria-pressed={on}
            style={on ? { background: color, borderColor: color, color: color === "#c8f23c" ? "#15161a" : "#fff" } : undefined}
            onClick={() => onChange({ target: { name, value: on && allowClear ? "" : cat.id } })}
          >
            {cat.name}
          </button>
        );
      })}
      {categories.length === 0 && <span className="hint">No categories yet</span>}
    </div>
  );
}
