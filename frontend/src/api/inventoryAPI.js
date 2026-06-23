import { apiClient } from "./axiosInstance";
import { toQueryString } from "../utils/helpers";

export const inventoryAPI = {
  list: (params = {}) => apiClient.get(`/api/inventory-stocks/${toQueryString(params)}`),
};
