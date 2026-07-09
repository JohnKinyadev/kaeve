import { apiClient } from "./axiosInstance";
import { toQueryString } from "../utils/helpers";

export const announcementsAPI = {
  list: (params = {}) => apiClient.get(`/api/announcements/${toQueryString(params)}`),
  create: (payload) => apiClient.post("/api/announcements/", payload),
  update: (id, payload) => apiClient.patch(`/api/announcements/${id}/`, payload),
};
