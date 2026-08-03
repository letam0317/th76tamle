/**
 * SidebarToggle — nút đóng/mở thanh bên kiểu Google Gemini (Audit Hasaki)
 * ---------------------------------------------------------------------
 * - Icon "panel-left": khung thanh bên đứng yên, chỉ MŨI TÊN bên trong xoay 180°.
 * - Hover: mũi tên nhích 1.5px theo hướng hành động (gợi ý trước khi bấm).
 * - Tooltip có độ trễ 300ms, tự tắt khi bấm / rời chuột / thiết bị cảm ứng.
 * - A11y: aria-label, aria-expanded, aria-controls, aria-describedby, focus-visible ring.
 * - Tôn trọng prefers-reduced-motion (dùng useReducedMotion của Framer Motion).
 */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useId, useRef, useState } from "react";

/** Ease chuẩn Apple/Gemini: vào nhanh, giảm tốc dài — trùng --ez-apple của dashboard. */
export const EASE_APPLE = [0.32, 0.72, 0, 1] as const;

export type SidebarToggleProps = {
  /** Thanh bên đang mở hay không (controlled). */
  open: boolean;
  /** Gọi khi người dùng bấm nút hoặc gõ phím tắt. Nhận trạng thái MỚI. */
  onToggle: (next: boolean) => void;
  /** id của <aside> để liên kết aria-controls. */
  controls?: string;
  /** Thanh bên nằm bên nào (đảo hướng mũi tên + vị trí tooltip). */
  side?: "left" | "right";
  /** Độ trễ hiện tooltip (ms). Mặc định 300ms. */
  tooltipDelay?: number;
  /** Nhãn khi ĐANG MỞ (hành động sẽ xảy ra là thu gọn). */
  labelOpen?: string;
  /** Nhãn khi ĐANG ĐÓNG. */
  labelClosed?: string;
  /** Bật phím tắt Ctrl/⌘ + B. */
  hotkey?: boolean;
  className?: string;
};

export default function SidebarToggle({
  open,
  onToggle,
  controls = "sidebar",
  side = "left",
  tooltipDelay = 300,
  labelOpen = "Thu gọn thanh bên",
  labelClosed = "Mở rộng thanh bên",
  hotkey = true,
  className = "",
}: SidebarToggleProps) {
  const reduce = useReducedMotion();
  const tipId = useId();
  const [tipOpen, setTipOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const label = open ? labelOpen : labelClosed;
  /** Hướng hành động: đang mở -> thu về phía thanh bên; đang đóng -> đẩy ra ngoài. */
  const dir = side === "left" ? (open ? -1 : 1) : open ? 1 : -1;

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const showTip = useCallback(() => {
    clear();
    timer.current = setTimeout(() => setTipOpen(true), tooltipDelay);
  }, [tooltipDelay]);
  const hideTip = useCallback(() => {
    clear();
    setTipOpen(false);
  }, []);
  useEffect(() => clear, []);

  /* Phím tắt Ctrl/⌘ + B — bỏ qua khi đang gõ trong input/textarea/contenteditable. */
  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== "b") return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      e.preventDefault();
      onToggle(!open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey, onToggle, open]);

  const dur = reduce ? 0 : 0.26;

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={controls}
        aria-describedby={tipOpen ? tipId : undefined}
        onClick={() => {
          hideTip();
          onToggle(!open);
        }}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return; // cảm ứng: không hiện tooltip
          setHover(true);
          showTip();
        }}
        onPointerLeave={() => {
          setHover(false);
          hideTip();
        }}
        onFocus={() => setTipOpen(true)}
        onBlur={hideTip}
        className={[
          "group grid h-10 w-10 place-items-center rounded-full",
          "text-slate-600 dark:text-slate-300",
          "transition-colors duration-200 ease-[cubic-bezier(.32,.72,0,1)]",
          "hover:bg-slate-100 dark:hover:bg-slate-800",
          "active:scale-[.94] active:bg-slate-200 dark:active:bg-slate-700",
          "motion-reduce:transition-none motion-reduce:active:scale-100",
          "outline-none focus-visible:ring-[3px] focus-visible:ring-sky-500/25",
          "focus-visible:ring-offset-0",
        ].join(" ")}
      >
        <svg
          viewBox="0 0 24 24"
          width={20}
          height={20}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          {/* Khung thanh bên — đứng yên, chỉ là "vỏ" */}
          <rect x="3" y="4" width="18" height="16" rx="2.6" />
          <line x1="9" y1="4" x2="9" y2="20" />
          {/* Mũi tên — xoay 180° khi đổi trạng thái, nhích nhẹ khi hover */}
          <motion.g
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            initial={false}
            animate={{ rotate: open ? 0 : 180, x: hover ? dir * 1.5 : 0 }}
            transition={{
              rotate: { duration: dur, ease: EASE_APPLE },
              x: { duration: reduce ? 0 : 0.18, ease: EASE_APPLE },
            }}
          >
            <path d="M16.6 9.4 13.9 12l2.7 2.6" />
          </motion.g>
        </svg>
      </button>

      <AnimatePresence>
        {tipOpen && (
          <motion.span
            id={tipId}
            role="tooltip"
            initial={{ opacity: 0, scale: 0.94, x: dirTipOffset(side, -4) }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: reduce ? 0 : 0.12 } }}
            transition={{ duration: reduce ? 0 : 0.16, ease: EASE_APPLE }}
            className={[
              "pointer-events-none absolute top-1/2 z-[70] -translate-y-1/2 whitespace-nowrap",
              side === "left" ? "left-[calc(100%+10px)]" : "right-[calc(100%+10px)]",
              "rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg",
              "dark:bg-slate-700",
            ].join(" ")}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Tooltip trượt vào từ phía nút (trái/phải) cho tự nhiên. */
function dirTipOffset(side: "left" | "right", d: number) {
  return side === "left" ? d : -d;
}
