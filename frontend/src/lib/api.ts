const defaultApiBaseUrl =
  process.env.NODE_ENV === "development" ? "http://localhost:8000/api" : "/api";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || defaultApiBaseUrl;