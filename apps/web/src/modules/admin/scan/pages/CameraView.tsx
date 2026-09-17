import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import { Card } from '@/shared/components/ui'

interface CameraViewProps {
  /** Meneruskan isi QR mentah ke pemilik (ScanPage.handleScannedCode). */
  onScanned: (code: string) => void
  /** Menyalakan teks status "Memproses pindaian...". */
  busy: boolean
}

/**
 * Viewport kamera untuk mode Kamera di menu Scan (pindahan dari ScanPage,
 * docs/plan/scan-mode-scanner/PLAN.md T1).
 *
 * Dipisah ke berkas sendiri supaya bisa di-lazy-load: `@zxing/browser`
 * sekitar 465 kB dan hanya dibutuhkan saat toggle berada di mode Kamera,
 * sedangkan default halaman adalah mode Scanner (D2).
 *
 * BUTUH HTTPS: getUserMedia hanya tersedia di secure context. Produksi sudah
 * HTTPS. Menguji lewat IP LAN ber-http:// TIDAK akan bisa membuka kamera -
 * pakai localhost (dianggap secure) atau terowongan HTTPS.
 */
export default function CameraView({ onScanned, busy }: CameraViewProps) {
  const [cameraError, setCameraError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)

  // Stream DIHENTIKAN saat unmount - kamera yang menyala terus akan menguras
  // baterai perangkat gate sepanjang acara. Inilah yang menjamin eksklusivitas
  // mode (K3): pindah toggle ke Scanner meng-unmount komponen ini sehingga
  // kamera mati total.
  useEffect(() => {
    let cancelled = false
    const reader = new BrowserQRCodeReader()

    reader
      .decodeFromConstraints(
        // facingMode 'environment' = kamera belakang bila tersedia; browser
        // jatuh ke kamera mana pun yang ada bila tidak.
        { video: { facingMode: 'environment' } },
        videoRef.current ?? undefined,
        (result, _err, controls) => {
          if (cancelled) {
            controls.stop()
            return
          }
          if (result) onScanned(result.getText())
        },
      )
      .then((controls) => {
        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
      })
      .catch(() => {
        if (cancelled) return
        setCameraError(
          'Kamera tidak bisa dibuka. Izinkan akses kamera di browser, lalu muat ulang halaman. Halaman ini butuh koneksi HTTPS.',
        )
      })

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [onScanned])

  return (
    <Card className="lg:col-span-2 overflow-hidden shadow-sm">
      <div className="relative bg-slate-950 aspect-4/3">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
          aria-label="Pratinjau kamera pemindai"
        />
        {/* Bingkai bidik: satu-satunya hiasan di viewport, dan tugasnya
            nyata - memberi tahu ke mana QR harus diletakkan. */}
        {!cameraError && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-40 rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]" />
          </div>
        )}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM3 3l18 18" />
            </svg>
            <p className="text-sm font-semibold text-slate-200">Kamera tidak aktif</p>
            <p className="text-xs text-slate-400 leading-relaxed">{cameraError}</p>
            <p className="text-xs text-slate-300 font-medium mt-1">
              Pencarian nama di bawah tetap bisa dipakai.
            </p>
          </div>
        )}
      </div>
      <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${cameraError ? 'bg-slate-300' : 'bg-emerald-500 motion-safe:animate-pulse'}`}
          aria-hidden="true"
        />
        <p className="text-xs text-slate-500">
          {cameraError ? 'Pemindai berhenti' : busy ? 'Memproses pindaian...' : 'Siap memindai'}
        </p>
      </div>
    </Card>
  )
}
