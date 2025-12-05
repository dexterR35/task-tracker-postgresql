/**
 * API Client Service
 * 
 * @fileoverview Centralized API client for REST API communication
 * @author Senior Developer
 * @version 1.0.0
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getToken();

    // Check if this is an authentication endpoint (login, register, etc.)
    // These endpoints don't require a token and 401 means invalid credentials, not missing token
    const isAuthEndpoint = endpoint.startsWith('/auth/login') || 
                          endpoint.startsWith('/auth/register') ||
                          endpoint.startsWith('/auth/forgot-password') ||
                          endpoint.startsWith('/auth/reset-password');

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
      }

      const data = await response.json();

      if (!response.ok) {
        // Handle 401 Unauthorized
        if (response.status === 401) {
          // For auth endpoints, 401 means invalid credentials - pass through the actual error
          if (isAuthEndpoint) {
            const error = new Error(data.error || data.message || 'Invalid credentials');
            error.status = response.status;
            error.data = data;
            error.isUnauthorized = true;
            throw error;
          }
          // For other endpoints, 401 means missing or invalid token
          const error = new Error('Access token required');
          error.status = response.status;
          error.data = data;
          error.isUnauthorized = true;
          // Clear invalid token
          this.setToken(null);
          throw error;
        }

        // Handle 403 Forbidden (Invalid or expired token)
        if (response.status === 403) {
          const errorMessage = data.error || data.message || 'Invalid or expired token';
          // Check if it's a token-related error
          if (errorMessage.toLowerCase().includes('token') || errorMessage.toLowerCase().includes('expired')) {
            const error = new Error(errorMessage);
            error.status = response.status;
            error.data = data;
            error.isUnauthorized = true;
            // Clear invalid token
            this.setToken(null);
            throw error;
          }
          // For other 403 errors (permission denied), pass through
          const error = new Error(errorMessage);
          error.status = response.status;
          error.data = data;
          error.isForbidden = true;
          throw error;
        }

        // Handle 429 Too Many Requests
        if (response.status === 429) {
          const error = new Error(data.message || data.error || 'Too many requests. Please wait a moment and try again.');
          error.status = response.status;
          error.data = data;
          error.isRateLimited = true;
          throw error;
        }
        
        const error = new Error(data.error || data.message || `HTTP error! status: ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server');
      }
      throw error;
    }
  }

  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

// Create singleton instance
const apiClient = new ApiClient();

export default apiClient;

