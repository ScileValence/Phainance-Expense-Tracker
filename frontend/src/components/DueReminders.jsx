import React, { useContext, useState } from "react";
import { BellRing, Check, SkipForward } from "lucide-react";
import { toast } from "react-toastify";
import { AppContext } from "../context/AppContext";
import { money, formatDue, relativeDue, intervalLabel } from "../utils/recurring";

export default function DueReminders() {
  const { dueItems, confirmRecurring, skipRecurring, now } = useContext(AppContext);
  const [busy, setBusy] = useState(null);

  if (dueItems.length === 0) return null;

  const run = async (fn, id, okMsg) => {
    setBusy(id);
    try {
      await fn(id);
      toast.success(okMsg);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="reminder-strip">
      {dueItems.map((r) => (
        <div className="reminder" key={r.id}>
          <div className="reminder-icon"><BellRing size={20} /></div>
          <div className="reminder-body">
            <strong>{r.title} · {money(r.amount)}</strong>
            <span>{formatDue(r)} · {relativeDue(r, now)} · {intervalLabel(r)}</span>
          </div>
          <div className="reminder-actions">
            <button
              className="btn btn-primary btn-sm"
              disabled={busy === r.id}
              onClick={() => run(confirmRecurring, r.id, "Logged as expense")}
            >
              <Check size={15} /> Mark paid
            </button>
            <button
              className="btn btn-ghost btn-sm"
              disabled={busy === r.id}
              onClick={() => run(skipRecurring, r.id, "Skipped this one")}
            >
              <SkipForward size={15} /> Skip
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
