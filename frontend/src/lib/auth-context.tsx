"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getCurrentUser, loginUser, logoutUser, type UserData, type LoginData, type LoginResponse } from "@/lib/api-auth";

interface AuthContextType {
  user: UserData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginData) => Promise<LoginResponse>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "auth_token";
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      setToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  // Fetch user when token changes
  useEffect(() => {
    if (token) {
      fetchUser(token);
    }
  }, [token]);

  const fetchUser = async (authToken: string) => {
    try {
      setIsLoading(true);
      const userData = await getCurrentUser(authToken);
      setUser(userData);
    } catch (error) {
      console.error("Failed to fetch user:", error);
      // Token is invalid, clear it
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (data: LoginData): Promise<LoginResponse> => {
    const response = await loginUser(data);

    // Store token in localStorage and cookies
    localStorage.setItem(TOKEN_KEY, response.access_token);
    // Set cookie for middleware to access
    document.cookie = `auth_token=${response.access_token}; path=/; max-age=${24 * 60 * 60}`;
    setToken(response.access_token);

    return response;
  }, []);

  const logout = useCallback(() => {
    logoutUser();
    localStorage.removeItem(TOKEN_KEY);
    // Clear auth token cookie
    document.cookie = "auth_token=; path=/; max-age=0";
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (token) {
      await fetchUser(token);
    }
  }, [token]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshUser,
    token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}


