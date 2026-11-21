import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Recurring from "./pages/Recurring";
import Income from "./pages/Income";
import VerifyEmail from "./pages/VerifyEmail";
import ReminderWatcher from "./components/ReminderWatcher";
import SettingsHost from "./components/SettingsModal";
import MotionRoot from "./components/MotionRoot";

import AddExpense from "./components/AddExpense";
import ExpenseList from "./components/ExpenseList";
import BudgetForm from "./components/BudgetForm";

import { AppProvider } from "./context/AppContext";
import { ToastContainer, toast, cssTransition } from "react-toastify";
import { authState } from "./utils/auth";
import { loadRates, useCurrency } from "./utils/currency";
import "react-toastify/dist/ReactToastify.css";
import "./styles.css";
import "./styles/motion.css";

// toasts: stretch in, squash on impact, settle (see motion.css)
const Pop = cssTransition({ enter: "toast-in", exit: "toast-out", collapseDuration: 120 });

// Load saved or system theme
const savedTheme =
  localStorage.getItem("theme") ||
  (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
document.body.setAttribute("data-theme", savedTheme);

// No token = guest mode (allowed). A token that has expired = sign in again.
function AuthGate() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (authState().mode === "expired") {
      localStorage.removeItem("token");
      toast.info("Your session expired. Please sign in again.");
      navigate("/login", { replace: true });
    }
  }, [pathname, navigate]);

  return null;
}

function AppRoutes() {
  const { currency, rates } = useCurrency();

  useEffect(() => {
    loadRates();
  }, []);

  // remount pages when the display currency (or its rates) change so every amount re-renders
  return (
    <Routes key={`${currency}:${rates ? "live" : "base"}`}>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/add" element={<AddExpense />} />
      <Route path="/list" element={<ExpenseList />} />
      <Route path="/income" element={<Income />} />
      <Route path="/budget" element={<BudgetForm />} />
      <Route path="/recurring" element={<Recurring />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppProvider>
      <BrowserRouter>
        <AuthGate />
        <AppRoutes />
        <ReminderWatcher />
        <SettingsHost />
        <MotionRoot />

        {/* Toast Notifications */}
        <ToastContainer
          position="top-right"
          transition={Pop}
          autoClose={1500}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </BrowserRouter>
    </AppProvider>
  </React.StrictMode>
);
