import { io } from "socket.io-client";
import { API } from "./api";
export const socket = io(API, {
  withCredentials: true,
  autoConnect: true,
  transports: ["websocket", "polling"],
});
