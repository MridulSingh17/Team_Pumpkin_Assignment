import type { LoginData, RegisterData, User } from "@/types";
import { authApi, deviceApi, handleApiError } from "@/utils/api";
import {
    clearDeviceId,
    clearKeys,
    generateKeyPair,
    retrieveKeys,
    storeDeviceId,
    storeKeys,
} from "@/utils/encryption";
import { clearAllMessages } from "@/utils/message-storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useState,
} from "react";

// Helper to clear local cache of old messages
const clearLocalMessageCache = async () => {
    try {
        await clearAllMessages();
        // Cleared local message cache
    } catch (error) {
        console.error("Error clearing local cache:", error);
    }
};

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    login: (data: LoginData) => Promise<void>;
    register: (data: Omit<RegisterData, "publicKey">) => Promise<void>;
    logout: () => Promise<void>;
    clearAllData: () => Promise<void>;
    setAuthData: (user: User, token: string) => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Load user from storage on mount
    useEffect(() => {
        const loadUser = async () => {
            try {
                const storedToken = await AsyncStorage.getItem("token");
                const storedUser = await AsyncStorage.getItem("user");

                if (storedToken && storedUser) {
                    setToken(storedToken);
                    setUser(JSON.parse(storedUser));
                }
            } catch (error) {
                console.error("Error loading user:", error);
            } finally {
                setLoading(false);
            }
        };

        loadUser();
    }, []);

    const register = async (
        data: Omit<RegisterData, "publicKey" | "deviceType">
    ) => {
        try {
            setLoading(true);

            // Generate encryption keys
            const keys = await generateKeyPair();

            // Register with public key and device type
            const response = await authApi.register({
                ...data,
                publicKey: keys.publicKey,
                deviceType: "android", // or "ios" based on platform
            });

            if (response.success && response.data) {
                // Store keys locally
                await storeKeys(keys.publicKey, keys.privateKey);

                // Store auth data
                await AsyncStorage.setItem("token", response.data.token);
                await AsyncStorage.setItem(
                    "user",
                    JSON.stringify(response.data.user)
                );

                // Store deviceId if device was created (use _id which is MongoDB ObjectId)
                if (response.data.device?._id) {
                    await storeDeviceId(response.data.device._id);
                }

                setToken(response.data.token);
                setUser(response.data.user);
            }
        } catch (error) {
            throw new Error(handleApiError(error));
        } finally {
            setLoading(false);
        }
    };

    const login = async (data: LoginData) => {
        try {
            setLoading(true);

            // Check if keys exist locally
            const keys = await retrieveKeys();

            // Prepare login data with device info if keys exist
            const loginPayload: LoginData = { ...data };
            if (keys) {
                loginPayload.deviceType = "android"; // or "ios" based on platform
                loginPayload.publicKey = keys.publicKey;
            }

            // Login with the backend
            const response = await authApi.login(loginPayload);

            if (response.success && response.data) {
                // Store token and user FIRST before making any API calls
                await AsyncStorage.setItem("token", response.data.token);
                await AsyncStorage.setItem(
                    "user",
                    JSON.stringify(response.data.user)
                );

                // Store deviceId if device was created/provided (use _id which is MongoDB ObjectId)
                if (response.data.device?._id) {
                    await storeDeviceId(response.data.device._id);
                }

                setToken(response.data.token);
                setUser(response.data.user);

                // Generate keys if they don't exist
                if (!keys) {
                    const { publicKey, privateKey } = await generateKeyPair();
                    await storeKeys(publicKey, privateKey);

                    // Clear old cached messages
                    await clearLocalMessageCache();

                    // Register device with new keys
                    try {
                        const deviceResponse = await deviceApi.register({
                            deviceType: "android", // or "ios" based on platform
                            publicKey: publicKey,
                        });

                        if (
                            deviceResponse.success &&
                            deviceResponse.data?.device?._id
                        ) {
                            await storeDeviceId(deviceResponse.data.device._id);
                        }
                    } catch (error) {
                        console.error("Failed to register device:", error);
                    }
                }
            }
        } catch (error) {
            throw new Error(handleApiError(error));
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            // Clear backend session
            await authApi.logout().catch(console.error);

            // Clear AsyncStorage completely (including deviceId)
            try {
                await AsyncStorage.clear();
            } catch (error) {
                console.error("Error clearing AsyncStorage:", error);
            }

            // Clear message cache
            try {
                await clearAllMessages();
            } catch (error) {
                console.error("Error clearing message cache:", error);
            }

            // Clear encryption keys
            await clearKeys();

            // Clear device ID
            await clearDeviceId();

            // Clear state
            setToken(null);
            setUser(null);

            // Redirect to login (QR scanner)
            router.replace("/");
        } catch (error) {
            console.error("Error during logout:", error);
        }
    };

    const clearAllData = async () => {
        // This function explicitly clears ALL data including encryption keys
        // Use this when user wants to start completely fresh
        // Clearing all encryption keys and local data

        // Clear encryption keys
        await clearKeys();

        // Clear device ID
        await clearDeviceId();

        // Clear AsyncStorage completely
        try {
            await AsyncStorage.clear();
        } catch (error) {
            console.error("Error clearing AsyncStorage:", error);
        }

        // Clear message cache
        try {
            await clearAllMessages();
        } catch (error) {
            console.error("Error clearing message cache:", error);
        }

        // Clear state
        setToken(null);
        setUser(null);

        // Redirect to login (QR scanner)
        router.replace("/");
    };

    // Function to set auth data directly (used by QR login)
    const setAuthData = (userData: User, authToken: string) => {
        setUser(userData);
        setToken(authToken);
    };

    const value: AuthContextType = {
        user,
        token,
        loading,
        login,
        register,
        logout,
        clearAllData,
        setAuthData,
        isAuthenticated: !!token && !!user,
    };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
