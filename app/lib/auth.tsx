import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "@remix-run/react";
import toast from "react-hot-toast";
import api from "~/lib/axios";
import { db } from "~/localdb";
import tokenStore from "~/lib/tokenStore";

interface User {
  email: string;
  name: string;
  userId: string;
}

interface LoginInput {
  email: string;
  password: string;
}
interface SignupInput extends LoginInput {
  name: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  token: string | null; // Add token to the context
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null); // Add token state

  // Update the token in both state and tokenStore whenever it changes
  const updateToken = (newToken: string | null) => {
    setToken(newToken);
    tokenStore.setToken(newToken);
  };

  // Set token in memory whenever it changes
  useEffect(() => {
    if (token) {
      tokenStore.setToken(token);
    } else {
      tokenStore.clearToken();
    }
  }, [token]);

  const refresh = async () => {
    try {
      const res = await api.get("/me");
      setUser(res.data.user as User);
    } catch (err) {
      setUser(null);
      updateToken(null); // Clear token on failed refresh
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async ({ email, password }: LoginInput) => {
    try {
      const res = await api.post("/login", { email, password });
      toast.success(res.data.message || "Logged in");
      // Update user state with the user data from the response
      setUser(res.data.user);
      updateToken(res.data.token); // Store token in memory and tokenStore
      navigate("/");
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const error = err as { response?: { data?: { error?: string } } };
        toast.error(error.response?.data?.error || "Login failed");
      } else {
        toast.error("Login failed");
      }
      throw err;
    }
  };

  const signup = async ({ email, password, name }: SignupInput) => {
    try {
      const res = await api.post("/signup", { email, password, name });
      toast.success(res.data.message || "Account created");
      // Update user state with the user data from the response
      setUser(res.data.user);
      updateToken(res.data.token); // Store token in memory and tokenStore
      navigate("/");
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const error = err as { response?: { data?: { error?: string } } };
        toast.error(error.response?.data?.error || "Signup failed");
      } else {
        toast.error("Signup failed");
      }
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.post("/logout");
    } catch (err) {
      // Ignore errors during logout
      console.error("Error during logout:", err);
    }
    db.tables.forEach((a) => {
      a.clear();
    });
    setUser(null);
    updateToken(null); // Clear token from memory and tokenStore
    navigate("/login");
  };

  const value: AuthContextValue = {
    user,
    loading,
    login,
    signup,
    logout,
    refresh,
    token, // Expose token through context
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
