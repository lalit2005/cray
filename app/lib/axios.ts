import axios from "axios";

export const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8787/api/"
    : "https://cray-backend.lalit2005.workers.dev/api/";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {},
  withCredentials: true,
});

export default api;
