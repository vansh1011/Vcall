export const API = import.meta.env.VITE_API_URL || "";

export const api = (path, opts = {}) =>
  fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });