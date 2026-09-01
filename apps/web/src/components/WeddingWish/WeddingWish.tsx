export default function WeddingWish() {
  return (
    <section className="wedding-wish-wrap" data-template="" data-section-order="wedding_wish">

      <div className="wedding-wish-inner">

        <div className="ornaments-wrapper">
          <div className="orn-wish-2 center">
            <div className="image-wrap" data-aos="zoom-out" data-aos-duration="2400" data-aos-delay="2200">
              <img src="/media/template/arsya/Orn-31.png" alt="Ornaments" />
            </div>
          </div>
          <div className="orn-wish-1 left">
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2600" data-aos-delay="2200">
              <img src="/media/template/arsya/Orn-28.png" alt="Ornaments" />
            </div>
          </div>
          <div className="orn-wish-1 right">
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2600" data-aos-delay="2200">
              <img src="/media/template/arsya/Orn-28.png" alt="Ornaments" />
            </div>
          </div>
        </div>

        <div className="wedding-wish-head">
          <h1 className="wedding-wish-title" data-aos="fade-up" data-aos-duration="1200">
            Wedding Wish
          </h1>
        </div>

        <div className="wedding-wish-body">

          <div className="wedding-wish-form">
            <form action="#" className="" method="POST" id="weddingWishForm">

              <div>
                <input type="hidden" name="guestId"
                  defaultValue="" />
                <input type="hidden" name="code"
                  defaultValue="" />
                <input type="hidden" name="post" defaultValue="newComment" />
              </div>

              <div className="form-group guest-name-wrap "
                data-aos="fade-up" data-aos-duration="1200" data-aos-delay="200">
                <input type="text" name="name" className="form-control guest-name"
                  placeholder="Name"
                  defaultValue="" />
              </div>

              <div className="form-group guest-comment-wrap" data-aos="fade-up" data-aos-duration="1200"
                data-aos-delay="300">
                <textarea className="form-control guest-comment no-scrollbar" name="comment" rows={1}
                  placeholder="Give your wish"></textarea>
              </div>

              <div className="submit-comment-wrap" data-aos="fade-up" data-aos-duration="1200"
                data-aos-delay="400">
                <button type="submit" className="submit submit-comment"
                  data-last="">Send</button>
              </div>

            </form>
          </div>

          <div className="comment-wrap">
            {/* COMMENTS */}

          </div>

          <div className="more-comment-wrap" data-aos="fade-up" data-aos-duration="1200">
            <button type="button" id="moreComment" data-template="" data-start="0"
              data-load-text="Loading">Show more comments</button>
          </div>

        </div>

        <div className="ornaments-wrapper">
          <div className="orn-lv-3">
            <div className="image-wrap" data-aos="fade-up" data-aos-duration="1200" data-aos-delay="500">
              <img src="/media/template/arsya/Orn-23.png" alt="Ornaments" />
            </div>
          </div>
          <div className="orn-lv-2 left">
            <div className="orn-lv-2-3">
              <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="1200">
                <img src="/media/template/arsya/Orn-05.png" alt="Ornaments" />
              </div>
            </div>
            <div className="orn-lv-2-2">
              <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1600" data-aos-delay="1100">
                <img src="/media/template/arsya/Orn-03.png" alt="Ornaments" />
              </div>
            </div>
            <div className="image-wrap" data-aos="fade-right" data-aos-duration="1200" data-aos-delay="500">
              <img src="/media/template/arsya/Orn-20.png" alt="Ornaments" />
            </div>
            <div className="orn-lv-2-1">
              <div className="image-wrap" data-aos="fade-right" data-aos-duration="1200" data-aos-delay="500">
                <img src="/media/template/arsya/Orn-29.png" alt="Ornaments" />
              </div>
            </div>
          </div>
          <div className="orn-lv-2 right">
            <div className="orn-lv-2-3">
              <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="1200">
                <img src="/media/template/arsya/Orn-05.png" alt="Ornaments" />
              </div>
            </div>
            <div className="orn-lv-2-2">
              <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1600" data-aos-delay="1100">
                <img src="/media/template/arsya/Orn-03.png" alt="Ornaments" />
              </div>
            </div>
            <div className="image-wrap" data-aos="fade-right" data-aos-duration="1200" data-aos-delay="500">
              <img src="/media/template/arsya/Orn-20.png" alt="Ornaments" />
            </div>
            <div className="orn-lv-2-1">
              <div className="image-wrap" data-aos="fade-right" data-aos-duration="1200" data-aos-delay="500">
                <img src="/media/template/arsya/Orn-29.png" alt="Ornaments" />
              </div>
            </div>
          </div>
        </div>

      </div>


    </section>
  )
}
