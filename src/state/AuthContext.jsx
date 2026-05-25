import { createContext, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("invoiceflow_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("invoiceflow_token"));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem("invoiceflow_refresh_token"));
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    async function refresh() {
      if (!token) {
        setAuthReady(true);
        return;
      }
      try {
      const storedRefreshToken = localStorage.getItem("invoiceflow_refresh_token");
      const { data } = await api.post("/auth/refresh", { refreshToken: storedRefreshToken });
      persist(data.user, data.token, data.refreshToken);
      } catch (_error) {
        localStorage.removeItem("invoiceflow_user");
        localStorage.removeItem("invoiceflow_token");
        localStorage.removeItem("invoiceflow_refresh_token");
        setUser(null);
        setToken(null);
      } finally {
        setAuthReady(true);
      }
    }
    refresh();
  }, []);

  const login = async ({ email, password, role }) => {
    try {
      const { data } = await api.post("/auth/login", { email, password, role });
      persist(data.user, data.token, data.refreshToken);
      toast.success(`Welcome back, ${data.user.name}`);
      return data.user;
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
      throw error;
    }
  };

  const signup = async (payload) => {
    try {
      const { data } = await api.post("/auth/signup", payload);
      toast.success(data.message || "Account created");
      return data.user;
    } catch (error) {
      toast.error(error.response?.data?.message || "Signup failed");
      throw error;
    }
  };

  const forgotPassword = async (payload) => {
    const { data } = await api.post("/auth/forgot-password", payload);
    toast.success(data.message);
    return data;
  };

  const verifyOtp = async (payload) => {
    const { data } = await api.post("/auth/verify-otp", payload);
    toast.success("OTP verified");
    return data;
  };

  const resetPassword = async (payload) => {
    const { data } = await api.post("/auth/reset-password", payload);
    toast.success(data.message);
    return data;
  };

  const persist = (nextUser, nextToken, nextRefreshToken = refreshToken) => {
    setUser(nextUser);
    setToken(nextToken);
    setRefreshToken(nextRefreshToken);
    localStorage.setItem("invoiceflow_user", JSON.stringify(nextUser));
    localStorage.setItem("invoiceflow_token", nextToken);
    if (nextRefreshToken) localStorage.setItem("invoiceflow_refresh_token", nextRefreshToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    localStorage.removeItem("invoiceflow_user");
    localStorage.removeItem("invoiceflow_token");
    localStorage.removeItem("invoiceflow_refresh_token");
    toast.success("Signed out");
  };

  const updateProfile = async (payload, successMessage = "Profile updated") => {
    const { data } = await api.patch("/users/me", payload);
    persist(data, token);
    toast.success(successMessage);
    return data;
  };

  const value = useMemo(() => ({ user, token, authReady, login, signup, forgotPassword, verifyOtp, resetPassword, updateProfile, logout, isAuthenticated: Boolean(user) }), [user, token, authReady]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
