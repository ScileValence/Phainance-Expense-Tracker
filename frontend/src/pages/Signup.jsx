import React, { useState } from "react";
import api from "../api/axios";
import { toast } from "react-toastify";
import { importGuestData } from "../utils/guestImport";
import { useNavigate, Link } from "react-router-dom";
import "../styles/auth.css";
import dunesImg from "../assets/dunes.jpg";

export default function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const res = await api.post("/auth/register", { username, email, password });
      if (res.data.token) {
        localStorage.setItem("token", res.data.token);
        setSuccess("Account created! We emailed you a link to verify your address.");
        try {
          const r = await importGuestData();
          if (r) toast.success(`Imported ${r.done} guest entries${r.failed ? ` (${r.failed} failed)` : ""}`);
        } catch {
          toast.error("Couldn’t import guest data");
        }
        setTimeout(() => navigate("/dashboard", { replace: true }), 1800);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-image">
        <img src={dunesImg} alt="" />
        <div className="overlay-text">
          <div className="brand-mark">p</div>
          <h1>phainance</h1>
          <p>A calmer way to <span className="accent">manage money.</span></p>
        </div>
      </div>

      <div className="auth-form-card">
        <h2>Create account</h2>
        <p className="small-text">Start tracking expenses in under a minute.</p>

        {error && <p className="error-msg">{error}</p>}
        {success && <p className="success-msg">{success}</p>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Username</label>
            <input className="input" type="text" placeholder="yourname" value={username}
              onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary">Sign up</button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
        <p className="auth-footer" style={{ marginTop: 10 }}>
          Just looking? <Link to="/dashboard">Continue as guest</Link>
        </p>
      </div>
    </div>
  );
}
