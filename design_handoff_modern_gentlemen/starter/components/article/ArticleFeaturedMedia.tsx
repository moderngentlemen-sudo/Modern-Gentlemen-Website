import { MediaImage } from "@/components/ui/MediaImage";
import { articleEmbedUrl, type ArticleFeaturedMedia as Media } from "@/lib/domain/articles";

export function ArticleFeaturedMedia({ media }: { media: Media }) {
  if (media.kind === "gallery" && media.gallery?.length) {
    return (
      <section className="container-mg py-10" aria-label="Featured gallery">
        <div className="grid grid-cols-1 gap-3 min-[681px]:grid-cols-2">
          {media.gallery.map((item, index) => (
            <figure
              key={`${item.assetId ?? item.url}-${index}`}
              className="relative aspect-[4/3] overflow-hidden bg-mg-fg/5"
            >
              <MediaImage
                src={item.url}
                alt={item.alt ?? ""}
                slot="gallery"
                className="object-cover"
              />
            </figure>
          ))}
        </div>
      </section>
    );
  }

  if (media.kind === "embed") {
    const src = articleEmbedUrl(media.embedUrl);
    if (!src) return null;
    return (
      <section className="container-mg py-10" aria-label="Featured video">
        <div className="aspect-video overflow-hidden bg-black">
          <iframe
            src={src}
            title="Featured video"
            loading="lazy"
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="h-full w-full border-0"
          />
        </div>
      </section>
    );
  }

  if (media.kind === "video" && media.video?.url) {
    return (
      <section className="container-mg py-10" aria-label="Featured video">
        <video
          src={media.video.url}
          poster={media.cover?.url}
          controls
          preload="metadata"
          className="aspect-video w-full bg-black object-contain"
        />
      </section>
    );
  }

  return null;
}
