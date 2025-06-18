import axios from "axios";

export const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8787/api/"
    : "https://cray-backend.lalit2005.workers.dev/api/";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {},
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor to include JWT token in Authorization header
api.interceptors.request.use(cfg => {
  if (typeof window !== 'undefined') {
    const t = localStorage.getItem('jwt');
    if (t) {
      cfg.headers.Authorization = `Bearer ${t}`;
    }
  }
  return cfg;
});

export default api;
