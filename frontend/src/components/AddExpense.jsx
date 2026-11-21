import Select from "./ui/Select";
import DatePicker from "./ui/DatePicker";
import React, { useRef, useState } from "react";
import api from "../api/axios";
import { useCategories } from "../utils/categories";
import { burstFrom } from "../utils/motion";
import StatusBanner from "./StatusBanner";
import { toBase, currencySymbol } from "../utils/currency";
import Sidebar from "./Sidebar";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import "../styles/dashboard.css";

export default function AddExpense() {
  const navigate = useNavigate();
  const { categories } = useCategories();
  const [form, setForm] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    categoryId: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // idle -> saving (instant spinner) -> done (check + burst) -> back to the list with the new row highlighted
  const [phase, setPhase] = useState("idle");
  const saveBtn = useRef(null);

  const submitExpense = (e) => {
    e.preventDefault();
    if (phase !== "idle") return;
    setPhase("saving");
    api
      .post("/expenses", {
        amount: toBase(form.amount),
        description: form.description.trim(),
        date: form.date,
        categoryId: form.categoryId ? parseInt(form.categoryId) : null,
      })
      .then((res) => {
        setPhase("done");
        burstFrom(saveBtn.current, { count: 7, spread: 0.8 });
        toast.success("Expense added");
        setTimeout(() => navigate("/list", { state: { fresh: res?.data?.id } }), 380);
      })
      .catch(() => {
        setPhase("idle");
        toast.error("Failed to add expense");
      });
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page">
        <StatusBanner />
        <header className="page-head fade-in">
          <div>
            <div className="eyebrow">New entry</div>
            <h2>Add expense</h2>
          </div>
          <button className="btn btn-ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={16} /> Back
          </button>
        </header>

        <form className="card page-narrow fade-in" onSubmit={submitExpense}>
          <div className="form-grid">
            <div className="field">
              <label>Amount ({currencySymbol()})</label>
              <input className="input" type="number" step="0.01" name="amount" value={form.amount}
                onChange={handleChange} required placeholder="0.00" />
            </div>
            <div className="field">
              <label>Date</label>
              <DatePicker name="date" value={form.date} onChange={handleChange} required />
            </div>
            <div className="field span-2">
              <label>Description</label>
              <input className="input" type="text" name="description" value={form.description}
                onChange={handleChange} required placeholder="e.g. Grocery shopping" />
            </div>
            <div className="field span-2">
              <label>Category</label>
              <Select
                name="categoryId"
                value={form.categoryId}
                onChange={handleChange}
                required
                placeholder="Select category"
                options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
              />
            </div>
          </div>
          <div className="form-actions">
            <button
              ref={saveBtn}
              type="submit"
              className={`btn btn-primary btn-save ${phase === "done" ? "is-done" : ""}`}
              disabled={phase !== "idle"}
              aria-busy={phase === "saving"}
            >
              {phase === "saving" && <Loader2 size={17} className="spinner" />}
              {phase === "done" && <Check size={17} className="draw-check" strokeWidth={3} />}
              {phase === "done" ? "Added" : phase === "saving" ? "Saving" : "Add expense"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate("/list")}>Cancel</button>
          </div>
        </form>
      </main>
    </div>
  );
}
