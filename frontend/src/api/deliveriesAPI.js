import { apiClient } from "./axiosInstance";
import { toQueryString } from "../utils/helpers";

export const deliveriesAPI = {
  list: (params = {}) => apiClient.get(`/api/deliveries/${toQueryString(params)}`),
  create: (payload) => apiClient.post("/api/deliveries/", payload),
  memberDeliveries: (memberId) => apiClient.get(`/api/members/${memberId}/deliveries/`),
};
