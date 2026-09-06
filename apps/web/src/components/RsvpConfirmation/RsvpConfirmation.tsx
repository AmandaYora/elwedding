import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import './rsvp-pass.css'
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
    //
    // Isi QR kini token tamu berprefiks, bukan teks yang dibaca manusia
    // (docs/plan/scan-checkin-gate/PLAN.md T18/§2.1): teks lama secara teknis
    // TIDAK BISA dipakai untuk identifikasi di gate - tidak bisa dipetakan
    // balik ke baris tamu, dan sepele dipalsukan siapa pun.
    //
    // 'ELW1:' KEMBAR LINTAS BAHASA dengan checkinCodePrefix di
    // guest/application/service.go (D10) - browser tidak bisa memanggil
    // konstanta Go, jadi duplikasi ini tidak terhindarkan. Mengubah salah
    // satu saja memutus rantai antara QR yang diterbitkan dan pemindai.
    if (session.token) {
      return `ELW1:${session.token}`
    }

    // Tanpa token = mode pratinjau (`/` tanpa ?guest=). Kembalikan teks lama
    // apa adanya: QR itu memang tidak mewakili tamu mana pun, dan pemindai
    // akan menolaknya dengan pesan yang benar. Konsisten dengan perilaku yang
    // sudah ada - RSVP-nya juga tidak tersimpan (§3.2).
    return [
      `Wedding Invitation - ${content.groomName} & ${content.brideName}`,
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
                  <div className="wpass">
                    <div className="wpass__card">
                      <p className="wpass__eyebrow">Undangan Masuk</p>
                      <p className="wpass__couple">
                        {content.groomName} &amp; {content.brideName}
                      </p>

                      <dl className="wpass__fields">
                        <div className="wpass__field">
                          <dt>Tamu</dt>
                          <dd>{session.name}</dd>
                        </div>
                        <div className="wpass__row">
                          <div className="wpass__field">
                            <dt>Hadir</dt>
                            <dd className="wpass__count">{displayAttendingCount} orang</dd>
                          </div>
                          <div className="wpass__field">
                            <dt>Tanggal</dt>
                            <dd>{content.weddingDateLabel}</dd>
                          </div>
                        </div>
                      </dl>

                      {/* Batas nyata: di atasnya keterangan tamu, di bawahnya
                          bagian yang dipindai penerima tamu. */}
                      <div className="wpass__perf" aria-hidden="true" />

                      <div className="wpass__qr">
                        <QRCodeCanvas
                          ref={qrCanvasRef}
                          value={displayQrPayload}
                          // Dirender 320 lalu dikecilkan saat TAMPIL: tajam di
                          // layar retina, dan berkas unduhannya ikut resolusi
                          // penuh ini, bukan ukuran tampilnya.
                          size={320}
                          // Ukuran tampil WAJIB lewat prop `style`, BUKAN lewat
                          // rsvp-pass.css. qrcode.react menyusun gayanya sendiri
                          // sebagai `{ height: size, width: size, ...style }`
                          // lalu menempelkannya INLINE ke <canvas>, dan style
                          // inline mengalahkan selector class mana pun - aturan
                          // `width:100%; max-width:200px` di CSS karena itu tidak
                          // pernah berlaku, kanvasnya selalu 320px. Di ponsel
                          // 320px lebih lebar daripada ruang kartu (~292px),
                          // sehingga kotak putih pembungkusnya (`width:fit-content`)
                          // terjepit mendatar sementara tingginya tetap - itulah
                          // yang membuatnya terlihat persegi panjang.
                          //
                          // `style` di-spread PALING AKHIR oleh pustakanya, jadi
                          // nilai di bawah ini yang menang.
                          //
                          // aspectRatio 1/1 adalah penjaga sesungguhnya: berapa
                          // pun lebar yang tersisa di layar sempit, tingginya
                          // selalu mengikuti lebarnya. QR memang selalu kotak,
                          // jadi rasionya tidak boleh bergantung pada ruang.
                          style={{ width: '100%', maxWidth: 200, height: 'auto', aspectRatio: '1 / 1' }}
                          // Zona tenang 4 modul sesuai spesifikasi QR. Tanpa
                          // ini PNG hasil unduhan tidak punya margin putih dan
                          // bisa gagal dipindai saat ditempel di chat/cetak.
                          marginSize={4}
                          bgColor="#ffffff"
                          fgColor="#355656"
                          id="rsvp-qr-canvas"
                          title={`QR konfirmasi kehadiran ${session.name}`}
                        />
                      </div>
                      <p className="wpass__hint">
                        Tunjukkan kode ini kepada penerima tamu saat Anda tiba.
                      </p>
                    </div>

                    {saveError && (
                      <p className="wpass__notice">
                        Konfirmasi Anda belum tersimpan. Periksa koneksi, lalu pilih ulang kehadiran.
                      </p>
                    )}

                    <div className="wpass__actions">
                      <button
                        type="button"
                        className="wpass__btn wpass__btn--primary"
                        onClick={handleDownloadQr}
                      >
                        Unduh QR
                      </button>
                      <button
                        type="button"
                        className="wpass__btn wpass__btn--quiet"
                        onClick={handleReset}
                      >
                        Ubah pilihan
                      </button>
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
