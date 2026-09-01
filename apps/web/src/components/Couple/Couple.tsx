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
                        <div className="image-wrap" data-aos="zoom-out-down" data-aos-duration="1500" data-aos-delay="700">
                            <img src="/media/template/arsya/Orn-10.png" alt="" />
                        </div>
                    </div>
                    <div className="orn-cphead-2 left">
                        <div className="image-wrap" data-aos="zoom-out" data-aos-duration="2200" data-aos-delay="900">
                            <img src="/media/template/arsya/Orn-11.png" alt="" />
                        </div>
                    </div>
                    <div className="orn-cphead-2 right">
                        <div className="image-wrap" data-aos="zoom-out" data-aos-duration="2200" data-aos-delay="900">
                            <img src="/media/template/arsya/Orn-11.png" alt="" />
                        </div>
                    </div>

                </div>

                <div className="couple">

                                            <div className="couple-head">

                            <div className="couple-head-wrap-1">
                                <h1 className="couple-title" data-aos="zoom-in" data-aos-duration="1000">The Wedding of</h1>                            </div>

                            <div className="couple-head-wrap-2">
                                <p className="couple-description" data-aos="fade-up" data-aos-duration="1000">We cordially invite you to the our wedding</p>                            </div>

                        </div>

                    <div
                        className="couple-body   show-picture  ">
                        <div className="couple-info groom">
                            <div className="couple-preview">

                                        <div className="couple-frame">

                                            <div className="orn-cp-8">
                                                <div className="image-wrap" data-aos="zoom-out" data-aos-duration="2100" data-aos-delay="1800">
                                                    <img src="/media/template/arsya/Orn-19.png" alt="Ornaments" />
                                                </div>
                                            </div>

                                            <div className="orn-cp-12">
                                                <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2100" data-aos-delay="1800">
                                                    <img src="/media/template/arsya/Orn-25.png" alt="Ornaments" />
                                                </div>
                                            </div>

                                            <div className="orn-cp-11">
                                                <div className="orn-cp-11-2">
                                                    <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2500" data-aos-delay="1800">
                                                        <img src="/media/template/arsya/Orn-05.png" alt="Ornaments" />
                                                    </div>
                                                </div>
                                                <div className="orn-cp-11-1">
                                                    <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2000" data-aos-delay="1800">
                                                        <img src="/media/template/arsya/Orn-24.png" alt="Ornaments" />
                                                    </div>
                                                </div>
                                                <div className="image-wrap" data-aos="zoom-out" data-aos-duration="2100" data-aos-delay="1800">
                                                    <img src="/media/template/arsya/Orn-23.png" alt="Ornaments" />
                                                </div>
                                            </div>

                                            <div className="orn-cp-10">
                                                <div className="image-wrap" data-aos="zoom-out" data-aos-duration="2100" data-aos-delay="1800">
                                                    <img src="/media/template/arsya/Orn-22.png" alt="Ornaments" />
                                                </div>
                                            </div>

                                            <div className="orn-cp-9">
                                                <div className="orn-cp-9-1">
                                                    <div className="image-wrap" data-aos="zoom-in" data-aos-duration="2100" data-aos-delay="1800">
                                                        <img src="/media/template/arsya/Orn-21.png" alt="Ornaments" />
                                                    </div>
                                                </div>
                                                <div className="image-wrap" data-aos="zoom-out" data-aos-duration="2100" data-aos-delay="1800">
                                                    <img src="/media/template/arsya/Orn-20.png" alt="Ornaments" />
                                                </div>
                                            </div>

                                            <div className="cp-frame-wrap">
                                                <div className="orn-cp-7">
                                                    <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2100"
                                                        data-aos-delay="1800">
                                                        <img src="/media/template/arsya/Orn-03.png" alt="Ornaments" />
                                                    </div>
                                                </div>
                                                <div className="orn-cp-4">
                                                    <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2100"
                                                        data-aos-delay="1800">
                                                        <img src="/media/template/arsya/Orn-15.png" alt="Ornaments" />
                                                    </div>
                                                </div>
                                                <div className="orn-cp-5">
                                                    <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2100"
                                                        data-aos-delay="1800">
                                                        <img src="/media/template/arsya/Orn-16.png" alt="Ornaments" />
                                                    </div>
                                                </div>

                                                <div className="orn-cp-6-1">
                                                    <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2300"
                                                        data-aos-delay="1900">
                                                        <img src="/media/template/arsya/Orn-18.png" alt="Ornaments" />
                                                    </div>
                                                </div>

                                                <div className="couple-picture-wrap">
                                                    <div className="couple-picture lightgallery" data-aos="zoom-out" data-aos-duration="1000" data-aos-once="false">
                                                        <a className="img-wrap" href={content.groomPhotoUrl} target="_blank">
                                                            <img className="img" src={content.groomPhotoUrl} alt="" />
                                                        </a>
                                                    </div>
                                                </div>

                                                <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1000">
                                                    <img src="/media/template/arsya/frame-couple.png" className="img-couple-frame" alt="Frame" />
                                                </div>

                                                <div className="orn-cp-6">
                                                    <div className="image-wrap" data-aos="zoom-in" data-aos-duration="2100"
                                                        data-aos-delay="1800">
                                                        <img src="/media/template/arsya/Orn-17.png" alt="Ornaments" />
                                                    </div>
                                                </div>

                                                <div className="orn-cp-3">
                                                    <div className="image-wrap" data-aos="zoom-in" data-aos-duration="2100"
                                                        data-aos-delay="1500">
                                                        <img src="/media/template/arsya/Orn-14.png" alt="Ornaments" />
                                                    </div>
                                                </div>
                                                <div className="orn-cp-1">
                                                    <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1300"
                                                        data-aos-delay="800">
                                                        <img src="/media/template/arsya/Orn-12.png" alt="Ornaments" />
                                                    </div>
                                                </div>
                                                <div className="orn-cp-2">
                                                    <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1700"
                                                        data-aos-delay="1000">
                                                        <img src="/media/template/arsya/Orn-13.png" alt="Ornaments" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="orn-cp-kupu kupu-1">
                                                <div className="image-wrap" data-aos="zoom-out" data-aos-duration="2100" data-aos-delay="1800">
                                                    <img src="/media/template/arsya/kupu-1.png" alt="Ornaments" />
                                                </div>
                                            </div>

                                        </div>

                                    </div>
                            <div className="couple-details">

                                <h2 className="couple-name" data-aos="fade-up" data-aos-duration="1000">{content.groomName}</h2>                                <p className="couple-parents" data-aos="fade-up" data-aos-duration="1000" dangerouslySetInnerHTML={{ __html: content.groomParentsText }} />
                                <div className="couple-link-wrap" data-aos="fade-up" data-aos-duration="1000">
                                        <a href={content.groomInstagram} target="_blank" className="couple-link"><i className="fab fa-instagram"></i> {instagramHandle(content.groomInstagram)}</a>
                                    </div>                            </div>
                        </div>

                                                    <div className="separator-wrap">
                                <div className="separator" data-aos="zoom-in" data-aos-duration="1500">
                                    <h2 className="couple-separator">&amp;</h2>
                                </div>
                            </div>

                                                    <div className="couple-info bride">
                                <div className="couple-preview">

                                            <div className="couple-frame">

                                                <div className="orn-cp-8">
                                                    <div className="image-wrap" data-aos="zoom-out" data-aos-duration="2100" data-aos-delay="1800">
                                                        <img src="/media/template/arsya/Orn-19.png" alt="Ornaments" />
                                                    </div>
                                                </div>

                                                <div className="orn-cp-12">
                                                    <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2100" data-aos-delay="1800">
                                                        <img src="/media/template/arsya/Orn-25.png" alt="Ornaments" />
                                                    </div>
                                                </div>

                                                <div className="orn-cp-11">
                                                    <div className="orn-cp-11-2">
                                                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2500" data-aos-delay="1800">
                                                            <img src="/media/template/arsya/Orn-05.png" alt="Ornaments" />
                                                        </div>
                                                    </div>
                                                    <div className="orn-cp-11-1">
                                                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2000" data-aos-delay="1800">
                                                            <img src="/media/template/arsya/Orn-24.png" alt="Ornaments" />
                                                        </div>
                                                    </div>
                                                    <div className="image-wrap" data-aos="zoom-out" data-aos-duration="2100" data-aos-delay="1800">
                                                        <img src="/media/template/arsya/Orn-23.png" alt="Ornaments" />
                                                    </div>
                                                </div>

                                                <div className="orn-cp-10">
                                                    <div className="image-wrap" data-aos="zoom-out" data-aos-duration="2100" data-aos-delay="1800">
                                                        <img src="/media/template/arsya/Orn-22.png" alt="Ornaments" />
                                                    </div>
                                                </div>

                                                <div className="orn-cp-9">
                                                    <div className="orn-cp-9-1">
                                                        <div className="image-wrap" data-aos="zoom-in" data-aos-duration="2100" data-aos-delay="1800">
                                                            <img src="/media/template/arsya/Orn-21.png" alt="Ornaments" />
                                                        </div>
                                                    </div>
                                                    <div className="image-wrap" data-aos="zoom-out" data-aos-duration="2100" data-aos-delay="1800">
                                                        <img src="/media/template/arsya/Orn-20.png" alt="Ornaments" />
                                                    </div>
                                                </div>

                                                <div className="cp-frame-wrap">

                                                    <div className="orn-cp-7">
                                                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2100"
                                                            data-aos-delay="1800">
                                                            <img src="/media/template/arsya/Orn-03.png" alt="Ornaments" />
                                                        </div>
                                                    </div>
                                                    <div className="orn-cp-4">
                                                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2100"
                                                            data-aos-delay="1800">
                                                            <img src="/media/template/arsya/Orn-15.png" alt="Ornaments" />
                                                        </div>
                                                    </div>
                                                    <div className="orn-cp-5">
                                                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2100"
                                                            data-aos-delay="1800">
                                                            <img src="/media/template/arsya/Orn-16.png" alt="Ornaments" />
                                                        </div>
                                                    </div>

                                                    <div className="orn-cp-6-1">
                                                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2300"
                                                            data-aos-delay="1900">
                                                            <img src="/media/template/arsya/Orn-18.png" alt="Ornaments" />
                                                        </div>
                                                    </div>

                                                    <div className="couple-picture-wrap">
                                                        <div className="couple-picture lightgallery" data-aos="zoom-out" data-aos-duration="1000" data-aos-once="false">
                                                            <a className="img-wrap" href={content.bridePhotoUrl} target="_blank">
                                                                <img className="img" src={content.bridePhotoUrl} alt="" />
                                                            </a>
                                                        </div>
                                                    </div>

                                                    <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1000">
                                                        <img src="/media/template/arsya/frame-couple.png" className="img-couple-frame" alt="Frame" />
                                                    </div>

                                                    <div className="orn-cp-6">
                                                        <div className="image-wrap" data-aos="zoom-in" data-aos-duration="2100"
                                                            data-aos-delay="1800">
                                                            <img src="/media/template/arsya/Orn-17.png" alt="Ornaments" />
                                                        </div>
                                                    </div>

                                                    <div className="orn-cp-3">
                                                        <div className="image-wrap" data-aos="zoom-in" data-aos-duration="2100"
                                                            data-aos-delay="1500">
                                                            <img src="/media/template/arsya/Orn-14.png" alt="Ornaments" />
                                                        </div>
                                                    </div>
                                                    <div className="orn-cp-1">
                                                        <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1300"
                                                            data-aos-delay="800">
                                                            <img src="/media/template/arsya/Orn-12.png" alt="Ornaments" />
                                                        </div>
                                                    </div>
                                                    <div className="orn-cp-2">
                                                        <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1700"
                                                            data-aos-delay="1000">
                                                            <img src="/media/template/arsya/Orn-13.png" alt="Ornaments" />
                                                        </div>
                                                    </div>

                                                </div>

                                                <div className="orn-cp-kupu kupu-1">
                                                    <div className="image-wrap" data-aos="zoom-out" data-aos-duration="2100" data-aos-delay="1800">
                                                        <img src="/media/template/arsya/kupu-1.png" alt="Ornaments" />
                                                    </div>
                                                </div>

                                            </div>

                                        </div>
                                <div className="couple-details">

                                    <h2 className="couple-name" data-aos="fade-up" data-aos-duration="1000">{content.brideName}</h2>                                    <p className="couple-parents" data-aos="fade-up" data-aos-duration="1000" dangerouslySetInnerHTML={{ __html: content.brideParentsText }} />
                                    <div className="couple-link-wrap" data-aos="fade-up" data-aos-duration="1000">
                                            <a href={content.brideInstagram} target="_blank" className="couple-link"><i className="fab fa-instagram"></i> {instagramHandle(content.brideInstagram)}</a>
                                        </div>                                </div>
                            </div>
                                            </div>

                </div>
            </section>
    );
}
