/* ===== BỘ LỌC NGÀY CHUẨN — taoBoLocNgay — NGUỒN DUY NHẤT toàn dự án (19/10/2026) =====
 * User 19/10: «dùng bộ lọc ngày ở Hạng mục 5S / Planogram làm chuẩn cho toàn dự án, cả Retail và Factory, cả web và điện thoại;
 * tương lai có bộ lọc ngày thì thiết kế như vậy; bộ lọc nào khác chuẩn thì đổi cho khớp». Khuôn này vốn nằm trong
 * kiemsoatkho/index.html (08/09: Task vi phạm "Ngày ghi nhận" + Planogram "Ngày"); 19/10 tách ra tệp riêng để mọi trang/module
 * dùng chung. Bản gốc: hasaki/kiemsoatkho/bo-loc-ngay.js (+ .css); factory/bo-loc-ngay.js là bản CHÉP Y HỆT (qc-bo-loc-ngay.mjs).
 * CẤM tự dựng lịch / menu ngày / <input type=date> / thư viện lịch riêng — cần chọn ngày thì dựng 1 bản của khuôn này.
 *
 * Mặt chuẩn: nút hiện khoảng đang lọc + pop-up lịch 2 tháng (điện thoại: tấm trượt đáy 1 tháng), nút nhanh, chạm 1 = ngày
 * bắt đầu, chạm 2 = ngày kết thúc, Xoá / Áp dụng. Mọi phần tử bám CLASS (.dp-prev/.dp-months/.dp-sel…) để nhiều bản cùng sống.
 *   o.root        phần tử .date-filter (có thể đã chứa nhãn .lbl) — nút .date-btn + pop-up .date-pop dựng vào đây
 *   o.onApply     function(tu, den) ISO yyyy-mm-dd — gọi khi Áp dụng / Xoá / nút nhanh "Tất cả" (rỗng = không lọc)
 *   o.presets     [{k, lb}] nút nhanh — k chuẩn: today · yesterday · 3 · 7 · 30 · month · all (số = N ngày gần nhất)
 *   o.tinhPreset  function(k) -> [tu, den] | null — trang tự định nghĩa 1 nút nhanh (Planogram: "all" = trọn cửa sổ 7 ngày)
 *   o.coDuLieu    function(iso) -> bool — vẽ CHẤM dưới ngày có dữ liệu (cửa sổ ngắn: nhìn là biết ngày nào trắng)
 *   o.chanNgay    function(iso) -> bool — ngày KHÔNG cho chọn (mờ, không bấm được)
 *   o.motNgay     true → chỉ chọn 1 ngày: chạm = chọn ngày đó (Plan date, lịch phân công theo ngày)
 *   o.khongRong   true → không có trạng thái "không lọc": Xoá = về o.macDinh() (Planogram luôn cần 1 khoảng để vẽ sơ đồ)
 *   o.macDinh     function() -> [tu, den] — giá trị của Xoá khi khongRong
 *   o.nhan        function(tu, den) -> chữ trên nút; trả "" = nhãn mặc định (dd/mm/yyyy → dd/mm/yyyy · "Tất cả")
 *   o.nhanChon    function(a, b) -> chữ ở chân lịch (mặc định như nhãn, chưa chọn = "Chưa chọn")
 *   o.homNay      function() -> ISO hôm nay (mặc định giờ máy) — trang tính theo giờ VN thì truyền vào
 *   o.idNut/idPop id gán cho nút / pop-up (Task vi phạm giữ #btnDate / #datePop cho bộ đo qc-mobile)
 * Trả về { el, dat(tu, den), lay(), mo(), dong(), veNhan(), dangMo() } — dat() chỉ đổi nhãn, KHÔNG gọi onApply. */
