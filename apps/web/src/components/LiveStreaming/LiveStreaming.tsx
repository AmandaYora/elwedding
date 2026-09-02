import type { InvitationContent } from '@/types/api'
import { extractYoutubeId, youtubeThumbnailUrl } from '@/shared/lib/youtube'

interface LiveStreamingProps {
  content: InvitationContent
}

export default function LiveStreaming({ content }: LiveStreamingProps) {
    const videoId = extractYoutubeId(content.liveStreamingYoutubeUrl)
    return (
        <section className="live-streaming" data-section-order="live_streaming">
            <div className="ornaments-wrapper">
                <div className="orn-lv-1 center">
                    <div className="image-wrap" data-aos="fade-up" data-aos-duration="1200" data-aos-delay="500">
                        <img src="/media/template/arsya/Orn-45.webp" width="840" height="518" alt="Ornaments"  loading="lazy" decoding="async" />
                    </div>
                </div>
                <div className="orn-lv-4 right">
                    <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1200" data-aos-delay="500">
                        <img src="/media/template/arsya/Orn-46.webp" width="1000" height="1040" alt="Ornaments"  loading="lazy" decoding="async" />
                    </div>
                </div>
                <div className="orn-lv-4 left">
                    <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1200" data-aos-delay="500">
                        <img src="/media/template/arsya/Orn-46.webp" width="1000" height="1040" alt="Ornaments"  loading="lazy" decoding="async" />
                    </div>
                </div>
                <div className="orn-cphead-2 left">
                    <div className="image-wrap" data-aos="zoom-out" data-aos-duration="2200" data-aos-delay="900">
                        <img src="/media/template/arsya/Orn-11.webp" width="600" height="695" alt=""  loading="lazy" decoding="async" />
                    </div>
                </div>
                <div className="orn-cphead-2 right">
                    <div className="image-wrap" data-aos="zoom-out" data-aos-duration="2200" data-aos-delay="900">
                        <img src="/media/template/arsya/Orn-11.webp" width="600" height="695" alt=""  loading="lazy" decoding="async" />
                    </div>
                </div>
            </div>
            <div className="inner">
                <div className="head">
                    <h1 data-aos="zoom-in" data-aos-duration="1000">{content.liveStreamingTitle}</h1>

                </div>
                <div className="body">
                    <div className="streaming-info"><div className="p-relative">


                        <div className="preview  wide  youtube " data-aos="fade-up" data-aos-duration="1000">
                            <img src={youtubeThumbnailUrl(content.liveStreamingYoutubeUrl)} alt=""  loading="lazy" decoding="async" />
                            <button className="play-btn" data-video-id={videoId} aria-label="Putar siaran langsung"><i className="fas fa-play" aria-hidden="true"></i></button>
                        </div>

                    </div><div className="link" data-aos="fade-up" data-aos-duration="1000">
                            <a href={content.liveStreamingYoutubeUrl} target="_blank" rel="">Open Link</a>
                        </div></div>
                </div>

            </div>
            <div className="ornaments-wrapper">
                <div className="orn-lv-3">
                    <div className="image-wrap" data-aos="fade-up" data-aos-duration="1200" data-aos-delay="500">
                        <img src="/media/template/arsya/Orn-23.webp" width="600" height="293" alt="Ornaments"  loading="lazy" decoding="async" />
                    </div>
                </div>
                <div className="orn-lv-2 left">
                    <div className="orn-lv-2-4">
                        <div className="orn-lv-2-4-1">
                            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="1200">
                                <img src="/media/template/arsya/Orn-07.webp" width="400" height="1114" alt="Ornaments"  loading="lazy" decoding="async" />
                            </div>
                        </div>
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="1200">
                            <img src="/media/template/arsya/Orn-28.webp" width="400" height="954" alt="Ornaments"  loading="lazy" decoding="async" />
                        </div>
                    </div>
                    <div className="orn-lv-2-3">
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="1200">
                            <img src="/media/template/arsya/Orn-05.webp" width="400" height="1019" alt="Ornaments"  loading="lazy" decoding="async" />
                        </div>
                    </div>
                    <div className="orn-lv-2-2">
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1600" data-aos-delay="1100">
                            <img src="/media/template/arsya/Orn-03.webp" width="400" height="841" alt="Ornaments"  loading="lazy" decoding="async" />
                        </div>
                    </div>
                    <div className="image-wrap" data-aos="fade-right" data-aos-duration="1200" data-aos-delay="500">
                        <img src="/media/template/arsya/Orn-20.webp" width="534" height="357" alt="Ornaments"  loading="lazy" decoding="async" />
                    </div>
                    <div className="orn-lv-2-1">
                        <div className="image-wrap" data-aos="fade-right" data-aos-duration="1200" data-aos-delay="500">
                            <img src="/media/template/arsya/Orn-29.webp" width="376" height="294" alt="Ornaments"  loading="lazy" decoding="async" />
                        </div>
                    </div>
                </div>
                <div className="orn-lv-2 right">
                    <div className="orn-lv-2-4">
                        <div className="orn-lv-2-4-1">
                            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="1200">
                                <img src="/media/template/arsya/Orn-07.webp" width="400" height="1114" alt="Ornaments"  loading="lazy" decoding="async" />
                            </div>
                        </div>
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="1200">
                            <img src="/media/template/arsya/Orn-28.webp" width="400" height="954" alt="Ornaments"  loading="lazy" decoding="async" />
                        </div>
                    </div>
                    <div className="orn-lv-2-3">
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="1200">
                            <img src="/media/template/arsya/Orn-05.webp" width="400" height="1019" alt="Ornaments"  loading="lazy" decoding="async" />
                        </div>
                    </div>
                    <div className="orn-lv-2-2">
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1600" data-aos-delay="1100">
                            <img src="/media/template/arsya/Orn-03.webp" width="400" height="841" alt="Ornaments"  loading="lazy" decoding="async" />
                        </div>
                    </div>
                    <div className="image-wrap" data-aos="fade-right" data-aos-duration="1200" data-aos-delay="500">
                        <img src="/media/template/arsya/Orn-20.webp" width="534" height="357" alt="Ornaments"  loading="lazy" decoding="async" />
                    </div>
                    <div className="orn-lv-2-1">
                        <div className="image-wrap" data-aos="fade-right" data-aos-duration="1200" data-aos-delay="500">
                            <img src="/media/template/arsya/Orn-29.webp" width="376" height="294" alt="Ornaments"  loading="lazy" decoding="async" />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
