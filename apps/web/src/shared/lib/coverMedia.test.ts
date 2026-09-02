import { describe, it, expect } from "vitest";
import { isVideoUrl, coverMediaHtml } from "./coverMedia";

describe("coverMedia", () => {
  it("isVideoUrl true untuk mp4/webm", () => {
    expect(isVideoUrl("/media/uploads/a.mp4")).toBe(true);
    expect(isVideoUrl("/media/uploads/b.webm")).toBe(true);
    expect(isVideoUrl("/media/uploads/c.MP4")).toBe(true);
    expect(isVideoUrl("/media/uploads/c.mp4?v=2")).toBe(true);
  });
  it("isVideoUrl false untuk gif/webp/png", () => {
    expect(isVideoUrl("/media/uploads/a.gif")).toBe(false);
    expect(isVideoUrl("/media/template/arsya/Orn-31.webp")).toBe(false);
    expect(isVideoUrl("/media/template/arsya/Orn-31.png")).toBe(false);
  });
  it("coverMediaHtml video menghasilkan <video>", () => {
    const html = coverMediaHtml("/media/uploads/a.mp4", "cover-video");
    expect(html).toContain("<video");
    expect(html).toContain('src="/media/uploads/a.mp4"');
    expect(html).toContain("autoplay");
    expect(html).toContain("playsinline");
    expect(html).toContain('class="cover-video"');
  });
  it("coverMediaHtml gif menghasilkan <img>", () => {
    const html = coverMediaHtml("/media/uploads/a.gif");
    expect(html).toContain("<img");
    expect(html).toContain('src="/media/uploads/a.gif"');
  });
  it("coverMediaHtml menerima kedua ekstensi (D5)", () => {
    expect(coverMediaHtml("/media/uploads/a.gif")).toContain("<img");
    expect(coverMediaHtml("/media/uploads/a.mp4")).toContain("<video");
    expect(coverMediaHtml("/media/uploads/a.webm")).toContain("<video");
  });
});
