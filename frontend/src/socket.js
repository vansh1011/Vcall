import { io } from "socket.io-client";

export const socket = io("/", {
  withCredentials: true,
  path: "/api/socket.io",
  transports: ["websocket", "polling"],
});