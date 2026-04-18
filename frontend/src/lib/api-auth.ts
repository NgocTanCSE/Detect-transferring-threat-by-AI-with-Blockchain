/**
 * Authentication API functions for login, register, and user management.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export interface UserData {
  id: string;
  username: string;
  email: string;
  role: string;
  wallet_address: string | null;
  warning_count: number;
  is_active: boolean;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  wallet_address?: string;
}

export interface LoginData {
  username: string;
  password: string;
}

/**
 * Register a new user account.
 */
export async function registerUser(data: RegisterData): Promise<UserData> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Registration failed");
  }

  return response.json();
}

/**
 * Login with username/email and password.
 */
export async function loginUser(data: LoginData): Promise<LoginResponse> {
  // OAuth2 form format
  const formData = new URLSearchParams();
  formData.append("username", data.username);
  formData.append("password", data.password);

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Login failed");
  }

  return response.json();
}

/**
 * Get current user info from token.
 */
export async function getCurrentUser(token: string): Promise<UserData> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to get user info");
  }

  return response.json();
}

/**
 * Logout user (client-side only, clears token).
 */
export async function logoutUser(): Promise<void> {
  // JWT is stateless, just clear client-side
  localStorage.removeItem("auth_token");
}
