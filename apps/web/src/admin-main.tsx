import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AdminApp from '@/modules/admin/app/AdminApp'

// globals.css (Tailwind + theme) HANYA diimpor di sini, tidak pernah dari
// main.tsx undangan - supaya preflight Tailwind tidak pernah menyentuh "/"
// (keputusan #10 PLAN.md / F9).
import '@/styles/globals.css'

createRoot(document.getElementById('admin-root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
)
