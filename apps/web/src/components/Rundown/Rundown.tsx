import type { RundownItem } from '@/types/api'

interface RundownProps {
  rundownItems: RundownItem[]
}

export default function Rundown({ rundownItems }: RundownProps) {
  const groups = new Map<string, RundownItem[]>()
  for (const item of rundownItems) {
    const list = groups.get(item.groupLabel) ?? []
    list.push(item)
    groups.set(item.groupLabel, list)
  }

  return (
    <section className="rundown-container" data-section-order="rundown">
      <div className="ornaments-wrapper">

        <div className="orn-rd-2 right">
          <div className="image-wrap" data-aos="zoom-out-up" data-aos-duration="2200" data-aos-delay="1000">
            <img src="/media/template/arsya/Orn-25.png" alt="" />
          </div>
        </div>
        <div className="orn-rd-2 left">
          <div className="image-wrap" data-aos="zoom-out-up" data-aos-duration="2200" data-aos-delay="1000">
            <img src="/media/template/arsya/Orn-25.png" alt="" />
          </div>
        </div>
        <div className="orn-rd-1 center">
          <div className="image-wrap" data-aos="zoom-out-up" data-aos-duration="2200" data-aos-delay="1000">
            <img src="/media/template/arsya/Orn-41.png" alt="" />
          </div>
        </div>
        <div className="orn-cover-2 left">
          <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2200" data-aos-delay="1300">
            <img src="/media/template/arsya/Orn-07.png" alt="" />
          </div>
          <div className="orn-cover-2-1">
            <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="1700" data-aos-delay="800">
              <img src="/media/template/arsya/Orn-08.png" alt="" />
            </div>
          </div>
        </div>
        <div className="orn-cover-2 right">
          <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="2200" data-aos-delay="1300">
            <img src="/media/template/arsya/Orn-07.png" alt="" />
          </div>
          <div className="orn-cover-2-1">
            <div className="image-wrap" data-aos="zoom-in-right" data-aos-duration="1700" data-aos-delay="800">
              <img src="/media/template/arsya/Orn-08.png" alt="" />
            </div>
          </div>
        </div>

      </div>
      <div className="rundown-inner">
        <h3 className="rundown-title" data-aos="fade-sup" data-aos-duration="1200" data-aos-delay="500">Rundown</h3>
        <div className="rundown-event-list" data-aos="fade-up" data-aos-duration="1200" data-aos-delay="500">
          {[...groups.entries()].map(([groupLabel, items]) => (
            <div className="rundown-event" key={groupLabel}>
              <h5 className="rundown-event-title">{groupLabel}</h5>
              <div className="rundown-agenda-list">
                {items.map((item) => (
                  <div className="rundown-agenda" key={item.id}>
                    <p className="rundown-agenda-time">{item.timeLabel}</p>
                    <div className="rundown-divider">
                      <div className="rundown-line"></div>
                      <div className="rundown-circle"></div>
                    </div>
                    <div className="rundown-agenda-content">
                      <p className="rundown-agenda-text">{item.activityText}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="ornaments-wrapper"></div>
    </section>
  )
}
