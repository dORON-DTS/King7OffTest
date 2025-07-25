// Global API interceptor to handle blocked users
export const handleApiResponse = async (response: Response, logout: () => void) => {
  if (response.status === 403) {
    try {
      const data = await response.json();
      if (data.blocked) {
        // User is blocked - show user-friendly message and logout
        showBlockedUserMessage();
        logout();
        return { blocked: true };
      }
    } catch (err) {
      // If we can't parse the response, just logout
      logout();
      return { blocked: true };
    }
  }
  return { blocked: false };
};

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

// Wrapper for fetch that automatically handles blocked users
export const apiFetch = async (url: string, options: RequestInit, logout: () => void) => {
  const response = await fetch(url, options);
  const result = await handleApiResponse(response, logout);
  
  if (result.blocked) {
    // Throw an error to stop further processing
    throw new Error('User blocked');
  }
  
  return response;
};

// Helper function to get display name (username if exists, otherwise playerName)
export const getPlayerDisplayName = async (
  playerName: string, 
  groupId: string, 
  logout: () => void
): Promise<string> => {
  try {
    const token = localStorage.getItem('token');
    const response = await apiFetch(
      `${process.env.REACT_APP_API_URL}/api/player-aliases/username/${encodeURIComponent(playerName)}/${groupId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      },
      logout
    );
    
    if (!response.ok) {
      // If API fails, fallback to playerName
      return playerName;
    }
    
    const data = await response.json();
    return data.displayName || playerName;
  } catch (error) {
    // If any error occurs, fallback to playerName
    console.error('Error getting player display name:', error);
    return playerName;
  }
};

// Helper function to get display names for multiple players (batch operation for performance)
export const getPlayerDisplayNames = async (
  playerNames: string[],
  groupId: string,
  logout: () => void
): Promise<{ displayNames: { [key: string]: string }, hasAlias: { [key: string]: boolean } }> => {
  try {
    const token = localStorage.getItem('token');
    const response = await apiFetch(
      `${process.env.REACT_APP_API_URL}/api/player-aliases/display-names`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playerNames,
          groupId
        })
      },
      logout
    );
    
    if (!response.ok) {
      // If API fails, fallback to player names
      const fallbackDisplayNames: { [key: string]: string } = {};
      const fallbackHasAlias: { [key: string]: boolean } = {};
      playerNames.forEach(name => {
        fallbackDisplayNames[name] = name;
        fallbackHasAlias[name] = false;
      });
      return { displayNames: fallbackDisplayNames, hasAlias: fallbackHasAlias };
    }
    
    const data = await response.json();
    return { 
      displayNames: data.displayNames || {}, 
      hasAlias: data.hasAlias || {} 
    };
  } catch (error) {
    // If any error occurs, fallback to player names
    console.error('Error getting player display names:', error);
    const fallbackDisplayNames: { [key: string]: string } = {};
    const fallbackHasAlias: { [key: string]: boolean } = {};
    playerNames.forEach(name => {
      fallbackDisplayNames[name] = name;
      fallbackHasAlias[name] = false;
    });
    return { displayNames: fallbackDisplayNames, hasAlias: fallbackHasAlias };
  }
}; 