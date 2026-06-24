"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface UserData {
  id: string;
  username: string;
  email: string;
  role: string;
  wallet_address: string;
}

interface AuthContextType {
  user: UserData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TEST_USER: UserData = {
  id: "test-user-001",
  username: "testuser",
  email: "test@sentinel.io",
  role: "user",
  wallet_address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
};

const TEST_TOKEN = "test-token-auto-login";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUser(TEST_USER);
    localStorage.setItem("auth_token", TEST_TOKEN);
    setIsLoading(false);
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: true,
    isLoading,
    token: TEST_TOKEN,
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
