import { apiClient } from "./axiosInstance";

export const authAPI = {
  login: (credentials) => apiClient.post("/api/auth/login/", credentials),
  register: (payload) => apiClient.post("/api/auth/register/", payload),
  refresh: (refresh) => apiClient.post("/api/auth/refresh/", { refresh }),
  me: () => apiClient.get("/api/auth/me/"),
};
