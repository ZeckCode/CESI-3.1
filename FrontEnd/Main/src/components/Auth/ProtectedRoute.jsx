import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { getToken } from "./auth";

/**
 * @param {string|string[]} role  Optional role or roles allowed
 */
export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const token = getToken();

  // Do NOT redirect while auth state is resolving
  if (loading) {
    return <div>Loading...</div>;
  }

  // Not logged in → go to login and remember where user came from
  if (!user || !token) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  // Role-based authorization
  if (role) {
    const allowedRoles = Array.isArray(role) ? role : [role];

    if (!allowedRoles.includes(user.role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
}


// <ProtectedRoute role={["admin", "teacher"]}>
//   <GradesPage />
// </ProtectedRoute>
