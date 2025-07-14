import React, { createContext, useState, useContext, useEffect } from 'react';

interface User {
  id: string;
  username: string;
  email?: string;
  role: string;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (token: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<{ success: boolean; token?: string; error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserInfo(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUserInfo = async (token: string) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.status === 304) {
        return; // Don't try to parse JSON
      }
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        logout();
      }
    } catch (err) {
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (token: string) => {
    localStorage.setItem('token', token);
    await fetchUserInfo(token);
    // Navigation will be handled by the router
  };

  const register = async (email: string, username: string, password: string) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const response = await fetch(`${apiUrl}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.error && data.error.includes('blocked')) {
          return { success: false, error: 'Your account has been blocked. Please contact an administrator.' };
        }
        if (response.status === 409) {
          return { success: false, error: 'Email already exists. Please use a different email address.' };
        }
        return { success: false, error: data.error || 'Registration failed' };
      }

      return { success: true, token: data.token };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Registration error' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    // Navigation will be handled by the router
  };

  return (
    <UserContext.Provider value={{ user, setUser, login, register, logout, isLoading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserContext; 