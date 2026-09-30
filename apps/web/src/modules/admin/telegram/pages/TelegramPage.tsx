import { useEffect, useRef, useState } from 'react'
import {
  type TelegramStatus,
  type TelegramConfig,
  type SendLog,
  getStatus,
  startLogin,
  completeLogin,
  logout,
  getConfig,
  updateConfig,
  listLogs,
  resendLog,
} from '@/modules/admin/telegram/services/telegram.service'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { StickyActionBar } from '@/shared/components/layout/StickyActionBar'
import { Card, CardHeader, CardBody, Input, Textarea, Switch, Button, Badge, Table, Thead, Tbody, Tr, Th, Td, Modal, Pagination } from '@/shared/components/ui'
import { EmptyState } from '@/shared/components/feedback/EmptyState'
import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { Skeleton, TableSkeleton } from '@/shared/components/feedback/Skeleton'
import { useToast } from '@/shared/components/toast/ToastProvider'
import { apiErrorMessage } from '@/shared/lib/api-error'

const LOGS_PAGE_SIZE = 10

const SEND_LOG_STATUS_LABEL: Record<SendLog['status'], string> = {
  pending: 'Diproses',
  sent: 'Terkirim',
  failed: 'Gagal',
  retrying: 'Menunggu kirim ulang',
}

function sendLogTone(status: SendLog['status']): 'slate' | 'blue' | 'amber' | 'violet' {
  if (status === 'sent') return 'blue'
  if (status === 'failed') return 'amber'
  if (status === 'retrying') return 'violet'
  return 'slate'
}

// Empat keadaan akun yang terbaca admin. Beda dari WhatsApp: tidak ada
// pairing QR dan tidak ada socket persisten - login memakai kode OTP yang
// dikirim Telegram ke nomor HP akun userbot (+ password bila ber-2FA).
type ConnectionState = 'ready' | 'disconnected' | 'unpaired' | 'login'

function connectionState(status: TelegramStatus): ConnectionState {
  if (!status.loggedIn) {
    return status.loginPending ? 'login' : 'unpaired'
  }
  return status.connected ? 'ready' : 'disconnected'
}

const CONNECTION_STATE_LABEL: Record<ConnectionState, string> = {
  ready: 'Siap mengirim',
  disconnected: 'Tertaut, tetapi sesi bermasalah',
  unpaired: 'Belum tertaut',
  login: 'Menunggu kode OTP',
}

