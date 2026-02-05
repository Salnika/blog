import { useParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import { getPostById } from "@/app/data/posts";
import { Calendar, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ArticleView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const post = id ? getPostById(id) : undefined;

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
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
      </motion.div>
    </motion.article>
  );
}
