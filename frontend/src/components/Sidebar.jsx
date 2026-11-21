import Popover from "./ui/Popover";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  PlusCircle,
  Plus,
  PiggyBank,
  Repeat,
  Wallet,
  LogIn,
  LogOut,
  Settings,
} from "lucide-react";
import { AppContext } from "../context/AppContext";
import { authState } from "../utils/auth";
import { openSettings } from "../utils/settingsStore";
import "../styles/sidebar.css";

const NAV = [
  { path: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { path: "/list", label: "Expenses", icon: Receipt },
  { path: "/add", label: "Add", icon: PlusCircle },
  { path: "/income", label: "Income", icon: Wallet },
  { path: "/recurring", label: "Recurring", icon: Repeat, badge: true },
  { path: "/budget", label: "Budget", icon: PiggyBank },
];

// Mobile only: the bottom bar has no room for the footer, so the account actions live in a popover.
// (Theme and currency now live in Settings.)
function AccountMenu({ username, guest, logout, onSignIn }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="account-menu" ref={ref}>
      <button className={`menu-item account-btn ${open ? "active" : ""}`} onClick={() => setOpen((o) => !o)} aria-label="Account menu">
        <div className="avatar sm">{username.slice(0, 1)}</div>
        <span className="label-text">Account</span>
      </button>

      <Popover anchorRef={ref} open={open} onClose={close} align="right" className="ui-pop-account">
        <div className="acct">
          <div className="acct-user">
            <div className="avatar">{username.slice(0, 1)}</div>
            <div>
              <strong>{username}</strong>
              <span>{guest ? "Guest · not saved" : "Personal account"}</span>
            </div>
            <button
              type="button"
              className="chip-settings pop"
              onClick={() => {
                close();
                openSettings();
              }}
              aria-label="Settings"
              title="Settings"
            >
              <Settings size={17} />
            </button>
          </div>
          {guest ? (
            <button type="button" className="acct-row" onClick={onSignIn}>
              <LogIn size={16} /> Sign in
            </button>
          ) : (
            <button type="button" className="acct-row danger" onClick={logout}>
              <LogOut size={16} /> Log out
            </button>
          )}
        </div>
      </Popover>
    </div>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { dueItems, loadRecurring, loadAccount } = useContext(AppContext);
  const auth = authState();
  const guest = auth.mode === "guest";
  const [username, setUsername] = useState("User");

  useEffect(() => {
    setUsername(authState().username);
    loadRecurring();
    loadAccount();
  }, [loadRecurring, loadAccount]);

  const logout = () => {
    localStorage.removeItem("token");
    window.location.href = "/dashboard"; // full reload: back to guest mode, account data cleared
  };

  // thumb-reach shortcut on phones: the one lime control on screen
  const showFab = ["/dashboard", "/list", "/income"].includes(location.pathname);

  return (
    <>
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">p</div>
        <span className="brand-name">phainance</span>
      </div>

      <nav className="menu">
        <div className="nav-label">Menu</div>
        {NAV.map(({ path, label, icon: Icon, badge }) => (
          <button
            key={path}
            className={`menu-item ${location.pathname === path ? "active" : ""}`}
            onClick={() => navigate(path)}
          >
            <Icon size={18} />
            <span className="label-text">{label}</span>
            {badge && dueItems.length > 0 && <span className="count">{dueItems.length}</span>}
          </button>
        ))}
      </nav>

      <AccountMenu
        username={username}
        guest={guest}
        logout={logout}
        onSignIn={() => navigate("/login")}
      />

      <div className="sidebar-foot">
        <div className="user-chip">
          <div className="avatar">{username.slice(0, 1)}</div>
          <div style={{ minWidth: 0 }}>
            <strong>{username}</strong>
            <span>{guest ? "Guest · not saved" : "Personal account"}</span>
          </div>
          <button type="button" className="chip-settings" onClick={openSettings} aria-label="Settings" title="Settings">
            <Settings size={17} />
          </button>
        </div>
        <div className="foot-actions">
          {guest ? (
            <button className="foot-btn" onClick={() => navigate("/login")} aria-label="Sign in">
              <LogIn size={16} />
              <span>Sign in</span>
            </button>
          ) : (
            <button className="foot-btn" onClick={logout} aria-label="Log out">
              <LogOut size={16} />
              <span>Log out</span>
            </button>
          )}
        </div>
      </div>
    </aside>
    {showFab && (
      <button type="button" className="fab" onClick={() => navigate("/add")} aria-label="Add expense">
        <Plus size={26} strokeWidth={2.6} />
      </button>
    )}
    </>
  );
}
