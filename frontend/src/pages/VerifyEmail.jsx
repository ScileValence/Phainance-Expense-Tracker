import React, { useContext, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import api from "../api/axios";
import { AppContext } from "../context/AppContext";
import "../styles/auth.css";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const { loadAccount } = useContext(AppContext);
  const [status, setStatus] = useState("loading"); // loading | ok | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing its token.");
      return;
    }
    api
      .post("/auth/verify-email", { token })
      .then(() => {
        setStatus("ok");
        loadAccount();
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.message || "Could not verify your email.");
      });
  }, [params, loadAccount]);

  return (
    <div className="verify-wrap">
      <div className="card verify-card fade-in">
        <div className="brand-mark" style={{ margin: "0 auto 18px", background: "var(--lime)", color: "#15161a" }}>p</div>
        {status === "loading" && (
          <>
            <Loader2 size={36} className="spin" />
            <h2>Verifying…</h2>
          </>
        )}
        {status === "ok" && (
          <>
            <CheckCircle2 size={40} color="var(--ok)" />
            <h2>Email verified</h2>
            <p>You’ll now get recurring-payment reminders by email at the time they’re due.</p>
            <Link className="btn btn-primary" to="/recurring">Go to reminders</Link>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle size={40} color="var(--danger)" />
            <h2>Link problem</h2>
            <p>{message}</p>
            <Link className="btn btn-primary" to="/dashboard">Back to the app</Link>
            <p className="hint">Signed in? Use “Resend link” from the banner to get a new one.</p>
          </>
        )}
      </div>
    </div>
  );
}
