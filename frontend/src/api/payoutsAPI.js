import { apiClient } from "./axiosInstance";
import { toQueryString } from "../utils/helpers";

export const payoutsAPI = {
  list: (params = {}) => apiClient.get(`/api/payouts/${toQueryString(params)}`),
  calculate: (seasonId) => apiClient.post(`/api/seasons/${seasonId}/generate-payouts/`, {}),
  statement: (memberId, seasonId) => apiClient.get(`/api/payouts/${memberId}/statement/?season=${seasonId}`),
};
