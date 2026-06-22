import { apiClient } from "./axiosInstance";
import { toQueryString } from "../utils/helpers";

export const membersAPI = {
  list: (params = {}) => apiClient.get(`/api/members/${toQueryString(params)}`),
  detail: (id) => apiClient.get(`/api/members/${id}/`),
  create: (payload) => apiClient.post("/api/members/", payload),
  update: (id, payload) => apiClient.patch(`/api/members/${id}/`, payload),
};
