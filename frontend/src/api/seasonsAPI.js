import { apiClient } from "./axiosInstance";
import { toQueryString } from "../utils/helpers";

export const seasonsAPI = {
  list: (params = {}) => apiClient.get(`/api/seasons/${toQueryString(params)}`),
  detail: (id) => apiClient.get(`/api/seasons/${id}/`),
  update: (id, payload) => apiClient.patch(`/api/seasons/${id}/`, payload),
  close: (id) => apiClient.patch(`/api/seasons/${id}/`, { is_closed: true, is_active: false }),
  generatePayouts: (id) => apiClient.post(`/api/seasons/${id}/generate-payouts/`, {}),
  intakeReport: (id) => apiClient.get(`/api/seasons/${id}/intake-report/`),
};
