import apiClient from './api';
import { ApiResponse } from '@types/index';

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    department: string | null;
    role: string;
    profileImageUrl?: string | null;
  };
}

export const authService = {

  /**
   * Lokaler Login
   */
  async localLogin(email: string, password: string): Promise<LoginResponse> {
    const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', { email, password });
    return response.data.data!;
  },

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    const response = await apiClient.post<ApiResponse<{ token: string }>>('/auth/refresh', {
      refreshToken,
    });
    return response.data.data!;
  },

  /**
   * Logout
   */
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  /**
   * Get current user
   */
  async getCurrentUser() {
    const response = await apiClient.get<ApiResponse>('/auth/me');
    return response.data.data;
  },
};
