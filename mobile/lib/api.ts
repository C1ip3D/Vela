import axios from "axios";
import { auth } from "./firebase";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {
    // no-op if auth not ready
  }
  return config;
});
