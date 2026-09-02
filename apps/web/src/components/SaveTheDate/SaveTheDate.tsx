import type { InvitationContent } from '@/types/api'

interface SaveTheDateProps {
  content: InvitationContent
}

/** "20260516T110000" dari epoch, dalam wall-clock Asia/Jakarta (bukan UTC) -
 * supaya konsisten dengan jam yang dilihat tamu di countdown (window.EVENT,
 * lihat useLegacyBootstrap.ts keputusan #16). */
function toGoogleCalendarStamp(unixSeconds: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(unixSeconds * 1000))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}${get('month')}${get('day')}T${get('hour')}${get('minute')}${get('second')}`
}

export default function SaveTheDate({ content }: SaveTheDateProps) {
  const start = toGoogleCalendarStamp(content.weddingDateUnix)
  const end = toGoogleCalendarStamp(content.weddingDateUnix + 3 * 3600)
  const calendarText = encodeURIComponent(`${content.brideName} & ${content.groomName} Wedding`)
  const calendarDetails = encodeURIComponent(
    `Hi, You're invited to our wedding ceremony | ${content.brideName} & ${content.groomName} Wedding | ${content.weddingDateLabel}`,
  )
  const calendarUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${calendarText}&dates=${start}/${end}&details=${calendarDetails}`

  return (
    <section className="save-date-wrap" data-section-order="save_the_date">

      <div className="ornaments-wrapper">

        <div className="orn-sd-3">
          <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1500" data-aos-delay="1000">
            <img src="/media/template/arsya/Orn-31.webp" width="840" height="763" alt=""  loading="lazy" decoding="async" />
          </div>
        </div>

        <div className="orn-sd-4 right">
          <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1800" data-aos-delay="1400">
            <img src="/media/template/arsya/Orn-32.webp" width="600" height="1013" alt=""  loading="lazy" decoding="async" />
          </div>
        </div>

        <div className="orn-sd-4 left">
          <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1800" data-aos-delay="1400">
            <img src="/media/template/arsya/Orn-32.webp" width="600" height="1013" alt=""  loading="lazy" decoding="async" />
          </div>
        </div>

      </div>

      <div className="save-date-frame">

        <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1000">
          <img src="/media/template/arsya/frame-sd.webp" width="332" height="436" alt=""  loading="lazy" decoding="async" />
        </div>

        <div className="save-date-content">
          <h1 className="save-date-title" data-aos="zoom-in" data-aos-duration="1000">
            Save the Date
          </h1>
          <div className="save-date">
            <div className="save-date-body">
              <div className="countdown">
                <div className="count-item" data-aos="fade-down-right" data-aos-duration="1200"
                  data-aos-delay="100">
                  <h2 className="count-num count-day">0</h2>
                  <small
                    className="count-text">Days</small>
                </div>
                <div className="count-item" data-aos="fade-down-left" data-aos-duration="1200"
                  data-aos-delay="300">
                  <h2 className="count-num count-hour">0</h2>
                  <small
                    className="count-text">Hours</small>
                </div>
                <div className="count-item" data-aos="fade-up-right" data-aos-duration="1200"
                  data-aos-delay="500">
                  <h2 className="count-num count-minute">0</h2>
                  <small
                    className="count-text">Minutes</small>
                </div>
                <div className="count-item" data-aos="fade-up-left" data-aos-duration="1200"
                  data-aos-delay="700">
                  <h2 className="count-num count-second">0</h2>
                  <small
                    className="count-text">Seconds</small>
                </div>
              </div>
            </div>
          </div>

          <div className="add-to-calendar-wrap" data-aos="fade-up" data-aos-duration="1000"
            data-aos-delay="1100">
            <a className="add-to-calendar" href={calendarUrl} target="_blank" rel="nofollow" id="addToCalendar">
              Add to Calendar
            </a>
          </div>
        </div>

        <div className="ornaments-wrapper"></div>

      </div>

      <div className="ornaments-wrapper">

        <div className="orn-sd-1">
          <div className="orn-sd-1-2">
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2300" data-aos-delay="1500">
              <img src="/media/template/arsya/Orn-28.webp" width="400" height="954" alt=""  loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="orn-sd-1-1">
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="2100" data-aos-delay="1300">
              <img src="/media/template/arsya/Orn-27.webp" width="312" height="543" alt=""  loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1500" data-aos-delay="1000">
            <img src="/media/template/arsya/Orn-26.webp" width="400" height="304" alt=""  loading="lazy" decoding="async" />
          </div>
        </div>

        <div className="orn-sd-2">
          <div className="orn-sd-2-3">
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1900" data-aos-delay="1800">
              <img src="/media/template/arsya/Orn-05.webp" width="400" height="1019" alt=""  loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="orn-sd-2-2">
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1900" data-aos-delay="1800">
              <img src="/media/template/arsya/Orn-03.webp" width="400" height="841" alt=""  loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="orn-sd-2-1">
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1500" data-aos-delay="1200">
              <img src="/media/template/arsya/Orn-30.webp" width="266" height="347" alt=""  loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1500" data-aos-delay="1000">
            <img src="/media/template/arsya/Orn-29.webp" width="376" height="294" alt=""  loading="lazy" decoding="async" />
          </div>
        </div>

      </div>

      <div className="ornaments-wrapper">

        <div className="orn-sd-5">
          <div className="image-wrap" data-aos="zoom-in" data-aos-duration="1800" data-aos-delay="1400">
            <img src="/media/template/arsya/Orn-33.webp" width="600" height="377" alt=""  loading="lazy" decoding="async" />
          </div>
        </div>

      </div>

    </section>
  )
}
