import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginSchema } from '@/modules/admin/auth/schemas/login.schema'
import { login } from '@/modules/admin/auth/services/auth.service'
import { useAuthStore } from '@/shared/stores/auth.store'
import { ROUTE_PATHS } from '@/app/routes/route-paths'
import { Button, Input } from '@/shared/components/ui'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const setSession = useAuthStore((s) => s.setSession)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const parsed = loginSchema.safeParse({ username, password })
    if (!parsed.success) {
      const errors: { username?: string; password?: string } = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === 'username' || key === 'password') errors[key] = issue.message
      }
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})

    setSubmitting(true)
    try {
      const { token, role } = await login(parsed.data.username, parsed.data.password)
      setSession(token, role, parsed.data.username)
      // Petugas gate diarahkan langsung ke Scan - dashboard tidak bisa
      // dibukanya (docs/plan/scan-checkin-gate T12/T13).
      navigate(role === 'scanner' ? ROUTE_PATHS.scan : ROUTE_PATHS.dashboard, { replace: true })
    } catch {
      setFormError('Username atau password salah. Silakan periksa kembali.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-slate-950 font-sans antialiased">
      {/* Sisi Kiri: Visual Branding & High-End Identity */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-between p-12 xl:p-16 relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-[#071a33] text-white border-r border-slate-800/80">
        {/* Glow ambient background */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/25">
              UP
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-400/20">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Admin Portal
              </span>
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-lg my-auto py-12">
          <h2 className="text-3xl xl:text-4xl font-bold tracking-tight text-white leading-tight">
            Undangan
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
              Pernikahan
            </span>
          </h2>
          <p className="mt-4 text-base text-slate-300 leading-relaxed">
            Pusat manajemen undangan digital eksklusif: kelola konten, kehadiran tamu RSVP, susunan acara, dan galeri dengan kontrol penuh.
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Live RSVP Tracker</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Pantau status konfirmasi kehadiran tamu secara real-time.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Section &amp; Content</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Kustomisasi urutan bagian &amp; data profil seketika.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500 flex items-center justify-between">
          <p>&copy; {new Date().getFullYear()} Undangan Pernikahan</p>
          <p className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Sistem Aktif
          </p>
        </div>
      </div>

      {/* Sisi Kanan: Form Login Modern */}
      <div className="lg:col-span-6 xl:col-span-5 flex items-center justify-center p-6 sm:p-10 md:p-14 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Header Mobile Only */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
              UP
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dashboard Admin</p>
              <h2 className="text-lg font-bold text-slate-900">Undangan Pernikahan</h2>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-xl shadow-slate-200/60 border border-slate-100">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Masuk</h1>
              <p className="text-sm text-slate-500 mt-1.5">
                Masukkan kredensial akun administrator Anda.
              </p>
            </div>

            {formError && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200/80 flex items-start gap-3 text-red-700 text-sm">
                <svg className="w-5 h-5 shrink-0 text-red-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1 font-medium">{formError}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
              <Input
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                error={fieldErrors.username}
                autoFocus
                autoComplete="username"
                placeholder="Masukkan username admin"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                }
              />

              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={fieldErrors.password}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-8.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              <Button
                type="submit"
                loading={submitting}
                size="lg"
                className="w-full mt-2 shadow-md shadow-blue-600/20"
              >
                Masuk ke Dashboard
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

