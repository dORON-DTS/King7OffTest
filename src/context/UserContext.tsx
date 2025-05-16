import React, { createContext, useState, useContext, useEffect } from 'react';

interface User {
  id: string;
  username: string;
  role: string;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (token: string) => Promise<void>;
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
      console.log("[UserContext] Fetching user info with token:", token);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      console.log("[UserContext] User info response status:", response.status);
      if (response.status === 304) {
        console.log("[UserContext] No changes to user info (304 Not Modified)");
        return; // Don't try to parse JSON
      }
      if (response.ok) {
        const userData = await response.json();
        console.log("[UserContext] User info data:", userData);
        setUser(userData);
      } else {
        console.log("[UserContext] User info fetch failed, logging out");
        logout();
      }
    } catch (err) {
      console.log("[UserContext] User info fetch error:", err);
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

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    // Navigation will be handled by the router
  };

  return (
    <UserContext.Provider value={{ user, setUser, login, logout, isLoading }}>
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