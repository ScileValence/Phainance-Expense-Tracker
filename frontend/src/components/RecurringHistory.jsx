import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { money } from "../utils/recurring";

const LABEL = { PAID: "Paid", SKIPPED: "Skipped", AUTO_PAID: "Logged automatically" };
const CLASS = { PAID: "ev-paid", SKIPPED: "ev-skipped", AUTO_PAID: "ev-auto" };

const day = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" });

// What happened to each occurrence of one payment, newest first.
export default function RecurringHistory({ id }) {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    let live = true;
    api
      .get(`/recurring/${id}/history`)
      .then((res) => live && setEvents(res.data || []))
      .catch(() => live && setEvents([]));
    return () => {
      live = false;
    };
  }, [id]);

  if (events === null) return <div className="rec-history hint">Loading…</div>;
  if (events.length === 0) return <div className="rec-history hint">Nothing has happened to this payment yet.</div>;

  return (
    <div className="rec-history">
      {events.map((e) => (
        <div className="rec-event" key={e.id}>
          <span className="when">{day(e.dueDate)}</span>
          <span className={`ev ${CLASS[e.action] || ""}`}>{LABEL[e.action] || e.action}</span>
          <span className="amt">{e.action === "SKIPPED" ? "" : money(e.amount)}</span>
        </div>
      ))}
    </div>
  );
}
