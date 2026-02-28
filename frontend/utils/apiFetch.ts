// frontend/src/utils/apiFetch.ts
import { Alert } from 'react-native';

// Change these URLs based on your setup
const LOCAL_API = 'http://localhost:8000';
const NGROK_API = 'https://rosamaria-choragic-oversecurely.ngrok-free.dev';

// Dynamically choose base URL
const BASE_URL = __DEV__ ? LOCAL_API : NGROK_API;

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

export async function apiFetch(endpoint: string, method: ApiOptions['method'] = 'GET', body?: any) {
  try {
    const url = `${BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((method !== 'GET' && body) ? {} : {}), // only JSON body for POST/PUT
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Automatically handle non-OK responses
    if (!response.ok) {
      const text = await response.text();
      console.error(`API Error (${response.status}):`, text);
      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json();
  } catch (err: any) {
    console.error('apiFetch Error:', err);
    Alert.alert('Network Error', err.message || 'Something went wrong');
    throw err;
  }
}