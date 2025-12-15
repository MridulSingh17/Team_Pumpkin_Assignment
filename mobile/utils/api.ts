/**
 * API Client for backend communication
 * Handles all HTTP requests with authentication
 */

import type {
    ApiResponse,
    AuthResponse,
    Conversation,
    CreateConversationData,
    Device,
    LoginData,
    Message,
    MessagesResponse,
    QRLoginData,
    QRLoginResponse,
    RegisterData,
    RegisterDeviceData,
    SendMessageData,
    User,
} from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, { AxiosError, AxiosInstance, isAxiosError } from "axios";

// Update this to your backend URL
const API_URL = "http://192.168.29.132:5001";

// Create axios instance
const apiClient: AxiosInstance = axios.create({
    baseURL: `${API_URL}/api`,
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 30000,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        if (error.response?.status === 401) {
            // Clear auth data on unauthorized
            await AsyncStorage.removeItem("token");
            await AsyncStorage.removeItem("user");
        }
        return Promise.reject(error);
    }
);

// Error handler
export function handleApiError(error: unknown): string {
    if (isAxiosError(error)) {
        return (
            error.response?.data?.message ||
            error.message ||
            "An error occurred"
        );
    }
    if (error instanceof Error) {
        return error.message;
    }
    return "An unknown error occurred";
}

// Auth API
export const authApi = {
    register: async (data: RegisterData): Promise<AuthResponse> => {
        const response = await apiClient.post<AuthResponse>(
            "/auth/register",
            data
        );
        return response.data;
    },

    login: async (data: LoginData): Promise<AuthResponse> => {
        const response = await apiClient.post<AuthResponse>(
            "/auth/login",
            data
        );
        return response.data;
    },

    logout: async (): Promise<ApiResponse> => {
        const response = await apiClient.post<ApiResponse>("/auth/logout");
        return response.data;
    },

    me: async (): Promise<ApiResponse<{ user: User }>> => {
        const response = await apiClient.get<ApiResponse<{ user: User }>>(
            "/auth/me"
        );
        return response.data;
    },

    qrLogin: async (data: QRLoginData): Promise<QRLoginResponse> => {
        const response = await apiClient.post<QRLoginResponse>(
            "/auth/qr-login",
            data
        );
        return response.data;
    },
};

// User API
export const userApi = {
    getAll: async (): Promise<ApiResponse<{ users: User[] }>> => {
        const response = await apiClient.get<ApiResponse<{ users: User[] }>>(
            "/users"
        );
        return response.data;
    },

    getUserPublicKey: async (
        userId: string
    ): Promise<ApiResponse<{ publicKey: string }>> => {
        const response = await apiClient.get<
            ApiResponse<{ publicKey: string }>
        >(`/users/${userId}/publicKey`);
        return response.data;
    },

    updatePublicKey: async (
        publicKey: string
    ): Promise<ApiResponse<{ user: User }>> => {
        const response = await apiClient.put<ApiResponse<{ user: User }>>(
            "/users/me/publicKey",
            { publicKey }
        );
        return response.data;
    },
};

// Conversation API
export const conversationApi = {
    getAll: async (): Promise<
        ApiResponse<{ conversations: Conversation[] }>
    > => {
        const response = await apiClient.get<
            ApiResponse<{ conversations: Conversation[] }>
        >("/conversations");
        return response.data;
    },

    getById: async (
        conversationId: string
    ): Promise<ApiResponse<{ conversation: Conversation }>> => {
        const response = await apiClient.get<
            ApiResponse<{ conversation: Conversation }>
        >(`/conversations/${conversationId}`);
        return response.data;
    },

    create: async (
        data: CreateConversationData
    ): Promise<ApiResponse<{ conversation: Conversation; isNew: boolean }>> => {
        const response = await apiClient.post<
            ApiResponse<{ conversation: Conversation; isNew: boolean }>
        >("/conversations", data);
        return response.data;
    },

    getOrCreate: async (
        data: CreateConversationData
    ): Promise<ApiResponse<{ conversation: Conversation; isNew: boolean }>> => {
        const response = await apiClient.post<
            ApiResponse<{ conversation: Conversation; isNew: boolean }>
        >("/conversations/get-or-create", data);
        return response.data;
    },
};

// Message API
export const messageApi = {
    getMessages: async (
        conversationId: string,
        page: number = 1,
        limit: number = 50,
        deviceId?: string
    ): Promise<MessagesResponse> => {
        const response = await apiClient.get<MessagesResponse>(
            `/messages/${conversationId}`,
            {
                params: { page, limit, deviceId },
            }
        );
        return response.data;
    },

    send: async (
        data: SendMessageData
    ): Promise<ApiResponse<{ message: Message }>> => {
        const response = await apiClient.post<
            ApiResponse<{ message: Message }>
        >("/messages", data);
        return response.data;
    },
};

// Device API
export const deviceApi = {
    register: async (
        data: RegisterDeviceData
    ): Promise<ApiResponse<{ device: Device }>> => {
        const response = await apiClient.post<ApiResponse<{ device: Device }>>(
            "/devices",
            data
        );
        return response.data;
    },

    getMyDevices: async (): Promise<
        ApiResponse<{ devices: Device[]; count: number; maxDevices: number }>
    > => {
        const response = await apiClient.get<
            ApiResponse<{
                devices: Device[];
                count: number;
                maxDevices: number;
            }>
        >("/devices/me");
        return response.data;
    },

    getUserDevices: async (
        userId: string
    ): Promise<ApiResponse<{ devices: Device[] }>> => {
        const response = await apiClient.get<
            ApiResponse<{ devices: Device[] }>
        >(`/devices/user/${userId}`);
        return response.data;
    },

    removeDevice: async (deviceId: string): Promise<ApiResponse> => {
        const response = await apiClient.delete<ApiResponse>(
            `/devices/${deviceId}`
        );
        return response.data;
    },

    markDeviceActive: async (
        deviceId: string
    ): Promise<ApiResponse<{ device: Device }>> => {
        const response = await apiClient.put<ApiResponse<{ device: Device }>>(
            `/devices/${deviceId}/active`
        );
        return response.data;
    },
};
