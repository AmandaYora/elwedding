import type { InvitationContent } from '@/types/api'
import { isVideoUrl } from '@/shared/lib/coverMedia'

interface CoverProps {
  content: InvitationContent
}

export default function Cover({ content }: CoverProps) {
    const isMobile = typeof window !== 'undefined' ? window.matchMedia('(max-width: 1024px)').matches : false
    return (
        <section className="cover " data-section-order="cover">

            <div className="ornaments-wrapper">
                <div className="orn-cover-4 center">
                    <div className="image-wrap" data-aos="zoom-out-up" data-aos-duration="2200" data-aos-delay="1300">
                        <img decoding="async" src="/media/template/arsya/Orn-31.webp" width="840" height="763" alt=""  fetchPriority="high" />
                    </div>
                </div>
            </div>

            <div className="inner">


                <div className="head" data-aos="zoom-in" data-aos-duration="3000" data-aos-delay="3000">
                                            <div className="logo-wrap" data-aos="fade-down" data-aos-duration="3000" data-aos-delay="3000">
                            <img decoding="async" src={content.coverLogoUrl} alt="" className="logo" />
                        </div>
                                        <p data-aos="fade-down" data-aos-duration="3000" data-aos-delay="3000">Wedding Invitation</p><h1 data-aos="zoom-in" data-aos-duration="3000" data-aos-delay="3000">{content.groomName} & {content.brideName}</h1><p data-aos="fade-up" data-aos-duration="3000" data-aos-delay="3000">{content.hashtag}</p>                </div>

                {/*
                  PENTING (PLAN.md keputusan #15 / F16 / task #17c): isi
                  #cover-main di bawah ini SENGAJA TIDAK menerima props.
                  IIFE window.COVERS di fddf2641.js memanggil
                  $('#cover-main').html("") lalu mengisi ulang dari
                  window.COVERS[MAIN].details (diisi useLegacyBootstrap dari
                  content.coverImageDesktopUrl/coverImageMobileUrl) - markup
                  statis di bawah ini HANYA fallback sebelum script legacy
                  jalan, isinya selalu ditimpa jQuery.
                */}
                <div className="body highlight" data-aos="zoom-in-up" data-aos-duration="2900" data-aos-delay="700">
                        <div className="orn-cover-frame">

                            <div className="image-wrap" style={{ opacity: '0 !important' }}>
                                <img decoding="async" src="/media/template/arsya/frame-cover.webp" width="1144" height="1624" alt="Cover Frame" />
                            </div>

                            <div className="cover-frame" id="coverFrame">
                                <div className="cover-picture cover-show" id="cover-main">
                                    {isMobile ? (
                                        <div className="picture mobile">
                                            {isVideoUrl(content.coverImageMobileUrl) ? (
                                                <video src={content.coverImageMobileUrl} autoPlay muted loop playsInline />
                                            ) : (
                                                <img decoding="async" src={content.coverImageMobileUrl} alt="" />
                                            )}
                                        </div>
                                    ) : (
                                        <div className="picture desktop">
                                            {isVideoUrl(content.coverImageDesktopUrl) ? (
                                                <video src={content.coverImageDesktopUrl} autoPlay muted loop playsInline />
                                            ) : (
                                                <img decoding="async" src={content.coverImageDesktopUrl} alt="" />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                <div className="ornaments-wrapper"></div>

            </div>

            <div className="ornaments-wrapper">
                <div className="orn-cover-3 left">
                    <div className="image-wrap" data-aos="zoom-in-down" data-aos-duration="2900" data-aos-delay="1800">
                        <img decoding="async" src="/media/template/arsya/Orn-09.webp" width="191" height="592" alt="" />
                    </div>
                </div>
                <div className="orn-cover-3 right">
                    <div className="image-wrap" data-aos="zoom-in-down" data-aos-duration="2900" data-aos-delay="1800">
                        <img decoding="async" src="/media/template/arsya/Orn-09.webp" width="191" height="592" alt="" />
                    </div>
                </div>

                <div className="orn-cover-2 left">
                    <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2900" data-aos-delay="1800">
                        <img decoding="async" src="/media/template/arsya/Orn-07.webp" width="400" height="1114" alt="" />
                    </div>
                    <div className="orn-cover-2-1">
                        <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2400" data-aos-delay="1300">
                            <img decoding="async" src="/media/template/arsya/Orn-08.webp" width="400" height="993" alt="" />
                        </div>
                    </div>
                </div>
                <div className="orn-cover-2 right">
                    <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2900" data-aos-delay="1800">
                        <img decoding="async" src="/media/template/arsya/Orn-07.webp" width="400" height="1114" alt="" />
                    </div>
                    <div className="orn-cover-2-1">
                        <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2400" data-aos-delay="1300">
                            <img decoding="async" src="/media/template/arsya/Orn-08.webp" width="400" height="993" alt="" />
                        </div>
                    </div>
                </div>

                <div className="orn-cover-1 left">
                    <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2400" data-aos-delay="1300">
                        <img decoding="async" src="/media/template/arsya/Orn-01.webp" width="600" height="741" alt="" />
                    </div>
                    <div className="orn-cover-1-3">
                        <div className="orn-cover-1-3-1">
                            <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="3500" data-aos-delay="2100">
                                <img decoding="async" src="/media/template/arsya/Orn-05.webp" width="400" height="1019" alt="" />
                            </div>
                        </div>
                        <div className="orn-cover-1-3-2">
                            <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="3300" data-aos-delay="2000">
                                <img decoding="async" src="/media/template/arsya/Orn-06.webp" width="400" height="1026" alt="" />
                            </div>
                        </div>
                        <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="3200" data-aos-delay="1900">
                            <img decoding="async" src="/media/template/arsya/Orn-04.webp" width="400" height="351" alt="" />
                        </div>
                    </div>
                    <div className="orn-cover-1-2">
                        <div className="image-wrap" data-aos="fade-up-left" data-aos-duration="2900" data-aos-delay="1700">
                            <img decoding="async" src="/media/template/arsya/Orn-03.webp" width="400" height="841" alt="" />
                        </div>
                    </div>
                    <div className="orn-cover-1-1">
                        <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2600" data-aos-delay="1500">
                            <img decoding="async" src="/media/template/arsya/Orn-02.webp" width="600" height="799" alt="" />
                        </div>
                        <div className="orn-cover-1-1-1">
                            <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2600" data-aos-delay="1500">
                                <img decoding="async" src="/media/template/arsya/Orn-51.webp" width="256" height="224" alt="" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="orn-cover-1 right">
                    <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2400" data-aos-delay="1300">
                        <img decoding="async" src="/media/template/arsya/Orn-01.webp" width="600" height="741" alt="" />
                    </div>
                    <div className="orn-cover-1-3">
                        <div className="orn-cover-1-3-1">
                            <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="3500" data-aos-delay="2100">
                                <img decoding="async" src="/media/template/arsya/Orn-05.webp" width="400" height="1019" alt="" />
                            </div>
                        </div>
                        <div className="orn-cover-1-3-2">
                            <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="3300" data-aos-delay="2000">
                                <img decoding="async" src="/media/template/arsya/Orn-06.webp" width="400" height="1026" alt="" />
                            </div>
                        </div>
                        <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="3200" data-aos-delay="1900">
                            <img decoding="async" src="/media/template/arsya/Orn-04.webp" width="400" height="351" alt="" />
                        </div>
                    </div>
                    <div className="orn-cover-1-2">
                        <div className="image-wrap" data-aos="fade-up-left" data-aos-duration="2900" data-aos-delay="1700">
                            <img decoding="async" src="/media/template/arsya/Orn-03.webp" width="400" height="841" alt="" />
                        </div>
                    </div>
                    <div className="orn-cover-1-1">
                        <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2600" data-aos-delay="1500">
                            <img decoding="async" src="/media/template/arsya/Orn-02.webp" width="600" height="799" alt="" />
                        </div>
                        <div className="orn-cover-1-1-1">
                            <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2600" data-aos-delay="1500">
                                <img decoding="async" src="/media/template/arsya/Orn-51.webp" width="256" height="224" alt="" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="orn-cover-5 center">
                    <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2900" data-aos-delay="1800">
                        <img decoding="async" src="/media/template/arsya/Orn-23.webp" width="600" height="293" alt="" />
                    </div>
                </div>
            </div>
        </section>
    );
}
