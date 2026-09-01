import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/shared/stores/auth.store'
import { ROUTE_PATHS } from '@/app/routes/route-paths'

export default function ProtectedRoute() {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to={ROUTE_PATHS.login} replace />
  return <Outlet />
}
