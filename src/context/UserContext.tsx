import React, { createContext, useState, useContext, useEffect } from 'react';

// Show a user-friendly blocked user message
const showBlockedUserMessage = () => {
  // Create a custom notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #ff4757, #ff3742);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 20px rgba(255, 71, 87, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    max-width: 90vw;
    text-align: center;
    animation: slideDown 0.3s ease-out;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="font-size: 20px;">🚫</div>
      <div>
        <div style="font-weight: 600; margin-bottom: 4px;">Account Blocked</div>
        <div style="font-size: 14px; opacity: 0.9;">Your account has been blocked. Please contact an administrator.</div>
      </div>
    </div>
  `;

  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(notification);

  // Remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideDown 0.3s ease-out reverse';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }, 5000);
};

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
      } else if (response.status === 403) {
        const data = await response.json();
        if (data.blocked) {
          // User is blocked - show user-friendly message and logout
          showBlockedUserMessage();
          logout();
        } else {
          logout();
        }
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
          // Check the specific error message from the server
          if (data.error && data.error.toLowerCase().includes('username already exists')) {
            return { success: false, error: 'Username already exists. Please choose a different username.' };
          } else if (data.error && data.error.toLowerCase().includes('email already exists')) {
          return { success: false, error: 'Email already exists. Please use a different email address.' };
          }
          return { success: false, error: data.error || 'Registration failed' };
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