import React, { createContext, useState, useEffect, useCallback, useMemo } from "react";
import api from "../api/axios";
import { isDue } from "../utils/recurring";

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });
  const [refreshToggle, setRefreshToggle] = useState(false);
  const triggerRefresh = () => setRefreshToggle((t) => !t);

  // ---- recurring payments (reminders) ----
  const [recurring, setRecurring] = useState([]);
  const [now, setNow] = useState(() => new Date());

  const loadRecurring = useCallback(async () => {
    try {
      const res = await api.get("/recurring");
      setRecurring(Array.isArray(res.data) ? res.data : []);
    } catch {
      /* silent: reminders are best-effort */
    }
  }, []);

  // ---- account (email verification state) ----
  const [account, setAccount] = useState(null);
  const loadAccount = useCallback(async () => {
    if (!localStorage.getItem("token")) {
      setAccount(null);
      return;
    }
    try {
      const res = await api.get("/notifications/settings");
      setAccount({ email: res.data.email, emailVerified: res.data.emailVerified });
    } catch {
      /* optional */
    }
  }, []);

  // refresh data + clock every 30s
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      loadRecurring();
    }, 30000);
    return () => clearInterval(id);
  }, [loadRecurring]);

  const dueItems = useMemo(() => recurring.filter((r) => isDue(r, now)), [recurring, now]);

  const confirmRecurring = async (id) => {
    await api.post(`/recurring/${id}/confirm`);
    await loadRecurring();
    triggerRefresh();
  };
  const skipRecurring = async (id) => {
    await api.post(`/recurring/${id}/skip`);
    await loadRecurring();
  };

  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  return (
    <AppContext.Provider
      value={{
        token,
        setToken,
        selectedMonth,
        setSelectedMonth,
        refreshToggle,
        triggerRefresh,
        recurring,
        dueItems,
        now,
        loadRecurring,
        account,
        loadAccount,
        confirmRecurring,
        skipRecurring,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
