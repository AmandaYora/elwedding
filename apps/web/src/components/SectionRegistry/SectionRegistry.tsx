import type { InvitationData } from '@/types/api'

import TopCover from '@/components/TopCover/TopCover'
import Cover from '@/components/Cover/Cover'
import Couple from '@/components/Couple/Couple'
import SaveTheDate from '@/components/SaveTheDate/SaveTheDate'
import Quote from '@/components/Quote/Quote'
import Agenda from '@/components/Agenda/Agenda'
import RsvpSection from '@/components/RsvpSection/RsvpSection'
import Rundown from '@/components/Rundown/Rundown'
import PhotoGallery from '@/components/PhotoGallery/PhotoGallery'
import VideoGallery from '@/components/VideoGallery/VideoGallery'
import LiveStreaming from '@/components/LiveStreaming/LiveStreaming'
import LoveStory from '@/components/LoveStory/LoveStory'
import WeddingGift from '@/components/WeddingGift/WeddingGift'
import InstagramFilter from '@/components/InstagramFilter/InstagramFilter'
import Notes from '@/components/Notes/Notes'
import WeddingWish from '@/components/WeddingWish/WeddingWish'
import Footnote from '@/components/Footnote/Footnote'

interface SectionRegistryProps {
  sectionKey: string
  data: InvitationData
}

/**
 * Memetakan 17 section-key (PLAN.md §2.1) ke komponennya. WAJIB
 * mengembalikan elemen komponen LANGSUNG, TANPA elemen wrapper (keputusan
 * #9/F8 PLAN.md) - bundle legacy menghitung parent lewat
 * `a[0].parentNode` lalu memindahkan semua `[data-section-order]` ke situ;
 * kalau ada wrapper di sini, section pertama justru "memindahkan" parent
 * jadi wrapper itu dan seluruh section tersedot ke dalamnya.
 */
export default function SectionRegistry({ sectionKey, data }: SectionRegistryProps) {
  const { content } = data

  switch (sectionKey) {
    case 'opening_cover':
      return <TopCover content={content} />
    case 'cover':
      return <Cover content={content} />
    case 'couple':
      return <Couple content={content} />
    case 'save_the_date':
      return <SaveTheDate content={content} />
    case 'quote':
      return <Quote content={content} />
    case 'event':
      return <Agenda content={content} agendaEvents={data.agendaEvents} />
    case 'rsvp':
      return <RsvpSection content={content} />
    case 'rundown':
      return <Rundown rundownItems={data.rundownItems} />
    case 'gallery_photo':
      return <PhotoGallery photos={data.galleryPhotos} />
    case 'gallery_video':
      return <VideoGallery content={content} />
    case 'live_streaming':
      return <LiveStreaming content={content} />
    case 'love_story':
      return <LoveStory chapters={data.loveStoryChapters} />
    case 'wedding_gift':
      return <WeddingGift content={content} banks={data.giftBanks} />
    case 'filter_instagram':
      return <InstagramFilter content={content} />
    case 'greet_thanks':
      return <Notes content={content} />
    case 'wedding_wish':
      return <WeddingWish />
    case 'footnote':
      return <Footnote content={content} />
    default:
      return null
  }
}
