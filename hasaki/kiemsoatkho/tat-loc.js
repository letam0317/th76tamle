/* tat-loc.js — nút «✕» Tắt lọc đứng sát BÊN TRÁI mọi nút «Bộ lọc» (Retail + Factory, cả pop-up) — 22/10/2026, sửa 23/10/2026.
 * User 22/10: «tạo thêm nút x Tắt lọc kế bên trái nút Bộ lọc — áp dụng toàn bộ các bộ lọc ở các hạng mục hiện có của cả retail và factory».
 * User 23/10 (1): «chỉ sáng đèn nút tắt lọc, tô màu đỏ khi đang áp dụng bộ lọc — không có lọc gì thì ẩn».
 * User 23/10 (2): «di chuyển nút tắt lọc ra bên trái các bộ lọc — luật vẫn vậy, chỉ di chuyển vị trí — chỉ nút X, không thêm chữ».
 *   ✕ vẫn là con của nút (span role=button, chặn sự kiện để bấm ✕ không mở/đóng bộ lọc) nhưng vẽ TUYỆT ĐỐI ra ngoài mép trái
 *   ⇒ không chen vào bố cục hàng (khung space-between / lưới / order không xê dịch). Mép trái hết chỗ (nút sát lề) thì nằm trong nút, sau chữ.
 * Cách làm CHUNG (không sửa từng mục): trong cùng khung với nút «Bộ lọc» (panel / pop-up), đưa mọi điều kiện về MẶC ĐỊNH rồi bắn đúng sự kiện
 * mà mục đó vốn nghe — ô chọn: lựa chọn ĐẦU (đúng như mục tự tính «đang lọc»: Xác minh = khác opt[0], Vi phạm/Kiểm kê = khác "" đứng đầu)
 * + change (+ đồng bộ ô chọn đẹp _csWrap); ô gõ tìm: "" + input/change; bộ lọc ngày chuẩn (bo-loc-ngay.js): bấm nút «Xoá» sẵn có trong khung lịch.
 * 23/10 KIỂM ảnh user (screenshot-1792725099771: «Bộ lọc · đang lọc» mà không có ✕): bản «nhớ giá trị lúc ô hiện lần đầu» coi bộ lọc ĐÃ NHỚ
 *   từ lần trước là mặc định ⇒ ✕ ẩn. Nay: ô chọn so với lựa chọn đầu (không nhớ); ✕ còn bám TÍN HIỆU của chính mục (chữ «đang lọc» /
 *   lớp dang-loc / huy hiệu đếm Factory) — mục nói đang lọc là có ✕. Chỉ lịch ngày còn nhớ chữ lúc hiện đầu (mục có khoảng ngày mặc định).
 * Bản chép: factory/tat-loc.js (sửa ở đây rồi chép sang). */
