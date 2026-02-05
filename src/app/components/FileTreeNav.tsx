import { useState } from "react";
import { ChevronRight, ChevronDown, FileText, Folder, Search } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate, useLocation } from "react-router";
import { publishedPosts, type Post } from "@/app/data/posts";

interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  id: string;
}

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

function TreeNode({ node, level = 0 }: { node: FileNode; level?: number }) {
  const [isOpen, setIsOpen] = useState(level === 0);
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = () => {
    if (node.type === "folder") {
      setIsOpen(!isOpen);
    } else {
      navigate(`/article/${node.id}`);
    }
  };

  const isSelected = node.type === "file" && location.pathname === `/article/${node.id}`;

  return (
    <div>
      <motion.div
        className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded-md transition-colors ${isSelected
          ? "bg-zinc-700/50 text-white"
          : "hover:bg-zinc-800/30 text-zinc-400 hover:text-zinc-200"
          }`}
        style={{ paddingLeft: `${level * 12 + 12}px` }}
        onClick={handleClick}
        whileHover={{ x: 2 }}
        transition={{ duration: 0.15 }}
      >
        {node.type === "folder" ? (
          <>
            {isOpen ? (
              <ChevronDown className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 flex-shrink-0" />
            )}
            <Folder className="w-4 h-4 flex-shrink-0" />
          </>
        ) : (
          <>
            <div className="w-4" />
            <FileText className="w-4 h-4 flex-shrink-0" />
          </>
        )}
        <span className="text-sm truncate">{node.name}</span>
      </motion.div>

      {node.type === "folder" && isOpen && node.children && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} level={level + 1} />
          ))}
        </motion.div>
      )}
    </div>
  );
}

export function FileTreeNav() {
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

  return (
    <div className="w-72 bg-zinc-900/50 border-r border-zinc-800 h-screen overflow-hidden flex flex-col">
      <div
        className="p-4 border-b border-zinc-800 cursor-pointer hover:bg-zinc-800/30 transition-colors"
        onClick={() => navigate("/")}
      >
        <h2 className="font-semibold text-zinc-100">Random Things</h2>
        <p className="text-sm text-zinc-500 mt-1">Archive</p>
      </div>

      <div className="p-3 border-b border-zinc-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
      </div>

      <div className="py-2 flex-1 overflow-y-auto overscroll-none">
        {filteredStructure.length > 0 ? (
          filteredStructure.map((node) => <TreeNode key={node.id} node={node} />)
        ) : (
          <div className="px-4 py-8 text-center text-zinc-500 text-sm">No result</div>
        )}
      </div>
    </div>
  );
}
