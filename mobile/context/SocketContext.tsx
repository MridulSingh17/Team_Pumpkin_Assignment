import type { Message, SendSocketMessage, SocketMessage } from "@/types";
import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

interface SocketContextType {
    socket: Socket | null;
    connected: boolean;
    sendMessage: (data: SendSocketMessage) => Promise<void>;
    onNewMessage: (callback: (message: Message) => void) => void;
    offNewMessage: (callback: (message: Message) => void) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const WS_URL = "ws://192.168.29.132:5001";

export function SocketProvider({ children }: { children: ReactNode }) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const { isAuthenticated, token } = useAuth();

 
    useEffect(() => {
        if (!isAuthenticated || !token) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setConnected(false);
            }
            return;
        }

        // Create socket connection
        const newSocket = io(WS_URL, {
            auth: {
                token,
            },
            transports: ["websocket"],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
        });

        // Connection event handlers
        newSocket.on("connect", () => {
            // Socket connected
            setConnected(true);
        });

        newSocket.on("disconnect", () => {
            // Socket disconnected
            setConnected(false);
        });

        newSocket.on("connect_error", (error) => {
            console.error("Socket connection error:", error);
            setConnected(false);
        });

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

                // Emitting send_message

                socket.emit(
                    "send_message",
                    data,
                    (response: {
                        success?: boolean;
                        message?: string;
                        error?: string;
                    }) => {
                        // Received response

                        if (response?.success) {
                            // Message sent successfully
                            resolve();
                        } else {
                            const errorMsg =
                                response?.message ||
                                response?.error ||
                                "Failed to send message";
                            console.error(
                                "SocketContext: Send failed:",
                                errorMsg
                            );
                            reject(new Error(errorMsg));
                        }
                    }
                );
            });
        },
        [socket, connected]
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
        [socket]
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
        [socket]
    );

    const value: SocketContextType = {
        socket,
        connected,
        sendMessage,
        onNewMessage,
        offNewMessage,
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    const context = useContext(SocketContext);
    if (context === undefined) {
        throw new Error("useSocket must be used within a SocketProvider");
    }
    return context;
}
