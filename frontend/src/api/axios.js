import axios from "axios";
import { guestAdapter } from "../utils/guestStore";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api",
});

// in-flight counter for the top progress bar (server requests only; guest mode is instant)
let inflight = 0;
const announce = () => window.dispatchEvent(new CustomEvent("net:inflight", { detail: inflight }));
const done = (config) => {
  if (config?.__counted) {
    inflight = Math.max(0, inflight - 1);
    announce();
  }
};

// Automatically attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      config.__counted = true;
      inflight += 1;
      announce();
    } else if (!String(config.url).startsWith("/auth")) {
      // guest mode: serve data from this browser instead of the server
      config.adapter = guestAdapter;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (res) => {
    done(res.config);
    return res;
  },
  (err) => {
    done(err.config);
    return Promise.reject(err);
  }
);

export default api;
