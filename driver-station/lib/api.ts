import { API_URL, AUTH_TOKEN_KEY } from "./auth-config";

/**
 * Get auth headers for API requests. Only call from client (uses localStorage).
 */
export function getAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") {
    return { "Content-Type": "application/json" };
  }
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  email_verified: boolean;
};

export async function authMe(): Promise<{ user: User }> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Invalid token");
  return res.json();
}

export async function checkEmail(email: string): Promise<{ action: string }> {
  const res = await fetch(`${API_URL}/auth/check_email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || "An error occurred");
  }
  return res.json();
}

export async function signup(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<void> {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
    }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((out as { error?: string }).error || "Signup failed");
}

export async function login(email: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if ((data as { emailVerified?: boolean }).emailVerified === false) {
      const e = new Error("EMAIL_NOT_VERIFIED") as Error & { emailVerified?: boolean };
      e.emailVerified = false;
      throw e;
    }
    throw new Error((data as { error?: string }).error || "Login failed");
  }
  return data as { token: string };
}

export async function forgotPassword(email: string): Promise<{ message?: string }> {
  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  return data as { message?: string };
}

export async function sendTerminalCommand(command: string): Promise<{ output?: string; error?: string }> {
  const res = await fetch(`${API_URL}/api/terminal/command`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ command }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: string }).error || res.statusText;
    return { error: err };
  }
  return data as { output?: string; error?: string };
}
