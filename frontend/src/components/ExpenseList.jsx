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
import { Plus, Pencil, Trash2, Check, X, Receipt, Search, Download, ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import { colorFor } from "../utils/palette";
import { money, toBase, toInput, fromBase, activeCode } from "../utils/currency";
import { filterExpenses, sortExpenses, summarize, hasActiveFilters } from "../utils/expenseFilters";
import { expensesCsv } from "../utils/csv";
import { downloadText } from "../utils/download";
import "../styles/dashboard.css";
import "../styles/entry.css";

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

  // what the list covers: a month, a preset range, or a custom range
  const [period, setPeriod] = useState("month"); // month | 3m | year | all | custom
  const [range, setRange] = useState({ from: "", to: "" });
  const [filters, setFilters] = useState({ query: "", categoryId: "", min: "", max: "" });
  const [sort, setSort] = useState("date-desc");
  const [moreOpen, setMoreOpen] = useState(false);
  const setFilter = (name, value) => setFilters((f) => ({ ...f, [name]: value }));

  const pad2 = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const customReady = range.from && range.to && range.from <= range.to;

  const periodQuery = () => {
    const now = new Date();
    if (period === "3m") return `from=${iso(new Date(now.getFullYear(), now.getMonth() - 2, 1))}&to=${iso(new Date(now.getFullYear(), now.getMonth() + 1, 0))}`;
    if (period === "year") return `from=${now.getFullYear()}-01-01&to=${now.getFullYear()}-12-31`;
    if (period === "all") return "from=2000-01-01&to=2099-12-31";
    if (period === "custom" && customReady) return `from=${range.from}&to=${range.to}`;
    return `month=${month}`;
  };

  const latestRequest = useRef(0); // a slow answer for an older period must not replace a newer list
  const fetchExpenses = () => {
    const mine = ++latestRequest.current;
    if (period === "custom" && !customReady) {
      setExpenses([]); // nothing to load until both dates are chosen
      return Promise.resolve();
    }
    return api
      .get(`/expenses?${periodQuery()}`)
      .then((res) => mine === latestRequest.current && setExpenses(res.data || []))
      .catch(() => mine === latestRequest.current && toast.error("Failed to load expenses."));
  };

  useEffect(() => {
    fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, period, range.from, range.to, navigate]);

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
  const periodLabel = {
    month: monthLabel,
    "3m": "Last 3 months",
    year: String(new Date().getFullYear()),
    all: "All time",
    custom: customReady ? `${range.from} to ${range.to}` : "Custom range",
  }[period];

  // search, category and amount filters (typed amounts are in the display currency), then the chosen order
  const [sortKey, sortDir] = sort.split("-");
  const active = hasActiveFilters(filters);
  const shown = sortExpenses(
    filterExpenses(visible, {
      ...filters,
      min: filters.min === "" ? "" : toBase(filters.min),
      max: filters.max === "" ? "" : toBase(filters.max),
    }),
    sortKey,
    sortDir
  );
  const { total } = summarize(shown);
  const clearFilters = () => setFilters({ query: "", categoryId: "", min: "", max: "" });

  const sortBy = (key) => setSort(sortKey === key ? `${key}-${sortDir === "asc" ? "desc" : "asc"}` : `${key}-${key === "amount" || key === "date" ? "desc" : "asc"}`);

  const exportCsv = () => {
    if (shown.length === 0) return;
    const slug = { month, "3m": "last-3-months", year: String(new Date().getFullYear()), all: "all-time", custom: `${range.from}_to_${range.to}` }[period];
    const csv = expensesCsv(shown, { formatAmount: (n) => fromBase(n).toFixed(2), currency: activeCode() });
    downloadText(`expenses-${slug}${active ? "-filtered" : ""}.csv`, csv);
    toast.success(`Exported ${shown.length} expense${shown.length === 1 ? "" : "s"}`);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page">
        <StatusBanner />
        <header className="page-head fade-in">
          <div>
            <div className="eyebrow">{periodLabel}</div>
            <h2>Expenses</h2>
            <p className="sub">{active ? `${shown.length} of ${visible.length} entries` : `${visible.length} entries`} · {money(total)} total</p>
          </div>
          <div className="head-controls">
            {period === "month" && (
              <MonthPicker
                variant="pill"
                align="right"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  localStorage.setItem("selectedMonth", e.target.value);
                }}
              />
            )}
            <button className="btn btn-ghost" onClick={exportCsv} disabled={shown.length === 0} title="Download what you see as a CSV file">
              <Download size={16} /> Export CSV
            </button>
            <button className="btn btn-primary" onClick={() => navigate("/add")}>
              <Plus size={17} /> Add expense
            </button>
          </div>
        </header>

        <section className="card toolbar fade-in">
          <div className="toolbar-grid">
            <label className="search">
              <Search size={16} />
              <input
                className="input"
                type="search"
                value={filters.query}
                placeholder="Search expenses"
                aria-label="Search expenses"
                onChange={(e) => setFilter("query", e.target.value)}
              />
              {filters.query && (
                <button type="button" className="search-clear" onClick={() => setFilter("query", "")} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </label>
            <Select
              name="categoryId"
              value={filters.categoryId}
              ariaLabel="Filter by category"
              onChange={(e) => setFilter("categoryId", e.target.value)}
              options={[
                { value: "", label: "All categories" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
                { value: "none", label: "No category" },
              ]}
            />
            <Select
              name="sort"
              value={sort}
              ariaLabel="Sort expenses"
              onChange={(e) => setSort(e.target.value)}
              options={[
                { value: "date-desc", label: "Newest first" },
                { value: "date-asc", label: "Oldest first" },
                { value: "amount-desc", label: "Highest amount" },
                { value: "amount-asc", label: "Lowest amount" },
                { value: "description-asc", label: "Description A to Z" },
              ]}
            />
            <Select
              name="period"
              value={period}
              ariaLabel="Period"
              onChange={(e) => setPeriod(e.target.value)}
              options={[
                { value: "month", label: "One month" },
                { value: "3m", label: "Last 3 months" },
                { value: "year", label: "This year" },
                { value: "all", label: "All time" },
                { value: "custom", label: "Custom range" },
              ]}
            />
          </div>

          {period === "custom" && (
            <div className="toolbar-range">
              <DatePicker name="from" value={range.from} placeholder="From" onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
              <span>to</span>
              <DatePicker name="to" value={range.to} placeholder="To" onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
              {!customReady && <span className="hint">Pick both dates{range.from && range.to ? " (the start must come first)" : ""}.</span>}
            </div>
          )}

          <div className="toolbar-foot">
            <button type="button" className={`link-btn more ${moreOpen ? "open" : ""}`} aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
              More filters <ChevronDown size={15} />
            </button>
            {active && (
              <button type="button" className="link-btn" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
          <div className={`reveal ${moreOpen ? "open" : ""}`} inert={moreOpen ? undefined : ""}>
            <div className="reveal-inner">
              <div className="toolbar-amounts">
                <div className="field">
                  <label>Min amount</label>
                  <input className="input" type="number" min="0" value={filters.min} placeholder="0" onChange={(e) => setFilter("min", e.target.value)} />
                </div>
                <div className="field">
                  <label>Max amount</label>
                  <input className="input" type="number" min="0" value={filters.max} placeholder="No limit" onChange={(e) => setFilter("max", e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="card fade-in">
          {shown.length === 0 ? (
            <div className="empty">
              <Receipt size={36} />
              {visible.length > 0 ? (
                <>
                  <p>No expenses match your filters.</p>
                  <button type="button" className="link-btn" onClick={clearFilters}>Clear filters</button>
                </>
              ) : (
                <p>{period === "custom" && !customReady ? "Choose a start and end date." : "No expenses found for this period."}</p>
              )}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    {[["description", "Description"], ["category", "Category"], ["date", "Date"], ["amount", "Amount"]].map(([key, label]) => (
                      <th key={key} style={key === "amount" ? { textAlign: "right" } : undefined} aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                        <button type="button" className="th-sort" onClick={() => sortBy(key)}>
                          {label}
                          {sortKey === key && (sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
                        </button>
                      </th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((expense) => {
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
