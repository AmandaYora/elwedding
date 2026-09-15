/**
 * Helper untuk cover GIF vs MP4/WebM — PLAN lighthouse D5.
 * Menerima .gif MAUPUN .mp4/.webm sehingga tidak bergantung urutan deploy
 * migration vs frontend. Keduanya valid, fallback tetap tampil.
 */
export function isVideoUrl(url: string): boolean {
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  return clean.endsWith(".mp4") || clean.endsWith(".webm");
}

export function coverMediaHtml(url: string, className = ""): string {
  const cls = className ? ` class="${className}"` : "";
  const esc = url.replace(/"/g, "&quot;");
  if (isVideoUrl(url)) {
    // autoplay muted loop playsinline — cover tidak pakai kontrol, loop halus
    // poster tidak dipakai (GIF asli juga tanpa poster)
    return `<video${cls} src="${esc}" autoplay muted loop playsinline></video>`;
  }
  // Foto cover utama (kandidat LCP, URL dinamis dari admin): fetchpriority
  // high memenangkannya dari antrean bandwidth, decoding async menjaga decode
  // keluar jalur kritis main thread. Disuntik di sini karena tag-nya dirakit
  // sebagai string HTML (bukan JSX), jadi tidak terjangkau aturan seragam di
  // komponen.
  return `<img${cls} src="${esc}" alt="" decoding="async" fetchpriority="high">`;
}