(function(){
  if (window.taoBoLocNgay && window.taoBoLocNgay.chuan) return;   // nạp 2 lần (module lazy) thì giữ bản đầu
  var esc = function(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function taoBoLocNgay(o){
    var isoOf = function(y, m, d){ return y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0"); };
    var parseISO = function(s){ var p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
    var fmtVN = function(iso){ var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; };
    var isoD = function(d){ return isoOf(d.getFullYear(), d.getMonth(), d.getDate()); };
    var homNay = function(){ return (o.homNay && o.homNay()) || isoD(new Date()); };
    var PRESETS = o.presets || [{ k: "today", lb: "Hôm nay" }, { k: "7", lb: "7 ngày" }, { k: "30", lb: "30 ngày" }, { k: "month", lb: "Tháng này" }, { k: "all", lb: "Tất cả" }];
    var tu = "", den = "", selA = "", selB = "", view = { y: 0, m: 0 };
    var root = o.root; root.classList.add("date-filter");
    var nut = document.createElement("button"); nut.type = "button"; nut.className = "date-btn"; if (o.idNut) nut.id = o.idNut;
    var pop = document.createElement("div"); pop.className = "date-pop hidden"; if (o.idPop) pop.id = o.idPop;
    pop.innerHTML =
      (PRESETS.length ? '<div class="dp-presets">' + PRESETS.map(function(p){ return '<button type="button" data-preset="' + esc(p.k) + '">' + esc(p.lb) + "</button>"; }).join("") + "</div>" : "") +
      '<div class="dp-nav"><button type="button" class="dp-prev">‹ Trước</button><span></span><button type="button" class="dp-next">Sau ›</button></div>' +
      '<div class="dp-months"></div>' +
      '<div class="dp-foot"><span class="dp-sel">Chưa chọn</span><div><button type="button" class="dp-clear">Xoá</button><button type="button" class="primary dp-apply">Áp dụng</button></div></div>';
    root.appendChild(nut); root.appendChild(pop);
    var q = function(s){ return pop.querySelector(s); };
    var khoang = function(){ var a = selA || tu, b = selB || den || a; if (a && b && a > b){ var t = a; a = b; b = t; } return [a, b]; };
    var nhanMD = function(a, b){ return a ? (b && b !== a ? fmtVN(a) + " → " + fmtVN(b) : fmtVN(a)) : "Tất cả"; };
    var nhan = function(a, b){ return (o.nhan && o.nhan(a, b)) || nhanMD(a, b); };   // o.nhan trả rỗng = dùng nhãn mặc định
    function monthHTML(y, m){
      var first = new Date(y, m, 1), startDow = (first.getDay() + 6) % 7, start = new Date(y, m, 1 - startDow), g = "";
      for (var i = 0; i < 42; i++){ var dt = new Date(start); dt.setDate(start.getDate() + i);
        var iso = isoD(dt), has = o.coDuLieu && o.coDuLieu(iso), khoa = o.chanNgay && o.chanNgay(iso);
        g += '<div class="dp-day' + (dt.getMonth() !== m ? " out" : "") + (has ? " has" : "") + (khoa ? " khoa" : "") + '" data-iso="' + iso + '"' + (has ? ' title="Có dữ liệu"' : "") + ">" + dt.getDate() + "</div>"; }
      var T = ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12"];
      var dow = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(function(x){ return '<div class="dp-dow">' + x + "</div>"; }).join("");
      return '<div class="dp-month"><div class="dp-mtitle">' + T[m] + " " + y + '</div><div class="dp-grid">' + dow + g + "</div></div>";
    }
    function veLich(){ var y = view.y, m = view.m, y2 = m === 11 ? y + 1 : y, m2 = (m + 1) % 12; q(".dp-months").innerHTML = monthHTML(y, m) + monthHTML(y2, m2); toSel(); }
    function toSel(){
      var k = khoang(), a = k[0], b = k[1], T = homNay();
      q(".dp-months").querySelectorAll(".dp-day").forEach(function(el){
        var iso = el.dataset.iso; el.classList.remove("in-range", "edge");
        el.classList.toggle("today", iso === T);
        if (a && b){ if (iso === a || iso === b) el.classList.add("edge"); else if (iso > a && iso < b) el.classList.add("in-range"); }
        else if (a && iso === a) el.classList.add("edge");
      });
      q(".dp-sel").textContent = o.nhanChon ? o.nhanChon(a, b) : (a ? nhanMD(a, b) : "Chưa chọn");
    }
    function veNhan(){ nut.textContent = nhan(tu, den); }
    /* GHIM POP-UP TRONG MÀN: pop neo left:0 theo ô lọc, mà ô lọc nằm sâu trong lề nên trên 375px lịch rộng 94vw vẫn lòi 2-3px
       mép phải → trang kéo ngang (bộ đo bắt 08/09/2026). Đo thật rồi dịch trái vừa đủ. Dùng offsetWidth + left của root (không
       dùng rect của pop: popIn đang scale(.98) lúc này, đo sẽ hụt ~7px). */
    function canhPop(){
      pop.style.left = "0px";
      var W = document.documentElement.clientWidth, le = 8, l0 = root.getBoundingClientRect().left, r0 = l0 + pop.offsetWidth;
      var dx = 0; if (r0 > W - le) dx = W - le - r0; if (l0 + dx < le) dx = le - l0;
      if (dx) pop.style.left = dx + "px";
    }
    /* 19/10: lịch trong khung TỰ CẮT (pop-up dự báo có cuộn, thẻ overflow:hidden, bảng lọc) thì bị xén mất chân Xoá/Áp dụng.
       Đo khung tổ tiên nào cắt → dời lịch ra <body> (position:fixed, neo dưới nút). Mở XUỐNG; chỉ lật lên khi dưới < min(lịch,240)
       và trên rộng hơn (luật o-chon-mo-xuong-popin). */
    function biCat(){
      var r = root.getBoundingClientRect(), day = r.bottom + 6 + pop.offsetHeight, phai = r.left + pop.offsetWidth;
      for (var el = root.parentElement; el && el !== document.body && el !== document.documentElement; el = el.parentElement){
        var cs = getComputedStyle(el);
        if (/(auto|scroll|hidden|clip)/.test(cs.overflowY + cs.overflowX)){ var k = el.getBoundingClientRect(); if (day > k.bottom + 1 || phai > k.right + 1) return true; }
        if (cs.position === "fixed" && day > window.innerHeight - 8) return true;   // trong pop-up cố định (modal): cuộn trang không kéo được lịch vào màn
      }
      return false;
    }
    function neoNgoai(){
      var r = nut.getBoundingClientRect(), W = document.documentElement.clientWidth, H = window.innerHeight, M = 8;
      pop.style.maxHeight = ""; var ph = pop.offsetHeight, pw = pop.offsetWidth;
      var duoi = H - r.bottom - 6 - M, tren = r.top - 6 - M, top;
      if (duoi < Math.min(ph, 240) && tren > duoi){ var h = Math.min(ph, tren); top = r.top - 6 - h; if (h < ph) pop.style.maxHeight = h + "px"; pop.style.transformOrigin = "bottom left"; }
      else { top = r.bottom + 6; if (ph > duoi) pop.style.maxHeight = Math.max(160, duoi) + "px"; pop.style.transformOrigin = "top left"; }
      pop.style.top = Math.round(top) + "px";
      pop.style.left = Math.round(Math.max(M, Math.min(r.left, W - pw - M))) + "px";
    }
    var theoCuon = function(e){ if (pop.classList.contains("dp-noi") && !pop.contains(e.target)) neoNgoai(); };
    var laDT = function(){ return window.matchMedia("(max-width:768px)").matches; };
    function mo(){
      var base = tu ? parseISO(tu) : new Date(); view = { y: base.getFullYear(), m: base.getMonth() }; selA = tu; selB = den; veLich();
      if (laDT()){ pop.classList.add("dp-sheet"); document.body.appendChild(pop); pop.classList.remove("hidden"); pop.style.left = ""; return; }
      pop.classList.remove("hidden"); canhPop();
      if (biCat()){ pop.classList.add("dp-noi"); document.body.appendChild(pop); neoNgoai();
        window.addEventListener("scroll", theoCuon, true); window.addEventListener("resize", neoNgoai); }
    }
    function dong(){
      pop.classList.add("hidden"); pop.style.left = ""; pop.style.top = ""; pop.style.maxHeight = ""; pop.style.transformOrigin = "";
      window.removeEventListener("scroll", theoCuon, true); window.removeEventListener("resize", neoNgoai);
      if (pop.parentNode !== root){ pop.classList.remove("dp-sheet", "dp-noi"); root.appendChild(pop); }
    }
    function chot(a, b){ tu = a || ""; den = b || ""; veNhan(); dong(); o.onApply(tu, den); }
    function xoa(){ selA = selB = ""; if (o.khongRong){ var d = (o.macDinh && o.macDinh()) || [homNay(), homNay()]; chot(d[0], d[1]); } else chot("", ""); }
    function tinhPreset(k){
      var r = o.tinhPreset && o.tinhPreset(k); if (r) return r;
      var t = parseISO(homNay()), lui = function(n){ var s = new Date(t); s.setDate(t.getDate() - n); return isoD(s); };
      if (k === "today") return [isoD(t), isoD(t)];
      if (k === "yesterday") return [lui(1), lui(1)];
      if (k === "month") return [isoOf(t.getFullYear(), t.getMonth(), 1), isoD(t)];
      if (/^\d+$/.test(k)) return [lui(Number(k) - 1), isoD(t)];
      return null;   // 'all' không tự định nghĩa = bỏ lọc
    }
    function nutNhanh(k){
      var r = tinhPreset(k);
      if (!r){ xoa(); return; }
      // Nút nhanh: tự tính [bắt đầu, kết thúc] -> NHẢY lịch tới tháng bắt đầu + TÔ dải; KHÔNG đóng để người dùng thấy trước khi Áp dụng
      selA = r[0]; selB = r[1];
      var base = parseISO(selA); view = { y: base.getFullYear(), m: base.getMonth() }; veLich();
    }
    function shift(n){ var m = view.m + n, y = view.y; if (m < 0){ m = 11; y--; } if (m > 11){ m = 0; y++; } view = { y: y, m: m }; veLich(); }
    nut.addEventListener("click", function(e){ e.stopPropagation(); pop.classList.contains("hidden") ? mo() : dong(); });
    pop.addEventListener("click", function(e){ e.stopPropagation(); });
    q(".dp-prev").addEventListener("click", function(){ shift(-1); });
    q(".dp-next").addEventListener("click", function(){ shift(1); });
    q(".dp-apply").addEventListener("click", function(){ var k = khoang(); if (o.khongRong && !k[0]){ dong(); return; } chot(k[0], k[1]); });
    q(".dp-clear").addEventListener("click", xoa);
    if (PRESETS.length) q(".dp-presets").addEventListener("click", function(e){ var b = e.target.closest("button[data-preset]"); if (b) nutNhanh(b.dataset.preset); });
    // CHỌN KHOẢNG bằng CHẠM/CLICK (Web + Mobile): chạm 1 = ngày bắt đầu, chạm 2 = ngày kết thúc (motNgay: chạm = chọn ngày đó)
    q(".dp-months").addEventListener("click", function(e){
      var c = e.target.closest(".dp-day"); if (!c || c.classList.contains("khoa")) return;
      var iso = c.dataset.iso;
      if (o.motNgay){ selA = selB = iso; }
      else if (!selA || (selA && selB)){ selA = iso; selB = ""; }   // chưa có / đã đủ cặp -> bắt đầu dải MỚI
      else if (iso < selA){ selB = selA; selA = iso; }              // chốt 2 trước ngày 1 -> hoán đổi
      else { selB = iso; }                                          // chốt ngày kết thúc
      toSel();
    });
    // đóng pop-up khi bấm ra ngoài — bám chính root nên nhiều bản trên 1 trang không đóng nhầm nhau
    document.addEventListener("click", function(e){ if (!pop.classList.contains("hidden") && !root.contains(e.target) && !pop.contains(e.target)) dong(); });
    veNhan();
    /* 23/10 tat-loc.js (nút ✕ Tắt lọc) đọc/xoá qua đây — pop có lúc bị dời ra body (điện thoại / khung cắt) nên không tìm .dp-clear trong root được */
    root.__ngay = { lay: function(){ return [tu, den]; }, xoa: xoa,
      macDinh: function(){ return o.khongRong ? ((o.macDinh && o.macDinh()) || [homNay(), homNay()]) : ["", ""]; } };
    return { el: root, dat: function(a, b){ tu = a || ""; den = b || ""; veNhan(); }, lay: function(){ return [tu, den]; }, mo: mo, dong: dong, veNhan: veNhan,
      dangMo: function(){ return !pop.classList.contains("hidden"); } };
  }
  taoBoLocNgay.chuan = 1;
  window.taoBoLocNgay = taoBoLocNgay;
})();
