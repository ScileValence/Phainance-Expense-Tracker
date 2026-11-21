import Select from "./ui/Select";
import DatePicker from "./ui/DatePicker";
import MonthPicker from "./ui/MonthPicker";
import React, { useEffect, useState, useRef } from "react";
import api from "../api/axios";
import { useCategories } from "../utils/categories";
import Sidebar from "./Sidebar";
import StatusBanner from "./StatusBanner";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { Plus, Pencil, Trash2, Check, X, Receipt } from "lucide-react";
import { colorFor } from "../utils/palette";
import { money, toBase, toInput } from "../utils/currency";
import "../styles/dashboard.css";

export default function ExpenseList() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const { categories } = useCategories();
  const location = useLocation();
  const freshId = useRef(location.state?.fresh); // the row you just added glows once (continuity from the Add screen)
  const [leaving, setLeaving] = useState(() => new Set()); // sliding away
  const [hidden, setHidden] = useState(() => new Set()); // gone from the list, waiting out the undo window
  const [back, setBack] = useState(() => new Set()); // restored by Undo
  const pending = useRef(new Map());
  const flip = (setter, id, on) =>
    setter((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  // leaving the page (or closing the tab) finishes any delete still waiting
  useEffect(() => {
    const flush = () => {
      pending.current.forEach((p, id) => {
        clearTimeout(p.slide);
        clearTimeout(p.commit);
        api.delete(`/expenses/${id}`).catch(() => {});
      });
      pending.current.clear();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
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

  const commitDelete = (id) => {
    pending.current.delete(id);
    api
      .delete(`/expenses/${id}`)
      .then(() => {
        flip(setHidden, id, false);
        fetchExpenses();
      })
      .catch(() => {
        flip(setHidden, id, false);
        flip(setLeaving, id, false);
        toast.error("Error deleting expense.");
        fetchExpenses();
      });
  };

  const undoDelete = (id) => {
    const p = pending.current.get(id);
    if (!p) return;
    clearTimeout(p.slide);
    clearTimeout(p.commit);
    pending.current.delete(id);
    flip(setLeaving, id, false); // reverses the slide if it is still playing
    flip(setHidden, id, false);
    flip(setBack, id, true);
    setTimeout(() => flip(setBack, id, false), 320);
    toast.dismiss(`del-${id}`);
  };

  // No confirm dialog: the row winds up and slides away at once (instant response), and Undo stays available for 5s.
  const deleteExpense = (id) => {
    flip(setLeaving, id, true);
    const slide = setTimeout(() => {
      flip(setHidden, id, true);
      flip(setLeaving, id, false);
    }, 260);
    const commit = setTimeout(() => commitDelete(id), 5200);
    pending.current.set(id, { slide, commit });
    toast(
      <div className="undo-toast">
        <span>Expense deleted</span>
        <button type="button" onClick={() => undoDelete(id)}>Undo</button>
      </div>,
      { toastId: `del-${id}`, autoClose: 5000, closeOnClick: false, icon: false }
    );
  };

  const visible = expenses.filter((e) => !hidden.has(e.id));
  const monthLabel = new Date(`${month}-01`).toLocaleString("default", { month: "long", year: "numeric" });
  const total = visible.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page">
        <StatusBanner />
        <header className="page-head fade-in">
          <div>
            <div className="eyebrow">{monthLabel}</div>
            <h2>Expenses</h2>
            <p className="sub">{visible.length} entries · {money(total)} total</p>
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
          {visible.length === 0 ? (
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
                  {visible.map((expense) => {
                    const editing = editId === expense.id;
                    const catName = expense.category?.name || "N/A";
                    return (
                      <tr
                        key={expense.id}
                        className={`${leaving.has(expense.id) ? "row-leaving" : ""} ${back.has(expense.id) ? "row-back" : ""} ${freshId.current === expense.id ? "row-fresh" : ""}`}
                      >
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
