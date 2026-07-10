import { apiClient } from "./axiosInstance";
import { toQueryString } from "../utils/helpers";

export const fertilizerAPI = {
  inventory: (params = {}) => apiClient.get(`/api/fertilizer-inventory/${toQueryString(params)}`),
  createInventory: (payload) => apiClient.post("/api/fertilizer-inventory/", payload),
  updateInventory: (id, payload) => apiClient.patch(`/api/fertilizer-inventory/${id}/`, payload),
  requests: (params = {}) => apiClient.get(`/api/fertilizer-requests/${toQueryString(params)}`),
  createRequest: (payload) => apiClient.post("/api/fertilizer-requests/", payload),
  approve: (id) => apiClient.post(`/api/fertilizer-requests/${id}/approve/`, {}),
  reject: (id) => apiClient.post(`/api/fertilizer-requests/${id}/reject/`, {}),
  reopen: (id) => apiClient.post(`/api/fertilizer-requests/${id}/reopen/`, {}),
};
