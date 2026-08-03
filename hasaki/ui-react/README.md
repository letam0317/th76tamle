# SidebarToggle — nút đóng/mở thanh bên kiểu Gemini (Audit Hasaki)

Hai bản, cùng một ngôn ngữ chuyển cảnh (`cubic-bezier(.32,.72,0,1)`):

| Bản | File | Dùng cho |
|---|---|---|
| React + TS + Framer Motion | `SidebarToggle.tsx`, `Sidebar.tsx`, `tailwind.config.ts` | dự án React sau này |
| Vanilla (CSS thuần + SVG) | đã vá thẳng vào `hasaki/kiemsoatkho/index.html` | dashboard đang chạy tại `letam0317.github.io/kiemsoatkho` |

## 1. Bản React

```bash
npm i framer-motion            # lucide-react không bắt buộc: icon vẽ inline
```

```tsx
import Sidebar from "./ui-react/Sidebar";

const GROUPS = [
  { title: "Hạng mục 5S", items: [
      { key: "tong", label: "Tổng quan" },
      { key: "task", label: "Task vi phạm" },
      { key: "hangmuc", label: "Quy định" },
      { key: "planogram", label: "Planogram" } ] },
  { title: "Hạng mục Tồn kho", items: [
      { key: "kk", label: "Kiểm kê" },
      { key: "htonbat", label: "Tồn kho bất thường" } ] },
];

<div className="flex min-h-screen">
  <Sidebar groups={GROUPS} active={tab} onSelect={setTab} open={open} onOpenChange={setOpen} />
  <main className="min-w-0 flex-1">…</main>
</div>
```

Dùng riêng nút:

```tsx
<SidebarToggle open={open} onToggle={setOpen} controls="audit-sidebar" />
```

Props: `open`, `onToggle`, `controls`, `side` (`left|right`), `tooltipDelay` (mặc định 300ms),
`labelOpen`, `labelClosed`, `hotkey` (Ctrl/⌘+B, mặc định bật).

Hành vi:
- Khung panel đứng yên, **chỉ mũi tên xoay 180°** trong 260ms → mắt bám được vật thể (Gemini làm đúng vậy).
- Hover: mũi tên nhích 1.5px theo hướng hành động, 180ms.
- Tooltip trễ 300ms, tắt ngay khi bấm; thiết bị cảm ứng (`pointerType !== "mouse"`) không hiện.
- `aria-label` + `aria-expanded` + `aria-controls` + `aria-describedby`; focus-visible ring 3px.
- `useReducedMotion` → mọi duration về 0 khi người dùng bật giảm chuyển động.

Tailwind: copy phần `theme.extend` trong `tailwind.config.ts` (thêm `ease-apple`, `ease-spring`,
`animation-popIn`, `w-rail`). Nếu không muốn sửa config, các class `ease-[cubic-bezier(.32,.72,0,1)]`
trong component đã là arbitrary value nên chạy được ngay.

## 2. Bản vanilla đã nhúng vào dashboard

Đã sửa trong `kiemsoatkho/index.html`:

- `<button id="sideToggle">` giờ chứa SVG panel-left (`.st-arrow` là mũi tên) thay cho ký tự `›`.
- CSS `#sideToggle` mới: bo `10px`, hover đổi nền, focus-ring theo chuẩn chung
  (`0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent)`), tooltip `::after/::before`
  có `transition-delay:.3s`, thiết bị cảm ứng ẩn tooltip và mở rộng vùng chạm ra 44px.
- JS `mo()/dong()` không còn ghi `textContent` (sẽ xoá mất SVG) mà đặt `aria-expanded` + `data-tip`;
  thêm phím tắt Ctrl/⌘+B và Esc (đóng drawer trên mobile).

Muốn đổi kích thước nút: sửa `width/height` của `#sideToggle` và `padding-left` của `.wrap>header`
cùng lúc (header chừa chỗ cho nút = `left + width + 3px`).

## 3. Làm mượt chuyển động (bài học 03/08)

Bản đầu animate `padding-left` của `.wrap` → **reflow cả trang mỗi frame**. Đo trên DOM nặng
(1200 dòng bảng + 700 ô lưới): layout **320ms/lượt, 7/44 frame vượt 20ms**.

Cách chữa — FLIP, đúng thủ pháp mà `.cs-list` / `.date-pop` đang dùng (chỉ `opacity` + `transform`):

1. Đổi `padding-left` **tức thì** (1 reflow duy nhất) thay vì transition nó.
2. Bù lại bằng `@keyframes wrapVao/wrapRa` chạy `transform:translate3d()` → compositor lo.
3. Ép flush layout ngay trong handler click (`void document.body.offsetWidth`) rồi mới bật
   `.side-anim` → cú reflow rơi vào task click, không rơi vào frame đầu của chuyển động.
4. Nút dùng thuộc tính `translate` riêng, **không** dùng `transform` — để `button:active{scale(.97)}`
   khỏi tranh chấp (gộp chung là nút nhảy về chỗ cũ khi nhấn).
5. Stagger mục điều hướng chỉ animate `transform`, fill `backwards`. **Đừng** nhét `opacity` vào
   keyframe: animation fill thắng khai báo thường → `.s-item{opacity:.72}` và hover sẽ mất tác dụng.

Sau khi chữa: layout **42ms/lượt, 1/44 frame vượt 20ms**.

> ⚠️ `Sidebar.tsx` (bản React) hiện animate `width` — cũng là thuộc tính layout, cùng loại vấn đề.
> Với trang nhẹ thì không thấy; trang nặng nên đổi sang FLIP như trên (đo `layout` bằng CDP
> `Performance.getMetrics` → `LayoutDuration`, đừng tin cảm giác).
