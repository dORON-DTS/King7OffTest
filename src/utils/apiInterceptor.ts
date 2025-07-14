// Global API interceptor to handle blocked users
export const handleApiResponse = async (response: Response, logout: () => void) => {
  if (response.status === 403) {
    try {
      const data = await response.json();
      if (data.blocked) {
        // User is blocked - show message and logout
        alert('Your account has been blocked. Please contact an administrator.');
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