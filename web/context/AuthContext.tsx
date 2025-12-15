'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, handleApiError } from '@/lib/api';
import { generateKeyPair, storeKeys, retrieveKeys, clearKeys } from '@/lib/encryption';
import { localDB } from '@/lib/localDB';
import type { User, RegisterData, LoginData } from '@/types';

// Helper to safely access localStorage
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error(`Error writing ${key} to localStorage:`, error);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing ${key} from localStorage:`, error);
    }
  }
};

// Helper to clear local cache of old messages
const clearLocalMessageCache = async () => {
  try {
    await localDB.clearAll();
    // Cleared local message cache
  } catch (error) {
    console.error('Error clearing local cache:', error);
  }
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: Omit<RegisterData, 'publicKey'>) => Promise<void>;
  logout: () => void;
  clearAllData: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check authentication status on mount (tokens in httpOnly cookies)
  useEffect(() => {
    const checkAuth = async () => {
      const storedUser = safeLocalStorage.getItem('user');

      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (error) {
          console.error('Error loading user from storage:', error);
          safeLocalStorage.removeItem('user');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const register = async (data: Omit<RegisterData, 'publicKey'>) => {
    try {
      setLoading(true);

      // Generate key pair for the user
      const { publicKey, privateKey } = await generateKeyPair();

      // Register with the backend
      const response = await authApi.register({
        ...data,
        publicKey,
        deviceType: 'web',
      });

      // Store keys locally
      storeKeys(publicKey, privateKey);

      // Store user, deviceId, and token (token also needed for Socket.IO)
      safeLocalStorage.setItem('user', JSON.stringify(response.data.user));
      if (response.data.device?._id) {
        safeLocalStorage.setItem('deviceId', response.data.device._id);
      }
      if (response.data.token) {
        safeLocalStorage.setItem('token', response.data.token);
      }

      setUser(response.data.user);

      // Redirect to chat
      router.push('/chat');
    } catch (error) {
      throw new Error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const login = async (data: LoginData) => {
    try {
      setLoading(true);

      // Check if keys exist locally, if not generate new ones
      let keys = retrieveKeys();

      if (!keys) {
        // No encryption keys found, generating new keys
        const { publicKey, privateKey } = await generateKeyPair();
        storeKeys(publicKey, privateKey);
        keys = { publicKey, privateKey };

        // Clear old cached messages since we have new keys
        await clearLocalMessageCache();
      }

      // Always send deviceType and publicKey (required by backend)
      const loginPayload = {
        ...data,
        deviceType: 'web',
        publicKey: keys.publicKey,
      };

      // Login with the backend
      const response = await authApi.login(loginPayload);

      // Store user, deviceId, and token (token also needed for Socket.IO)
      safeLocalStorage.setItem('user', JSON.stringify(response.data.user));

      // Store deviceId if device was created/provided (use _id which is MongoDB ObjectId)
      if (response.data.device?._id) {
        safeLocalStorage.setItem('deviceId', response.data.device._id);
      }
      if (response.data.token) {
        safeLocalStorage.setItem('token', response.data.token);
      }

      setUser(response.data.user);

      // Redirect to chat
      router.push('/chat');
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

      // Clear encryption keys first
      clearKeys();

      // Clear IndexedDB - clear all stores first
      try {
        await localDB.clearAll();
      } catch (error) {
        console.error('Error clearing IndexedDB stores:', error);
      }

      // Close and delete the entire IndexedDB database
      try {
        localDB.close();
        if (typeof window !== 'undefined' && window.indexedDB) {
          await new Promise<void>((resolve, reject) => {
            const deleteRequest = window.indexedDB.deleteDatabase('EncryptedChatDB');
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(new Error('Failed to delete database'));
            deleteRequest.onblocked = () => {
              console.warn('Database deletion blocked');
              resolve(); // Continue anyway
            };
          });
        }
      } catch (error) {
        console.error('Error deleting IndexedDB:', error);
      }

      // Clear localStorage completely (including deviceId and token)
      try {
        localStorage.clear();
      } catch (error) {
        console.error('Error clearing localStorage:', error);
      }

      // Clear sessionStorage
      try {
        sessionStorage.clear();
      } catch (error) {
        console.error('Error clearing sessionStorage:', error);
      }

      // Clear all cookies
      try {
        const cookies = document.cookie.split(";");
        for (const cookie of cookies) {
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          // Clear for all possible paths and domains
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
        }
      } catch (error) {
        console.error('Error clearing cookies:', error);
      }

      // Clear state
      setUser(null);

      // Small delay to ensure everything is cleared
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      // Always redirect to login
      router.push('/login');
    }
  };

  const clearAllData = async () => {
    // This function explicitly clears ALL data including encryption keys
    // Use this when user wants to start completely fresh
    try {
      // Clear encryption keys first
      clearKeys();

      // Clear IndexedDB - clear all stores first
      try {
        await localDB.clearAll();
      } catch (error) {
        console.error('Error clearing IndexedDB stores:', error);
      }

      // Close and delete the entire IndexedDB database
      try {
        localDB.close();
        if (typeof window !== 'undefined' && window.indexedDB) {
          await new Promise<void>((resolve, reject) => {
            const deleteRequest = window.indexedDB.deleteDatabase('EncryptedChatDB');
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(new Error('Failed to delete database'));
            deleteRequest.onblocked = () => {
              console.warn('Database deletion blocked');
              resolve(); // Continue anyway
            };
          });
        }
      } catch (error) {
        console.error('Error deleting IndexedDB:', error);
      }

      // Clear localStorage completely
      try {
        localStorage.clear();
      } catch (error) {
        console.error('Error clearing localStorage:', error);
      }

      // Clear sessionStorage
      try {
        sessionStorage.clear();
      } catch (error) {
        console.error('Error clearing sessionStorage:', error);
      }

      // Clear all cookies
      try {
        const cookies = document.cookie.split(";");
        for (const cookie of cookies) {
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          // Clear for all possible paths and domains
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
        }
      } catch (error) {
        console.error('Error clearing cookies:', error);
      }

      // Clear state
      setUser(null);

      // Small delay to ensure everything is cleared
      await new Promise(resolve => setTimeout(resolve, 100));

      // Notify user
      alert('All local data and encryption keys have been cleared. You will need to log in again.');
    } catch (error) {
      console.error('Error clearing all data:', error);
    } finally {
      router.push('/login');
    }
  };

  // Expose clearAllData to window for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as Window & { clearChatData?: () => Promise<void> }).clearChatData = async () => {
        // Clearing all chat data and encryption keys
        await clearAllData();
      };
      // Debug: Call window.clearChatData() to clear all local data
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    clearAllData,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}