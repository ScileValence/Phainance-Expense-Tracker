import Select from "./ui/Select";
import DatePicker from "./ui/DatePicker";
import MonthPicker from "./ui/MonthPicker";
import React, { useEffect, useState } from "react";
import api from "../api";
import Sidebar from "./Sidebar";
import StatusBanner from "./StatusBanner";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Plus, Pencil, Trash2, Check, X, Receipt } from "lucide-react";
import { colorFor } from "../utils/palette";
import { money, toBase, toInput } from "../utils/currency";
import "../styles/dashboard.css";

export default function ExpenseList() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ amount: "", description: "", date: "", categoryId: "" });
  const [month, setMonth] = useState(
    localStorage.getItem("selectedMonth") || new Date().toISOString().slice(0, 7)
  );

  const fetchExpenses = () =>
    api
      .get(`/expenses?month=${month}`)
      .then((res) => setExpenses(res.data || []))
      .catch(() => toast.error("Failed to load expenses."));

  useEffect(() => {
    fetchExpenses();
    api
      .get("/categories")
      .then((res) => setCategories(res.data || []))
      .catch(() => toast.error("Failed to load categories."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, navigate]);

  const handleEditClick = (expense) => {
    setEditId(expense.id);
    setEditForm({
      amount: toInput(expense.amount),
      description: expense.description,
      date: expense.date,
      categoryId: expense.category?.id || "",
    });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveEdit = (id) => {
    api
      .put(`/expenses/${id}`, {
        amount: toBase(editForm.amount),
        description: editForm.description,
        date: editForm.date,
        categoryId: editForm.categoryId ? parseInt(editForm.categoryId) : null,
      })
      .then(() => {
        toast.success("Expense updated");
        setEditId(null);
        fetchExpenses();
      })
      .catch(() => toast.error("Failed to update expense."));
  };

  const deleteExpense = (id) => {
    if (!window.confirm("Delete this expense?")) return;
    api
      .delete(`/expenses/${id}`)
      .then(() => {
        toast.info("Expense deleted");
        fetchExpenses();
      })
      .catch(() => toast.error("Error deleting expense."));
  };

  const monthLabel = new Date(`${month}-01`).toLocaleString("default", { month: "long", year: "numeric" });
  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page">
        <StatusBanner />
        <header className="page-head fade-in">
          <div>
            <div className="eyebrow">{monthLabel}</div>
            <h2>Expenses</h2>
            <p className="sub">{expenses.length} entries · {money(total)} total</p>
          </div>
          <div className="head-controls">
            <MonthPicker
              variant="pill"
              align="right"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                localStorage.setItem("selectedMonth", e.target.value);
              }}
            />
            <button className="btn btn-primary" onClick={() => navigate("/add")}>
              <Plus size={17} /> Add expense
            </button>
          </div>
        </header>

        <section className="card fade-in">
          {expenses.length === 0 ? (
            <div className="empty">
              <Receipt size={36} />
              <p>No expenses found for this month.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => {
                    const editing = editId === expense.id;
                    const catName = expense.category?.name || "N/A";
                    return (
                      <tr key={expense.id}>
                        <td>
                          {editing ? (
                            <input className="input input-sm" type="text" name="description"
                              value={editForm.description} onChange={handleEditChange} />
                          ) : (
                            <strong style={{ fontWeight: 600 }}>{expense.description}</strong>
                          )}
                        </td>
                        <td>
                          {editing ? (
                            <Select
                              size="sm"
                              name="categoryId"
                              value={editForm.categoryId}
                              onChange={handleEditChange}
                              options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
                            />
                          ) : (
                            <span className="cat-pill">
                              <span className="dot" style={{ background: colorFor(catName) }} />
                              {catName}
                            </span>
                          )}
                        </td>
                        <td>
                          {editing ? (
                            <DatePicker size="sm" name="date" value={editForm.date} onChange={handleEditChange} />
                          ) : (
                            expense.date
                          )}
                        </td>
                        <td className="num">
                          {editing ? (
                            <input className="input input-sm" type="number" name="amount"
                              value={editForm.amount} onChange={handleEditChange} style={{ textAlign: "right" }} />
                          ) : (
                            money(expense.amount)
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            {editing ? (
                              <>
                                <button className="btn btn-primary btn-sm btn-icon" onClick={() => saveEdit(expense.id)} aria-label="Save"><Check size={16} /></button>
                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditId(null)} aria-label="Cancel"><X size={16} /></button>
                              </>
                            ) : (
                              <>
                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleEditClick(expense)} aria-label="Edit"><Pencil size={15} /></button>
                                <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteExpense(expense.id)} aria-label="Delete"><Trash2 size={15} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
