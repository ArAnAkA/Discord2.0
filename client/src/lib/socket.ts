import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  socket = io({
    path: "/socket.io",
    withCredentials: true,
    autoConnect: false,
  });

  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.disconnect();
}

