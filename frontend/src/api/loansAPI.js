import { apiClient } from "./axiosInstance";
import { toQueryString } from "../utils/helpers";

export const loansAPI = {
  list: (params = {}) => apiClient.get(`/api/loans/${toQueryString(params)}`),
  apply: (payload) => apiClient.post("/api/loans/apply/", payload),
  eligibility: (params = {}) => apiClient.get(`/api/loans/eligibility/${toQueryString(params)}`),
  currentPolicy: () => apiClient.get("/api/loan-policy/current/"),
  searchGuarantors: (search) => apiClient.get(`/api/members/guarantor-search/${toQueryString({ search })}`),
  approve: (id) => apiClient.post(`/api/loans/${id}/approve/`, {}),
  reject: (id, reason) => apiClient.post(`/api/loans/${id}/reject/`, { reason }),
};
