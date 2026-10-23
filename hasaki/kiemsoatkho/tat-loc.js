/* tat-loc.js — nút «✕» Tắt lọc nằm TRONG mọi nút «Bộ lọc» (Retail + Factory, cả pop-up) — 22/10/2026, sửa 23/10/2026.
 * User 22/10: «tạo thêm nút x Tắt lọc kế bên trái nút Bộ lọc — áp dụng toàn bộ các bộ lọc ở các hạng mục hiện có của cả retail và factory».
 * User 23/10: «di chuyển nút Tắt lọc vào bên trong nút Bộ lọc — chỉ sáng đèn nút tắt lọc, tô màu đỏ khi đang áp dụng bộ lọc — không có lọc gì thì ẩn».
 * Cách làm CHUNG (không sửa từng mục): trong cùng khung với nút «Bộ lọc» (panel / pop-up), đưa mọi điều kiện về trống rồi bắn đúng sự kiện
 * mà mục đó vốn nghe — ô chọn: value "" (không có thì lựa chọn đầu) + change (+ đồng bộ ô chọn đẹp _csWrap); ô gõ tìm: "" + input/change;
 * bộ lọc ngày chuẩn (bo-loc-ngay.js): bấm nút «Xoá» sẵn có trong khung lịch (gọi đúng onApply của mục; mục bắt buộc có khoảng ngày thì về mặc định).
 * ✕ là <span role="button"> (không lồng button trong button), chặn sự kiện để bấm ✕ KHÔNG mở/đóng bộ lọc. Mục tự ghi lại chữ nút
 * (textContent = "Bộ lọc · đang lọc") làm rơi ✕ → MutationObserver gắn lại ngay khung hình sau (nút Bộ lọc) / gộp 150 ms (chỗ khác).
 * 23/10 KIỂM: «Theo máy» ô Trạng thái mặc định «chờ quyết» (không phải lựa chọn đầu) → ✕ đỏ ngay khi mở và bấm ✕ về «Đã xong».
 * Nay nhớ GIÁ TRỊ MẶC ĐỊNH của từng ô lúc ô hiện lần đầu (khoá = khung + thứ tự ô, sống qua lượt vẽ lại): ✕ chỉ hiện khi khác mặc định, bấm thì trả về đúng mặc định.
 * Bản chép: factory/tat-loc.js (sửa ở đây rồi chép sang). */
(function () {
  if (window.__TAT_LOC) return; window.__TAT_LOC = 1;
  var KHUNG = ".modal-box,.modalbox,.hk-dau-panel,.kk-dau-panel,.panel,.pane,section";
  var la = function (el) { return el.tagName === "BUTTON" && /^Bộ lọc/.test((el.textContent || "").trim()) && !el.classList.contains("tat-loc"); };
  function oCuaKhung(k) {   // các điều kiện lọc trong khung — bỏ qua ô trong bảng dữ liệu / ô quyết định / chính các nút
    var ds = [].slice.call(k.querySelectorAll("select, input[type=search], input[type=text], input:not([type]), .date-filter"));
    return nhoMacDinh(k, ds.filter(function (x) { return !x.closest("table, .menu, .date-pop, .tk-f, .hx-qd, [data-khong-tat-loc]") && !(x.matches("input") && x.closest(".date-filter")) && !x.disabled; }));
  }
  var MD = {};   // khoá ô → giá trị lúc hiện lần đầu
  function giaTri(x) { if (x.classList.contains("date-filter")) { var s = x.querySelector(".dp-sel"); return s ? s.textContent.trim() : ""; } return x.tagName === "SELECT" ? x.value : String(x.value || "").trim(); }
  function nhoMacDinh(k, ds) {
    var kk = (k.id || ((k.parentElement && k.parentElement.closest("[id]")) || {}).id || "") + ">" + String(k.className || k.tagName);   // khung chung lớp «panel» ở mọi tab → kèm id tab chứa nó
    ds.forEach(function (x, i) { if (x.__tlKhoa) return; x.__tlKhoa = kk + "|" + i + "|" + x.tagName + (x.id || x.name || "") + (x.tagName === "SELECT" ? "|" + [].slice.call(x.options, 0, 4).map(function (o) { return o.value; }).join(",") : "");
      if (!(x.__tlKhoa in MD)) MD[x.__tlKhoa] = giaTri(x); });
    return ds;
  }
  function macDinh(x) {
    var v = MD[x.__tlKhoa];
    if (x.classList.contains("date-filter")) return v || "Chưa chọn";
    if (x.tagName === "SELECT") { var co = [].some.call(x.options, function (o) { return o.value === v; }); return co ? v : null; }
    return "";
  }
  function dangLoc(x) {
    var m = macDinh(x);
    if (x.tagName === "SELECT" && m === null) { var co = [].some.call(x.options, function (o) { return o.value === ""; }); return co ? x.value !== "" : x.selectedIndex > 0; }
    return giaTri(x) !== m;
  }
  function tatLoc(k) {
    oCuaKhung(k).forEach(function (x) {
      if (!dangLoc(x)) return;
      if (x.classList.contains("date-filter")) { var b = x.querySelector(".dp-clear"); if (b) b.click(); return; }
      if (x.tagName === "SELECT") { var m = macDinh(x), co = [].some.call(x.options, function (o) { return o.value === ""; }); if (m !== null) x.value = m; else if (co) x.value = ""; else x.selectedIndex = 0;
        x.dispatchEvent(new Event("change", { bubbles: true })); if (x._csWrap && typeof x._csWrap._csDongBo === "function") x._csWrap._csDongBo(); return; }
      x.value = ""; x.dispatchEvent(new Event("input", { bubbles: true })); x.dispatchEvent(new Event("change", { bubbles: true }));
      x.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Backspace" }));
    });
  }
  function bam(ev) {
    ev.preventDefault(); ev.stopPropagation();
    var nut = ev.currentTarget, k = nut.closest(KHUNG); if (k) tatLoc(k); setTimeout(henGan, 60);
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
      nut.hidden = !oCuaKhung(k).some(dangLoc);
    });
  }
  var hT = 0; function henGan() { clearTimeout(hT); hT = setTimeout(gan, 150); }
  var st = document.createElement("style");
  st.textContent = ".tat-loc{display:inline-flex;align-items:center;justify-content:center;flex:none;width:18px;height:18px;margin-left:6px;border-radius:50%;" +
    "background:var(--bad);color:var(--accent-text);font-size:11px;font-weight:700;line-height:1;cursor:pointer;vertical-align:middle}" +
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
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", gan); else gan();
})();
