import type { GalleryPhoto } from '@/types/api'

interface PhotoGalleryProps {
  photos: GalleryPhoto[]
}

export default function PhotoGallery({ photos }: PhotoGalleryProps) {
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
                            {photos.map((photo) => (
                                <div className="photo-item " key={photo.id}>
                                    <div className="photo-img-wrap lightgallery">
                                        <a href={photo.photoUrl} className="photo-link">
                                            <img src={photo.thumbUrl} alt="Gallery"
                                                className="photo-img"  loading="lazy" decoding="async" />
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>

                    <div className="photo-slider-wrap">
                        {/* Slider */}
                        <div className="photo-slider" data-aos="fade-up" data-aos-duration="1200">
                            {photos.map((photo) => (
                                <div className="photo-item " key={photo.id}>
                                    <div className="photo-img-wrap">
                                        <img src={photo.thumbUrl} alt="Gallery"
                                            className="photo-img "  loading="lazy" decoding="async" />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Slider Nav */}
                        <button className="photo-arrow next" aria-label="Foto selanjutnya">
                            <svg aria-hidden="true" width="108" height="198" viewBox="0 0 108 198" fill="none"
                                xmlns="http://www.w3.org/2000/svg">
                                <path d="M8 190L100 99L8 8" stroke="black" strokeWidth="15" strokeLinecap="round"
                                    strokeLinejoin="round" />
                            </svg>
                        </button>
                        <button className="photo-arrow prev" aria-label="Foto sebelumnya">
                            <svg aria-hidden="true" width="108" height="198" viewBox="0 0 108 198" fill="none"
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
