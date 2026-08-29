import { useLegacyBootstrap } from '@/hooks/useLegacyBootstrap'

import PrimaryPane from '@/components/PrimaryPane/PrimaryPane'
import TopCover from '@/components/TopCover/TopCover'
import Cover from '@/components/Cover/Cover'
import Couple from '@/components/Couple/Couple'
import SaveTheDate from '@/components/SaveTheDate/SaveTheDate'
import Quote from '@/components/Quote/Quote'
import Agenda from '@/components/Agenda/Agenda'
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
import Footer from '@/components/Footer/Footer'
import MusicPlayer from '@/components/MusicPlayer/MusicPlayer'
import AlertModal from '@/components/AlertModal/AlertModal'

/**
 * Renders the exact same DOM shape as the original server-rendered page,
 * organized into one component per `data-section-order` section. All
 * interactivity (RSVP, gallery, sliders, countdown, music player, AOS
 * animations...) comes from the platform's own bundled scripts + jQuery
 * vendor plugins, wired up post-mount by useLegacyBootstrap - see that
 * hook and src/data/legacyConfig.ts for why nothing here holds state.
 */
function App() {
  useLegacyBootstrap()

  return (
    <>
      <section className="kat-page__side-to-side">
        <PrimaryPane />

        <section className="secondary-pane">
          <TopCover />
          <Cover />
          <Couple />
          <SaveTheDate />
          <Quote />
          <Agenda />
          <Rundown />
          <PhotoGallery />
          <VideoGallery />
          <LiveStreaming />
          <LoveStory />
          <WeddingGift />
          <InstagramFilter />
          <Notes />
          <WeddingWish />
          <Footnote />
          <Footer />
        </section>
      </section>

      <MusicPlayer />
      <AlertModal />
    </>
  )
}

export default App
