import { BrowserDb } from "./localDb";
import { signOutLocal } from "./sync";
import { localAdapter } from "./localAdapter";

// Off by default: needs the server's /sync endpoints (plan Task 6) before it can be switched on.
export const LOCAL_FIRST = import.meta.env.VITE_LOCAL_FIRST === "true";

export const localDb = new BrowserDb();
export const localApiAdapter = localAdapter(localDb, {
  onWrite: () => window.dispatchEvent(new Event("local:write")),
});

export const wipeAccountData = () => signOutLocal(localDb);
