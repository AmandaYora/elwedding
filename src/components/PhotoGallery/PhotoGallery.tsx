export default function PhotoGallery() {
    return (
        <section className="photo-wrap" data-section-order="gallery_photo">

            <div className="photo-inner">

                <div className="photo-head">
                    <h1 className="photo-title" data-aos="fade-up" data-aos-duration="1200">Potraits of Love</h1>
                </div>

                <div className="photo-body">

                    <div className="photo-nav-wrap">

                        {/* Slider */}
                        <div className="photo-nav" data-aos="fade-up" data-aos-duration="1200">
                            <div className="photo-item ">
                                <div className="photo-img-wrap lightgallery">
                                    <a href="/media/photos/photo-18.webp" className="photo-link">
                                        <img src="/media/photos/photo-01.webp" alt="Gallery"
                                            className="photo-img" />
                                    </a>
                                </div>
                            </div>
                            <div className="photo-item ">
                                <div className="photo-img-wrap lightgallery">
                                    <a href="/media/photos/photo-06.webp" className="photo-link">
                                        <img src="/media/photos/photo-24.webp" alt="Gallery"
                                            className="photo-img" />
                                    </a>
                                </div>
                            </div>
                            <div className="photo-item ">
                                <div className="photo-img-wrap lightgallery">
                                    <a href="/media/photos/photo-23.webp" className="photo-link">
                                        <img src="/media/photos/photo-22.webp" alt="Gallery"
                                            className="photo-img" />
                                    </a>
                                </div>
                            </div>
                            <div className="photo-item ">
                                <div className="photo-img-wrap lightgallery">
                                    <a href="/media/photos/photo-07.webp" className="photo-link">
                                        <img src="/media/photos/photo-10.webp" alt="Gallery"
                                            className="photo-img" />
                                    </a>
                                </div>
                            </div>
                            <div className="photo-item ">
                                <div className="photo-img-wrap lightgallery">
                                    <a href="/media/photos/photo-19.webp" className="photo-link">
                                        <img src="/media/photos/photo-11.webp" alt="Gallery"
                                            className="photo-img" />
                                    </a>
                                </div>
                            </div>
                            <div className="photo-item ">
                                <div className="photo-img-wrap lightgallery">
                                    <a href="/media/photos/photo-16.webp" className="photo-link">
                                        <img src="/media/photos/photo-15.webp" alt="Gallery"
                                            className="photo-img" />
                                    </a>
                                </div>
                            </div>
                            <div className="photo-item ">
                                <div className="photo-img-wrap lightgallery">
                                    <a href="/media/photos/photo-09.webp" className="photo-link">
                                        <img src="/media/photos/photo-27.webp" alt="Gallery"
                                            className="photo-img" />
                                    </a>
                                </div>
                            </div>
                            <div className="photo-item ">
                                <div className="photo-img-wrap lightgallery">
                                    <a href="/media/photos/photo-04.webp" className="photo-link">
                                        <img src="/media/photos/photo-03.webp" alt="Gallery"
                                            className="photo-img" />
                                    </a>
                                </div>
                            </div>
                            <div className="photo-item ">
                                <div className="photo-img-wrap lightgallery">
                                    <a href="/media/photos/photo-14.webp" className="photo-link">
                                        <img src="/media/photos/photo-02.webp" alt="Gallery"
                                            className="photo-img" />
                                    </a>
                                </div>
                            </div>
                        </div>

                    </div>

                    <div className="photo-slider-wrap">
                        {/* Slider */}
                        <div className="photo-slider" data-aos="fade-up" data-aos-duration="1200">
                            <div className="photo-item ">
                                <div className="photo-img-wrap">
                                    <img src="/media/photos/photo-01.webp" alt="Gallery"
                                        className="photo-img " />
                                </div>
                            </div>
                            <div className="photo-item ">
                                <div className="photo-img-wrap">
                                    <img src="/media/photos/photo-24.webp" alt="Gallery"
                                        className="photo-img " />
                                </div>
                            </div>
                            <div className="photo-item ">
                                <div className="photo-img-wrap">
                                    <img src="/media/photos/photo-22.webp" alt="Gallery"
                                        className="photo-img " />
                                </div>
                            </div>
                            <div className="photo-item ">
                                <div className="photo-img-wrap">
                                    <img src="/media/photos/photo-10.webp" alt="Gallery"
                                        className="photo-img " />
                                </div>
                            </div>
                            <div className="photo-item ">
                                <div className="photo-img-wrap">
                                    <img src="/media/photos/photo-11.webp" alt="Gallery"
                                        className="photo-img " />
                                </div>
                            </div>
                            <div className="photo-item ">
                                <div className="photo-img-wrap">
                                    <img src="/media/photos/photo-15.webp" alt="Gallery"
                                        className="photo-img " />
                                </div>
                            </div>
                            <div className="photo-item ">
                                <div className="photo-img-wrap">
                                    <img src="/media/photos/photo-27.webp" alt="Gallery"
                                        className="photo-img " />
                                </div>
                            </div>
                            <div className="photo-item ">
                                <div className="photo-img-wrap">
                                    <img src="/media/photos/photo-03.webp" alt="Gallery"
                                        className="photo-img " />
                                </div>
                            </div>
                            <div className="photo-item ">
                                <div className="photo-img-wrap">
                                    <img src="/media/photos/photo-02.webp" alt="Gallery"
                                        className="photo-img " />
                                </div>
                            </div>
                        </div>

                        {/* Slider Nav */}
                        <button className="photo-arrow next">
                            <svg width="108" height="198" viewBox="0 0 108 198" fill="none"
                                xmlns="http://www.w3.org/2000/svg">
                                <path d="M8 190L100 99L8 8" stroke="black" strokeWidth="15" strokeLinecap="round"
                                    strokeLinejoin="round" />
                            </svg>
                        </button>
                        <button className="photo-arrow prev">
                            <svg width="108" height="198" viewBox="0 0 108 198" fill="none"
                                xmlns="http://www.w3.org/2000/svg">
                                <path d="M100 190L8 99L100 8" stroke="black" strokeWidth="15" strokeLinecap="round"
                                    strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>

                </div>
            </div>

        </section>
    );
}
