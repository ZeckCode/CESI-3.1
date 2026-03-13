import { useMemo, useState, useEffect, useCallback } from "react";
import { AuthContext } from "./AuthContext";
import { getUser, setAuth, clearAuth, getToken } from "./auth"; 
// adjust path: if auth.js is in same folder, keep "./auth"

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If you also want: verify token with backend here.
    setLoading(false);
  }, []);

  /**
   * Call this after login success
   * @param {{user: object, token?: string}} payload
   */
  const login = useCallback(({ user: u, token }) => {
    setUser(u);
    sessionStorage.removeItem("cesi.justLoggedOut");

    // Store token + user if token exists, otherwise store user only
    if (token) setAuth({ token, user: u });
    else localStorage.setItem("user", JSON.stringify(u));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.setItem("cesi.justLoggedOut", "1");
    clearAuth(); // removes token + user
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      token: getToken(), // optional to expose
    }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
