// frontend/src/hooks/useFetchUsers.ts
import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { apiFetch } from '@/utils/api';

export interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

export function useFetchUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/admin/users');
      const usersArray: User[] = Array.isArray(data)
        ? data
        : Array.isArray(data.users)
        ? data.users
        : [];
      const normalizedUsers = usersArray.map((u: any) => ({
        ...u,
        _id: u._id || u.id || Math.random().toString(),
      }));
      setUsers(normalizedUsers);
    } catch (err: any) {
      console.error('Fetch Users Error:', err);
      Alert.alert('Error', err.message || 'Failed to fetch users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, setUsers, loading, fetchUsers };
}