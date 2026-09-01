import type { InvitationContent } from '@/types/api'
import { extractYoutubeId, youtubeThumbnailUrl } from '@/shared/lib/youtube'

interface VideoGalleryProps {
  content: InvitationContent
}

export default function VideoGallery({ content }: VideoGalleryProps) {
    const videoId = extractYoutubeId(content.videoGalleryYoutubeUrl)
    return (
        <section className="video-gallery autoplay-video-section no-head" data-section-order="gallery_video">
            <div className="ornaments-wrapper">

                <div className="orn-dc-2">
                    <div className="orn-dc-2-2">
                        <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1800" data-aos-delay="1400">
                            <img src="/media/template/arsya/Orn-35.png" alt="" />
                        </div>
                    </div>
                    <div className="orn-dc-2-1">
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1800" data-aos-delay="1400">
                            <img src="/media/template/arsya/Orn-05.png" alt="" />
                        </div>
                    </div>
                    <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1800" data-aos-delay="1400">
                        <img src="/media/template/arsya/Orn-08.png" alt="" />
                    </div>
                </div>

                <div className="orn-dc-3">
                    <div className="orn-dc-2-2">
                        <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1800" data-aos-delay="1400">
                            <img src="/media/template/arsya/Orn-35.png" alt="" />
                        </div>
                    </div>
                    <div className="orn-dc-2-1">
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1800" data-aos-delay="1400">
                            <img src="/media/template/arsya/Orn-05.png" alt="" />
                        </div>
                    </div>
                    <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1800" data-aos-delay="1400">
                        <img src="/media/template/arsya/Orn-08.png" alt="" />
                    </div>
                </div>

            </div>
            <div className="inner"><div className="title" data-aos="zoom-out" data-aos-duration="1000">
                <h1 data-aos="zoom-out-up" data-aos-duration="1000">{content.videoGalleryTitle}</h1>

            </div><div className="video-outer">

                    <div className="video">
                        <div className="ornaments-wrapper"></div>
                        <div className="video-bg"></div>
                        <div className="preview autoplay-video-box" data-aos="zoom-in" data-aos-duration="1000">
                            <div className="autoplay-video" data-url={content.videoGalleryYoutubeUrl}></div>
                            <img src={youtubeThumbnailUrl(content.videoGalleryYoutubeUrl)} alt="" />
                            <button className="play-btn" data-video-id={videoId}><i className="fas fa-play"></i></button>
                        </div>
                        <div className="title"><h2 data-aos="fade-up" data-aos-duration="1000">{content.videoGalleryCaption}</h2></div>

                        <div className="ornaments-wrapper"></div>
                    </div>


                </div>
            </div>
        </section>
    );
}
