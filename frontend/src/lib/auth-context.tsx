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
const AUTH_DISABLED = (process.env.NEXT_PUBLIC_AUTH_DISABLED ?? "false").toLowerCase() === "true";

const AUTH_DISABLED_USER: UserData = {
  id: "00000000-0000-0000-0000-000000000000",
  username: "system_admin",
  email: "system-admin@local",
  role: "admin",
  wallet_address: null,
  warning_count: 0,
  is_active: true,
  created_at: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    if (AUTH_DISABLED) {
      setUser(AUTH_DISABLED_USER);
      setToken("auth-disabled");
      setIsLoading(false);
      return;
    }

    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      setToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  // Fetch user when token changes
  useEffect(() => {
    if (AUTH_DISABLED) {
      return;
    }

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
    if (AUTH_DISABLED) {
      throw new Error("Authentication is temporarily disabled");
    }

    const response = await loginUser(data);

    // Store token
    localStorage.setItem(TOKEN_KEY, response.access_token);
    setToken(response.access_token);

    return response;
  }, []);

  const logout = useCallback(() => {
    if (AUTH_DISABLED) {
      return;
    }

    logoutUser();
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (AUTH_DISABLED) {
      return;
    }

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
