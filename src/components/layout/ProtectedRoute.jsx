import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../state/AuthContext.jsx";

export default function ProtectedRoute({ roles }) {
  const { isAuthenticated, authReady, user } = useAuth();
  if (!authReady) return <div className="grid min-h-screen place-items-center text-sm font-semibold text-slate-500">Refreshing secure session...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles?.length && !roles.includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
