import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "@remix-run/react";
import toast from "react-hot-toast";
import api from "~/lib/axios";

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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      // Check for existing token in localStorage
      const token = localStorage.getItem('jwt');
      if (token) {
        // Set auth header if token exists
        api.defaults.headers.Authorization = `Bearer ${token}`;
        const res = await api.get("/me");
        setUser(res.data.user as User);
      } else {
        setUser(null);
      }
    } catch (err) {
      // Clear invalid token on error
      localStorage.removeItem('jwt');
      delete api.defaults.headers.Authorization;
      setUser(null);
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
      // Store token and set auth header
      if (res.data.token) {
        localStorage.setItem('jwt', res.data.token);
        api.defaults.headers.Authorization = `Bearer ${res.data.token}`;
      }
      // Update user state with the user data from the response
      setUser(res.data.user);
      navigate("/");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Login failed");
      throw err;
    }
  };

  const signup = async ({ email, password, name }: SignupInput) => {
    try {
      const res = await api.post("/signup", { email, password, name });
      toast.success(res.data.message || "Account created");
      // Store token and set auth header
      if (res.data.token) {
        localStorage.setItem('jwt', res.data.token);
        api.defaults.headers.Authorization = `Bearer ${res.data.token}`;
      }
      // Update user state with the user data from the response
      setUser(res.data.user);
      navigate("/");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Signup failed");
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.post("/logout");
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      // Clear token and auth header
      localStorage.removeItem('jwt');
      delete api.defaults.headers.Authorization;
      setUser(null);
      navigate("/login");
    }
  };

  const value: AuthContextValue = {
    user,
    loading,
    login,
    signup,
    logout,
    refresh,
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
