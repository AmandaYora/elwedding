import type { InvitationContent } from '@/types/api'

interface CoupleProps {
  content: InvitationContent
}

function instagramHandle(url: string): string {
  const slug = url.split('/').filter(Boolean).pop()
  return slug ? `@${slug}` : ''
}

export default function Couple({ content }: CoupleProps) {
    return (
            <section className="couple-wrap " data-section-order="couple">
                <div className="ornaments-wrapper">

                    <div className="orn-cphead-1">
                        <div className="image-wrap" data-aos="zoom-out-down" data-aos-duration="750" data-aos-delay="350">
                            <img src="/media/template/arsya/Orn-10.webp" width="1000" height="859" alt=""  loading="lazy" decoding="async" />
                        </div>
                    </div>
                    <div className="orn-cphead-2 left">
                        <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1100" data-aos-delay="450">
                            <img src="/media/template/arsya/Orn-11.webp" width="600" height="695" alt=""  loading="lazy" decoding="async" />
                        </div>
                    </div>
                    <div className="orn-cphead-2 right">
                        <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1100" data-aos-delay="450">
                            <img src="/media/template/arsya/Orn-11.webp" width="600" height="695" alt=""  loading="lazy" decoding="async" />
                        </div>
                    </div>

                </div>

                <div className="couple">

                                            <div className="couple-head">

                            <div className="couple-head-wrap-1">
                                <h1 className="couple-title" data-aos="zoom-in" data-aos-duration="500">The Wedding of</h1>                            </div>

                            <div className="couple-head-wrap-2">
                                <p className="couple-description" data-aos="fade-up" data-aos-duration="500">We cordially invite you to the our wedding</p>                            </div>

                        </div>

                    <div
                        className="couple-body   show-picture  ">
                        <div className="couple-info groom">
                            <div className="couple-preview">

                                        <div className="couple-frame">

                                            <div className="orn-cp-8">
                                                <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1050" data-aos-delay="900">
                                                    <img src="/media/template/arsya/Orn-19.webp" width="800" height="200" alt="Ornaments"  loading="lazy" decoding="async" />
                                                </div>
                                            </div>

                                            <div className="orn-cp-12">
                                                <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1050" data-aos-delay="900">
                                                    <img src="/media/template/arsya/Orn-25.webp" width="600" height="770" alt="Ornaments"  loading="lazy" decoding="async" />
                                                </div>
                                            </div>

                                            <div className="orn-cp-11">
                                                <div className="orn-cp-11-2">
                                                    <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1250" data-aos-delay="900">
                                                        <img src="/media/template/arsya/Orn-05.webp" width="400" height="1019" alt="Ornaments"  loading="lazy" decoding="async" />
                                                    </div>
                                                </div>
                                                <div className="orn-cp-11-1">
                                                    <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1000" data-aos-delay="900">
                                                        <img src="/media/template/arsya/Orn-24.webp" width="249" height="351" alt="Ornaments"  loading="lazy" decoding="async" />
                                                    </div>
                                                </div>
                                                <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1050" data-aos-delay="900">
                                                    <img src="/media/template/arsya/Orn-23.webp" width="600" height="293" alt="Ornaments"  loading="lazy" decoding="async" />
                                                </div>
                                            </div>

                                            <div className="orn-cp-10">
                                                <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1050" data-aos-delay="900">
                                                    <img src="/media/template/arsya/Orn-22.webp" width="319" height="219" alt="Ornaments"  loading="lazy" decoding="async" />
                                                </div>
                                            </div>

                                            <div className="orn-cp-9">
                                                <div className="orn-cp-9-1">
                                                    <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1050" data-aos-delay="900">
                                                        <img src="/media/template/arsya/Orn-21.webp" width="381" height="312" alt="Ornaments"  loading="lazy" decoding="async" />
                                                    </div>
                                                </div>
                                                <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1050" data-aos-delay="900">
                                                    <img src="/media/template/arsya/Orn-20.webp" width="534" height="357" alt="Ornaments"  loading="lazy" decoding="async" />
                                                </div>
                                            </div>

                                            <div className="cp-frame-wrap">
                                                <div className="orn-cp-7">
                                                    <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1050"
                                                        data-aos-delay="900">
                                                        <img src="/media/template/arsya/Orn-03.webp" width="400" height="841" alt="Ornaments"  loading="lazy" decoding="async" />
                                                    </div>
                                                </div>
                                                <div className="orn-cp-4">
                                                    <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1050"
                                                        data-aos-delay="900">
                                                        <img src="/media/template/arsya/Orn-15.webp" width="600" height="1625" alt="Ornaments"  loading="lazy" decoding="async" />
                                                    </div>
                                                </div>
                                                <div className="orn-cp-5">
                                                    <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1050"
                                                        data-aos-delay="900">
                                                        <img src="/media/template/arsya/Orn-16.webp" width="288" height="441" alt="Ornaments"  loading="lazy" decoding="async" />
                                                    </div>
                                                </div>

                                                <div className="orn-cp-6-1">
                                                    <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1150"
                                                        data-aos-delay="950">
                                                        <img src="/media/template/arsya/Orn-18.webp" width="297" height="388" alt="Ornaments"  loading="lazy" decoding="async" />
                                                    </div>
                                                </div>

                                                <div className="couple-picture-wrap">
                                                    <div className="couple-picture lightgallery" data-aos="zoom-out" data-aos-duration="500" data-aos-once="false">
                                                        <a className="img-wrap" aria-label="Lihat foto mempelai" href={content.groomPhotoUrl} target="_blank">
                                                            <img className="img" src={content.groomPhotoUrl} alt=""  loading="lazy" decoding="async" />
                                                        </a>
                                                    </div>
                                                </div>

                                                <div className="image-wrap" data-aos="zoom-in" data-aos-duration="500">
                                                    <img src="/media/template/arsya/frame-couple.webp" width="600" height="924" className="img-couple-frame" alt="Frame"  loading="lazy" decoding="async" />
                                                </div>

                                                <div className="orn-cp-6">
                                                    <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1050"
                                                        data-aos-delay="900">
                                                        <img src="/media/template/arsya/Orn-17.webp" width="400" height="563" alt="Ornaments"  loading="lazy" decoding="async" />
                                                    </div>
                                                </div>

                                                <div className="orn-cp-3">
                                                    <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1050"
                                                        data-aos-delay="750">
                                                        <img src="/media/template/arsya/Orn-14.webp" width="400" height="515" alt="Ornaments"  loading="lazy" decoding="async" />
                                                    </div>
                                                </div>
                                                <div className="orn-cp-1">
                                                    <div className="image-wrap" data-aos="zoom-in" data-aos-duration="650"
                                                        data-aos-delay="400">
                                                        <img src="/media/template/arsya/Orn-12.webp" width="492" height="423" alt="Ornaments"  loading="lazy" decoding="async" />
                                                    </div>
                                                </div>
                                                <div className="orn-cp-2">
                                                    <div className="image-wrap" data-aos="zoom-in" data-aos-duration="850"
                                                        data-aos-delay="500">
                                                        <img src="/media/template/arsya/Orn-13.webp" width="400" height="320" alt="Ornaments"  loading="lazy" decoding="async" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="orn-cp-kupu kupu-1">
                                                <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1050" data-aos-delay="900">
                                                    <img src="/media/template/arsya/kupu-1.webp" width="114" height="137" alt="Ornaments"  loading="lazy" decoding="async" />
                                                </div>
                                            </div>

                                        </div>

                                    </div>
                            <div className="couple-details">

                                <h2 className="couple-name" data-aos="fade-up" data-aos-duration="500">{content.groomName}</h2>                                <p className="couple-parents" data-aos="fade-up" data-aos-duration="500" dangerouslySetInnerHTML={{ __html: content.groomParentsText }} />
                                <div className="couple-link-wrap" data-aos="fade-up" data-aos-duration="500">
                                        <a href={content.groomInstagram} target="_blank" className="couple-link"><i className="fab fa-instagram"></i> {instagramHandle(content.groomInstagram)}</a>
                                    </div>                            </div>
                        </div>

                                                    <div className="separator-wrap">
                                <div className="separator" data-aos="zoom-in" data-aos-duration="750">
                                    <h2 className="couple-separator">&amp;</h2>
                                </div>
                            </div>

                                                    <div className="couple-info bride">
                                <div className="couple-preview">

                                            <div className="couple-frame">

                                                <div className="orn-cp-8">
                                                    <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1050" data-aos-delay="900">
                                                        <img src="/media/template/arsya/Orn-19.webp" width="800" height="200" alt="Ornaments"  loading="lazy" decoding="async" />
                                                    </div>
                                                </div>

                                                <div className="orn-cp-12">
                                                    <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1050" data-aos-delay="900">
                                                        <img src="/media/template/arsya/Orn-25.webp" width="600" height="770" alt="Ornaments"  loading="lazy" decoding="async" />
                                                    </div>
                                                </div>

                                                <div className="orn-cp-11">
                                                    <div className="orn-cp-11-2">
                                                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1250" data-aos-delay="900">
                                                            <img src="/media/template/arsya/Orn-05.webp" width="400" height="1019" alt="Ornaments"  loading="lazy" decoding="async" />
                                                        </div>
                                                    </div>
                                                    <div className="orn-cp-11-1">
                                                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1000" data-aos-delay="900">
                                                            <img src="/media/template/arsya/Orn-24.webp" width="249" height="351" alt="Ornaments"  loading="lazy" decoding="async" />
                                                        </div>
                                                    </div>
                                                    <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1050" data-aos-delay="900">
                                                        <img src="/media/template/arsya/Orn-23.webp" width="600" height="293" alt="Ornaments"  loading="lazy" decoding="async" />
                                                    </div>
                                                </div>

                                                <div className="orn-cp-10">
                                                    <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1050" data-aos-delay="900">
                                                        <img src="/media/template/arsya/Orn-22.webp" width="319" height="219" alt="Ornaments"  loading="lazy" decoding="async" />
                                                    </div>
                                                </div>

                                                <div className="orn-cp-9">
                                                    <div className="orn-cp-9-1">
                                                        <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1050" data-aos-delay="900">
                                                            <img src="/media/template/arsya/Orn-21.webp" width="381" height="312" alt="Ornaments"  loading="lazy" decoding="async" />
                                                        </div>
                                                    </div>
                                                    <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1050" data-aos-delay="900">
                                                        <img src="/media/template/arsya/Orn-20.webp" width="534" height="357" alt="Ornaments"  loading="lazy" decoding="async" />
                                                    </div>
                                                </div>

                                                <div className="cp-frame-wrap">

                                                    <div className="orn-cp-7">
                                                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1050"
                                                            data-aos-delay="900">
                                                            <img src="/media/template/arsya/Orn-03.webp" width="400" height="841" alt="Ornaments"  loading="lazy" decoding="async" />
                                                        </div>
                                                    </div>
                                                    <div className="orn-cp-4">
                                                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1050"
                                                            data-aos-delay="900">
                                                            <img src="/media/template/arsya/Orn-15.webp" width="600" height="1625" alt="Ornaments"  loading="lazy" decoding="async" />
                                                        </div>
                                                    </div>
                                                    <div className="orn-cp-5">
                                                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1050"
                                                            data-aos-delay="900">
                                                            <img src="/media/template/arsya/Orn-16.webp" width="288" height="441" alt="Ornaments"  loading="lazy" decoding="async" />
                                                        </div>
                                                    </div>

                                                    <div className="orn-cp-6-1">
                                                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1150"
                                                            data-aos-delay="950">
                                                            <img src="/media/template/arsya/Orn-18.webp" width="297" height="388" alt="Ornaments"  loading="lazy" decoding="async" />
                                                        </div>
                                                    </div>

                                                    <div className="couple-picture-wrap">
                                                        <div className="couple-picture lightgallery" data-aos="zoom-out" data-aos-duration="500" data-aos-once="false">
                                                            <a className="img-wrap" aria-label="Lihat foto mempelai" href={content.bridePhotoUrl} target="_blank">
                                                                <img className="img" src={content.bridePhotoUrl} alt=""  loading="lazy" decoding="async" />
                                                            </a>
                                                        </div>
                                                    </div>

                                                    <div className="image-wrap" data-aos="zoom-in" data-aos-duration="500">
                                                        <img src="/media/template/arsya/frame-couple.webp" width="600" height="924" className="img-couple-frame" alt="Frame"  loading="lazy" decoding="async" />
                                                    </div>

                                                    <div className="orn-cp-6">
                                                        <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1050"
                                                            data-aos-delay="900">
                                                            <img src="/media/template/arsya/Orn-17.webp" width="400" height="563" alt="Ornaments"  loading="lazy" decoding="async" />
                                                        </div>
                                                    </div>

                                                    <div className="orn-cp-3">
                                                        <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1050"
                                                            data-aos-delay="750">
                                                            <img src="/media/template/arsya/Orn-14.webp" width="400" height="515" alt="Ornaments"  loading="lazy" decoding="async" />
                                                        </div>
                                                    </div>
                                                    <div className="orn-cp-1">
                                                        <div className="image-wrap" data-aos="zoom-in" data-aos-duration="650"
                                                            data-aos-delay="400">
                                                            <img src="/media/template/arsya/Orn-12.webp" width="492" height="423" alt="Ornaments"  loading="lazy" decoding="async" />
                                                        </div>
                                                    </div>
                                                    <div className="orn-cp-2">
                                                        <div className="image-wrap" data-aos="zoom-in" data-aos-duration="850"
                                                            data-aos-delay="500">
                                                            <img src="/media/template/arsya/Orn-13.webp" width="400" height="320" alt="Ornaments"  loading="lazy" decoding="async" />
                                                        </div>
                                                    </div>

                                                </div>

                                                <div className="orn-cp-kupu kupu-1">
                                                    <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1050" data-aos-delay="900">
                                                        <img src="/media/template/arsya/kupu-1.webp" width="114" height="137" alt="Ornaments"  loading="lazy" decoding="async" />
                                                    </div>
                                                </div>

                                            </div>

                                        </div>
                                <div className="couple-details">

                                    <h2 className="couple-name" data-aos="fade-up" data-aos-duration="500">{content.brideName}</h2>                                    <p className="couple-parents" data-aos="fade-up" data-aos-duration="500" dangerouslySetInnerHTML={{ __html: content.brideParentsText }} />
                                    <div className="couple-link-wrap" data-aos="fade-up" data-aos-duration="500">
                                            <a href={content.brideInstagram} target="_blank" className="couple-link"><i className="fab fa-instagram"></i> {instagramHandle(content.brideInstagram)}</a>
                                        </div>                                </div>
                            </div>
                                            </div>

                </div>
            </section>
    );
}
