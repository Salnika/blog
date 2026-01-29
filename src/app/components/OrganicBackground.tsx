import { motion } from "motion/react";

export function OrganicBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Blob 1 */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.55) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
        animate={{
          x: ["-10%", "10%", "-10%"],
          y: ["-10%", "20%", "-10%"],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        initial={{ x: "10%", y: "10%" }}
      />

      {/* Blob 2 */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, rgba(168, 85, 247, 0.55) 0%, transparent 70%)",
          filter: "blur(60px)",
          right: 0,
          top: "30%",
        }}
        animate={{
          x: ["10%", "-20%", "10%"],
          y: ["0%", "15%", "0%"],
          scale: [1, 1.3, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Blob 3 */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-25"
        style={{
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.55) 0%, transparent 70%)",
          filter: "blur(50px)",
          bottom: "10%",
          left: "30%",
        }}
        animate={{
          x: ["-15%", "15%", "-15%"],
          y: ["10%", "-10%", "10%"],
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Animated mesh gradient */}
      <motion.div
        className="absolute inset-0 opacity-15"
        style={{
          background:
            "linear-gradient(45deg, transparent 30%, rgba(99, 102, 241, 0.14) 50%, transparent 70%)",
        }}
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          duration: 60,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Particles */}
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 bg-indigo-300/40 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            filter: "blur(0.5px)",
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: 3 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 2,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
