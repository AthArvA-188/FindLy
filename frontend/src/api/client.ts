/**
 * Base API client configuration
 * Uses relative /api paths so Vite dev proxy can route requests
 * in both local and Docker dev environments.
 */

const BASE_URL = '/api';
const IS_MOCK = false; // Set to false when backend is ready

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  if (IS_MOCK) {
    throw new Error(`Mock API: ${endpoint} - Backend not connected yet`);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, `API Error: ${response.statusText}`);
  }

  return response.json();
}

async function fetchForm<T>(endpoint: string, formData: FormData): Promise<T> {
  if (IS_MOCK) {
    throw new Error(`Mock API: ${endpoint} - Backend not connected yet`);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    body: formData,
    // No Content-Type header — browser sets it with the multipart boundary
  });

  if (!response.ok) {
    throw new ApiError(response.status, `API Error: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => fetchApi<T>(endpoint),

  post: <T>(endpoint: string, data?: unknown) =>
    fetchApi<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  postForm: <T>(endpoint: string, formData: FormData) =>
    fetchForm<T>(endpoint, formData),

  delete: <T>(endpoint: string) =>
    fetchApi<T>(endpoint, { method: 'DELETE' }),
};
