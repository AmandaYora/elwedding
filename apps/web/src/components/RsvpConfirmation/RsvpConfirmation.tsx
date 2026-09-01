import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { useGuestSession } from '@/hooks/useGuestSession'
import { httpClient } from '@/shared/services/http-client'
import type { InvitationContent, RsvpStatus, RsvpUpdateResponse, ApiEnvelope } from '@/types/api'

interface RsvpConfirmationProps {
  content: InvitationContent
}

/**
 * Kartu konfirmasi kehadiran di section Reservation. Terhubung ke backend
 * (PLAN.md guest-fields-admin-layout §5.4/task #18): status tersinkron dari
 * sesi tamu (`useGuestSession`, token dari `?guest=`), dan tiap pilihan
 * dikirim ke `PATCH /api/v1/public/guests/by-token/:token/rsvp` HANYA jika
 * ada token - tanpa token, tetap berfungsi sebagai preview tanpa persist
 * (docs/plan/qrcode-rsvp/PLAN.md, dipertahankan dashboard-wa-rsvp
 * keputusan #15).
 *
 * Sejak dashboard-wa-rsvp: memilih "Akan Hadir" tidak langsung menampilkan
 * QR - tamu memilih dulu 1/2 tamu (keputusan #2), baru QR muncul. QR yang
 * ditampilkan berasal dari `qrPayload` respons backend (keputusan #6),
 * dengan fallback teks yang disusun di sini bila PATCH gagal atau tanpa
 * token, supaya tamu tetap mendapat QR yang bisa diunduh.
 */
