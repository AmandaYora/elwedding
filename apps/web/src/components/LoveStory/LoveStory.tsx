import type { LoveStoryChapter } from '@/types/api'

interface LoveStoryProps {
  chapters: LoveStoryChapter[]
}

export default function LoveStory({ chapters }: LoveStoryProps) {
    return (
        <section className="love-story-wrap" data-section-order="love_story">

            <div className="love-story-inner">

                <div className="ornaments-wrapper">
                    <div className="orn-ls-bg">
                        <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1900" data-aos-delay="2900">
                            <img src="/media/template/arsya/bg-gift.webp" width="840" height="1064" alt=""  loading="lazy" decoding="async" />
                        </div>
                    </div>
                </div>

                <div className="love-story-head">
                    <h1 className="love-story-title">Our Story</h1>
                </div>

                <div className="love-story-body">
                    <div className="ornaments-wrapper">

                        <div className="orn-ls-2 right">
                            <div className="orn-ls-2-2">
                                <div className="image-wrap" data-aos="zoom-in-left" data-aos-duration="1900" data-aos-delay="2900">
                                    <img src="/media/template/arsya/Orn-05.webp" width="400" height="1019" alt=""  loading="lazy" decoding="async" />
                                </div>
                            </div>
                            <div className="orn-ls-2-1">
                                <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="1900" data-aos-delay="2700">
                                    <img src="/media/template/arsya/Orn-08.webp" width="400" height="993" alt=""  loading="lazy" decoding="async" />
                                </div>
                            </div>
                            <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="1900" data-aos-delay="2100">
                                <img src="/media/template/arsya/Orn-03.webp" width="400" height="841" alt=""  loading="lazy" decoding="async" />
                            </div>
                        </div>
                        <div className="orn-ls-2 left">
                            <div className="orn-ls-2-2">
                                <div className="image-wrap" data-aos="zoom-in-left" data-aos-duration="1900" data-aos-delay="2900">
                                    <img src="/media/template/arsya/Orn-05.webp" width="400" height="1019" alt=""  loading="lazy" decoding="async" />
                                </div>
                            </div>
                            <div className="orn-ls-2-1">
                                <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="1900" data-aos-delay="2700">
                                    <img src="/media/template/arsya/Orn-08.webp" width="400" height="993" alt=""  loading="lazy" decoding="async" />
                                </div>
                            </div>
                            <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="1900" data-aos-delay="2100">
                                <img src="/media/template/arsya/Orn-03.webp" width="400" height="841" alt=""  loading="lazy" decoding="async" />
                            </div>
                        </div>

                    </div>
                    {/* Story Chitra Wrap */}
                    <div className="story-chitra__slider-wrap">
                        {/* Story Chitra Slider For */}
                        <div className="story-chitra__slider-for">
                            {chapters.map((chapter) => (
                                <div className="story-chitra__silder-for__item-wrap" key={chapter.id}>
                                    <div className="story-chitra__slider-for__item">
                                        <img src={chapter.photoUrl} alt=""  loading="lazy" decoding="async" />
                                    </div>
                                    <div className="story-chitra__content">
                                        <h2 className="story-chitra__title" data-aos="fade-up" data-aos-duration="1000">{chapter.title}</h2>
                                        <p className="story-chitra__caption" data-aos="fade-up" data-aos-duration="1000">{chapter.caption}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Story Chitra Slider Nav */}
                        <div className="story-chitra__slider-nav" data-aos="fade-up" data-aos-duration="1200">
                            {chapters.map((chapter, index) => (
                                <div className="story-chitra__slider-nav__item__manual" data-slick-index={index} key={chapter.id}></div>
                            ))}
                        </div>
                    </div>

                    <button className="story-chitra__arrow-btn prev" aria-label="Cerita sebelumnya">
                        <svg aria-hidden="true" width="108" height="198" viewBox="0 0 108 198" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M100 190L8 99L100 8" stroke="black" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    <button className="story-chitra__arrow-btn next" aria-label="Cerita selanjutnya">
                        <svg aria-hidden="true" width="108" height="198" viewBox="0 0 108 198" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 190L100 99L8 8" stroke="black" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                <div className="ornaments-wrapper"></div>
            </div>

            <div className="ornaments-wrapper">

                <div className="orn-ls-1 right">
                    <div className="orn-ls-1-2">
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="2200">
                            <img src="/media/template/arsya/Orn-56.webp" width="600" height="663" alt=""  loading="lazy" decoding="async" />
                        </div>
                    </div>
                    <div className="orn-ls-1-1">
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="1800">
                            <img src="/media/template/arsya/Orn-21.webp" width="381" height="312" alt=""  loading="lazy" decoding="async" />
                        </div>
                    </div>
                    <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1500" data-aos-delay="1000">
                        <img src="/media/template/arsya/Orn-26.webp" width="400" height="304" alt=""  loading="lazy" decoding="async" />
                    </div>
                </div>
                <div className="orn-ls-1 left">
                    <div className="orn-ls-1-2">
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="2200">
                            <img src="/media/template/arsya/Orn-56.webp" width="600" height="663" alt=""  loading="lazy" decoding="async" />
                        </div>
                    </div>
                    <div className="orn-ls-1-1">
                        <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="1800">
                            <img src="/media/template/arsya/Orn-21.webp" width="381" height="312" alt=""  loading="lazy" decoding="async" />
                        </div>
                    </div>
                    <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1500" data-aos-delay="1000">
                        <img src="/media/template/arsya/Orn-26.webp" width="400" height="304" alt=""  loading="lazy" decoding="async" />
                    </div>
                </div>

            </div>

        </section>
    );
}
