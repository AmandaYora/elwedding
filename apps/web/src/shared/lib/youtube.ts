/**
 * Ekstrak video ID YouTube dari URL apa pun (watch?v=, youtu.be/, embed/).
 * Dipakai VideoGallery & LiveStreaming untuk membangun data-video-id dan
 * thumbnail - menggantikan file thumbnail lokal pre-generate
 * (public/media/youtube-thumbs/<id>/...) yang hanya cocok untuk video ID
 * lama. Setelah admin bisa mengganti URL video (fitur #1), thumbnail HARUS
 * ikut berubah otomatis, jadi dipakai CDN thumbnail bawaan YouTube
 * (img.youtube.com) yang selalu tersedia untuk video ID apa pun.
 */
export function extractYoutubeId(url: string): string {
  const patterns = [/[?&]v=([^&]+)/, /youtu\.be\/([^?&]+)/, /embed\/([^?&]+)/]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return ''
}

export function youtubeThumbnailUrl(url: string): string {
  const id = extractYoutubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : ''
}
