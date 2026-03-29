import { useState } from "react";
import { ChevronRight, ChevronDown, FileText, Folder, Search, X } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate, useLocation } from "react-router";
import { concave, refractive } from "@hashintel/refractive";
import { publishedPosts, type Post } from "@/app/data/posts";

interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  id: string;
}

const sidebarRefraction = {
  radius: 28,
  blur: 12,
  bezelWidth: 18,
  glassThickness: 80,
  specularOpacity: 1,
};

const searchRefraction = {
  radius: 16,
  blur: 8,
  bezelWidth: 10,
  glassThickness: 54,
  specularOpacity: 1,
  bezelHeightFn: concave,
};

function getYearFromDate(date: string): string {
  return date.slice(0, 4);
}

function buildBlogStructure(posts: Post[]): FileNode[] {
  const years = Array.from(new Set(posts.map((post) => getYearFromDate(post.date)))).sort(
    (a, b) => {
      return Number(b) - Number(a) || b.localeCompare(a);
    },
  );

  return years.map((year) => {
    const postsForYear = posts.filter((post) => getYearFromDate(post.date) === year);
    const postsByCategory = new Map<string, Post[]>();

    for (const post of postsForYear) {
      const categories = Array.from(new Set(post.tags));
      for (const category of categories) {
        const categoryPosts = postsByCategory.get(category) ?? [];
        categoryPosts.push(post);
        postsByCategory.set(category, categoryPosts);
      }
    }

    const categoryNodes = Array.from(postsByCategory.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, categoryPosts]): FileNode => {
        const sorted = [...categoryPosts].sort((a, b) => {
          const aTime = Date.parse(a.date);
          const bTime = Date.parse(b.date);
          return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
        });

        return {
          id: `category:${year}:${category}`,
          name: category,
          type: "folder",
          children: sorted.map((post) => ({
            id: post.id,
            name: post.title,
            type: "file",
          })),
        };
      });

    return {
      id: `year:${year}`,
      name: year,
      type: "folder",
      children: categoryNodes,
    };
  });
}

function TreeNode({
  node,
  level = 0,
  onSelectFile,
}: {
  node: FileNode;
  level?: number;
  onSelectFile?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(level === 0);
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = () => {
    if (node.type === "folder") {
      setIsOpen(!isOpen);
    } else {
      void navigate(`/article/${node.id}`);
      onSelectFile?.();
    }
  };

  const isSelected = node.type === "file" && location.pathname === `/article/${node.id}`;

  return (
    <div className="space-y-1">
      <div
        className="group relative overflow-hidden rounded-2xl"
        style={{ marginLeft: `${level * 12}px` }}
      >
        <refractive.div
          refraction={searchRefraction}
          className="pointer-events-none absolute inset-0 overflow-hidden border border-white/10 bg-white/8 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        />
        <motion.button
          type="button"
          className={[
            "relative z-10 flex w-full cursor-pointer items-center gap-2 rounded-2xl px-3 py-1.5 text-left transition-colors",
            isSelected ? "bg-zinc-700/50 text-white" : "text-zinc-400 hover:text-zinc-100",
          ].join(" ")}
          onClick={handleClick}
          whileHover={{ x: 2 }}
          transition={{ duration: 0.15 }}
        >
          {node.type === "folder" ? (
            <>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
              )}
              <Folder className="h-4 w-4 flex-shrink-0" />
            </>
          ) : (
            <>
              <div className="w-4" />
              <FileText className="h-4 w-4 flex-shrink-0" />
            </>
          )}
          <span className="truncate text-sm">{node.name}</span>
        </motion.button>
      </div>

      {node.type === "folder" && isOpen && node.children && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} level={level + 1} onSelectFile={onSelectFile} />
          ))}
        </motion.div>
      )}
    </div>
  );
}

export function FileTreeNav({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const blogStructure = buildBlogStructure(publishedPosts);

  const filterNodes = (nodes: FileNode[], query: string): FileNode[] => {
    if (!query) {
      return nodes;
    }

    return nodes.reduce((acc: FileNode[], node) => {
      if (node.type === "file" && node.name.toLowerCase().includes(query.toLowerCase())) {
        acc.push(node);
      } else if (node.name.toLowerCase().includes(query.toLowerCase())) {
        acc.push(node);
      } else if (node.type === "folder" && node.children) {
        const filteredChildren = filterNodes(node.children, query);
        if (filteredChildren.length > 0) {
          acc.push({ ...node, children: filteredChildren });
        }
      }
      return acc;
    }, []);
  };

  const filteredStructure = filterNodes(blogStructure, searchQuery);

  const isMobile = Boolean(onMobileClose);
  const mobileTransform = mobileOpen ? "translate-x-0" : "-translate-x-full";

  return (
    <div
      className={[
        "w-72 h-screen p-3 md:p-4",
        "fixed inset-y-0 left-0 z-40 shadow-2xl transition-transform duration-200 ease-out",
        mobileTransform,
        "md:static md:z-auto md:shadow-none md:translate-x-0",
      ].join(" ")}
      role="navigation"
      aria-label="Archives"
    >
      <refractive.div
        refraction={sidebarRefraction}
        className="relative flex h-full min-h-0 flex-col overflow-hidden border border-white/10 bg-[#0b1022]/44 text-zinc-100"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/10 via-white/4 to-transparent" />

        <div
          className="relative flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4 transition-colors hover:bg-white/5"
          onClick={() => {
            void navigate("/");
            onMobileClose?.();
          }}
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-200/70">Archive</p>
            <h2 className="mt-2 font-semibold text-zinc-50">Random Things</h2>
            <p className="mt-1 text-sm text-zinc-400">archives</p>
          </div>

          {isMobile && (
            <button
              type="button"
              aria-label="Fermer le menu"
              className="mt-0.5 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/8 hover:text-zinc-100 md:hidden"
              onClick={(e) => {
                e.stopPropagation();
                onMobileClose?.();
              }}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="relative border-b border-white/10 px-3 py-3">
          <refractive.div
            refraction={searchRefraction}
            className="relative overflow-hidden border border-white/10 bg-white/6"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-100/55" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent py-2.5 pl-10 pr-3 text-sm text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
            />
          </refractive.div>
        </div>

        <div className="relative flex-1 overflow-y-auto overscroll-none px-2 py-2">
          {filteredStructure.length > 0 ? (
            filteredStructure.map((node) => (
              <TreeNode key={node.id} node={node} onSelectFile={onMobileClose} />
            ))
          ) : (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">No result</div>
          )}
        </div>
      </refractive.div>
    </div>
  );
}
