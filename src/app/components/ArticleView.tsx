import { useParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import { getPostById } from "@/app/data/posts";
import { Calendar, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";

function StlPreviewCard({
  href,
  label,
  downloadName,
}: {
  href: string;
  label: string;
  downloadName: string;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let animationFrame = 0;
    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;

    const run = async () => {
      try {
        const three = await import("three");
        const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");

        const container = containerRef.current;
        if (!container) {
          return;
        }

        const ensureNonZeroSize = async () => {
          for (let i = 0; i < 10; i += 1) {
            const width = container.clientWidth;
            const height = container.clientHeight;
            if (width > 0 && height > 0) {
              return { width, height };
            }
            await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
          }
          return { width: 300, height: 200 };
        };

        const { width, height } = await ensureNonZeroSize();

        const scene = new three.Scene();
        scene.background = null;

        const camera = new three.PerspectiveCamera(40, width / height, 0.1, 100);
        camera.position.set(0, 0.6, 2.2);

        const renderer = new three.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);
        container.appendChild(renderer.domElement);

        const ambient = new three.AmbientLight(0xffffff, 0.55);
        scene.add(ambient);

        const key = new three.DirectionalLight(0xffffff, 0.9);
        key.position.set(3, 4, 2);
        scene.add(key);

        const fill = new three.DirectionalLight(0xffffff, 0.4);
        fill.position.set(-2, 1, 3);
        scene.add(fill);

        const loader = new STLLoader();

        const geometry = await new Promise<InstanceType<typeof three.BufferGeometry>>(
          (resolve, reject) => {
            loader.load(
              href,
              (geo) => resolve(geo as unknown as InstanceType<typeof three.BufferGeometry>),
              undefined,
              (err) => reject(err),
            );
          },
        );

        if (disposed) {
          geometry.dispose();
          renderer.dispose();
          return;
        }

        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        const material = new three.MeshStandardMaterial({
          color: 0xe5e7eb,
          metalness: 0.15,
          roughness: 0.55,
        });

        const mesh = new three.Mesh(geometry, material);

        if (geometry.boundingBox) {
          const center = new three.Vector3();
          geometry.boundingBox.getCenter(center);
          mesh.position.sub(center);

          const size = new three.Vector3();
          geometry.boundingBox.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);

          const radius = geometry.boundingSphere?.radius && geometry.boundingSphere.radius > 0
            ? geometry.boundingSphere.radius
            : Math.max(maxDim / 2, 1);

          const fovRad = (camera.fov * Math.PI) / 180;
          const distance = (radius / Math.sin(fovRad / 2)) * 1.25;

          camera.near = Math.max(radius / 1000, 0.01);
          camera.far = Math.max(distance + radius * 4, radius * 100);
          camera.updateProjectionMatrix();

          camera.position.set(0, radius * 0.35, distance);
          camera.lookAt(0, 0, 0);
        }

        scene.add(mesh);

        resizeObserver = new ResizeObserver(() => {
          const nextWidth = container.clientWidth;
          const nextHeight = container.clientHeight;
          if (nextWidth <= 0 || nextHeight <= 0) {
            return;
          }
          camera.aspect = nextWidth / nextHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(nextWidth, nextHeight);
        });
        resizeObserver.observe(container);

        setStatus("ready");

        const tick = () => {
          if (disposed) {
            return;
          }
          mesh.rotation.y += 0.008;
          renderer.render(scene, camera);
          animationFrame = window.requestAnimationFrame(tick);
        };
        tick();

        return () => {
          disposed = true;
          window.cancelAnimationFrame(animationFrame);
          resizeObserver?.disconnect();
          geometry.dispose();
          material.dispose();
          renderer.dispose();
          container.replaceChildren();
        };
      } catch (error) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error("Failed to render STL preview:", error);
        }
        setStatus("error");
      }
    };

    let cleanup: (() => void) | undefined;
    run()
      .then((maybeCleanup) => {
        cleanup = typeof maybeCleanup === "function" ? maybeCleanup : undefined;
      })
      .catch(() => setStatus("error"));

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      cleanup?.();
    };
  }, [href]);

  return (
    <span className="not-prose my-6 block overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/30">
      <span className="relative block h-56 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40">
        <span ref={containerRef} className="absolute inset-0 block" />
        {status !== "ready" && (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
            {status === "loading" ? "Chargement de la preview 3D…" : "Preview 3D indisponible"}
          </span>
        )}
      </span>

      <span className="flex items-center justify-between gap-3 p-4">
        <a
          href={href}
          download={downloadName}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-700/60 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-100 no-underline hover:bg-zinc-800/60 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span className="font-medium">{label}</span>
        </a>
        <span className="text-xs text-zinc-500">STL</span>
      </span>
    </span>
  );
}

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
              const label = getFilenameFromUrl(resolvedHref ?? "") ?? (title ?? "").trim();
              const downloadName = (title ?? "").trim() || label;

              if (isStlDownload && resolvedHref && label && downloadName) {
                return <StlPreviewCard href={resolvedHref} label={label} downloadName={downloadName} />;
              }

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
