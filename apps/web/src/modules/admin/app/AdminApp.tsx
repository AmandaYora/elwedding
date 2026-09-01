import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ROUTE_PATHS } from '@/app/routes/route-paths'
import { ToastProvider } from '@/shared/components/toast/ToastProvider'
import ProtectedRoute from '@/modules/admin/shared/ProtectedRoute'
import AdminLayout from '@/modules/admin/shared/AdminLayout'
import LoginPage from '@/modules/admin/auth/pages/LoginPage'
import DashboardPage from '@/modules/admin/dashboard/pages/DashboardPage'
import SectionsPage from '@/modules/admin/sections/pages/SectionsPage'
import ContentPage from '@/modules/admin/content/pages/ContentPage'
import GuestsPage from '@/modules/admin/guests/pages/GuestsPage'
import ReservationsPage from '@/modules/admin/reservations/pages/ReservationsPage'
import WhatsAppPage from '@/modules/admin/whatsapp/pages/WhatsAppPage'
import UsersPage from '@/modules/admin/users/pages/UsersPage'
import SettingsPage from '@/modules/admin/settings/pages/SettingsPage'

/**
 * basename="/admin" (keputusan #10 PLAN.md): entry HTML terpisah
 * (admin.html) disajikan Go server untuk path /admin dan /admin/*, jadi
 * router client-side beroperasi relatif terhadap prefix itu.
 *
 * ToastProvider (admin-ui-redesign task F9) membungkus SELURUH router,
 * termasuk LoginPage, supaya toast bisa dipakai di halaman mana pun.
 */
export default function AdminApp() {
  return (
    <ToastProvider>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path={ROUTE_PATHS.login} element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path={ROUTE_PATHS.sections} element={<SectionsPage />} />
              <Route path={ROUTE_PATHS.content} element={<ContentPage />} />
              <Route path={ROUTE_PATHS.guests} element={<GuestsPage />} />
              <Route path={ROUTE_PATHS.reservations} element={<ReservationsPage />} />
              <Route path={ROUTE_PATHS.whatsapp} element={<WhatsAppPage />} />
              <Route path={ROUTE_PATHS.users} element={<UsersPage />} />
              <Route path={ROUTE_PATHS.settings} element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to={ROUTE_PATHS.dashboard} replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
