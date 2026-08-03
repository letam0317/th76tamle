/**
 * Sidebar — thanh bên Audit Hasaki, đóng/mở kiểu Gemini.
 * ------------------------------------------------------
 * Desktop (≥768px): ghim cố định, co giãn 256px (w-64) <-> 72px (rail chỉ còn chấm/icon).
 * Mobile  (<768px): drawer trượt phủ lên nội dung + nền mờ, bấm nền hoặc Esc để đóng.
 * Nút toggle nằm ở đầu thanh bên (giống Gemini) — dùng chung <SidebarToggle/>.
 */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import SidebarToggle, { EASE_APPLE } from "./SidebarToggle";

export type NavItem = { key: string; label: string };
export type NavGroup = { title: string; items: NavItem[] };

export type SidebarProps = {
  groups: NavGroup[];
  active: string;
  onSelect: (key: string) => void;
  /** Mở/đóng có thể do cha giữ (persist localStorage…); bỏ trống thì tự quản. */
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  brand?: string;
};

const SIDEBAR_ID = "audit-sidebar";

export default function Sidebar({
  groups,
  active,
  onSelect,
  open: openProp,
  onOpenChange,
  brand = "AUDIT HASAKI",
}: SidebarProps) {
  const reduce = useReducedMotion();
  const [openState, setOpenState] = useState(true);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };

  /* Mobile: Esc đóng drawer. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const dur = reduce ? 0 : 0.3;

  return (
    <>
      {/* Nền mờ — chỉ mobile */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.24, ease: EASE_APPLE }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <aside
        id={SIDEBAR_ID}
        aria-label="Điều hướng hạng mục"
        data-open={open ? "true" : "false"}
        className={[
          "fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden",
          "border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
          "md:static md:z-auto md:h-auto md:shrink-0",
          // chuyển cảnh: mobile trượt ngang, desktop co giãn bề rộng
          "transition-[transform,width] duration-300 ease-[cubic-bezier(.32,.72,0,1)]",
          "motion-reduce:transition-none",
          open
            ? "w-72 translate-x-0 md:w-64"
            : "w-72 -translate-x-full md:w-[72px] md:translate-x-0",
        ].join(" ")}
      >
        {/* Đầu thanh: logo + nút toggle (Gemini để nút ngay đây) */}
        <div className="flex h-14 items-center gap-2 px-3">
          <SidebarToggle
            open={open}
            onToggle={setOpen}
            controls={SIDEBAR_ID}
            className="shrink-0"
          />
          <AnimatePresence initial={false}>
            {open && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: reduce ? 0 : 0.2, ease: EASE_APPLE }}
                className="truncate text-[13px] font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400"
              >
                {brand}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-4">
          {groups.map((g) => (
            <div key={g.title} className="mb-1">
              {/* Tiêu đề nhóm: khi thu gọn thì thay bằng gạch ngăn, không bóp chữ */}
              <div className="flex h-8 items-center gap-2 px-2">
                <span className="h-3 w-3 shrink-0 rounded-[3.5px] bg-emerald-600/90 dark:bg-emerald-400/90" />
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: reduce ? 0 : 0.18 }}
                      className="truncate text-[11.5px] font-extrabold text-slate-800 dark:text-slate-200"
                    >
                      {g.title}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              <div
                className={[
                  "flex flex-col gap-px transition-[margin,padding,border] duration-300",
                  "ease-[cubic-bezier(.32,.72,0,1)]",
                  open
                    ? "ml-3 border-l-[1.5px] border-slate-200 pl-2 dark:border-slate-800"
                    : "ml-0 border-l-0 pl-0",
                ].join(" ")}
              >
                {g.items.map((it) => {
                  const on = it.key === active;
                  return (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => onSelect(it.key)}
                      aria-current={on ? "page" : undefined}
                      title={!open ? it.label : undefined}
                      className={[
                        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-semibold",
                        "border-l-[3px] transition-colors duration-150",
                        "outline-none focus-visible:ring-[3px] focus-visible:ring-emerald-500/25",
                        on
                          ? "border-l-emerald-600 bg-slate-50 text-emerald-700 dark:bg-slate-800 dark:text-emerald-400"
                          : "border-l-transparent text-slate-700/75 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300/75 dark:hover:bg-slate-800",
                      ].join(" ")}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current ${on ? "opacity-100" : "opacity-40"}`}
                      />
                      <span
                        className={[
                          "truncate transition-[opacity,max-width] duration-300 ease-[cubic-bezier(.32,.72,0,1)]",
                          open ? "max-w-[180px] opacity-100" : "max-w-0 opacity-0",
                        ].join(" ")}
                      >
                        {it.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Ví dụ ghép vào layout (nội dung tự co theo bề rộng thanh bên):
 *
 * const GROUPS = [
 *   { title: "Hạng mục 5S", items: [
 *       { key: "tong", label: "Tổng quan" },
 *       { key: "task", label: "Task vi phạm" },
 *       { key: "hangmuc", label: "Quy định" },
 *       { key: "planogram", label: "Planogram" }] },
 *   { title: "Hạng mục Tồn kho", items: [
 *       { key: "kk", label: "Kiểm kê" },
 *       { key: "htonbat", label: "Tồn kho bất thường" }] },
 * ];
 *
 * export function AppShell() {
 *   const [open, setOpen] = useState(true);
 *   const [tab, setTab] = useState("tong");
 *   return (
 *     <div className="flex min-h-screen">
 *       <Sidebar groups={GROUPS} active={tab} onSelect={setTab} open={open} onOpenChange={setOpen} />
 *       <main className="min-w-0 flex-1 p-4">…</main>
 *     </div>
 *   );
 * }
 * ------------------------------------------------------------------ */
