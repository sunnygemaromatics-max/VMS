// Token and auth helpers
const TOKEN_KEY = 'vms_auth_token';
const USER_KEY = 'vms_user';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'HR_MANAGER' | 'SECURITY_GUARD' | 'RECEPTIONIST' | 'CONTRACTOR_SUPERVISOR' | 'EMPLOYEE';
  branchId: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

// Get token from localStorage
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

// Get user from localStorage
export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
}

// Set auth data after login
export function setAuth(token: string, user: AuthUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Clear auth data on logout
export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

import { apiPost } from './api';

export type LoginResult =
  | AuthResponse
  | { totpRequired: true };

export async function apiLogin(
  email: string,
  password: string,
  totp?: string,
): Promise<LoginResult> {
  return apiPost<LoginResult>('/auth/login', { email, password, totp });
}

export async function apiSignup(
  email: string,
  password: string,
  fullName: string,
  branchId: string
): Promise<AuthResponse> {
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  return apiPost<AuthResponse>('/auth/register', {
    email,
    password,
    fullName,
    branchId,
  });
}