(function () {
  if (window.__TAT_LOC) return; window.__TAT_LOC = 1;
  var KHUNG = ".modal-box,.modalbox,.hk-dau-panel,.kk-dau-panel,.panel,.pane,section";
  var chuNut = function (b) { var c = b.cloneNode(true), x = c.querySelector(".tat-loc"); if (x) x.remove(); return (c.textContent || "").trim(); };
  var la = function (el) { return el.tagName === "BUTTON" && /^Bộ lọc/.test(chuNut(el)) && !el.classList.contains("tat-loc"); };
  /* mục tự báo đang lọc: chữ «đang lọc», lớp dang-loc, huy hiệu đếm (Factory «Bộ lọc nâng cao» n) */
  var mucBaoLoc = function (b) { var bd = b.querySelector(".fk-adv-badge"); return /đang lọc/.test(chuNut(b)) || b.classList.contains("dang-loc") || !!(bd && !bd.classList.contains("empty") && +bd.textContent > 0); };
  function oCuaKhung(k) {   // các điều kiện lọc trong khung — bỏ qua ô trong bảng dữ liệu / ô quyết định / chính các nút
    var ds = [].slice.call(k.querySelectorAll("select, input[type=search], input[type=text], input:not([type]), .date-filter"));
    return ds.filter(function (x) { return !x.closest("table, .menu, .date-pop, .tk-f, .hx-qd, [data-khong-tat-loc]") && !(x.matches("input") && x.closest(".date-filter")) && !x.disabled; });
  }
  var MD = {};   // lịch ngày: khoá → chữ lúc hiện lần đầu
  function chuNgay(x) { var s = x.querySelector(".dp-sel"); return s ? s.textContent.trim() : ""; }
  function khoaNgay(x) { var k = x.closest(KHUNG); return ((k && (k.id || ((k.parentElement && k.parentElement.closest("[id]")) || {}).id)) || "") + "|" + (x.dataset.ngay || [].indexOf.call(k ? k.querySelectorAll(".date-filter") : [], x)); }
  function ngayMacDinh(x) {
    var kk = khoaNgay(x);
    if (!(kk in MD)) MD[kk] = chuNgay(x);
    return MD[kk];
  }
  function dangLoc(x) {
    if (x.classList.contains("date-filter")) {
      if (x.__ngay) { var md = x.__ngay.macDinh(), v = x.__ngay.lay(); return String(v[0] || "") + "|" + String(v[1] || "") !== String(md[0] || "") + "|" + String(md[1] || ""); }   // 23/10 trạng thái THẬT của lịch
      var c = chuNgay(x); return c !== "Chưa chọn" && c !== ngayMacDinh(x); }
    if (x.tagName === "SELECT") return x.options.length > 0 && x.value !== x.options[0].value;
    return !!String(x.value || "").trim();
  }
  function tatLoc(k, manh) {   // manh = mục báo đang lọc ⇒ lịch ngày khác «Chưa chọn» cũng xoá (khoảng ngày đặt từ trước khi trang mở)
    oCuaKhung(k).forEach(function (x) {
      /* «Xoá» trả về mặc định của mục (mục bắt buộc có ngày → hôm nay/hôm qua) ⇒ chữ sau Xoá chính là mặc định */
      if (x.classList.contains("date-filter") && x.__ngay) { if (dangLoc(x)) x.__ngay.xoa(); return; }   // 23/10 Theo máy: lịch dời ra body → .dp-clear không còn trong ô, xoá thẳng qua API
      if (x.classList.contains("date-filter")) { if (dangLoc(x) || (manh && chuNgay(x) !== "Chưa chọn")) { var b = x.querySelector(".dp-clear"); if (b) { b.click(); MD[khoaNgay(x)] = chuNgay(x); } } return; }
      if (!dangLoc(x)) return;
      if (x.tagName === "SELECT") { x.selectedIndex = 0;
        x.dispatchEvent(new Event("change", { bubbles: true })); if (x._csWrap && typeof x._csWrap._csDongBo === "function") x._csWrap._csDongBo(); return; }
      x.value = ""; x.dispatchEvent(new Event("input", { bubbles: true })); x.dispatchEvent(new Event("change", { bubbles: true }));
      x.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Backspace" }));
    });
  }
  function bam(ev) {
    ev.preventDefault(); ev.stopPropagation();
    var nut = ev.currentTarget, b = nut.parentNode, k = nut.closest(KHUNG); if (k) tatLoc(k, !!b && mucBaoLoc(b)); setTimeout(henGan, 60);
  }
  function gan() {
    [].slice.call(document.querySelectorAll("button")).forEach(function (b) {
      if (!la(b)) return; var k = b.closest(KHUNG); if (!k) return;
      var nut = b.querySelector(":scope > .tat-loc");
      if (!nut) {
        nut = document.createElement("span"); nut.className = "tat-loc"; nut.setAttribute("role", "button"); nut.tabIndex = 0;
        nut.setAttribute("aria-label", "Tắt lọc"); nut.title = "Tắt lọc — bỏ mọi điều kiện lọc ở khung này"; nut.textContent = "✕";
        nut.addEventListener("click", bam);
        nut.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") bam(ev); });
        b.appendChild(nut);
      }
      var hien = mucBaoLoc(b) || oCuaKhung(k).some(dangLoc);
      nut.hidden = !hien;
      if (!hien) { if (b.dataset.tlMl != null) { b.style.removeProperty("margin-left"); if (b.dataset.tlMl) b.style.marginLeft = b.dataset.tlMl; delete b.dataset.tlMl; } return; }
      if (getComputedStyle(b).position === "static") b.classList.add("tl-goc");
      /* đủ chỗ bên trái (≥ 26px trong khung cha) thì vẽ ngoài mép trái; nút sát lề thì nằm trong nút */
      var rb = b.getBoundingClientRect(), rk = (b.parentElement || k).getBoundingClientRect(), trong = rb.width > 0 && rb.left - Math.max(rk.left, 0) < 26;
      if (nut.classList.contains("tl-trong") !== trong) nut.classList.toggle("tl-trong", trong);
      /* 23/10 (đo điện thoại Theo máy): ✕ đè chữ đếm bên cạnh → chỉ khi ĐÈ mới đẩy nút nhường chỗ (nút ghim phải bằng margin-left:auto không đè nên không đụng) */
      var tr = b.previousElementSibling, de = !trong && tr && tr.getBoundingClientRect().right > rb.left - 28;
      if (de && b.dataset.tlMl == null) { b.dataset.tlMl = b.style.marginLeft; b.style.setProperty("margin-left", "28px", "important"); }   // important: khung đầu panel ép margin-left:0!important
    });
  }
  var hT = 0; function henGan() { clearTimeout(hT); hT = setTimeout(gan, 150); }
  var st = document.createElement("style");
  st.textContent = ".tl-goc{position:relative}" +
    ".tat-loc{position:absolute;right:calc(100% + 6px);top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;" +
    "margin:0;padding:0;border-radius:50%;background:var(--bad);color:var(--accent-text);font-size:11px;font-weight:700;line-height:1;cursor:pointer;z-index:1}" +
    ".tat-loc.tl-trong{position:static;transform:none;flex:none;width:18px;height:18px;margin-left:6px;vertical-align:middle}" +
    ".tat-loc:hover{filter:brightness(1.12)}.tat-loc:focus-visible{outline:2px solid var(--bad);outline-offset:2px}.tat-loc[hidden]{display:none!important}";
  (document.head || document.documentElement).appendChild(st);
  var rT = 0;
  new MutationObserver(function (ms) {
    if (!ms.some(function (m) { return !(m.target.closest && m.target.closest(".tat-loc")); })) return;
    /* chữ nút «Bộ lọc» vừa bị ghi lại → ✕ rơi mất: gắn lại ngay khung hình sau, khỏi chớp */
    if (ms.some(function (m) { return m.target.tagName === "BUTTON" && la(m.target); })) { cancelAnimationFrame(rT); rT = requestAnimationFrame(gan); }
    henGan();
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  document.addEventListener("change", henGan, true); document.addEventListener("input", henGan, true);
  window.addEventListener("resize", henGan);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", gan); else gan();
})();
