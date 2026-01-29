import { motion } from "motion/react";
import { publishedPosts } from "@/app/data/posts";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router";

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-6xl font-bold mb-12 text-zinc-100">Posts</h1>

        <div className="border-b border-zinc-800 mb-4 pb-2 flex items-center gap-8 text-sm text-zinc-500">
          <span className="w-32">DATE</span>
          <span className="flex-1">NAME</span>
        </div>

        <div className="space-y-0">
          {publishedPosts.map((post, index) => (
            <motion.div
              key={post.id}
              className="group border-b border-zinc-800/50 hover:bg-zinc-900/20 transition-colors cursor-pointer"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => navigate(`/article/${post.id}`)}
            >
              <div className="flex items-center gap-8 py-4 px-2">
                <span className="w-32 text-sm text-zinc-500">{post.date}</span>
                <span className="flex-1 text-zinc-200 group-hover:text-white transition-colors">
                  {post.title}
                </span>
                <motion.div
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  whileHover={{ scale: 1.1 }}
                >
                  <Plus className="w-5 h-5 text-zinc-500" />
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
