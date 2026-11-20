import axios from "axios";
import { guestAdapter } from "../utils/guestStore";

const api = axios.create({
  baseURL: "http://localhost:8080/api",
});

// Automatically attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (!String(config.url).startsWith("/auth")) {
      // guest mode: serve data from this browser instead of the server
      config.adapter = guestAdapter;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
