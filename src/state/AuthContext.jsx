import { createContext, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("webcultivation_user") || sessionStorage.getItem("webcultivation_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("webcultivation_token") || sessionStorage.getItem("webcultivation_token"));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem("webcultivation_refresh_token") || sessionStorage.getItem("webcultivation_refresh_token"));
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    async function refresh() {
      if (!token) {
        setAuthReady(true);
        return;
      }
      try {
      const rememberSession = Boolean(localStorage.getItem("webcultivation_refresh_token"));
      const storedRefreshToken = localStorage.getItem("webcultivation_refresh_token") || sessionStorage.getItem("webcultivation_refresh_token");
      if (!storedRefreshToken) throw new Error("Refresh token missing");
      const { data } = await api.post("/auth/refresh", { refreshToken: storedRefreshToken });
      persist(data.user, data.token, data.refreshToken, rememberSession);
      } catch (_error) {
        localStorage.removeItem("webcultivation_user");
        localStorage.removeItem("webcultivation_token");
        localStorage.removeItem("webcultivation_refresh_token");
        sessionStorage.removeItem("webcultivation_user");
        sessionStorage.removeItem("webcultivation_token");
        sessionStorage.removeItem("webcultivation_refresh_token");
        setUser(null);
        setToken(null);
      } finally {
        setAuthReady(true);
      }
    }
    refresh();
  }, []);

  const login = async ({ email, password, role, remember = true }) => {
    try {
      const { data } = await api.post("/auth/login", { email, password, role, remember });
      persist(data.user, data.token, data.refreshToken, remember);
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

  const persist = (nextUser, nextToken, nextRefreshToken = refreshToken, remember = true) => {
    setUser(nextUser);
    setToken(nextToken);
    setRefreshToken(nextRefreshToken);
    const primary = remember ? localStorage : sessionStorage;
    const secondary = remember ? sessionStorage : localStorage;
    secondary.removeItem("webcultivation_user");
    secondary.removeItem("webcultivation_token");
    secondary.removeItem("webcultivation_refresh_token");
    primary.setItem("webcultivation_user", JSON.stringify(nextUser));
    primary.setItem("webcultivation_token", nextToken);
    if (nextRefreshToken) primary.setItem("webcultivation_refresh_token", nextRefreshToken);
  };

  const logout = async () => {
    api.post("/auth/logout").catch(() => {});
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    localStorage.removeItem("webcultivation_user");
    localStorage.removeItem("webcultivation_token");
    localStorage.removeItem("webcultivation_refresh_token");
    sessionStorage.removeItem("webcultivation_user");
    sessionStorage.removeItem("webcultivation_token");
    sessionStorage.removeItem("webcultivation_refresh_token");
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
