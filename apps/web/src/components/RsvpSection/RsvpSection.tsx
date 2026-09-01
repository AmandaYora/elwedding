import RsvpConfirmation from '@/components/RsvpConfirmation/RsvpConfirmation'
import type { InvitationContent } from '@/types/api'

interface RsvpSectionProps {
  content: InvitationContent
}

/**
 * Section "rsvp" (data-section-order="rsvp"), dipisah dari Agenda
 * (PLAN.md task #17a / F5) supaya SectionRegistry bisa memetakan
 * 1 section-key -> 1 komponen. Wrapper div INI (bukan komponen tambahan)
 * yang membawa atribut data-section-order, sesuai posisi semula di
 * Agenda.tsx (di dalam div, bukan langsung di RsvpConfirmation) - jadi
 * SectionRegistry cukup me-render <RsvpSection/> langsung tanpa wrapper
 * tambahan lagi (keputusan #9/F8 PLAN.md).
 */
export default function RsvpSection({ content }: RsvpSectionProps) {
  return (
    <div data-section-order="rsvp">
      <RsvpConfirmation content={content} />
    </div>
  )
}
