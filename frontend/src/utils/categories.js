import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../api/axios";

const EVENT = "categories:changed";

// call after creating / renaming / deleting a category so every open list refreshes
export const notifyCategoriesChanged = () => window.dispatchEvent(new Event(EVENT));

// built-in + your own categories; reloads when they change
export function useCategories() {
  const [categories, setCategories] = useState([]);

  const load = useCallback(
    () =>
      api
        .get("/categories")
        .then((res) => setCategories(res.data || []))
        .catch(() => toast.error("Failed to load categories.")),
    []
  );

  useEffect(() => {
    load();
    window.addEventListener(EVENT, load);
    return () => window.removeEventListener(EVENT, load);
  }, [load]);

  return { categories, reload: load };
}
