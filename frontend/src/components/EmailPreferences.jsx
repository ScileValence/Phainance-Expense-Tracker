import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Send, LogIn } from "lucide-react";
import api from "../api/axios";
import Select from "./ui/Select";
import { isGuest } from "../utils/auth";

const SWITCHES = [
  { key: "emailReminders", title: "Payment reminders", text: "At the due time of a recurring payment" },
  { key: "emailBudgetAlerts", title: "Budget alerts", text: "At 80% of a budget and when you go over it" },
  { key: "emailPaymentUpdates", title: "Payment updates", text: "When a payment is paused, resumed, skipped, paid, edited or stopped" },
];

const SUMMARY_OPTIONS = [
  { value: "OFF", label: "Off" },
  { value: "WEEKLY", label: "Weekly, on Mondays" },
  { value: "MONTHLY", label: "Monthly, on the 1st" },
];

// Which emails you get. Each switch saves straight away (and rolls back if the save fails).
export default function EmailPreferences({ onLeave }) {
  const navigate = useNavigate();
  const guest = isGuest();
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get("/notifications/settings")
      .then((res) => setSettings(res.data))
      .catch(() => toast.error("Could not load email settings"));
  }, []);

  useEffect(() => {
    if (!guest) load();
  }, [guest, load]);

  if (guest) {
    return (
      <>
        <p className="card-lead">Emails (reminders, budget alerts and a weekly or monthly summary) need an account.</p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ marginTop: 12 }}
          onClick={() => {
            onLeave?.();
            navigate("/login");
          }}
        >
          <LogIn size={14} /> Sign in
        </button>
      </>
    );
  }

  if (!settings) return <p className="hint">Loading…</p>;

  const ready = settings.emailConfigured && settings.emailVerified;
  const why = !settings.emailConfigured
    ? "Email is not set up on the server."
    : !settings.emailVerified
      ? `Verify ${settings.email || "your email"} first (check your inbox).`
      : null;

  const save = async (patch) => {
    const before = settings;
    setSettings({ ...settings, ...patch }); // show it at once
    try {
      const res = await api.put("/notifications/settings", patch);
      setSettings(res.data);
    } catch {
      setSettings(before);
      toast.error("Could not save that change");
    }
  };

  const sendSample = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/notifications/summary/test");
      if (data.sent) toast.success("Sample summary sent. Check your inbox.");
      else toast.info(data.reason || "Nothing was sent.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not send the sample");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {why && <p className="hint email-why">{why}</p>}

      {SWITCHES.map((row) => (
        <div className="email-pref" key={row.key}>
          <div className="setting-text">
            <strong>{row.title}</strong>
            <span>{row.text}</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!settings[row.key]}
            aria-label={row.title}
            className={`switch ${settings[row.key] ? "on" : ""}`}
            disabled={!ready}
            onClick={() => save({ [row.key]: !settings[row.key] })}
          />
        </div>
      ))}

      <div className="sub-label">Summary email</div>
      <Select
        name="summaryFrequency"
        value={settings.summaryFrequency || "OFF"}
        ariaLabel="Summary email"
        disabled={!ready}
        onChange={(e) => save({ summaryFrequency: e.target.value })}
        options={SUMMARY_OPTIONS}
      />
      <p className="settings-note">
        Spending, top categories, change since last time and what is due soon. Turning it on never sends an old one.
      </p>
      <button type="button" className="btn btn-ghost btn-sm" onClick={sendSample} disabled={!ready || busy}>
        <Send size={14} /> Send me a sample
      </button>
    </>
  );
}
