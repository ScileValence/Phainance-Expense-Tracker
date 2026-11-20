import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserRound, MailWarning } from "lucide-react";
import { toast } from "react-toastify";
import api from "../api/axios";
import { AppContext } from "../context/AppContext";
import { isGuest } from "../utils/auth";

// Guest: explains what's limited. Signed in but unverified: nudges to verify the email.
export default function StatusBanner() {
  const navigate = useNavigate();
  const { account } = useContext(AppContext);
  const [busy, setBusy] = useState(false);

  if (isGuest()) {
    return (
      <div className="banner fade-in">
        <div className="banner-icon"><UserRound size={18} /></div>
        <div className="banner-text">
          <strong>You’re in guest mode</strong>
          <span>Your data stays only in this browser. Sign in to save it to your account and get email &amp; push reminders.</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate("/login")}>Sign in</button>
      </div>
    );
  }

  if (account && account.emailVerified === false) {
    const resend = async () => {
      setBusy(true);
      try {
        const { data } = await api.post("/notifications/resend-verification");
        const msg = {
          SENT: "Verification email sent",
          COOLDOWN: "Please wait a minute before requesting another",
          ALREADY_VERIFIED: "Already verified",
          NOT_CONFIGURED: "Email isn’t set up on the server",
          FAILED: "Couldn’t send the email",
        }[data.result];
        (data.result === "SENT" ? toast.success : toast.info)(msg || "Done");
      } catch {
        toast.error("Couldn’t send the email");
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="banner banner-warn fade-in">
        <div className="banner-icon"><MailWarning size={18} /></div>
        <div className="banner-text">
          <strong>Verify your email</strong>
          <span>We sent a link to {account.email}. Email reminders start once it’s confirmed.</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={resend} disabled={busy}>Resend link</button>
      </div>
    );
  }
  return null;
}
