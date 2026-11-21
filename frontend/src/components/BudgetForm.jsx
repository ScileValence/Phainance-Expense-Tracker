import MonthPicker from "./ui/MonthPicker";
import React, { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import Sidebar from "./Sidebar";
import StatusBanner from "./StatusBanner";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft, Check } from "lucide-react";
import { burstFrom } from "../utils/motion";
import { money, toBase, toInput, currencySymbol } from "../utils/currency";
import "../styles/dashboard.css";

export default function BudgetForm() {
  const [limit, setLimit] = useState("");
  const [info, setInfo] = useState({ month: "", limit: 0, spent: 0 });
  const [month, setMonth] = useState(
    localStorage.getItem("selectedMonth") || new Date().toISOString().slice(0, 7)
  );
  const navigate = useNavigate();

  const fetchBudget = () =>
    api
      .get(`/budget?month=${month}`)
      .then((res) => {
        setInfo(res.data || { month, limit: 0, spent: 0 });
        setLimit(res.data?.limit ? toInput(res.data.limit) : "");
      })
      .catch(() => toast.error("Failed to fetch budget data"));

  useEffect(() => {
    fetchBudget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, navigate]);

  const [done, setDone] = useState(false);
  const saveBtn = useRef(null);

  const submit = (e) => {
    e.preventDefault();
    api
      .post("/budget", { limitAmount: toBase(limit), month })
      .then(() => {
        toast.success("Budget saved");
        setDone(true);
        burstFrom(saveBtn.current, { count: 8, spread: 0.9 });
        setTimeout(() => setDone(false), 900);
        fetchBudget();
      })
      .catch(() => toast.error("Error saving budget"));
  };

  const monthLabel = new Date(`${month}-01`).toLocaleString("default", { month: "long", year: "numeric" });
  const ratio = info.limit > 0 ? info.spent / info.limit : 0;
  const barColor = ratio > 0.9 ? "var(--coral)" : ratio > 0.7 ? "var(--amber)" : "var(--ok)";

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page">
        <StatusBanner />
        <header className="page-head fade-in">
          <div>
            <div className="eyebrow">{monthLabel}</div>
            <h2>Monthly budget</h2>
          </div>
          <button className="btn btn-ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={16} /> Back
          </button>
        </header>

        <div className="page-narrow stagger" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <form className="card" onSubmit={submit}>
            <div className="form-grid">
              <div className="field">
                <label>Month</label>
                <MonthPicker
                  value={month}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    localStorage.setItem("selectedMonth", e.target.value);
                  }}
                  required
                />
              </div>
              <div className="field">
                <label>Budget limit ({currencySymbol()})</label>
                <input
                  className="input"
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder={info.limit ? `Current: ${money(info.limit)}` : "Enter budget limit"}
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <button ref={saveBtn} type="submit" className={`btn btn-primary btn-save ${done ? "is-done" : ""}`} disabled={done}>
                {done && <Check size={17} className="draw-check" strokeWidth={3} />}
                {done ? "Saved" : "Save budget"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => navigate("/dashboard")}>Cancel</button>
            </div>
          </form>

          {info.limit > 0 && (
            <div className="card">
              <h3 className="card-title">Overview</h3>
              <div className="budget-stats">
                <div><span>Limit</span><strong>{money(info.limit)}</strong></div>
                <div><span>Spent</span><strong>{money(info.spent)}</strong></div>
                <div><span>Remaining</span><strong>{money(info.limit - info.spent)}</strong></div>
              </div>
              <div className="progress">
                <span style={{ width: `${Math.min(ratio * 100, 100)}%`, background: barColor }} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
