import MonthPicker from "../components/ui/MonthPicker";
import React, { useContext, useEffect, useState, useCallback } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { Plus, Wallet, TrendingDown, PiggyBank, Repeat, ChevronRight } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from "recharts";
import Sidebar from "../components/Sidebar";
import DueReminders from "../components/DueReminders";
import { AppContext } from "../context/AppContext";
import { COLORS, colorFor } from "../utils/palette";
import { isSoon } from "../utils/recurring";
import { money, compact } from "../utils/currency";
import { authState } from "../utils/auth";
import StatusBanner from "../components/StatusBanner";
import "../styles/dashboard.css";

const ChartTip = ({ active, payload, label, prefix = "" }) =>
  active && payload?.length ? (
    <div className="chart-tooltip">
      {prefix || label}: {money(payload[0].value)}
    </div>
  ) : null;

export default function Dashboard() {
  const navigate = useNavigate();
  const { recurring, refreshToggle, now } = useContext(AppContext);

  const [month, setMonth] = useState(
    localStorage.getItem("selectedMonth") || new Date().toISOString().slice(0, 7)
  );
  const [username, setUsername] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [budgetData, setBudgetData] = useState({ month: "", limit: 0, spent: 0 });
  const [categoryData, setCategoryData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [incomeTotal, setIncomeTotal] = useState(0);

  useEffect(() => {
    setUsername(authState().username);
  }, []);

  const fetchAll = useCallback(
    async (forMonth) => {
      try {
        const [exp, bud, cat, daily, inc] = await Promise.all([
          api.get(`/expenses?month=${forMonth}`),
          api.get(`/budget?month=${forMonth}`),
          api.get(`/analytics/category?month=${forMonth}`),
          api.get(`/analytics/daily?month=${forMonth}`),
          api.get(`/income?month=${forMonth}`),
        ]);
        setExpenses(exp.data || []);
        setBudgetData(bud.data || { month: forMonth, limit: 0, spent: 0 });
        setCategoryData(cat.data || []);
        setDailyData(daily.data || []);
        setIncomeTotal((inc.data || []).reduce((t, i) => t + (i.amount || 0), 0));
      } catch (err) {
        console.error("Dashboard fetch failed:", err);
        if (err.response?.status === 401 && localStorage.getItem("token")) {
          localStorage.removeItem("token");
          navigate("/login");
        }
      }
    },
    [navigate]
  );

  useEffect(() => {
    if (!month) return;
    localStorage.setItem("selectedMonth", month);
    fetchAll(month);
  }, [month, fetchAll, refreshToggle]);

  const totalSpent = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const limit = budgetData.limit || 0;
  const remaining = limit - totalSpent;
  const pct = limit > 0 ? Math.round((totalSpent / limit) * 100) : 0;
  const barColor = pct < 70 ? "var(--lime)" : pct < 90 ? "var(--amber)" : "var(--coral)";
  const saved = incomeTotal - totalSpent;
  const upcoming = recurring.filter((r) => isSoon(r, now)).length;

  const monthLabel = new Date(`${month}-01`).toLocaleString("default", { month: "long", year: "numeric" });
  const catTotal = categoryData.reduce((s, c) => s + (c.value || 0), 0);

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="page">
        <StatusBanner />
        <header className="page-head fade-in">
          <div>
            <div className="eyebrow">{monthLabel}</div>
            <h2>{username === "Guest" ? "Welcome! Here’s your money." : `Hi ${username}, here’s your money.`}</h2>
          </div>
          <div className="head-controls">
            <MonthPicker variant="pill" align="right" value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="btn btn-primary" onClick={() => navigate("/add")}>
              <Plus size={17} /> Add expense
            </button>
          </div>
        </header>

        <div className="dash-grid">
          <div className="col-12"><DueReminders /></div>

          {/* hero */}
          <section className="hero col-7 fade-in">
            <div>
              <div className="eyebrow">{limit > 0 ? (remaining >= 0 ? "Left to spend" : "Over budget by") : "Spent this month"}</div>
              <div className={`hero-amount ${remaining < 0 && limit > 0 ? "over" : ""}`}>
                {money(limit > 0 ? Math.abs(remaining) : totalSpent)}
              </div>
            </div>
            <div>
              <div className="progress"><span style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} /></div>
              <div className="hero-foot">
                <span>{limit > 0 ? `${pct}% of budget used` : "No budget set for this month"}</span>
                <span>{limit > 0 ? `Budget ${money(limit)}` : ""}</span>
              </div>
            </div>
          </section>

          {/* stats */}
          <div className="col-5 dash-grid" style={{ gap: 20, gridTemplateColumns: "1fr 1fr", alignContent: "stretch" }}>
            <div className="card stat fade-in" style={{ cursor: "pointer" }} onClick={() => navigate("/income")}>
              <div className="stat-icon"><Wallet size={19} /></div>
              <div><div className="stat-value">{money(incomeTotal)}</div><div className="stat-label">Income</div></div>
            </div>
            <div className="card stat fade-in">
              <div className="stat-icon"><TrendingDown size={19} /></div>
              <div><div className="stat-value">{money(totalSpent)}</div><div className="stat-label">Spent</div></div>
            </div>
            <div className="card stat fade-in">
              <div className="stat-icon"><PiggyBank size={19} /></div>
              <div>
                <div className="stat-value" style={{ color: saved < 0 ? "var(--danger)" : undefined }}>{money(saved)}</div>
                <div className="stat-label">{saved < 0 ? "Overspent" : "Saved"}</div>
              </div>
            </div>
            <div className="card stat fade-in" style={{ cursor: "pointer" }} onClick={() => navigate("/recurring")}>
              <div className="stat-icon"><Repeat size={19} /></div>
              <div><div className="stat-value">{upcoming}</div><div className="stat-label">Due in 3 days</div></div>
            </div>
          </div>

          {/* spending by category */}
          <section className="card col-5 fade-in">
            <div className="card-head">
              <div><h3 className="card-title">By category</h3><div className="card-sub">{monthLabel}</div></div>
            </div>
            {categoryData.length === 0 ? (
              <div className="empty"><p>No spending yet.</p></div>
            ) : (
              <>
                <div className="donut-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="92%" paddingAngle={3} stroke="none">
                        {categoryData.map((c, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <ReTooltip content={<ChartTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center"><strong>{money(catTotal)}</strong><span>Total</span></div>
                </div>
                <div className="legend">
                  {categoryData.map((c, i) => (
                    <div className="legend-row" key={c.name}>
                      <span className="dot" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="name">{c.name}</span>
                      <span className="val">{money(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* daily trend */}
          <section className="card col-7 fade-in">
            <div className="card-head">
              <div><h3 className="card-title">Daily spending</h3><div className="card-sub">{monthLabel}</div></div>
            </div>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ left: -12, right: 6, top: 6 }}>
                  <defs>
                    <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6d5ef5" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6d5ef5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} tickFormatter={(d) => String(d).slice(-2)} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} tickFormatter={compact} />
                  <ReTooltip content={<ChartTip />} cursor={{ stroke: "var(--muted)", strokeDasharray: 4 }} />
                  <Area type="monotone" dataKey="amount" stroke="#6d5ef5" strokeWidth={2.5} fill="url(#spendFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* recent */}
          <section className="card col-12 fade-in">
            <div className="card-head">
              <h3 className="card-title">Recent expenses</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/list")}>
                View all <ChevronRight size={15} />
              </button>
            </div>
            {expenses.length === 0 ? (
              <div className="empty"><p>No expenses for this month.</p></div>
            ) : (
              <div className="tx-list">
                {[...expenses].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 8).map((e) => {
                  const name = e.category?.name || "Other";
                  return (
                    <div className="tx" key={e.id}>
                      <div className="tx-icon" style={{ background: colorFor(name) }}>{name.slice(0, 1)}</div>
                      <div className="tx-main">
                        <strong>{e.description || "Untitled"}</strong>
                        <span>{name} · {e.date}</span>
                      </div>
                      <div className="tx-amt">−{money(e.amount)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
