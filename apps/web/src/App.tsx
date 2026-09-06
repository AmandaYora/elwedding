import { useInvitationData } from '@/hooks/useInvitationData'
import { useLegacyBootstrap } from '@/hooks/useLegacyBootstrap'
import { useGuestSession } from '@/hooks/useGuestSession'

import PrimaryPane from '@/components/PrimaryPane/PrimaryPane'
import SectionRegistry from '@/components/SectionRegistry/SectionRegistry'
import MusicPlayer from '@/components/MusicPlayer/MusicPlayer'
import AlertModal from '@/components/AlertModal/AlertModal'
import GuestGate from '@/components/GuestGate/GuestGate'

/**
 * Data-driven (PLAN.md §5.3): section yang dirender hanya yang enabled,
 * sesuai urutan dari API - bukan lagi daftar JSX statis. `useLegacyBootstrap`
 * dipanggil UNCONDITIONAL (aturan Hooks), efeknya sendiri yang di-gate oleh
 * `ready` di dalam hook tsb.
 *
 * Saat loading: mengembalikan `null`, BUKAN loading screen buatan sendiri -
 * layar loading sudah disediakan bundle `1e92684f.js` (index.html) dan baru
 * ditutup saat tombol "Open Invitation" (`startTheJourney()`) diklik.
 * Menambah loading screen React sendiri akan menumpuk dua layar loading.
 */
function App() {
  const { data, loading, error } = useInvitationData()
  const { access } = useGuestSession()

  // `ready` kini JUGA menuntut akses diberikan. Ini bukan sekadar kerapian:
  // useLegacyBootstrap memuat sembilan bundel jQuery yang langsung mencari
  // `[data-section-order]` di DOM dan menulis ulang isinya. Kalau ia tetap
  // jalan saat gerbang tertutup, ia bekerja di halaman yang section-nya tidak
  // pernah dirender - memuat ratusan kilobyte untuk orang yang justru tidak
  // boleh melihat undangannya.
  const ready = !loading && !error && !!data && access === 'granted'
  useLegacyBootstrap(data, ready)

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        Gagal memuat undangan. Silakan muat ulang halaman.
      </div>
    )
  }

  // Menunggu SALAH SATU dari dua jawaban (konten & keputusan akses) tetap
  // berarti `null`, bukan undangan dan bukan pula layar penolakan. Menebak
  // lebih awal berarti salah satu dari dua kesalahan: mengedipkan isi undangan
  // ke orang yang belum tentu berhak, atau menuduh tamu sah yang jaringannya
  // lambat. `null` aman karena layar loading legacy (1e92684f.js) masih
  // menutupi halaman sampai DOMContentLoaded.
  if (loading || access === 'checking') return null

  // Gerbang dievaluasi SEBELUM `!data`: tanpa token, orang yang membuka
  // halaman harus menerima jawaban yang jelas, bukan layar kosong, walau
  // konten undangannya sendiri gagal dimuat. GuestGate memang menerima nama
  // mempelai kosong.
  if (access !== 'granted') {
    return (
      <GuestGate
        groomName={data?.content.groomName}
        brideName={data?.content.brideName}
        reason={access === 'unavailable' ? 'unavailable' : 'denied'}
        onRetry={() => window.location.reload()}
      />
    )
  }

  if (!data) return null

  return (
    <>
      <section className="kat-page__side-to-side">
        <PrimaryPane content={data.content} />

        <section className="secondary-pane">
          {/* TIDAK ada <Footer />: footer template hanya berisi teks
              copyright, dan atas permintaan user tidak boleh ada copyright
              sama sekali di bagian bawah undangan. Section-nya dihapus utuh,
              bukan dikosongkan - `.footer` punya background putih +
              padding 30px, jadi menyisakannya kosong akan memunculkan pita
              putih tanpa isi. Reorder section di bundle legacy
              (assets/js/fddf2641.js) sudah menjaga ketiadaannya:
              `t && d.appendChild(t)`. */}
          {data.sections.map((s) => (
            <SectionRegistry key={s.key} sectionKey={s.key} data={data} />
          ))}
        </section>
      </section>

      <MusicPlayer />
      <AlertModal />
    </>
  )
}

export default App
