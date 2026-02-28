import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  name: string;
  email: string;
  photoProfile: string;
  photoPublicId: string;
  role: string;
  token: string; // <-- Added JWT token
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  login: (userData: User) => Promise<void>; // Optional: helper to save token on login
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      const keys = [
        'jwt_token',
        'user_id',
        'name',
        'email',
        'photoProfile',
        'photoPublicId',
        'user_role'
      ];
      const stores = await AsyncStorage.multiGet(keys);

      const data: any = {};
      stores.forEach(([key, value]) => {
        data[key] = value;
      });

      if (data.user_id && data.jwt_token) {
        setUser({
          id: data.user_id,
          name: data.name || '',
          email: data.email || '',
          photoProfile: data.photoProfile || '',
          photoPublicId: data.photoPublicId || '',
          role: data.user_role || 'user',
          token: data.jwt_token,
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (userData: User) => {
    try {
      await AsyncStorage.multiSet([
        ['jwt_token', userData.token],
        ['user_id', userData.id],
        ['name', userData.name],
        ['email', userData.email],
        ['photoProfile', userData.photoProfile],
        ['photoPublicId', userData.photoPublicId],
        ['user_role', userData.role],
      ]);
      setUser(userData);
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  };

  const refreshUser = async () => {
    setLoading(true);
    await loadUser();
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'jwt_token',
        'user_id',
        'name',
        'email',
        'photoProfile',
        'photoPublicId',
        'user_role'
      ]);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        refreshUser,
        logout,
        login,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}