import type { InvitationContent } from '@/types/api'

interface InstagramFilterProps {
  content: InvitationContent
}

export default function InstagramFilter({ content }: InstagramFilterProps) {
  return (
    <section className="ig-filter-wrap" data-section-order="filter_instagram">

      <div className="ornaments-wrapper">
        <div className="orn-ig-bg">
          <div className="image-wrap" data-aos="zoom-out-up" data-aos-duration="2300" data-aos-delay="500">
            <img src="/media/template/arsya/Orn-31.webp" width="840" height="763" alt="Ornaments"  loading="lazy" decoding="async" />
          </div>
        </div>
        <div className="orn-ig-2 right">
          <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="600">
            <img src="/media/template/arsya/Orn-32.webp" width="600" height="1013" alt=""  loading="lazy" decoding="async" />
          </div>
        </div>
        <div className="orn-ig-2 left">
          <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="600">
            <img src="/media/template/arsya/Orn-32.webp" width="600" height="1013" alt=""  loading="lazy" decoding="async" />
          </div>
        </div>
        <div className="orn-ig-3 right">
          <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="600">
            <img src="/media/template/arsya/Orn-33.webp" width="600" height="377" alt=""  loading="lazy" decoding="async" />
          </div>
        </div>
        <div className="orn-ig-3 left">
          <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="600">
            <img src="/media/template/arsya/Orn-33.webp" width="600" height="377" alt=""  loading="lazy" decoding="async" />
          </div>
        </div>
        <div className="orn-lv-3">
          <div className="image-wrap" data-aos="fade-up" data-aos-duration="2300" data-aos-delay="500">
            <img src="/media/template/arsya/Orn-23.webp" width="600" height="293" alt="Ornaments"  loading="lazy" decoding="async" />
          </div>
        </div>
      </div>

      <div className="ig-filter">

        <div className="ig-filter-head">
          <h2 className="ig-filter-title" data-aos="fade-up" data-aos-duration="1200">
            {content.instagramFilterTitle}
          </h2>

          <p className="ig-filter-caption" data-aos="fade-up" data-aos-duration="1200" data-aos-delay="200">
            {content.instagramFilterCaption}
          </p>
        </div>
        <div className="ig-filter-body">

          <div className="p-relative ig-preview-outer" data-aos="fade-up" data-aos-duration="1500" data-aos-delay="1000">
            <div className="ornaments-wrapper"></div>

            <div className="ig-filter-img-wrap">

              <img className="ig-filter-img" src={content.instagramFilterPreviewPhotoUrl}
                alt="Instagram Filter Preview"  loading="lazy" decoding="async" />

            </div>

            <div className="ornaments-wrapper"></div>
          </div>
          <div className="ig-filter-link-wrap" data-aos="fade-up" data-aos-duration="1200"
            data-aos-delay="400">
            <a className="ig-filter-link" href={content.instagramFilterLink}
              target="_blank">Use Filter</a>
          </div>
        </div>
      </div>

      <div className="ornaments-wrapper">
        <div className="orn-ig-1 right">
          <div className="orn-ig-1-2">
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2100" data-aos-delay="1500">
              <img src="/media/template/arsya/Orn-28.webp" width="400" height="954" alt=""  loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="orn-ig-1-1">
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1700" data-aos-delay="900">
              <img src="/media/template/arsya/Orn-27.webp" width="312" height="543" alt=""  loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1500" data-aos-delay="600">
            <img src="/media/template/arsya/Orn-26.webp" width="400" height="304" alt=""  loading="lazy" decoding="async" />
          </div>
        </div>
        <div className="orn-ig-1 left">
          <div className="orn-ig-1-2">
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2100" data-aos-delay="1500">
              <img src="/media/template/arsya/Orn-28.webp" width="400" height="954" alt=""  loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="orn-ig-1-1">
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
  )
}
