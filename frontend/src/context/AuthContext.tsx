import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { clientEnv } from "../lib/env";

type UserRole = "admin" | "editor" | "viewer";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const STORAGE_KEY = "sk-dataforge-auth-token";
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken("");
    setUser(null);
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const loadCurrentUser = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${clientEnv.apiUrl}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const data = (await response.json()) as { user: AuthUser; message?: string };

        if (!response.ok) {
          throw new Error(data.message || "Session expired.");
        }

        setUser(data.user);
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };

    void loadCurrentUser();
  }, [token]);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const isApiRequest = requestUrl.startsWith(clientEnv.apiUrl);

      if (!isApiRequest || !token) {
        return originalFetch(input, init);
      }

      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      return originalFetch(input, {
        ...init,
        headers
      });
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [token]);

  const login = async (email: string, password: string) => {
    const response = await fetch(`${clientEnv.apiUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });
    const data = (await response.json()) as { token: string; user: AuthUser; message?: string };

    if (!response.ok) {
      throw new Error(data.message || "Failed to sign in.");
    }

    localStorage.setItem(STORAGE_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      login,
      logout
    }),
    [loading, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}
