export const getToken = () => localStorage.getItem("token");

export function decodeToken(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

// guest: no token (app works, data stays in this browser)
// user: valid token | expired: token present but unusable
export function authState() {
  const token = getToken();
  if (!token) return { mode: "guest", username: "Guest" };
  const d = decodeToken(token);
  if (!d || (d.exp && Date.now() > d.exp * 1000)) return { mode: "expired", username: "" };
  return { mode: "user", username: d.sub || "User", token };
}

export const isGuest = () => !getToken();
