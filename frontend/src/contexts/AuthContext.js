import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TOKEN_KEY = 'vivalusa_token';

function setAxiosToken(token) {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
}

function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingTwoFA, setPendingTwoFA] = useState(false);

  const checkAuth = useCallback(async () => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) setAxiosToken(stored);
    try {
      const { data } = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(data);
    } catch {
      setUser(false);
      localStorage.removeItem(TOKEN_KEY);
      setAxiosToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (email, password) => {
    try {
      const { data } = await axios.post(`${API}/auth/login`, { email, password }, { withCredentials: true });
      if (data.requires_2fa) {
        setPendingTwoFA(true);
        return { success: false, requires_2fa: true };
      }
      if (data.access_token) {
        localStorage.setItem(TOKEN_KEY, data.access_token);
        setAxiosToken(data.access_token);
      }
      setUser(data);
      return { success: true };
    } catch (e) {
      return { success: false, error: formatApiErrorDetail(e.response?.data?.detail) };
    }
  };

  const verify2fa = async (code) => {
    try {
      const { data } = await axios.post(`${API}/admin/2fa/verify`, { code }, { withCredentials: true });
      setPendingTwoFA(false);
      setUser(data);
      return { success: true };
    } catch (e) {
      return { success: false, error: formatApiErrorDetail(e.response?.data?.detail) };
    }
  };

  const register = async (name, email, password) => {
    try {
      const { data } = await axios.post(`${API}/auth/register`, { name, email, password }, { withCredentials: true });
      if (data.access_token) {
        localStorage.setItem(TOKEN_KEY, data.access_token);
        setAxiosToken(data.access_token);
      }
      setUser(data);
      return { success: true };
    } catch (e) {
      return { success: false, error: formatApiErrorDetail(e.response?.data?.detail) };
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch { /* ignore */ }
    localStorage.removeItem(TOKEN_KEY);
    setAxiosToken(null);
    setUser(false);
    setPendingTwoFA(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, verify2fa, pendingTwoFA, setPendingTwoFA }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
