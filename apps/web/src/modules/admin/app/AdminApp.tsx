import { Suspense, lazy } from 'react'
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
// GroupsPage eager seperti rute lain - halaman kecil tanpa dependensi berat,
// beda dari ScanPage yang lazy karena pustaka kamera (guest-groups T14).
import GroupsPage from '@/modules/admin/groups/pages/GroupsPage'
// WishesPage eager seperti rute lain - halaman kecil tanpa dependensi berat,
// alasan yang sama dengan GroupsPage (docs/plan/wedding-wish/PLAN.md T20).
import WishesPage from '@/modules/admin/wishes/pages/WishesPage'
import ReservationsPage from '@/modules/admin/reservations/pages/ReservationsPage'
import WhatsAppPage from '@/modules/admin/whatsapp/pages/WhatsAppPage'
import UsersPage from '@/modules/admin/users/pages/UsersPage'
import SettingsPage from '@/modules/admin/settings/pages/SettingsPage'

// ScanPage SENGAJA lazy, berbeda dari rute lain yang diimpor eager di atas
// (docs/plan/scan-checkin-gate/PLAN.md T13): halaman ini menarik pustaka
// kamera @zxing/browser, dan mayoritas pengguna tidak pernah membukanya -
// tidak ada alasan membebani bundel admin untuk mereka.
const ScanPage = lazy(() => import('@/modules/admin/scan/pages/ScanPage'))
// ArrivalsPage ikut lazy, dan Vite memberinya chunk SENDIRI (~7 kB) yang
// terpisah dari ScanPage - terverifikasi di hasil `npm run build:web`. Itu
// yang diinginkan: membuka daftar tamu masuk tidak ikut menarik pustaka
// kamera 465 kB, padahal keduanya berbagi checkin.service.ts.
const ArrivalsPage = lazy(() => import('@/modules/admin/scan/pages/ArrivalsPage'))

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
              <Route path={ROUTE_PATHS.groups} element={<GroupsPage />} />
              <Route path={ROUTE_PATHS.wishes} element={<WishesPage />} />
              <Route path={ROUTE_PATHS.reservations} element={<ReservationsPage />} />
              <Route path={ROUTE_PATHS.whatsapp} element={<WhatsAppPage />} />
              <Route path={ROUTE_PATHS.users} element={<UsersPage />} />
              <Route path={ROUTE_PATHS.settings} element={<SettingsPage />} />
              <Route
                path={ROUTE_PATHS.scan}
                element={
                  <Suspense fallback={<div className="p-6 text-sm text-slate-500">Memuat pemindai...</div>}>
                    <ScanPage />
                  </Suspense>
                }
              />
              <Route
                path={ROUTE_PATHS.arrivals}
                element={
                  <Suspense fallback={<div className="p-6 text-sm text-slate-500">Memuat daftar...</div>}>
                    <ArrivalsPage />
                  </Suspense>
                }
              />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to={ROUTE_PATHS.dashboard} replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
