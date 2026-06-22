import { apiClient } from "./axiosInstance";
import { toQueryString } from "../utils/helpers";

export const millingAPI = {
  list: (params = {}) => apiClient.get(`/api/milling-batches/${toQueryString(params)}`),
  createBatch: (payload) => apiClient.post("/api/milling-batches/", payload),
};
