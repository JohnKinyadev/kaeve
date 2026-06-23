import { apiClient } from "./axiosInstance";
import { toQueryString } from "../utils/helpers";

export const usersAPI = {
  list: (params = {}) => apiClient.get(`/api/users/${toQueryString(params)}`),
  updateRole: (id, role) => apiClient.patch(`/api/users/${id}/`, { role }),
};
