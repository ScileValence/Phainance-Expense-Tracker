import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { Download, Moon, Settings, Sun, Trash2, Upload, X } from "lucide-react";
import Select from "./ui/Select";
import CategoryManager from "./CategoryManager";
import Collapse from "./ui/Collapse";
import EmailPreferences from "./EmailPreferences";
import { lastPoint, reducedMotion, revealTheme, rubber } from "../utils/motion";
import { CURRENCIES, activeCode, setCurrency, useCurrency } from "../utils/currency";
import { authState } from "../utils/auth";
import { closeSettings, useSettingsOpen } from "../utils/settingsStore";
import {
  MAX_IMPORT_BYTES,
  applyImport,
  buildExport,
  clearAllData,
  countRows,
  downloadJson,
  errorMessage,
  exportFilename,
  parseImport,
} from "../utils/dataTools";
import "../styles/settings.css";

const reloadSoon = () => setTimeout(() => window.location.reload(), 900);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function SettingsDialog({ onClose }) {
  const { rates } = useCurrency();
  const guest = authState().mode !== "user";
  const dialogRef = useRef(null);
  const fileRef = useRef(null);

  const [theme, setTheme] = useState(document.body.getAttribute("data-theme") || "light");
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState(null); // null | { type: "import", name, clean } | { type: "clear" }
  const [confirmText, setConfirmText] = useState("");

  const [shown, setShown] = useState(false);
  const closeTimer = useRef(0);
  const drag = useRef(null);

  // closing plays the open animation backwards; pressing close mid-open just reverses it
  const requestClose = useCallback(() => {
    setShown(false);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(onClose, reducedMotion() ? 0 : 200);
  }, [onClose]);

  // grow out of the place that was pressed (origin awareness)
  useLayoutEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const r = d.getBoundingClientRect();
    const left = r.left + (r.width - d.offsetWidth) / 2;
    const top = r.top + (r.height - d.offsetHeight) / 2;
    const fresh = Date.now() - lastPoint.t < 2000;
    d.style.transformOrigin = fresh ? `${lastPoint.x - left}px ${lastPoint.y - top}px` : "50% 50%";
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  // focus handling, Escape and background scroll lock
  useEffect(() => {
    const prev = document.activeElement;
    dialogRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      // an open dropdown (rendered in a portal) handles its own Escape first
      if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector(".ui-popover")) requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [requestClose]);

  // drag the header down to dismiss; pull it up and it resists, then springs back (rubber banding)
  const onHeadDown = (e) => {
    if (e.target.closest("button")) return;
    drag.current = { y0: e.clientY, t0: performance.now(), dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dialogRef.current.classList.remove("springing");
    dialogRef.current.classList.add("dragging");
  };
  const onHeadMove = (e) => {
    const g = drag.current;
    if (!g) return;
    g.dy = e.clientY - g.y0;
    dialogRef.current.style.transform = `translateY(${g.dy > 0 ? g.dy : -rubber(-g.dy, 56)}px)`;
  };
  const onHeadUp = () => {
    const g = drag.current;
    if (!g) return;
    drag.current = null;
    const d = dialogRef.current;
    d.classList.remove("dragging");
    const velocity = g.dy / Math.max(1, performance.now() - g.t0);
    if (g.dy > 110 || velocity > 0.7) {
      d.style.transform = "translateY(110vh)";
      requestClose();
    } else {
      d.classList.add("springing");
      d.style.transform = "";
    }
  };

  const pickTheme = (next) => {
    if (next === theme) return;
    revealTheme(() => {
      document.body.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
    setTheme(next);
  };

  const doExport = async () => {
    setBusy(true);
    try {
      const data = await buildExport();
      downloadJson(data, exportFilename());
      toast.success(`Exported ${data.expenses.length} expenses and ${data.income.length} income entries.`);
    } catch (err) {
      toast.error(`Export failed: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      toast.error("That file is too large (max 5 MB).");
      return;
    }
    try {
      const clean = parseImport(await file.text());
      if (countRows(clean) === 0) {
        toast.error("Nothing valid to import in that file.");
        return;
      }
      setConfirmText("");
      setPanel({ type: "import", name: file.name, clean });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const runImport = async (replace) => {
    setBusy(true);
    try {
      const { done, failed } = await applyImport(panel.clean, { replace });
      if (failed) toast.warn(`Imported ${done} items, ${failed} failed.`);
      else toast.success(`Imported ${done} items.`);
      requestClose();
      reloadSoon();
    } catch (err) {
      toast.error(`Import failed: ${errorMessage(err)}`);
      setBusy(false);
    }
  };

  const runClear = async () => {
    setBusy(true);
    try {
      await clearAllData();
      toast.success("All data cleared.");
      requestClose();
      reloadSoon();
    } catch (err) {
      toast.error(`Couldn't clear data: ${errorMessage(err)}`);
      setBusy(false);
    }
  };

  const active = activeCode();
  const POPULAR = ["INR", "USD", "EUR", "GBP"]; // a short list first: fewer choices to scan (Hick's law)
  const currencyOption = (cur) => ({
    value: cur.code,
    label: `${cur.symbol}  ${cur.code} · ${cur.name}`,
    disabled: cur.code !== "INR" && !rates?.[cur.code],
  });
  const currencyOptions = [
    { group: true, disabled: true, value: "__popular", label: "Popular" },
    ...CURRENCIES.filter((c) => POPULAR.includes(c.code)).map(currencyOption),
    { group: true, disabled: true, value: "__all", label: "All currencies" },
    ...CURRENCIES.filter((c) => !POPULAR.includes(c.code)).map(currencyOption),
  ];
  const c = panel?.type === "import" ? panel.clean : null;

  return (
    <div className={`settings-overlay ${shown ? "shown" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1} ref={dialogRef}>
        <div className="settings-head" onPointerDown={onHeadDown} onPointerMove={onHeadMove} onPointerUp={onHeadUp} onPointerCancel={onHeadUp}>
          <h3 id="settings-title">
            <Settings size={18} /> Settings
          </h3>
          <button type="button" className="settings-close" onClick={requestClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <div className="settings-body">
          <Collapse title="Display" defaultOpen>
            <div className="seg" role="group" aria-label="Theme">
              <button type="button" className={theme === "light" ? "on" : ""} onClick={() => pickTheme("light")}>
                <Sun size={15} /> Light
              </button>
              <button type="button" className={theme === "dark" ? "on" : ""} onClick={() => pickTheme("dark")}>
                <Moon size={15} /> Dark
              </button>
            </div>
            <div className="sub-label">Currency</div>
            <Select
              name="currency"
              value={active}
              ariaLabel="Display currency"
              onChange={(e) => setCurrency(e.target.value)}
              options={currencyOptions}
            />
            <p className="settings-note">
              {rates ? "Amounts are stored in INR and converted for display." : "Live rates unavailable: showing INR."}{" "}
              <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">
                Rates by ExchangeRate-API
              </a>
            </p>
          </Collapse>

          <Collapse title="Categories">
            <CategoryManager />
            <p className="settings-note">A category in use can't be deleted. Move its expenses to another category first.</p>
          </Collapse>

          <Collapse title="Emails">
            <EmailPreferences onLeave={requestClose} />
          </Collapse>

          <Collapse title="Your data">
            <p className="settings-note" style={{ marginTop: 0 }}>
              {guest ? "Guest data lives only in this browser." : "Data is saved to your account."} Exports are JSON files.
            </p>

            <button type="button" className="data-row" onClick={doExport} disabled={busy}>
              <Download size={18} />
              <span>
                <strong>Export data</strong>
                <small>Download everything as a .json file</small>
              </span>
            </button>

            <button type="button" className="data-row" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload size={18} />
              <span>
                <strong>Import data</strong>
                <small>Load a Phainance .json export</small>
              </span>
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />

            <button
              type="button"
              className="data-row danger"
              onClick={() => {
                setConfirmText("");
                setPanel({ type: "clear" });
              }}
              disabled={busy}
            >
              <Trash2 size={18} />
              <span>
                <strong>Clear all data</strong>
                <small>Delete expenses, income, budgets and recurring payments</small>
              </span>
            </button>

            {c && (
              <div className="data-panel" role="group" aria-label="Confirm import">
                <strong>Import {panel.name}?</strong>
                <p>
                  {plural(c.expenses.length, "expense")}, {c.income.length} income, {plural(c.budgets.length, "budget")},{" "}
                  {c.recurring.length} recurring
                  {c.skipped ? ` · ${c.skipped} invalid row${c.skipped === 1 ? "" : "s"} will be skipped` : ""}.
                </p>
                <div className="panel-actions">
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => runImport(false)}>
                    Add to existing
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => runImport(true)}>
                    Replace all data
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setPanel(null)}>
                    Cancel
                  </button>
                </div>
                <small>Importing the same file twice with "Add to existing" creates duplicates.</small>
              </div>
            )}

            {panel?.type === "clear" && (
              <div className="data-panel danger" role="group" aria-label="Confirm clearing data">
                <strong>Delete everything{guest ? " on this device" : " in your account"}?</strong>
                <p>This cannot be undone. Export first if you might want it back. Type DELETE to confirm.</p>
                <input
                  className="input input-sm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoFocus
                  autoComplete="off"
                  aria-label="Type DELETE to confirm"
                />
                <div className="panel-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-danger-solid"
                    disabled={busy || confirmText.trim().toUpperCase() !== "DELETE"}
                    onClick={runClear}
                  >
                    Delete all data
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setPanel(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Collapse>
        </div>
      </div>
    </div>
  );
}

// Mounted once at the app root (outside <Routes>) so it survives page remounts.
export default function SettingsHost() {
  const open = useSettingsOpen();
  if (!open) return null;
  return createPortal(<SettingsDialog onClose={closeSettings} />, document.body);
}