export default function RsvpConfirmation({ content }: RsvpConfirmationProps) {
  const session = useGuestSession()
  // F15 (PLAN.md): `override` null berarti "ikuti status sesi tamu" - begitu
  // sesi selesai resolve, pilihan yang sudah tersimpan langsung terlihat
  // tanpa efek terpisah (menghindari cascading render/setState-in-effect).
  const [override, setOverride] = useState<RsvpStatus | null>(null)
  const choice = override ?? session.status
  const [saveError, setSaveError] = useState(false)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  // Langkah antara "klik Akan Hadir" dan "QR muncul" (keputusan #2) - QR
  // BELUM ditampilkan selama step ini.
  const [pickingCount, setPickingCount] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [attendingCount, setAttendingCount] = useState(1)
  const [qrPayload, setQrPayload] = useState('')

  function composeLocalQrPayload(count: number) {
    // Fallback client-side (keputusan #15 mode preview / PATCH gagal) -
    // format sama seperti yang disusun backend (buildQRPayload).
    return [
      `Wedding Invitation - ${content.brideName} & ${content.groomName}`,
      `Nama Tamu: ${session.name}`,
      'Status: Akan Hadir',
      `Jumlah Tamu: ${count}`,
      `Tanggal: ${content.weddingDateLabel}`,
    ].join('\n')
  }

  // Tamu yang membuka ulang link setelah RSVP 'attending' sebelumnya (sesi
  // sudah resolve ke status itu tanpa pernah melewati handleConfirmAttending
  // di render ini) tidak punya qrPayload/attendingCount lokal - dipulihkan
  // dari session.attendingCount (dto.go GuestSessionDTO). Dihitung SAAT
  // render, bukan lewat useEffect+setState, supaya tetap konsisten dengan
  // pola F15 di atas (menghindari cascading render).
  const displayAttendingCount = qrPayload ? attendingCount : session.attendingCount
  const displayQrPayload = qrPayload || composeLocalQrPayload(displayAttendingCount)

  async function persistSimple(status: RsvpStatus) {
    setSaveError(false)
    if (!session.token) return // tanpa token: state lokal saja (perilaku lama)
    try {
      await httpClient.patch(`/api/v1/public/guests/by-token/${session.token}/rsvp`, { status })
    } catch {
      setSaveError(true)
    }
  }

  function handleAttend() {
    setPickingCount(true)
  }

  async function handleConfirmAttending(count: number) {
    setConfirming(true)
    setSaveError(false)
    setAttendingCount(count)

    if (!session.token) {
      // Mode preview (keputusan #15): tanpa token, TIDAK ada PATCH & TIDAK
      // ada kirim WhatsApp - teks QR disusun sendiri di sini.
      setQrPayload(composeLocalQrPayload(count))
      setPickingCount(false)
      setOverride('attending')
      setConfirming(false)
      return
    }

    try {
      const res = await httpClient.patch<ApiEnvelope<RsvpUpdateResponse>>(
        `/api/v1/public/guests/by-token/${session.token}/rsvp`,
        { status: 'attending', attendingCount: count },
      )
      setQrPayload(res.data.data.qrPayload || composeLocalQrPayload(count))
    } catch {
      // PATCH gagal - tamu tetap melihat QR (fallback lokal) supaya tidak
      // buntu, dengan peringatan bahwa status belum tentu tersimpan.
      setQrPayload(composeLocalQrPayload(count))
      setSaveError(true)
    } finally {
      setPickingCount(false)
      setOverride('attending')
      setConfirming(false)
    }
  }

  function handleNotAttend() {
    setOverride('not_attending')
    void persistSimple('not_attending')
  }

  function handleRemindLater() {
    setOverride('remind_later')
    void persistSimple('remind_later')
  }

  function handleReset() {
    setPickingCount(false)
    setOverride('pending')
  }

  function handleDownloadQr() {
    const canvas = qrCanvasRef.current
    if (!canvas) return

    const sanitizedName = session.name.replace(/[^a-zA-Z0-9 _-]/g, '_').trim()
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `qr-konfirmasi-${sanitizedName}.png`
    link.click()
  }

  return (
    <div className="rsvp-wrap">
      <div className="rsvp-form-outer">
        <div className="rsvp-form-wrapper">
          <div className="rsvp-body-wrapper">
            <div className="rsvp-body">
              <div className="rsvp-head">
                <h2 className="rsvp-title">Konfirmasi Kehadiran</h2>
                <p className="rsvp-desc">
                  Halo {session.name}, apakah Anda akan hadir di acara kami?
                </p>
              </div>

              <div className="rsvp-inner">
                {choice === 'pending' && !pickingCount && (
                  <div className="rsvp-confirm-wrap">
                    <button type="button" className="rsvp-confirm-btn" onClick={handleAttend}>
                      Akan Hadir
                    </button>
                    <button type="button" className="rsvp-confirm-btn" onClick={handleNotAttend}>
                      Tidak Hadir
                    </button>
                    <button type="button" className="rsvp-confirm-btn" onClick={handleRemindLater}>
                      Ingatkan Saya Nanti
                    </button>
                  </div>
                )}

                {choice === 'pending' && pickingCount && (
                  <div className="rsvp-message-wrap">
                    <p className="rsvp-message-title">Berapa orang yang akan hadir?</p>
                    <p className="rsvp-message-content">
                      1 undangan yang datang memungkinkan berpasangan - pilih jumlah tamu untuk kebutuhan konsumsi.
                    </p>
                    <div className="rsvp-confirm-wrap">
                      <button
                        type="button"
                        className="rsvp-confirm-btn"
                        disabled={confirming}
                        onClick={() => void handleConfirmAttending(1)}
                      >
                        1 Tamu
                      </button>
                      <button
                        type="button"
                        className="rsvp-confirm-btn"
                        disabled={confirming}
                        onClick={() => void handleConfirmAttending(2)}
                      >
                        2 Tamu
                      </button>
                      <button
                        type="button"
                        className="rsvp-confirm-btn"
                        style={{ background: 'transparent', color: 'var(--text-secondary)', boxShadow: 'none' }}
                        disabled={confirming}
                        onClick={() => setPickingCount(false)}
                      >
                        Kembali
                      </button>
                    </div>
                  </div>
                )}

                {choice === 'attending' && (
                  <div className="rsvp-qrcard-outer">
                    <div className="rsvp-qrcard-inner">
                      <div className="rsvp-qrcard-img-wrap">
                        <QRCodeCanvas
                          ref={qrCanvasRef}
                          value={displayQrPayload}
                          size={240}
                          id="rsvp-qr-canvas"
                          className="rsvp-qrcard-img"
                        />
                      </div>
                      <p className="rsvp-message-content" style={{ fontSize: '0.85em' }}>
                        {displayAttendingCount} tamu akan hadir.
                      </p>
                      {saveError && (
                        <p className="rsvp-message-content" style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>
                          Gagal menyimpan status, silakan coba lagi.
                        </p>
                      )}
                      <div className="rsvp-confirm-wrap">
                        <button
                          type="button"
                          className="download rsvp-confirm-btn"
                          onClick={handleDownloadQr}
                        >
                          Unduh QR
                        </button>
                        <button
                          type="button"
                          className="rsvp-confirm-btn"
                          style={{ background: 'transparent', color: 'var(--text-secondary)', boxShadow: 'none' }}
                          onClick={handleReset}
                        >
                          Ubah pilihan
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {choice === 'not_attending' && (
                  <div className="rsvp-message-wrap">
                    <p className="rsvp-message-title">Terima Kasih</p>
                    <p className="rsvp-message-content">
                      Terima kasih atas konfirmasinya. Kami akan sangat merindukan
                      kehadiran Anda di hari bahagia kami.
                    </p>
                    <button
                      type="button"
                      className="rsvp-confirm-btn"
                      style={{ background: 'transparent', color: 'var(--text-secondary)', boxShadow: 'none' }}
                      onClick={handleReset}
                    >
                      Ubah pilihan
                    </button>
                  </div>
                )}

                {choice === 'remind_later' && (
                  <div className="rsvp-message-wrap">
                    <p className="rsvp-message-title">Baik, Kami Tunggu</p>
                    <p className="rsvp-message-content">
                      Tidak masalah, silakan konfirmasi kehadiran Anda kapan saja
                      sebelum hari acara.
                    </p>
                    <button
                      type="button"
                      className="rsvp-confirm-btn"
                      style={{ background: 'transparent', color: 'var(--text-secondary)', boxShadow: 'none' }}
                      onClick={handleReset}
                    >
                      Ubah pilihan
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
