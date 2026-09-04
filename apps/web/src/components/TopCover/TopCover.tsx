import { useGuestSession } from '@/hooks/useGuestSession'
import type { InvitationContent } from '@/types/api'

interface TopCoverProps {
  content: InvitationContent
}

export default function TopCover({ content }: TopCoverProps) {
    // Hook dipanggil LANGSUNG di sini (D5), mengikuti pola RsvpConfirmation -
    // bukan dialirkan sebagai prop lewat SectionRegistry/App.tsx. Request-nya
    // tidak berlipat karena useGuestSession memoisasi promise per token (D6).
    const session = useGuestSession()
    // WAJIB pakai `resolved`, JANGAN mencetak session.name apa adanya:
    // fallback-nya adalah "Tamu Undangan", sedangkan teks tanpa token harus
    // tetap "Dear Mr/Mrs/Ms" (K7). Ini juga menutup jendela "token ada tapi
    // fetch belum selesai", yang kalau tidak dijaga akan sempat menampilkan
    // "Dear Tamu Undangan" sekejap.
    const greeting = session.resolved ? session.name : 'Mr/Mrs/Ms'

    return (
        <section className="top-cover" data-section-order="opening_cover">

            <div className="ornaments-wrapper">
                <div className="orn-tc-1">
                    <div className="image-wrap" data-aos="zoom-out-up" data-aos-duration="2400" data-aos-delay="1100">
                        <img src="/media/template/arsya/Orn-45.webp" width="840" height="518" alt="" />
                    </div>
                    <div className="orn-tc-1-1">
                        <div className="image-wrap" data-aos="zoom-out-up" data-aos-duration="2800" data-aos-delay="2600">
                            <img src="/media/template/arsya/Orn-55.webp" width="1000" height="451" alt="" />
                        </div>
                    </div>
                </div>

                <div className="orn-ff-2 right">
                    <div className="image-wrap" data-aos="fade-right" data-aos-duration="4200" data-aos-delay="4000">
                        <img src="/media/template/arsya/Orn-25.webp" width="600" height="770" alt="Ornaments" />
                    </div>
                </div>
                <div className="orn-ff-2 left">
                    <div className="image-wrap" data-aos="fade-right" data-aos-duration="4200" data-aos-delay="4000">
                        <img src="/media/template/arsya/Orn-25.webp" width="600" height="770" alt="Ornaments" />
                    </div>
                </div>

                <div className="orn-lv-4 right">
                    <div className="image-wrap" data-aos="fade-down-right" data-aos-duration="4000" data-aos-delay="3100">
                        <img src="/media/template/arsya/Orn-46.webp" width="1000" height="1040" alt="Ornaments" />
                    </div>
                </div>

                <div className="orn-lv-4 left">
                    <div className="image-wrap" data-aos="fade-down-right" data-aos-duration="4000" data-aos-delay="3100">
                        <img src="/media/template/arsya/Orn-46.webp" width="1000" height="1040" alt="Ornaments" />
                    </div>
                </div>

                <div className="orn-cphead-2 left">
                    <div className="image-wrap" data-aos="zoom-in-down" data-aos-duration="3900" data-aos-delay="4200">
                        <img src="/media/template/arsya/Orn-11.webp" width="600" height="695" alt="" />
                    </div>
                </div>

                <div className="orn-cphead-2 right">
                    <div className="image-wrap" data-aos="zoom-in-down" data-aos-duration="3900" data-aos-delay="4200">
                        <img src="/media/template/arsya/Orn-11.webp" width="600" height="695" alt="" />
                    </div>
                </div>
            </div>

            <div className="ornaments-wrapper">
                <div className="orn-ff-1 left">
                    <div className="orn-ff-1-3">
                        <div className="orn-ff-1-3-3">
                            <div className="image-wrap" data-aos="zoom-in-left" data-aos-duration="3100" data-aos-delay="3600">
                                <img src="/media/template/arsya/Orn-28.webp" width="400" height="954" alt="" />
                            </div>
                        </div>
                        <div className="orn-ff-1-3-1">
                            <div className="orn-ff-1-3-2">
                                <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="3400" data-aos-delay="3200">
                                    <img src="/media/template/arsya/Orn-07.webp" width="400" height="1114" alt="" />
                                </div>
                            </div>
                            <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="3100" data-aos-delay="2900">
                                <img src="/media/template/arsya/Orn-05.webp" width="400" height="1019" alt="" />
                            </div>
                        </div>
                        <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2900" data-aos-delay="2200">
                            <img src="/media/template/arsya/Orn-08.webp" width="400" height="993" alt="" />
                        </div>
                    </div>

                    <div className="orn-ff-1-2">
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2600" data-aos-delay="2000">
                            <img src="/media/template/arsya/Orn-03.webp" width="400" height="841" alt="" />
                        </div>
                    </div>
                    <div className="image-wrap" data-aos="fade-up-right" data-aos-duration="2400" data-aos-delay="1500">
                        <img src="/media/template/arsya/Orn-39.webp" width="400" height="329" alt="" />
                    </div>
                    <div className="orn-ff-1-1">
                        <div className="image-wrap" data-aos="fade-up-right" data-aos-duration="3000" data-aos-delay="3000">
                            <img src="/media/template/arsya/Orn-50.webp" width="405" height="379" alt="" />
                        </div>
                    </div>
                </div>
                <div className="orn-ff-1 right">
                    <div className="orn-ff-1-3">
                        <div className="orn-ff-1-3-3">
                            <div className="image-wrap" data-aos="zoom-in-left" data-aos-duration="3100" data-aos-delay="3600">
                                <img src="/media/template/arsya/Orn-28.webp" width="400" height="954" alt="" />
                            </div>
                        </div>
                        <div className="orn-ff-1-3-1">
                            <div className="orn-ff-1-3-2">
                                <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="3400" data-aos-delay="3200">
                                    <img src="/media/template/arsya/Orn-07.webp" width="400" height="1114" alt="" />
                                </div>
                            </div>
                            <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="3100" data-aos-delay="2900">
                                <img src="/media/template/arsya/Orn-05.webp" width="400" height="1019" alt="" />
                            </div>
                        </div>
                        <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2900" data-aos-delay="2200">
                            <img src="/media/template/arsya/Orn-08.webp" width="400" height="993" alt="" />
                        </div>
                    </div>

                    <div className="orn-ff-1-2">
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2600" data-aos-delay="2000">
                            <img src="/media/template/arsya/Orn-03.webp" width="400" height="841" alt="" />
                        </div>
                    </div>
                    <div className="image-wrap" data-aos="fade-up-right" data-aos-duration="2400" data-aos-delay="1500">
                        <img src="/media/template/arsya/Orn-39.webp" width="400" height="329" alt="" />
                    </div>
                    <div className="orn-ff-1-1">
                        <div className="image-wrap" data-aos="fade-up-right" data-aos-duration="3000" data-aos-delay="3000">
                            <img src="/media/template/arsya/Orn-50.webp" width="405" height="379" alt="" />
                        </div>
                    </div>
                </div>
            </div>

            <div className=" inner">

                <div className="head-tc">
                    <div data-aos="zoom-in" data-aos-duration="3400" data-aos-delay="3000">
                                            </div>
                    <h1 className="top-cover-title no-scrollbar" data-aos="zoom-in" data-aos-duration="3400" data-aos-delay="3000" id="trig-tc">{content.groomName} <br />
&amp; <br />
{content.brideName}</h1>
                </div>

                <div className=" details">

                                            <p data-aos="fade-up" data-aos-duration="3400" data-aos-delay="3000" style={{}}>
                            Dear {greeting}                        </p>


                    <div className="link-wrap" data-aos="fade-up" data-aos-duration="3400" data-aos-delay="3000">
                        <a href="javascript:;" onClick={() => window.startTheJourney?.()} className="link" id="startToExplore">
                            Open Invitation</a>
                    </div>

                </div>
            </div>

            <div className="ornaments-wrapper"></div>


        </section>
    );
}
