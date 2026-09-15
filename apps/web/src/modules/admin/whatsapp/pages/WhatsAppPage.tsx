import { useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import {
  type WhatsAppStatus,
  type WhatsAppConfig,
  type SendLog,
  getStatus,
  startPairing,
  logout,
  reconnect,
  getConfig,
  updateConfig,
  listLogs,
  resendLog,
} from '@/modules/admin/whatsapp/services/whatsapp.service'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { StickyActionBar } from '@/shared/components/layout/StickyActionBar'
import { Card, CardHeader, CardBody, Textarea, Switch, Button, Badge, Table, Thead, Tbody, Tr, Th, Td, Modal, Pagination } from '@/shared/components/ui'
import { EmptyState } from '@/shared/components/feedback/EmptyState'
import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { Skeleton, TableSkeleton } from '@/shared/components/feedback/Skeleton'
import { useToast } from '@/shared/components/toast/ToastProvider'

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

// Empat keadaan koneksi yang terbaca admin (keputusan D3). loggedIn = sesi
// ada, connected = socket hidup - keduanya wajib dibaca karena sesi bisa ada
// sementara socket mati (akar defect §2.1).
type ConnectionState = 'ready' | 'disconnected' | 'unpaired' | 'pairing'

function connectionState(status: WhatsAppStatus): ConnectionState {
  if (!status.loggedIn) {
    return status.pairing || status.pairingQR ? 'pairing' : 'unpaired'
  }
  return status.connected ? 'ready' : 'disconnected'
}

const CONNECTION_STATE_LABEL: Record<ConnectionState, string> = {
  ready: 'Siap mengirim',
  disconnected: 'Tertaut, koneksi terputus',
  unpaired: 'Belum tertaut',
  pairing: 'Menunggu pindaian QR',
}

export default function WhatsAppPage() {
  const toast = useToast()

  // --- status & pairing ---
  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState(false)
  const [statusReloadToken, setStatusReloadToken] = useState(0)
  const [pairingBusy, setPairingBusy] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  // Cermin status terakhir untuk keputusan error di dalam poll (state React
  // yang dibaca closure akan basi; ref selalu segar).
  const statusRef = useRef<WhatsAppStatus | null>(null)

  // Polling TIDAK PERNAH berhenti (menutup G5): 2 detik saat belum siap,
  // 15 detik saat siap mengirim. Satu blip jaringan tidak mematikan pantauan
  // - ErrorState hanya bila belum pernah dapat status sama sekali, selebihnya
  // status terakhir tetap tampil dan polling coba lagi 15 detik kemudian.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function poll() {
      try {
        const s = await getStatus()
        if (cancelled) return
        statusRef.current = s
        setStatus(s)
        setStatusError(false)
        setStatusLoading(false)
        timer = setTimeout(poll, connectionState(s) === 'ready' ? 15000 : 2000)
      } catch {
        if (cancelled) return
        setStatusLoading(false)
        if (!statusRef.current) {
          setStatusError(true)
        }
        timer = setTimeout(poll, 15000)
      }
    }
    void poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [statusReloadToken])

  async function handleStartPairing() {
    setPairingBusy(true)
    try {
      await startPairing()
      setStatusReloadToken((t) => t + 1)
    } catch {
      toast.error('Gagal memulai pairing WhatsApp.')
    } finally {
      setPairingBusy(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      const result = await logout()
      if (result.remoteRevoked) {
        toast.success('WhatsApp berhasil diputus.')
      } else {
        // Keputusan D2: sesi lokal sudah bersih, tetapi server WhatsApp tidak
        // sempat dihubungi - perangkat mungkin masih terdaftar di HP admin.
        // ToastProvider hanya punya success/error, jadi "peringatan" ini
        // memakai error agar terlihat sebagai tindakan lanjutan yang wajib.
        toast.error('Koneksi lokal diputus, tetapi perangkat mungkin masih terdaftar di HP. Hapus manual lewat WhatsApp > Perangkat Tertaut.')
      }
      setLogoutConfirmOpen(false)
      setStatusReloadToken((t) => t + 1)
    } catch {
      toast.error('Gagal memutus WhatsApp.')
    } finally {
      setLoggingOut(false)
    }
  }

  async function handleReconnect() {
    setReconnecting(true)
    try {
      await reconnect()
      toast.success('Koneksi WhatsApp dipulihkan.')
      setStatusReloadToken((t) => t + 1)
    } catch {
      toast.error('Gagal menyambungkan ulang WhatsApp.')
    } finally {
      setReconnecting(false)
    }
  }

  // --- template pesan ---
  const [config, setConfig] = useState<WhatsAppConfig | null>(null)
  const [initialConfig, setInitialConfig] = useState<WhatsAppConfig | null>(null)
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
        title="WhatsApp"
        description="Tautkan akun WhatsApp untuk mengirim QR konfirmasi kehadiran secara otomatis ke tamu."
      />

      {/* Status Koneksi & Pairing */}
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
            <ErrorState message="Gagal memuat status WhatsApp." onRetry={() => setStatusReloadToken((t) => t + 1)} />
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
                      <Button size="sm" onClick={handleReconnect} loading={reconnecting}>
                        Sambungkan Ulang
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

              {(connState === 'unpaired' || connState === 'pairing') && (
                <div className="flex flex-col items-center gap-4 py-4">
                  {connState === 'unpaired' && (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      <span className="w-2 h-2 rounded-full bg-slate-400" aria-hidden="true" />
                      {CONNECTION_STATE_LABEL.unpaired}
                    </span>
                  )}
                  {/* Alasan sesi hilang (mis. perangkat dilepas dari HP) -
                      ditampilkan supaya "Belum tertaut" tidak misterius. */}
                  {status.lastError && !status.pairingQR && (
                    <p className="text-sm text-slate-600 text-center max-w-sm">{status.lastError}</p>
                  )}
                  {status.pairingQR ? (
                    <>
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <QRCodeCanvas value={status.pairingQR} size={220} />
                      </div>
                      <p className="text-sm text-slate-600 text-center max-w-sm">
                        Buka WhatsApp di ponsel Anda &rarr; Perangkat Tertaut &rarr; Tautkan Perangkat, lalu pindai kode QR ini.
                      </p>
                    </>
                  ) : (
                    <>
                      {status.pairingError && (
                        <p className="text-sm text-red-600 text-center max-w-sm">{status.pairingError}</p>
                      )}
                      <Button onClick={handleStartPairing} loading={pairingBusy || status.pairing}>
                        Tautkan akun WhatsApp
                      </Button>
                    </>
                  )}
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
            <div className="flex flex-col gap-8">
              {/* --- Bagian 1: QR Code (jalur otomatis lewat whatsmeow) --- */}
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
                    Dipakai untuk pengiriman QR code secara otomatis lewat akun WhatsApp yang tertaut, sesaat
                    setelah tamu mengonfirmasi kehadiran (RSVP).
                  </p>
                </div>
                {/* Switch ini SENGAJA berada di dalam bagian QR dan deskripsinya
                    tidak diubah (docs/plan/og-share-image-dinamis/PLAN.md D12):
                    ia hanya menghentikan pengiriman QR otomatis. Jangan
                    memindahkannya ke luar sebagai toggle bersama - itu akan
                    menyiratkan ia juga mengatur tombol "Kirim Undangan", dan
                    admin yang mematikan auto-send QR akan kehilangan tombol itu
                    tanpa penjelasan apa pun. */}
                <Switch
                  checked={config.isEnabled}
                  onChange={(checked) => setConfig((c) => (c ? { ...c, isEnabled: checked } : c))}
                  label="Aktifkan pengiriman otomatis"
                  description="Matikan untuk menghentikan sementara pengiriman QR ke WhatsApp tanpa memutus tautan akun."
                />
              </div>

              {/* --- Bagian 2: Undangan (manual per tamu lewat wa.me) --- */}
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
                  Dipakai tombol &ldquo;Kirim Undangan&rdquo; di menu Tamu, yang membuka WhatsApp biasa dengan
                  pesan sudah terisi. Pengiriman dilakukan manual per tamu dan tidak dipengaruhi sakelar
                  pengiriman otomatis di atas. Tidak ada {'{jumlah}'} di sini karena saat undangan dikirim tamu
                  belum mengonfirmasi kehadiran.
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
          <EmptyState title="Belum ada pengiriman" description="Log akan muncul begitu ada tamu yang RSVP hadir." />
        )}

        {!logsLoading && !logsError && logs.length > 0 && (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Tamu</Th>
                  <Th>Telepon</Th>
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
                      <span className="font-mono text-xs text-slate-600">{log.phone || '—'}</span>
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
        title="Putuskan WhatsApp"
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
          Putuskan tautan akun WhatsApp ini? Pengiriman QR otomatis akan berhenti sampai akun ditautkan ulang lewat scan QR.
        </p>
      </Modal>
    </div>
  )
}
