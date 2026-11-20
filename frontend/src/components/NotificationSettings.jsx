import React, { useCallback, useEffect, useState } from "react";
import { Mail, BellRing, Send, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isGuest } from "../utils/auth";
import { toast } from "react-toastify";
import api from "../api/axios";
import { pushSupported, currentSubscription, enablePush, disablePush, syncPush } from "../utils/push";

export default function NotificationSettings() {
  const navigate = useNavigate();
  const guest = isGuest();
  const [settings, setSettings] = useState(null);
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/notifications/settings");
      setSettings(res.data);
      if (res.data.pushConfigured && pushSupported()) {
        const sub = await syncPush().catch(() => null);
        setPushOn(!!sub && Notification.permission === "granted");
      }
    } catch {
      /* settings are optional UI */
    }
  }, []);

  useEffect(() => {
    if (!guest) load();
  }, [load, guest]);

  if (guest) {
    return (
      <div className="card fade-in">
        <div className="card-head">
          <div>
            <h3 className="card-title">Reminder alerts</h3>
            <div className="card-sub">Email and push reminders need an account.</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/login")}>
            <LogIn size={14} /> Sign in
          </button>
        </div>
        <p className="hint">As a guest you still get in-app reminders while this tab is open.</p>
      </div>
    );
  }

  if (!settings) return null;

  const toggleEmail = async () => {
    try {
      const res = await api.put("/notifications/settings", { emailReminders: !settings.emailReminders });
      setSettings(res.data);
    } catch {
      toast.error("Could not update email setting");
    }
  };

  const togglePush = async () => {
    setBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
        toast.info("Push reminders off for this device");
      } else {
        await enablePush(settings.vapidPublicKey);
        setPushOn(true);
        toast.success("Push reminders on for this device");
      }
    } catch (err) {
      // stale subscription made with different keys: drop it so the next try starts clean
      if (err?.name === "InvalidStateError") {
        const sub = await currentSubscription().catch(() => null);
        if (sub) await sub.unsubscribe();
        toast.error("Push keys changed. Click again to re-enable.");
      } else {
        toast.error(err?.message || "Could not change push setting");
      }
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/notifications/test");
      const parts = [];
      if (data.emailSent) parts.push("email");
      if (data.emailSkippedUnverified) toast.info("Email skipped: verify your address first");
      if (data.pushSent > 0) parts.push("push");
      if (parts.length) toast.success(`Test sent: ${parts.join(" + ")}`);
      else toast.warn("Nothing was sent. Check the setup below.");
    } catch {
      toast.error("Test failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card fade-in">
      <div className="card-head">
        <div>
          <h3 className="card-title">Reminder alerts</h3>
          <div className="card-sub">Sent at the due time, even when the app is closed.</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={sendTest} disabled={busy}>
          <Send size={14} /> Send test
        </button>
      </div>

      <div className="setting-row">
        <div className="stat-icon"><Mail size={18} /></div>
        <div className="setting-text">
          <strong>Email</strong>
          <span>
            {!settings.emailConfigured
              ? "Not set up on the server (add MAIL_USERNAME / MAIL_PASSWORD)"
              : !settings.emailVerified
              ? `Verify ${settings.email || "your email"} first (check your inbox)`
              : settings.email || "No email on account"}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.emailReminders}
          className={`switch ${settings.emailReminders ? "on" : ""}`}
          onClick={toggleEmail}
          disabled={!settings.emailConfigured || !settings.emailVerified}
        />
      </div>

      <div className="setting-row">
        <div className="stat-icon"><BellRing size={18} /></div>
        <div className="setting-text">
          <strong>Push on this device</strong>
          <span>
            {!settings.pushConfigured
              ? "Not set up on the server (add VAPID keys)"
              : !pushSupported()
              ? "This browser doesn’t support push"
              : Notification.permission === "denied"
              ? "Blocked in browser settings"
              : pushOn
              ? "Enabled"
              : "Off"}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={pushOn}
          className={`switch ${pushOn ? "on" : ""}`}
          onClick={togglePush}
          disabled={busy || !settings.pushConfigured || !pushSupported() || Notification.permission === "denied"}
        />
      </div>
    </div>
  );
}
