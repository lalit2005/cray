import axios from "axios";

const api = axios.create({
  baseURL:
    process.env.NODE_ENV === "development"
      ? "http://localhost:8787/api/"
      : "https://backend.lalit2005.workers.dev/api/",
  headers: {},
  withCredentials: true,
});

export default api;
