import axios from "axios";
import tokenStore from "./tokenStore";

export const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8787/api/"
    : "https://cray-backend.lalit2005.workers.dev/api/";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {},
  withCredentials: true, // Keep cookies enabled for non-incognito mode
});

// Create an interceptor to automatically add the token from memory to every request
api.interceptors.request.use((config) => {
  const token = tokenStore.getToken();

  // If we have a token in memory, add it to the request header
  if (token) {
    // Set the token in both Authorization and custom token header for maximum compatibility
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
    config.headers.token = token;
  }

  return config;
});

export default api;
