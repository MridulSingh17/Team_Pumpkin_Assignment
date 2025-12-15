/**
 * API Client for backend communication
 * Handles all HTTP requests with authentication
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  AuthResponse,
  RegisterData,
  LoginData,
  User,
  Conversation,
  CreateConversationData,
  Message,
  SendMessageData,
  MessagesResponse,
  ExportData,
  ExportResponse,
  ImportData,
  ImportResponse,
  ApiResponse,
  Device,
  RegisterDeviceData,
} from '@/types';

// Temporarily hardcoded to ensure correct port
const API_URL = 'http://localhost:5001';

// API Client initialized

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
  withCredentials: true, // Send cookies with requests
});

// Request interceptor (tokens now in httpOnly cookies)
apiClient.interceptors.request.use(
  (config) => {
    // Cookies are sent automatically with withCredentials: true
    // No need to manually add Authorization header
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and token refresh
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url;
    const originalRequest = error.config as any;

    console.error(`API Error: ${status} ${error.config?.method?.toUpperCase()} ${url}`, error.response?.data);

    // Handle 401 Unauthorized - try to refresh token
    if (status === 401 && !originalRequest._retry && url !== '/auth/refresh') {
      originalRequest._retry = true;

      try {
        // Try to refresh the token
        const refreshResponse = await apiClient.post('/auth/refresh');

        // Store new token in localStorage for Socket.IO
        if (refreshResponse.data?.data?.token) {
          localStorage.setItem('token', refreshResponse.data.data.token);
        }

        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout user
        console.warn('Token refresh failed, logging out');
        localStorage.removeItem('user');
        localStorage.removeItem('deviceId');
        localStorage.removeItem('token');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth APIs
export const authApi = {
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  logout: async (): Promise<ApiResponse> => {
    const response = await apiClient.post<ApiResponse>('/auth/logout');
    return response.data;
  },
};

// User APIs
export const userApi = {
  getAll: async (): Promise<ApiResponse<{ users: User[] }>> => {
    const response = await apiClient.get<ApiResponse<{ users: User[] }>>('/users');
    return response.data;
  },

  getMe: async (): Promise<ApiResponse<{ user: User }>> => {
    const response = await apiClient.get<ApiResponse<{ user: User }>>('/users/me');
    return response.data;
  },

  getUserPublicKey: async (userId: string): Promise<ApiResponse<{ publicKey: string; username: string }>> => {
    const response = await apiClient.get<ApiResponse<{ publicKey: string; username: string }>>(
      `/users/${userId}/publicKey`
    );
    return response.data;
  },

  updatePublicKey: async (publicKey: string): Promise<ApiResponse<{ user: User }>> => {
    const response = await apiClient.put<ApiResponse<{ user: User }>>('/users/me/publicKey', { publicKey });
    return response.data;
  },
};

// Conversation APIs
export const conversationApi = {
  getOrCreate: async (data: CreateConversationData): Promise<ApiResponse<{ conversation: Conversation; isNew: boolean }>> => {
    const response = await apiClient.post<ApiResponse<{ conversation: Conversation; isNew: boolean }>>('/conversations/get-or-create', data);
    return response.data;
  },

  create: async (data: CreateConversationData): Promise<ApiResponse<{ conversation: Conversation }>> => {
    const response = await apiClient.post<ApiResponse<{ conversation: Conversation }>>('/conversations', data);
    return response.data;
  },

  getAll: async (): Promise<ApiResponse<{ conversations: Conversation[] }>> => {
    const response = await apiClient.get<ApiResponse<{ conversations: Conversation[] }>>('/conversations');
    return response.data;
  },

  getById: async (conversationId: string): Promise<ApiResponse<{ conversation: Conversation }>> => {
    const response = await apiClient.get<ApiResponse<{ conversation: Conversation }>>(
      `/conversations/${conversationId}`
    );
    return response.data;
  },
};

// Message APIs
export const messageApi = {
  send: async (data: SendMessageData): Promise<ApiResponse<{ message: Message }>> => {
    const response = await apiClient.post<ApiResponse<{ message: Message }>>('/messages', data);
    return response.data;
  },

  getMessages: async (
    conversationId: string,
    page: number = 1,
    limit: number = 50,
    deviceId?: string
  ): Promise<MessagesResponse> => {
    const response = await apiClient.get<MessagesResponse>(`/messages/${conversationId}`, {
      params: { page, limit, deviceId },
    });
    return response.data;
  },
};

// Device APIs
export const deviceApi = {
  register: async (data: RegisterDeviceData): Promise<ApiResponse<{ device: Device }>> => {
    const response = await apiClient.post<ApiResponse<{ device: Device }>>('/devices', data);
    return response.data;
  },

  getMyDevices: async (): Promise<ApiResponse<{ devices: Device[]; count: number; maxDevices: number }>> => {
    const response = await apiClient.get<ApiResponse<{ devices: Device[]; count: number; maxDevices: number }>>('/devices/me');
    return response.data;
  },

  getUserDevices: async (userId: string): Promise<ApiResponse<{ devices: Device[] }>> => {
    const response = await apiClient.get<ApiResponse<{ devices: Device[] }>>(`/devices/user/${userId}`);
    return response.data;
  },

  removeDevice: async (deviceId: string): Promise<ApiResponse> => {
    const response = await apiClient.delete<ApiResponse>(`/devices/${deviceId}`);
    return response.data;
  },

  markDeviceActive: async (deviceId: string): Promise<ApiResponse<{ device: Device }>> => {
    const response = await apiClient.put<ApiResponse<{ device: Device }>>(`/devices/${deviceId}/active`);
    return response.data;
  },
};

// Export/Import APIs
export const exportApi = {
  exportConversation: async (data: ExportData): Promise<ExportResponse> => {
    const response = await apiClient.post<ExportResponse>('/export', data);
    return response.data;
  },

  importConversation: async (data: ImportData): Promise<ImportResponse> => {
    const response = await apiClient.post<ImportResponse>('/export/import', data);
    return response.data;
  },
};

// Helper function to handle API errors
export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiResponse>;
    return axiosError.response?.data?.message || axiosError.message || 'An error occurred';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
}

export default apiClient;