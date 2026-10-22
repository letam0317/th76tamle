/* tat-loc.js — nút «✕ Tắt lọc» ngay BÊN TRÁI mọi nút «Bộ lọc» (Retail + Factory, cả pop-up) — 22/10/2026.
 * User: «tạo thêm nút x Tắt lọc kế bên trái nút Bộ lọc — áp dụng toàn bộ các bộ lọc ở các hạng mục hiện có của cả retail và factory».
 * Cách làm CHUNG (không sửa từng mục): trong cùng khung với nút «Bộ lọc» (panel / pop-up), đưa mọi điều kiện về trống rồi bắn đúng sự kiện
 * mà mục đó vốn nghe — ô chọn: value "" (không có thì lựa chọn đầu) + change (+ đồng bộ ô chọn đẹp _csWrap); ô gõ tìm: "" + input/change;
 * bộ lọc ngày chuẩn (bo-loc-ngay.js): bấm nút «Xoá» sẵn có trong khung lịch (gọi đúng onApply của mục; mục bắt buộc có khoảng ngày thì về mặc định).
 * Nút chỉ BẬT khi đang có điều kiện lọc; khung bị vẽ lại (bộ lọc dựng lại HTML) thì tự gắn lại (MutationObserver, gộp 150 ms).
 * Bản chép: factory/tat-loc.js (sửa ở đây rồi chép sang). */
(function () {
  if (window.__TAT_LOC) return; window.__TAT_LOC = 1;
  var KHUNG = ".modal-box,.modalbox,.hk-dau-panel,.kk-dau-panel,.panel,.pane,section";
  var la = function (el) { return el.tagName === "BUTTON" && /^Bộ lọc/.test((el.textContent || "").trim()) && !el.classList.contains("tat-loc"); };
  function oCuaKhung(k) {   // các điều kiện lọc trong khung — bỏ qua ô trong bảng dữ liệu / ô quyết định / chính các nút
    var ds = [].slice.call(k.querySelectorAll("select, input[type=search], input[type=text], input:not([type]), .date-filter"));
    return ds.filter(function (x) { return !x.closest("table, .menu, .date-pop, .tk-f, .hx-qd, [data-khong-tat-loc]") && !(x.matches("input") && x.closest(".date-filter")) && !x.disabled; });
  }
  function dangLoc(x) {
    if (x.classList.contains("date-filter")) { var s = x.querySelector(".dp-sel"); return !!s && s.textContent.trim() !== "Chưa chọn"; }
    if (x.tagName === "SELECT") { var co = [].some.call(x.options, function (o) { return o.value === ""; }); return co ? x.value !== "" : x.selectedIndex > 0; }
    return !!String(x.value || "").trim();
  }
  function tatLoc(k) {
    oCuaKhung(k).forEach(function (x) {
      if (!dangLoc(x)) return;
      if (x.classList.contains("date-filter")) { var b = x.querySelector(".dp-clear"); if (b) b.click(); return; }
      if (x.tagName === "SELECT") { var co = [].some.call(x.options, function (o) { return o.value === ""; }); if (co) x.value = ""; else x.selectedIndex = 0;
        x.dispatchEvent(new Event("change", { bubbles: true })); if (x._csWrap && typeof x._csWrap._csDongBo === "function") x._csWrap._csDongBo(); return; }
      x.value = ""; x.dispatchEvent(new Event("input", { bubbles: true })); x.dispatchEvent(new Event("change", { bubbles: true }));
      x.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Backspace" }));
    });
  }
  function capNhat(nut, k) { var co = oCuaKhung(k).some(dangLoc); nut.disabled = !co; nut.title = co ? "Bỏ mọi điều kiện lọc ở khung này" : "Chưa lọc gì"; }
  function gan() {
    [].slice.call(document.querySelectorAll("button")).forEach(function (b) {
      if (!la(b)) return; var k = b.closest(KHUNG); if (!k) return;
      var nut = b.previousElementSibling && b.previousElementSibling.classList.contains("tat-loc") ? b.previousElementSibling : null;
      if (!nut) {
        nut = document.createElement("button"); nut.type = "button"; nut.className = b.className.replace(/\b(dang-loc|on|active)\b/g, "").trim() + " tat-loc"; nut.textContent = "✕ Tắt lọc";
        nut.addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); var k2 = nut.closest(KHUNG); if (k2) tatLoc(k2); setTimeout(henGan, 60); });
        b.parentNode.insertBefore(nut, b);
      }
      capNhat(nut, k);
    });
  }
  var hT = 0; function henGan() { clearTimeout(hT); hT = setTimeout(gan, 150); }
  var st = document.createElement("style");
  st.textContent = ".tat-loc{margin-right:8px}.tat-loc[disabled]{opacity:.45;cursor:default}";
  (document.head || document.documentElement).appendChild(st);
  new MutationObserver(function (ms) { if (ms.some(function (m) { return !(m.target.closest && m.target.closest(".tat-loc")); })) henGan(); })
    .observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  document.addEventListener("change", henGan, true); document.addEventListener("input", henGan, true);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", gan); else gan();
})();
