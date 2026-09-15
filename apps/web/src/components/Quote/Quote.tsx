import type { InvitationContent } from '@/types/api'

interface QuoteProps {
  content: InvitationContent
}

export default function Quote({ content }: QuoteProps) {
  return (
    <section className="quote-wrap" data-section-order="quote">

      <div className="ornaments-wrapper">
        <div className="orn-quote-1">
          <div className="image-wrap" data-aos="zoom-out" data-aos-duration="750" data-aos-delay="500">
            <img src="/media/template/arsya/Orn-55.webp" width="1000" height="451" alt=""  loading="lazy" decoding="async" />
          </div>
        </div>
        <div className="orn-quote-3 right">
          <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="750" data-aos-delay="700">
            <img src="/media/template/arsya/Orn-25.webp" width="600" height="770" alt=""  loading="lazy" decoding="async" />
          </div>
        </div>
        <div className="orn-quote-3 left">
          <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="750" data-aos-delay="700">
            <img src="/media/template/arsya/Orn-25.webp" width="600" height="770" alt=""  loading="lazy" decoding="async" />
          </div>
        </div>

        <div className="orn-quote-2 right">
          <div className="orn-quote-2-2">
            <div className="orn-quote-2-2-1">
              <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="900" data-aos-delay="950">
                <img src="/media/template/arsya/Orn-07.webp" width="400" height="1114" alt=""  loading="lazy" decoding="async" />
              </div>
            </div>
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="900" data-aos-delay="950">
              <img src="/media/template/arsya/Orn-08.webp" width="400" height="993" alt=""  loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="orn-quote-2-1">
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="900" data-aos-delay="800">
              <img src="/media/template/arsya/Orn-03.webp" width="400" height="841" alt=""  loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="750" data-aos-delay="500">
            <img src="/media/template/arsya/Orn-49.webp" width="519" height="603" alt=""  loading="lazy" decoding="async" />
          </div>
        </div>
        <div className="orn-quote-2 left">
          <div className="orn-quote-2-2">
            <div className="orn-quote-2-2-1">
              <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="900" data-aos-delay="950">
                <img src="/media/template/arsya/Orn-07.webp" width="400" height="1114" alt=""  loading="lazy" decoding="async" />
              </div>
            </div>
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="900" data-aos-delay="950">
              <img src="/media/template/arsya/Orn-08.webp" width="400" height="993" alt=""  loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="orn-quote-2-1">
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="900" data-aos-delay="800">
              <img src="/media/template/arsya/Orn-03.webp" width="400" height="841" alt=""  loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="750" data-aos-delay="500">
            <img src="/media/template/arsya/Orn-49.webp" width="519" height="603" alt=""  loading="lazy" decoding="async" />
          </div>
        </div>
      </div>

      <div className="p-relative quote-frame-wrap">
        <div className="quote">
          <p className="quote-caption" data-aos="fade-up" data-aos-duration="1700">
            &ldquo;{content.quoteText}&rdquo;
          </p>
        </div>
      </div>

    </section>
  )
}
