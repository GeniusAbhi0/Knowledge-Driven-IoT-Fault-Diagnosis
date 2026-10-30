import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LiveProvider } from "../contexts/LiveContext";
import { Spinner } from "./ui";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <LiveProvider><Outlet /></LiveProvider>;
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
  return user ? <Navigate to="/" replace /> : <Outlet />;
}
