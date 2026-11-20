import { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { AppContext } from "../context/AppContext";
import { money } from "../utils/recurring";

// Fires a one-time in-app toast per due payment (email + web push are sent by the backend).
export default function ReminderWatcher() {
  const { dueItems } = useContext(AppContext);
  const navigate = useNavigate();

  useEffect(() => {
    dueItems.forEach((r) => {
      const key = `notified:${r.id}:${r.nextDueDate}:${r.dueTime}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");

      toast.warn(`${r.title} · ${money(r.amount)} is due`, {
        autoClose: 4000,
        onClick: () => navigate("/recurring"),
      });
    });
  }, [dueItems, navigate]);

  return null;
}
