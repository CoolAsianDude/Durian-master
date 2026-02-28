// frontend/src/utils/api.ts
import { API_URL } from '@/config/appconf';

/**
 * Centralized API fetch with JWT token support
 */
export async function apiFetch(
  path: string,
  method: string = 'GET',
  body?: any
) {
  try {
    // Get JWT from localStorage (or wherever you store it)
    const token = localStorage.getItem('token'); 

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (method !== 'GET') headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error('apiFetch Error:', err);
    throw err;
  }
}