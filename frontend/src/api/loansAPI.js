import { apiClient } from "./axiosInstance";
import { toQueryString } from "../utils/helpers";

export const loansAPI = {
  list: (params = {}) => apiClient.get(`/api/loans/${toQueryString(params)}`),
  approve: (id) => apiClient.post(`/api/loans/${id}/approve/`, {}),
  reject: (id, reason) => apiClient.post(`/api/loans/${id}/reject/`, { reason }),
};
