import Select from "./ui/Select";
import DatePicker from "./ui/DatePicker";
import React, { useEffect, useState } from "react";
import api from "../api";
import StatusBanner from "./StatusBanner";
import { toBase, currencySymbol } from "../utils/currency";
import Sidebar from "./Sidebar";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft } from "lucide-react";
import "../styles/dashboard.css";

export default function AddExpense() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    categoryId: "",
  });

  useEffect(() => {
    api
      .get("/categories")
      .then((res) => setCategories(res.data || []))
      .catch(() => toast.error("Failed to load categories."));
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const submitExpense = (e) => {
    e.preventDefault();
    api
      .post("/expenses", {
        amount: toBase(form.amount),
        description: form.description.trim(),
        date: form.date,
        categoryId: form.categoryId ? parseInt(form.categoryId) : null,
      })
      .then(() => {
        toast.success("Expense added");
        navigate("/list");
      })
      .catch(() => toast.error("Failed to add expense"));
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
            <button type="submit" className="btn btn-primary">Add expense</button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate("/list")}>Cancel</button>
          </div>
        </form>
      </main>
    </div>
  );
}
