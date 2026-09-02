import type { InvitationContent } from '@/types/api'

interface NotesProps {
  content: InvitationContent
}

export default function Notes({ content }: NotesProps) {
  return (
    <section className="notes-container" data-section-order="greet_thanks">
      <div className="thankyou" data-aos="zoom-in" data-aos-duration="2500" data-aos-delay="1800">
        <div className="ornaments-wrapper">
          <div className="orn-qt-1 left">
            <div className="orn-qt-1-3">
              <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1800" data-aos-delay="800">
                <img src="/media/template/arsya/Orn-15.webp" width="600" height="1625" alt=""  loading="lazy" decoding="async" />
              </div>
            </div>
            <div className="orn-qt-1-1">
              <div className="orn-qt-1-2">
                <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1800" data-aos-delay="800">
                  <img src="/media/template/arsya/Orn-05.webp" width="400" height="1019" alt=""  loading="lazy" decoding="async" />
                </div>
              </div>
              <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1800" data-aos-delay="800">
                <img src="/media/template/arsya/Orn-03.webp" width="400" height="841" alt=""  loading="lazy" decoding="async" />
              </div>
            </div>
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="600">
              <img src="/media/template/arsya/Orn-49.webp" width="519" height="603" alt=""  loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="orn-qt-1 right">
            <div className="orn-qt-1-3">
              <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1800" data-aos-delay="800">
                <img src="/media/template/arsya/Orn-15.webp" width="600" height="1625" alt=""  loading="lazy" decoding="async" />
              </div>
            </div>
            <div className="orn-qt-1-1">
              <div className="orn-qt-1-2">
                <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1800" data-aos-delay="800">
                  <img src="/media/template/arsya/Orn-05.webp" width="400" height="1019" alt=""  loading="lazy" decoding="async" />
                </div>
              </div>
              <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1800" data-aos-delay="800">
                <img src="/media/template/arsya/Orn-03.webp" width="400" height="841" alt=""  loading="lazy" decoding="async" />
              </div>
            </div>
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="600">
              <img src="/media/template/arsya/Orn-49.webp" width="519" height="603" alt=""  loading="lazy" decoding="async" />
            </div>
          </div>
        </div>
        <h2 className="note-title">{content.thanksTitle}</h2>
        <p className="note-description">{content.thanksDescription}</p>
      </div>
    </section>
  )
}