export default function TelegramPage() {
  const toast = useToast()

  // --- status & login ---
  const [status, setStatus] = useState<TelegramStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState(false)
  const [statusReloadToken, setStatusReloadToken] = useState(0)
  const [startingLogin, setStartingLogin] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  // Cermin status terakhir untuk keputusan error di dalam poll (state React
  // yang dibaca closure akan basi; ref selalu segar) - pola WhatsAppPage.
  const statusRef = useRef<TelegramStatus | null>(null)
  // Endpoint Status Telegram bisa memeriksa auth ke jaringan (hingga ~25
  // detik), jadi tick berikutnya dilewati bila yang sebelumnya belum selesai -
  // tanpa penjaga ini polling menumpuk request yang lambat.
  const statusInflightRef = useRef(false)

  // Nomor HP tujuan kode OTP, dari respons login/start. null = tidak diketahui
  // (mis. halaman dimuat ulang saat loginPending) - teks generik dipakai.
  const [targetPhone, setTargetPhone] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState('')
  const [otpPassword, setOtpPassword] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [completingLogin, setCompletingLogin] = useState(false)
  const [loginFormError, setLoginFormError] = useState('')

  // Polling TIDAK PERNAH berhenti (pola WhatsAppPage): 5 detik saat belum
  // siap, 15 detik saat siap mengirim. 5 (bukan 2) karena Status Telegram
  // bisa menyentuh jaringan - 2 detik akan menumpuk antrean saat auth lambat.
  // ErrorState hanya bila belum pernah dapat status sama sekali, selebihnya
  // status terakhir tetap tampil dan polling coba lagi 15 detik kemudian.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function poll() {
      if (statusInflightRef.current) {
        timer = setTimeout(poll, 5000)
        return
      }
      statusInflightRef.current = true
      try {
        const s = await getStatus()
        if (cancelled) return
        statusRef.current = s
        setStatus(s)
        setStatusError(false)
        setStatusLoading(false)
        // Kode berhasil dilengkapi di tempat lain (tab lain menekan Simpan):
        // pasangan kode+password yang basi dibersihkan supaya form tidak
        // menawarkan login yang sudah tidak dibutuhkan.
        if (s.loggedIn) {
          setOtpCode('')
          setOtpPassword('')
          setNeedsPassword(false)
          setLoginFormError('')
        }
        timer = setTimeout(poll, connectionState(s) === 'ready' ? 15000 : 5000)
      } catch {
        if (cancelled) return
        setStatusLoading(false)
        if (!statusRef.current) {
          setStatusError(true)
        }
        timer = setTimeout(poll, 15000)
      } finally {
        statusInflightRef.current = false
      }
    }
    void poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [statusReloadToken])

  async function handleStartLogin() {
    setStartingLogin(true)
    try {
      const result = await startLogin()
      setTargetPhone(result.phone)
      setOtpCode('')
      setOtpPassword('')
      setNeedsPassword(false)
      setLoginFormError('')
      toast.success(`Kode OTP dikirim ke ${result.phone}. Masukkan kode itu di bawah.`)
      setStatusReloadToken((t) => t + 1)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal meminta kode OTP Telegram.'))
    } finally {
      setStartingLogin(false)
    }
  }

  async function handleCompleteLogin() {
    if (!otpCode.trim()) {
      setLoginFormError('Kode OTP wajib diisi.')
      return
    }
    setCompletingLogin(true)
    setLoginFormError('')
    try {
      await completeLogin(otpCode.trim(), otpPassword)
      setOtpCode('')
      setOtpPassword('')
      setNeedsPassword(false)
      toast.success('Akun Telegram berhasil ditautkan.')
      setStatusReloadToken((t) => t + 1)
    } catch (err) {
      const message = apiErrorMessage(err, 'Gagal menautkan akun Telegram.')
      // Backend membalas 400 "memakai verifikasi 2 langkah" saat akun ber-2FA
      // tetapi password belum dikirim - itu BUKAN kegagalan final, melainkan
      // instruksi menampilkan field password (lihat ErrPasswordNeeded).
      if (message.includes('verifikasi 2 langkah')) {
        setNeedsPassword(true)
        setLoginFormError('Akun ini memakai verifikasi 2 langkah. Masukkan password Telegram Anda lalu tekan Simpan lagi.')
      } else {
        setLoginFormError(message)
      }
    } finally {
      setCompletingLogin(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      const result = await logout()
      if (result.remoteRevoked) {
        toast.success('Telegram berhasil diputus.')
      } else {
        // Keputusan D2 (cermin WhatsApp): sesi lokal sudah bersih, tetapi
        // server Telegram tidak sempat dihubungi - sesi mungkin masih
        // terdaftar di akun. ToastProvider hanya punya success/error, jadi
        // "peringatan" ini memakai error agar terlihat sebagai tindakan
        // lanjutan yang wajib.
        toast.error('Koneksi lokal diputus, tetapi sesi mungkin masih terdaftar di akun. Cabut manual lewat Telegram > Pengaturan > Perangkat bila masih muncul di sana.')
      }
      setLogoutConfirmOpen(false)
      setStatusReloadToken((t) => t + 1)
    } catch {
      toast.error('Gagal memutus Telegram.')
    } finally {
      setLoggingOut(false)
    }
  }

  // --- template pesan ---
  const [config, setConfig] = useState<TelegramConfig | null>(null)
  const [initialConfig, setInitialConfig] = useState<TelegramConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [configError, setConfigError] = useState(false)
  const [configReloadToken, setConfigReloadToken] = useState(0)
  const [savingConfig, setSavingConfig] = useState(false)

  useEffect(() => {
    let cancelled = false
    getConfig()
      .then((c) => {
        if (cancelled) return
        setConfig(c)
        setInitialConfig(c)
        setConfigError(false)
        setConfigLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setConfigError(true)
        setConfigLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [configReloadToken])

  const configDirty = config !== null && initialConfig !== null && JSON.stringify(config) !== JSON.stringify(initialConfig)

  async function handleSaveConfig() {
    if (!config) return
    setSavingConfig(true)
    try {
      await updateConfig(config)
      setInitialConfig(config)
      toast.success('Template pesan tersimpan.')
    } catch {
      toast.error('Gagal menyimpan template pesan.')
    } finally {
      setSavingConfig(false)
    }
  }

  // --- log kirim ---
  const [logs, setLogs] = useState<SendLog[]>([])
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsPage, setLogsPage] = useState(1)
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsError, setLogsError] = useState(false)
  const [logsReloadToken, setLogsReloadToken] = useState(0)
  const [resendingId, setResendingId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    listLogs(logsPage)
      .then((res) => {
        if (cancelled) return
        setLogs(res.data)
        setLogsTotal(res.meta.total)
        setLogsError(false)
        setLogsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLogsError(true)
        setLogsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [logsPage, logsReloadToken])

  async function handleResend(id: number) {
    setResendingId(id)
    try {
      await resendLog(id)
      toast.success('Pesan berhasil dikirim ulang.')
      setLogsReloadToken((t) => t + 1)
    } catch {
      toast.error('Gagal mengirim ulang pesan.')
    } finally {
      setResendingId(null)
    }
  }

  const connState = status ? connectionState(status) : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Telegram"
        description="Tautkan akun Telegram pengirim untuk mengirim QR konfirmasi kehadiran secara otomatis ke tamu yang punya username Telegram."
      />

      {/* Status Koneksi & Login */}
      <Card className="shadow-sm">
        <CardHeader>Status Koneksi</CardHeader>
        <CardBody className="p-6">
          {statusLoading && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-9 w-32" />
            </div>
          )}

          {!statusLoading && statusError && (
            <ErrorState message="Gagal memuat status Telegram." onRetry={() => setStatusReloadToken((t) => t + 1)} />
          )}

          {!statusLoading && !statusError && status && connState && (
            <>
              {connState === 'ready' && (
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                    {CONNECTION_STATE_LABEL.ready}
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => setLogoutConfirmOpen(true)}>
                    Putuskan
                  </Button>
                </div>
              )}

              {connState === 'disconnected' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
                      {CONNECTION_STATE_LABEL.disconnected}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={handleStartLogin} loading={startingLogin}>
                        Kirim ulang kode OTP
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setLogoutConfirmOpen(true)}>
                        Putuskan
                      </Button>
                    </div>
                  </div>
                  {status.lastError && (
                    <p className="text-sm text-amber-700">{status.lastError}</p>
                  )}
                </div>
              )}

              {connState === 'unpaired' && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-slate-400" aria-hidden="true" />
                    {CONNECTION_STATE_LABEL.unpaired}
                  </span>
                  {/* Alasan sesi hilang (mis. sesi dicabut dari HP) -
                      ditampilkan supaya "Belum tertaut" tidak misterius. */}
                  {status.lastError && (
                    <p className="text-sm text-slate-600 text-center max-w-sm">{status.lastError}</p>
                  )}
                  <p className="text-sm text-slate-600 text-center max-w-sm">
                    Telegram akan mengirim kode OTP ke nomor HP akun pengirim. Siapkan ponsel itu sebelum menekan tombol.
                  </p>
                  <Button onClick={handleStartLogin} loading={startingLogin}>
                    Kirim kode OTP
                  </Button>
                </div>
              )}

              {connState === 'login' && (
                <div className="flex flex-col gap-4 max-w-sm mx-auto py-2 w-full">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200 self-center">
                    <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
                    {CONNECTION_STATE_LABEL.login}
                  </span>
                  <p className="text-sm text-slate-600 text-center">
                    Kode OTP dikirim ke {targetPhone ?? 'nomor HP akun Telegram'}. Masukkan kode itu di bawah.
                  </p>
                  {/* loginError dari percobaan sebelumnya (mis. kode salah) -
                      ditampilkan supaya admin tahu kenapa harus mengulang. */}
                  {status.loginError && !loginFormError && (
                    <p className="text-sm text-red-600 text-center">{status.loginError}</p>
                  )}
                  <Input
                    label="Kode OTP"
                    value={otpCode}
                    error={loginFormError && !needsPassword ? loginFormError : undefined}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="12345"
                    hint="Kode 5 digit dari aplikasi Telegram."
                  />
                  {(needsPassword || otpPassword) && (
                    <Input
                      label="Password verifikasi 2 langkah"
                      type="password"
                      value={otpPassword}
                      error={loginFormError && needsPassword ? loginFormError : undefined}
                      onChange={(e) => setOtpPassword(e.target.value)}
                      placeholder="Password Telegram Anda"
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <Button onClick={handleCompleteLogin} loading={completingLogin}>
                      Tautkan akun
                    </Button>
                    <Button variant="secondary" onClick={handleStartLogin} loading={startingLogin}>
                      Kirim ulang kode
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      {/* Template Pesan */}
      <Card className="shadow-sm">
        <CardHeader>Template Pesan</CardHeader>
        <CardBody className="p-6">
          {configLoading && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-24 w-full" />
            </div>
          )}
          {!configLoading && configError && (
            <ErrorState message="Gagal memuat template pesan." onRetry={() => setConfigReloadToken((t) => t + 1)} />
          )}
          {!configLoading && !configError && config && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Textarea
                  label="Template Pesan QR Code"
                  value={config.messageTemplate}
                  onChange={(e) => setConfig((c) => (c ? { ...c, messageTemplate: e.target.value } : c))}
                  rows={5}
                  placeholder="Halo {nama}! Terima kasih telah mengonfirmasi kehadiran..."
                />
                <p className="text-xs text-slate-500">Placeholder tersedia: {'{nama}'}, {'{jumlah}'}, {'{mempelai}'}, {'{tanggal}'}</p>
                <p className="text-xs text-slate-500">
                  Dipakai untuk pengiriman QR code secara otomatis lewat akun Telegram yang tertaut, sesaat
                  setelah tamu yang punya username Telegram mengonfirmasi kehadiran (RSVP).
                </p>
              </div>
              <Switch
                checked={config.isEnabled}
                onChange={(checked) => setConfig((c) => (c ? { ...c, isEnabled: checked } : c))}
                label="Aktifkan pengiriman otomatis"
                description="Matikan untuk menghentikan sementara pengiriman QR ke Telegram tanpa memutus tautan akun."
              />
              {/* --- Bagian 2: Undangan (manual per tamu lewat userbot) ---
                  Cermin "Template Pesan Undangan" di menu WhatsApp: dipakai
                  tombol kirim di menu Tamu, yang mengirim TEKS lewat akun
                  tertaut sesudah admin menekan Kirim di modal preview.
                  Pengiriman manual dan tidak dipengaruhi sakelar otomatis di
                  atas. Tidak ada {jumlah} di sini karena saat undangan dikirim
                  tamu belum mengonfirmasi kehadiran. */}
              <div className="flex flex-col gap-1.5 pt-6 border-t border-slate-100">
                <Textarea
                  label="Template Pesan Undangan"
                  value={config.invitationTemplate}
                  onChange={(e) => setConfig((c) => (c ? { ...c, invitationTemplate: e.target.value } : c))}
                  rows={5}
                  placeholder="Halo {nama}, kami mengundang Anda ke pernikahan {mempelai} pada {tanggal}..."
                />
                <p className="text-xs text-slate-500">Placeholder tersedia: {'{nama}'}, {'{mempelai}'}, {'{tanggal}'}, {'{link}'}</p>
                <p className="text-xs text-slate-500">
                  Dipakai tombol kirim di menu Tamu, yang menampilkan pratinjau pesan sebelum dikirim
                  lewat akun Telegram yang tertaut. Pengiriman dilakukan manual per tamu dan tidak
                  dipengaruhi sakelar pengiriman otomatis di atas.
                </p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
      {!configLoading && !configError && config && (
        <StickyActionBar dirty={configDirty} saving={savingConfig} onSave={handleSaveConfig} hint="Ada perubahan template belum disimpan." />
      )}

      {/* Log Pengiriman */}
      <Card className="shadow-sm">
        <CardHeader>Log Pengiriman</CardHeader>

        {logsLoading && <TableSkeleton rows={5} cols={5} />}

        {!logsLoading && logsError && (
          <div className="p-6">
            <ErrorState message="Gagal memuat log pengiriman." onRetry={() => setLogsReloadToken((t) => t + 1)} />
          </div>
        )}

        {!logsLoading && !logsError && logs.length === 0 && (
          <EmptyState title="Belum ada pengiriman" description="Log akan muncul begitu ada tamu ber-username Telegram yang RSVP hadir." />
        )}

        {!logsLoading && !logsError && logs.length > 0 && (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Tamu</Th>
                  <Th>Telegram</Th>
                  <Th>Jumlah</Th>
                  <Th>Status</Th>
                  <Th className="text-right pr-6">Aksi</Th>
                </Tr>
              </Thead>
              <Tbody>
                {logs.map((log) => (
                  <Tr key={log.id}>
                    <Td>
                      <span className="font-semibold text-slate-900">{log.guestName}</span>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-slate-600">{log.telegramUsername ? `@${log.telegramUsername}` : '—'}</span>
                    </Td>
                    <Td>{log.attendingCount} org</Td>
                    <Td>
                      <div className="flex flex-col gap-0.5">
                        <Badge tone={sendLogTone(log.status)} label={SEND_LOG_STATUS_LABEL[log.status]} />
                        {(log.status === 'failed' || log.status === 'retrying') && log.errorMessage && (
                          <span className="text-xs text-red-600">{log.errorMessage}</span>
                        )}
                      </div>
                    </Td>
                    <Td className="text-right pr-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={log.status !== 'failed'}
                        loading={resendingId === log.id}
                        onClick={() => handleResend(log.id)}
                        className="h-8 px-2 text-slate-600 hover:text-blue-600"
                      >
                        Kirim ulang
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/30">
              <Pagination page={logsPage} pageSize={LOGS_PAGE_SIZE} total={logsTotal} onPageChange={setLogsPage} />
            </div>
          </>
        )}
      </Card>

      {/* Modal Konfirmasi Putuskan */}
      <Modal
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        title="Putuskan Telegram"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLogoutConfirmOpen(false)}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleLogout} loading={loggingOut}>
              Putuskan
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700 leading-relaxed">
          Putuskan tautan akun Telegram ini? Pengiriman QR otomatis akan berhenti sampai akun ditautkan ulang lewat kode OTP.
        </p>
      </Modal>
    </div>
  )
}
