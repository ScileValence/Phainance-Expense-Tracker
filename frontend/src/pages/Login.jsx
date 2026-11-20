import React, { useState } from "react";
import api from "../api/axios";
import { toast } from "react-toastify";
import { importGuestData } from "../utils/guestImport";
import { useNavigate, Link } from "react-router-dom";
import "../styles/auth.css";
import dunesImg from "../assets/dunes.jpg";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/auth/login", { username, password });
      localStorage.setItem("token", res.data.token);
    } catch {
      setError("Invalid username or password");
      return;
    }
    try {
      const r = await importGuestData();
      if (r) toast.success(`Imported ${r.done} guest entries${r.failed ? ` (${r.failed} failed)` : ""}`);
    } catch {
      toast.error("Couldn’t import guest data");
    }
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="auth-layout">
      <div className="auth-image">
        <img src={dunesImg} alt="" />
        <div className="overlay-text">
          <div className="brand-mark">p</div>
          <h1>phainance</h1>
          <p>Track. Save. <span className="accent">Grow.</span></p>
        </div>
      </div>

      <div className="auth-form-card">
        <h2>Welcome back</h2>
        <p className="small-text">Log in to continue managing your money.</p>
        {error && <p className="error-msg">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Username</label>
            <input className="input" type="text" placeholder="yourname" value={username}
              onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary">Sign in</button>
        </form>

        <p className="auth-footer">
          New here? <Link to="/signup">Create an account</Link>
        </p>
        <p className="auth-footer" style={{ marginTop: 10 }}>
          Just looking? <Link to="/dashboard">Continue as guest</Link>
        </p>
      </div>
    </div>
  );
}
