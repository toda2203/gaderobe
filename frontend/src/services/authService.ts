import apiClient from './api';
import type { ApiResponse } from '@types/index';

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
  };
}

export const authService = {
  /**
   * Get Microsoft login URL
   */
  async getLoginUrl(): Promise<string> {
    const response = await apiClient.get<ApiResponse<{ authUrl: string }>>('/auth/login');
    return response.data.data!.authUrl;
  },

  /**
   * Handle OAuth callback
   */
  async handleCallback(code: string): Promise<LoginResponse> {
    const response = await apiClient.get<ApiResponse<LoginResponse>>('/auth/callback', {
      params: { code },
    });
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
