/**
 * Simple in-memory token store that allows setting and retrieving the authentication token
 * from any part of the application without having to pass it manually.
 */

// In-memory token storage (not persisted anywhere)
let authToken: string | null = null;

export const tokenStore = {
  /**
   * Set the authentication token in memory
   */
  setToken: (token: string | null) => {
    authToken = token;
  },

  /**
   * Get the current authentication token from memory
   */
  getToken: (): string | null => {
    return authToken;
  },

  /**
   * Clear the authentication token from memory
   */
  clearToken: () => {
    authToken = null;
  },
};

export default tokenStore;
