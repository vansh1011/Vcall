import { io } from "socket.io-client";

const BACKEND = import.meta.env.VITE_API_URL || "https://vcall-1-69uh.onrender.com";

export const socket = io(BACKEND, {
  withCredentials: true,
  path: "/socket.io",        
  transports: ["websocket", "polling"],
  autoConnect: false,
});