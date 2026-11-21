import React, { useState } from "react";
import { toast } from "react-toastify";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import api from "../api/axios";
import { colorFor } from "../utils/palette";
import { notifyCategoriesChanged, useCategories } from "../utils/categories";
import { errorMessage } from "../utils/dataTools";

// Add, rename and delete your own categories. Default ones are listed but locked.
export default function CategoryManager() {
  const { categories } = useCategories();
  const [name, setName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn, message) => {
    setBusy(true);
    try {
      await fn();
      notifyCategoriesChanged();
      if (message) toast.success(message);
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (await run(() => api.post("/categories", { name }), "Category added.")) setName("");
  };

  const saveEdit = async () => {
    if (!editName.trim()) return;
    if (await run(() => api.put(`/categories/${editId}`, { name: editName }), "Category renamed.")) setEditId(null);
  };

  const remove = (cat) => {
    if (!window.confirm(`Delete "${cat.name}"?`)) return;
    run(() => api.delete(`/categories/${cat.id}`), "Category deleted.");
  };

  return (
    <>
      <div className="cat-list">
        {categories.map((cat) => (
          <div className="cat-row" key={cat.id}>
            <span className="dot" style={{ background: colorFor(cat.name) }} />
            {editId === cat.id ? (
              <>
                <input
                  className="input input-sm"
                  value={editName}
                  maxLength={40}
                  autoFocus
                  aria-label="Category name"
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setEditId(null);
                    }
                  }}
                />
                <button type="button" className="cat-act" onClick={saveEdit} disabled={busy} aria-label="Save">
                  <Check size={16} />
                </button>
                <button type="button" className="cat-act" onClick={() => setEditId(null)} aria-label="Cancel">
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <span className="name">{cat.name}</span>
                {cat.builtIn ? (
                  <span className="cat-tag">Default</span>
                ) : (
                  <>
                    <button
                      type="button"
                      className="cat-act"
                      onClick={() => {
                        setEditId(cat.id);
                        setEditName(cat.name);
                      }}
                      aria-label={`Rename ${cat.name}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button type="button" className="cat-act danger" onClick={() => remove(cat)} disabled={busy} aria-label={`Delete ${cat.name}`}>
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <form className="cat-add" onSubmit={add}>
        <input
          className="input input-sm"
          value={name}
          maxLength={40}
          placeholder="New category"
          aria-label="New category name"
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !name.trim()}>
          <Plus size={15} /> Add
        </button>
      </form>
    </>
  );
}
