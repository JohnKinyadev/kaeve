import { createContext, useCallback, useMemo, useState } from "react";

import { authAPI } from "../api/authAPI";
import { tokenStorage } from "../api/axiosInstance";
import { normalizeRole } from "../utils/helpers";
import { ROLES } from "../utils/constants";

export const AuthContext = createContext(null);

function normalizeUser(payload) {
  const role = normalizeRole(payload.role || payload.user_role || payload.groups?.[0]);
  return {
    id: payload.id || payload.user_id || payload.sub,
    username: payload.username,
    email: payload.email,
    name: payload.name || payload.username || payload.email || "User",
    role: role || ROLES.MEMBER,
    member: payload.member || null,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => tokenStorage.getStoredUser());

  const login = useCallback(async (credentials) => {
    const data = await authAPI.login(credentials);
    tokenStorage.setTokens(data);
    const profile = await authAPI.me();
    const nextUser = normalizeUser(profile);
    tokenStorage.setStoredUser(nextUser);
    setUser(nextUser);
    return nextUser;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authAPI.register(payload);
    tokenStorage.setTokens(data);
    const profile = await authAPI.me().catch(() => data.user);
    const nextUser = normalizeUser(profile);
    tokenStorage.setStoredUser(nextUser);
    setUser(nextUser);
    return nextUser;
  }, []);

  const completeSocialLogin = useCallback(async ({ access, refresh }) => {
    tokenStorage.setTokens({ access, refresh });
    const profile = await authAPI.me();
    const nextUser = normalizeUser(profile);
    tokenStorage.setStoredUser(nextUser);
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clearTokens();
    setUser(null);
    window.location.hash = "#/login";
  }, []);

  const value = useMemo(
    () => ({
      user,
      role: user?.role,
      login,
      register,
      completeSocialLogin,
      logout,
      isAuthenticated: Boolean(user && tokenStorage.getAccessToken()),
    }),
    [completeSocialLogin, login, logout, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
