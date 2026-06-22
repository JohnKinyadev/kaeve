import { apiClient } from "./axiosInstance";

export const dashboardAPI = {
  summary: () => apiClient.get("/api/dashboard-summary/"),
  recentDeliveries: () => apiClient.get("/api/deliveries/?ordering=-delivery_date&page=1"),
};
