import type { Config } from "tailwindcss";

/**
 * Token chuyển cảnh dùng chung cho Audit Hasaki — trùng --ez-apple / --ez-spring
 * đã có trong kiemsoatkho/index.html để bản React và bản web tĩnh nhìn như một.
 */
export default {
  content: ["./src/**/*.{ts,tsx}", "./ui-react/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="tokyo"],[data-theme="dracula"],[data-theme="nord"],[data-theme="mocha"]'],
  theme: {
    extend: {
      transitionTimingFunction: {
        apple: "cubic-bezier(.32,.72,0,1)",   // vào nhanh, giảm tốc dài (Gemini/macOS)
        spring: "cubic-bezier(.175,.885,.32,1.12)", // overshoot rất nhẹ
      },
      transitionDuration: { 260: "260ms" },
      keyframes: {
        popIn: {
          from: { opacity: "0", transform: "translate3d(0,-6px,0) scale(.98)" },
          to: { opacity: "1", transform: "none" },
        },
        tipIn: {
          from: { opacity: "0", transform: "translateY(-50%) translateX(-4px) scale(.94)" },
          to: { opacity: "1", transform: "translateY(-50%) translateX(0) scale(1)" },
        },
      },
      animation: {
        popIn: "popIn .16s cubic-bezier(.16,1,.3,1)",
        // delay 300ms nằm ngay trong animation -> khỏi cần state khi dùng bản CSS thuần
        tipIn: "tipIn .16s cubic-bezier(.32,.72,0,1) .3s both",
      },
      width: { rail: "72px" },
    },
  },
  plugins: [],
} satisfies Config;
