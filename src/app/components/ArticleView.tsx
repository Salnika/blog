import { useParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import { getPostById } from "@/app/data/posts";
import { Calendar, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, useState } from "react";

function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl) {
    return "/";
  }
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function withBaseUrl(url: string): string {
  const baseUrl = normalizeBaseUrl(import.meta.env.BASE_URL);
  const clean = url.startsWith("/") ? url.slice(1) : url;
  return `${baseUrl}${clean}`;
}

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(
    /<a\s+([^>]*?)>([\s\S]*?)<(?:\/a|a)\s*\/?>/gi,
    (_match, attrsRaw, inner) => {
      const attrs = String(attrsRaw ?? "");
      const hrefMatch = attrs.match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
      const href = String(hrefMatch?.[1] ?? hrefMatch?.[2] ?? "").trim();
      if (!href) {
        return inner;
      }

      const downloadMatch = attrs.match(/\b(?:download|dowload)\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
      const downloadName = String(downloadMatch?.[1] ?? downloadMatch?.[2] ?? "").trim();

      const text = String(inner ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const titleSuffix = downloadName ? ` "${downloadName.replace(/"/g, '\\"')}"` : "";
      return `[${text || href}](${href}${titleSuffix})`;
    },
  );
}

function resolvePostAssetUrl(url: string | undefined): string | undefined {
  if (!url) {
    return url;
  }

  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("mailto:") ||
    url.startsWith("data:") ||
    url.startsWith("#") ||
    url === "/"
  ) {
    return url;
  }

  if (url.startsWith("/")) {
    const baseUrl = normalizeBaseUrl(import.meta.env.BASE_URL);
    if (baseUrl !== "/" && url.startsWith(baseUrl)) {
      return url;
    }
    return withBaseUrl(url);
  }

  const normalized = url.startsWith("./") ? url.slice(2) : url;
  if (normalized.startsWith("assets/")) {
    return withBaseUrl(`/post-assets/${normalized.slice("assets/".length)}`);
  }

  return url;
}

function stripQueryHash(url: string): string {
  return url.split("#")[0].split("?")[0];
}

function getFilenameFromUrl(url: string): string | undefined {
  const clean = stripQueryHash(url);
  const last = clean.split("/").pop();
  if (!last) {
    return undefined;
  }
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

export function ArticleView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const post = id ? getPostById(id) : undefined;
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt?: string } | null>(null);

  const content = useMemo(() => normalizeMarkdown(post?.content ?? ""), [post?.content]);

  useEffect(() => {
    if (!lightboxImage) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxImage(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxImage]);

  if (!post || post.draft) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-zinc-300 mb-2">Oups...</h2>
          <button
            onClick={() => navigate("/")}
            className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.article
      className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Back button */}
      <motion.button
        className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors mb-8 cursor-pointer"
        onClick={() => navigate("/")}
        whileHover={{ x: -4 }}
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Go back to posts list</span>
      </motion.button>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-zinc-100 mb-4">{post.title}</h1>

        <div className="flex items-center gap-2 text-sm text-zinc-400 mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{post.date}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 bg-zinc-800/50 text-zinc-300 text-sm rounded-full border border-zinc-700/50"
            >
              {tag}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Content */}
      <motion.div
        className="prose prose-invert max-w-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            img: ({ src, alt, className, ...props }) => {
              const resolvedSrc = resolvePostAssetUrl(src);
              return (
                <img
                  {...props}
                  src={resolvedSrc}
                  alt={alt}
                  loading="lazy"
                  decoding="async"
                  className={["cursor-zoom-in", className].filter(Boolean).join(" ")}
                  onClick={(event) => {
                    if (!resolvedSrc) {
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    setLightboxImage({ src: resolvedSrc, alt: alt ?? undefined });
                  }}
                />
              );
            },
            a: ({ href, title, className, ...props }) => {
              const resolvedHref = resolvePostAssetUrl(href);
              const clean = resolvedHref ? stripQueryHash(resolvedHref).toLowerCase() : "";
              const isStlDownload = Boolean(resolvedHref) && clean.endsWith(".stl");
              const filename = (title ?? "").trim() || getFilenameFromUrl(resolvedHref ?? "");

              return (
                <a
                  {...props}
                  href={resolvedHref}
                  title={title}
                  download={isStlDownload ? filename : undefined}
                  className={[
                    isStlDownload
                      ? "inline-flex items-center rounded-md border border-zinc-700/60 bg-zinc-800/40 px-3 py-1.5 text-sm text-zinc-100 no-underline hover:bg-zinc-800/60"
                      : "",
                    className,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </motion.div>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label={lightboxImage.alt ? `Image: ${lightboxImage.alt}` : "Image"}
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="w-full h-full flex items-center justify-center"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt ?? ""}
              className="max-h-[90vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </motion.article>
  );
}
