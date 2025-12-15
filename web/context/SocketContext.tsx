"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import type { Message, SendSocketMessage, SocketMessage } from "@/types";

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  sendMessage: (data: SendSocketMessage) => Promise<void>;
  onNewMessage: (callback: (message: Message) => void) => void;
  offNewMessage: (callback: (message: Message) => void) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:5001";

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  // Sync token from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    setToken(storedToken);

    // Listen for storage changes (for cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "token") {
        setToken(e.newValue);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Initialize socket connection
  useEffect(() => {
    // If authenticated but no token in state, try to get from localStorage directly
    if (isAuthenticated && !token) {
      const directToken = localStorage.getItem("token");
      if (directToken) {
        setToken(directToken);
        return; // Will trigger re-render with token
      }
    }

    if (!isAuthenticated || !token) {
      return;
    }

    // Create socket connection with authentication
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const newSocket = io(WS_URL, {
      auth: {
        token,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    // Connection event handlers
    newSocket.on("connect", () => {
      setConnected(true);
    });

    newSocket.on("disconnect", (reason) => {
      setConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error);
      setConnected(false);
    });



    // eslint-disable-next-line react-compiler/react-compiler
    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [isAuthenticated, token]);

  // Send message function
  const sendMessage = useCallback(
    (data: SendSocketMessage): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!socket || !connected) {
          reject(new Error("Socket not connected"));
          return;
        }

        socket.emit(
          "send_message",
          data,
          (response?: {
            success: boolean;
            message?: string;
            error?: string;
            data?: { message: Message };
          }) => {
            if (response?.success) {
              resolve();
            } else {
              const errorMsg =
                response?.message ||
                response?.error ||
                "Failed to send message";
              reject(new Error(errorMsg));
            }
          },
        );
      });
    },
    [socket, connected],
  );

  // Subscribe to new messages
  const onNewMessage = useCallback(
    (callback: (message: Message) => void) => {
      if (!socket) return;

      const handler = (data: SocketMessage) => {
        callback(data.message);
      };

      socket.on("new_message", handler);
    },
    [socket],
  );

  // Unsubscribe from new messages
  const offNewMessage = useCallback(
    (callback: (message: Message) => void) => {
      if (!socket) return;

      const handler = (data: SocketMessage) => {
        callback(data.message);
      };

      socket.off("new_message", handler);
    },
    [socket],
  );

  const value: SocketContextType = {
    socket,
    connected,
    sendMessage,
    onNewMessage,
    offNewMessage,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
