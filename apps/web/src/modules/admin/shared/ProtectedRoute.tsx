import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore, isScannerRole } from '@/shared/stores/auth.store'
import { ROUTE_PATHS, SCANNER_ALLOWED_PATHS } from '@/app/routes/route-paths'

export default function ProtectedRoute() {
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.role)
  const location = useLocation()

  if (!token) return <Navigate to={ROUTE_PATHS.login} replace />

  // Akun petugas hanya punya menu Scan & Tamu Masuk (K2). Ini KOSMETIK -
  // penegakan sebenarnya ada di authmw.RequireFullAdmin, yang membalas 403
  // untuk seluruh /api/v1/admin/ selain /checkin/*. Jangan pernah menjadikan
  // pengalihan ini satu-satunya pembatas.
  if (isScannerRole(role) && !SCANNER_ALLOWED_PATHS.includes(location.pathname)) {
    return <Navigate to={ROUTE_PATHS.scan} replace />
  }

  return <Outlet />
}
