import type { InvitationContent, WeddingGiftBank } from '@/types/api'

interface WeddingGiftProps {
  content: InvitationContent
  banks: WeddingGiftBank[]
}

export default function WeddingGift({ content, banks }: WeddingGiftProps) {
    return (
        <div data-section-order="wedding_gift">
            {/* WEDDING GIFT */}
            <section className="wedding-gift-outer">

                <div className="ornaments-wrapper">

                    <div className="orn-wg-3 center">
                        <div className="image-wrap" data-aos="zoom-out-up" data-aos-duration="2800" data-aos-delay="3000">
                            <picture>
                                <source media="(min-width:561px)" srcSet="/media/template/arsya/Orn-57.webp" />
                                <img src="/media/template/arsya/Orn-44.webp" width="840" height="1373" alt="Ornaments"  loading="lazy" decoding="async" />
                            </picture>
                        </div>
                    </div>
                    <div className="orn-wg-2 left">
                        <div className="orn-wg-2-1">
                            <div className="orn-wg-2-2">
                                <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2000" data-aos-delay="2200">
                                    <img src="/media/template/arsya/Orn-05.webp" width="400" height="1019" alt=""  loading="lazy" decoding="async" />
                                </div>
                            </div>
                            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2000" data-aos-delay="1700">
                                <img src="/media/template/arsya/Orn-16.webp" width="288" height="441" alt=""  loading="lazy" decoding="async" />
                            </div>
                        </div>
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2000" data-aos-delay="1200">
                            <img src="/media/template/arsya/Orn-21.webp" width="381" height="312" alt=""  loading="lazy" decoding="async" />
                        </div>
                    </div>
                    <div className="orn-wg-2 right">
                        <div className="orn-wg-2-1">
                            <div className="orn-wg-2-2">
                                <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2000" data-aos-delay="2200">
                                    <img src="/media/template/arsya/Orn-05.webp" width="400" height="1019" alt=""  loading="lazy" decoding="async" />
                                </div>
                            </div>
                            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2000" data-aos-delay="1700">
                                <img src="/media/template/arsya/Orn-16.webp" width="288" height="441" alt=""  loading="lazy" decoding="async" />
                            </div>
                        </div>
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2000" data-aos-delay="1200">
                            <img src="/media/template/arsya/Orn-21.webp" width="381" height="312" alt=""  loading="lazy" decoding="async" />
                        </div>
                    </div>

                </div>
                <section className="wedding-gift-wrap ">
                    <div className="wedding-gift-inner">

                        <div className="wedding-gift-head">
                            <h1 className="wedding-gift-title" data-aos="zoom-in" data-aos-duration="1500">
                                Wedding Gift
                            </h1>
                            <p className="wedding-gift-description" data-aos="fade-up" data-aos-duration="1000">
                                {content.weddingGiftDescription}
                            </p>
                        </div>

                        <div className="wedding-gift-body-wrap">

                            <div className="wedding-gift-body ">
                                <div className="wedding-gift-body-inner">

                                    <div className="wedding-gift-form">
                                        <div id="weddingGiftForm">

                                            {/* Details */}
                                            <div className="wedding-gift-details wedding-gift__first-slide wedding-gift-slide">

                                                {/* Bank Wrap */}
                                                <div className="wedding-gift-bank-wrap" data-aos="fade-up" data-aos-duration="1600" data-aos-delay="1200">
                                                    {banks.map((bank, index) => (
                                                        <div className="bank-item-wrap acr-item" key={bank.id}>
                                                            <div className={`bank-btn-top${index === 0 ? ' active' : ''}`}>
                                                                <p className="bank-btop-txt">
                                                                    {bank.bankName}
                                                                </p>
                                                                <i className="ph-fill ph-control" aria-hidden="true"></i>
                                                            </div>
                                                            <div className="bank-item no-pict-bank" id={`savingBook${bank.id}`}>
                                                                <div className="ornaments-wrapper"></div>
                                                                <div className="bg-bank"></div>
                                                                <div className="bank-detail-wrap">

                                                                    <div className="bank-detail">
                                                                        <h3 className="bank-name" data-aos="zoom-in" data-aos-duration="1000" data-aos-delay="700">{bank.bankName}</h3>
                                                                        <div className="bank-account-number-wrap" data-aos="zoom-in" data-aos-duration="1000" data-aos-delay="1000">
                                                                            <p className="bank-account-number-label" data-aos="zoom-in" data-aos-duration="1000" data-aos-delay="800">Account Number : <span className="bank-account-number">{bank.accountNumber}</span></p>
                                                                            <button type="button" className="bank-copy" data-copy={bank.accountNumber} aria-label="Salin nomor rekening"><i className="ph ph-copy-simple" aria-hidden="true"></i></button>
                                                                        </div>
                                                                        <p className="bank-account-name-label" data-aos="zoom-in" data-aos-duration="1000" data-aos-delay="900">Account Name : <span className="bank-account-name">{bank.accountName}</span></p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>


                                                <div className="ornaments-wrapper"></div>

                                            </div>


                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                <div className="ornaments-wrapper">

                    <div className="orn-wg-1 left">
                        <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2000" data-aos-delay="1200">
                            <img src="/media/template/arsya/Orn-20.webp" width="534" height="357" alt=""  loading="lazy" decoding="async" />
                        </div>
                    </div>
                    <div className="orn-wg-1 right">
                        <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2000" data-aos-delay="1200">
                            <img src="/media/template/arsya/Orn-20.webp" width="534" height="357" alt=""  loading="lazy" decoding="async" />
                        </div>
                    </div>

                </div>
            </section>

            {/* HADIAH KADO */}
            <section className="gift-section-wrap">

                <div className="ornaments-wrapper">
                    <div className="orn-kd-2 right">
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2500" data-aos-delay="600">
                            <img src="/media/template/arsya/Orn-32.webp" width="600" height="1013" alt=""  loading="lazy" decoding="async" />
                        </div>
                    </div>
                    <div className="orn-kd-2 left">
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2500" data-aos-delay="600">
                            <img src="/media/template/arsya/Orn-32.webp" width="600" height="1013" alt=""  loading="lazy" decoding="async" />
                        </div>
                    </div>
                </div>

                <div id="wedding-gifts" className="container wedding-gifts-wrap">

                </div>

                <div className="ornaments-wrapper">
                    <div className="orn-cover-2 left">
                        <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2200" data-aos-delay="1300">
                            <img src="/media/template/arsya/Orn-07.webp" width="400" height="1114" alt=""  loading="lazy" decoding="async" />
                        </div>
                        <div className="orn-cover-2-1">
                            <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="1700" data-aos-delay="800">
                                <img src="/media/template/arsya/Orn-08.webp" width="400" height="993" alt=""  loading="lazy" decoding="async" />
                            </div>
                        </div>
                    </div>
                    <div className="orn-cover-2 right">
                        <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2200" data-aos-delay="1300">
                            <img src="/media/template/arsya/Orn-07.webp" width="400" height="1114" alt=""  loading="lazy" decoding="async" />
                        </div>
                        <div className="orn-cover-2-1">
                            <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="1700" data-aos-delay="800">
                                <img src="/media/template/arsya/Orn-08.webp" width="400" height="993" alt=""  loading="lazy" decoding="async" />
                            </div>
                        </div>
                    </div>

                    <div className="orn-kd-1 right">
                        <div className="orn-kd-1-2">
                            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2100" data-aos-delay="1500">
                                <img src="/media/template/arsya/Orn-28.webp" width="400" height="954" alt=""  loading="lazy" decoding="async" />
                            </div>
                        </div>
                        <div className="orn-kd-1-1">
                            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1700" data-aos-delay="900">
                                <img src="/media/template/arsya/Orn-27.webp" width="312" height="543" alt=""  loading="lazy" decoding="async" />
                            </div>
                        </div>
                        <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1500" data-aos-delay="600">
                            <img src="/media/template/arsya/Orn-26.webp" width="400" height="304" alt=""  loading="lazy" decoding="async" />
                        </div>
                    </div>
                    <div className="orn-kd-1 left">
                        <div className="orn-kd-1-2">
                            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2100" data-aos-delay="1500">
                                <img src="/media/template/arsya/Orn-28.webp" width="400" height="954" alt=""  loading="lazy" decoding="async" />
                            </div>
                        </div>
                        <div className="orn-kd-1-1">
                            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1700" data-aos-delay="900">
                                <img src="/media/template/arsya/Orn-27.webp" width="312" height="543" alt=""  loading="lazy" decoding="async" />
                            </div>
                        </div>
                        <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1500" data-aos-delay="600">
                            <img src="/media/template/arsya/Orn-26.webp" width="400" height="304" alt=""  loading="lazy" decoding="async" />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
