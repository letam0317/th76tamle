/**
 * ============================================================================
 *  hasaki-planogram.js — MODULE "PLANOGRAM" (vệ sinh quầy kệ & không gian làm việc)
 * ============================================================================
 *  Theo dõi VỆ SINH của kho SHOP - 170 QUOC LO 1A theo nguồn planogram
 *  (request-of-declaration). Bố cục THEO HÀNH ĐỘNG (25/07/2026):
 *   1. "Vệ sinh hôm nay" — 4 thẻ: Tổng yêu cầu / Đã vệ sinh / Chưa vệ sinh (phụ
 *      trách CÓ chấm công — cần nhắc) / Không có ca làm việc (phụ trách nghỉ hoặc
 *      chưa có người nhận). Bấm thẻ → pop-up từng yêu cầu: trạng thái thật, người
 *      làm + giờ, ẢNH BÁO CÁO (hotlink công khai, lightbox), link mở planogram.
 *      + ĐỘ PHỦ YÊU CẦU (30/07/2026) — trả lời "đã phát ĐỦ yêu cầu vệ sinh cho mọi kệ /
 *      chỗ làm việc chưa": thanh phủ từng khu vực + dải cảnh báo vị trí BỊ BỎ SÓT, bấm ra
 *      pop-up tách 2 mức "đã dừng phát yêu cầu" ↔ "chưa khai báo lịch". Danh mục vị trí
 *      lấy theo MẶT BẰNG THẬT (dmChuan), KHÔNG lấy từ chính dữ liệu yêu cầu.
 *   2. "Theo khu vực" (độ phủ phụ trách) + panel "Phụ trách vị trí" THU GỌN:
 *      chỉ còn dòng chỉ số + nút "Tra cứu theo nhân viên" → pop-up xem 1 NV làm
 *      việc Ở ĐÂU THEO NGÀY (F0-A8 đổi theo ngày, F0-A1 theo tuần) — tham khảo.
 *   3. "Đối chiếu chấm công hôm nay" (giữ nguyên) — bấm 1 dòng NV mở nhật ký NV đó.
 *
 *  Dữ liệu: 5 tab Sheet 5S do sync-vesinh-all.js ghi (cụm 8h40 / nút Cập nhật ngay):
 *   PHU-TRACH-QUAY-KE · CHAMCONG-VESINH · VESINH-YEUCAU (yêu cầu 7 ngày — 03/08/2026 CẮT 5 cột
 *     suy được, 246KB → 113KB; Khu vực/Trạng thái/PT Name/PT lần cuối nay dashboard tự suy)
 *   · VESINH-ANH (03/08/2026 — ảnh báo cáo tách khỏi VESINH-YEUCAU, nạp BẬC 3 lúc mở pop-up ô
 *     hoặc danh sách yêu cầu; chưa về thì chỉ là không có thumbnail, không lỗi)
 *   · VESINH-NHATKY (NV × ngày × khu vực, 45 ngày) — 01/08/2026 DASHBOARD KHÔNG ĐỌC NỮA:
 *     nhật ký theo nhân viên nay gom từ VESINH-LICHSU (khớp 272/272 dòng, lại phủ 60 ngày)
 *   · VESINH-LICHSU (01/08/2026 — LỊCH SỬ từng lượt báo cáo theo vị trí + GIỜ, cửa sổ trượt 60
 *     ngày, sync tự xoá dòng sang ngày thứ 61): nguồn đối chiếu "ô này ai đã làm, lúc mấy giờ,
 *     mấy lượt do đúng người phụ trách" trong pop-up ô sơ đồ. Nạp BẬC 3 (khi mở pop-up).
 *   · VESINH-CHAMCONG-NGAY (01/08/2026 — CHẤM CÔNG THEO NGÀY 60 ngày, giờ vào ca + giờ ra cuối):
 *     thẻ "Phụ trách" trong pop-up ô hiện chấm công của ĐÚNG NGÀY đang chọn → thấy ngay "hôm đó
 *     ĐI LÀM mà KHÔNG báo cáo" (đi truy) khác "nghỉ" (bố trí người khác). Nạp BẬC 3.
 *   + VESINH-PHANCONG (sync-phancong.mjs) = chủ vị trí chính thức · VESINH-AI = AI xét ảnh.
 *
 *  Đồng bộ thiết kế TUYỆT ĐỐI với các tab khác (khuôn hasaki-tonbatthuong.js):
 *   - Closure kín, CHỈ lộ window.HPLANOGRAM; DOM/CSS tiền tố hp-.
 *   - Màu qua CSS variables portal (--panel/--text/--muted/--line/--accent) — ăn 7 theme.
 *   - Thẻ chỉ số bấm được, pop-up combo chain-filter, animation/độ mượt giữ nguyên.
 *   - Ảnh mở bằng LIGHTBOX CAROUSEL sẵn có của host (openLB) — không chế thêm.
 *
 *  LAZY: host chỉ inject khi người dùng đứng ở HASAKI ▸ Planogram.
 *  API: HPLANOGRAM.init(paneEl) — idempotent; gọi lại chỉ refresh nếu dữ liệu cũ >5'.
 *
 *  NÉN DỌC (30/07/2026): mục tiêu A1 + A8 lọt TRỌN 1 khung nhìn ~800-900px không cuộn —
 *   ô kệ 30×24 gap 3/2, lối đi giữa 8px, legend 1 hàng, alert strip mỏng; KPI 1 hàng
 *   thẻ nền nhuộm màu, progress 6px, chips AI nhỏ; panel "Cần nhắc theo NV" dời sang
 *   cột phải (hpNhacSlot) cho 2 cột cân cao; fitMaps chặn hệ số phóng theo CẢ chiều cao.
 * ============================================================================
 */
(function(){
"use strict";
if (window.HPLANOGRAM) return;

/* ===== CẤU HÌNH ===== */
var SHEET_ID = "1FWffWi75aATbokfqIcqjByEPzkJLQBngTXp5aPOIbLM";   // Sheet 5S (kiemsoatkho)
var SHEET_URL = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/edit";
/* ?src=1: chỉ quản trị mới thấy link Sheet nguồn — dashboard là trang công khai. */
var SHOW_SRC = /[?&]src=1/.test(location.search);
var TAB = "PHU-TRACH-QUAY-KE";
var TAB_CC = "CHAMCONG-VESINH";     // đối chiếu chấm công × vệ sinh hôm nay
var TAB_YC = "VESINH-YEUCAU";       // từng yêu cầu vệ sinh hôm nay (trạng thái, KHÔNG còn ảnh)
/* Ảnh báo cáo tách ra tab riêng 03/08/2026: nó chiếm 44/246KB của VESINH-YEUCAU — tab quyết định
 * lúc nào màn hình có nội dung — mà không khối nào của màn hình đầu cần tới ảnh. Nạp BẬC 3
 * (mở pop-up ô / mở danh sách yêu cầu). Chưa về thì mọi chỗ chỉ đơn giản là không có thumbnail. */
var TAB_ANH = "VESINH-ANH";
/* ẢNH NGÀY CŨ (18/08/2026) — ảnh nay giữ đủ 7 ngày (bằng cửa sổ VESINH-YEUCAU) nhưng chia 2 tab.
 * VÌ SAO KHÔNG DỒN 1 TAB: đo thật 18/08 readTab VESINH-ANH = 398KB/3,1s, 7 ngày sẽ là ~990KB —
 * ai mở pop-up cũng phải gánh, trong khi gần như mọi lượt xem là NGÀY HÔM NAY. Nên tab nhanh giữ
 * nguyên 3 ngày, phần ngày 4→7 nằm đây và CHỈ nạp khi người dùng soi đúng ngày không có trong tab
 * nhanh (canAnhNgay). Chưa nạp = ô ngày cũ không có thumbnail, không lỗi. */
var TAB_ANH_CU = "VESINH-ANH-CU";
/* VESINH-NHATKY: sync vẫn ghi (tab cho người đọc trên Sheet) nhưng DASHBOARD KHÔNG ĐỌC NỮA
 * (01/08/2026). Đối chiếu thật: 272/272 dòng của nó dựng lại được y nguyên từ VESINH-LICHSU
 * (gom theo ngày|email|khu) — mà LICHSU phủ 60 ngày (rộng hơn 45) và đã được nạp trước sẵn cho
 * pop-up ô. Đọc thêm nó chỉ tốn 1 request GAS + 34KB cho cùng một sự thật. */
var TAB_NK_BO = "VESINH-NHATKY";
/* Lịch sử TỪNG LƯỢT báo cáo theo VỊ TRÍ + GIỜ, cửa sổ trượt 60 ngày (sync-vesinh-all.js cộng dồn
 * mỗi lượt rồi tự xoá dòng sang ngày thứ 61). VÌ SAO CẦN: 3 nguồn kia đều bị cắt cửa sổ (YEUCAU 7
 * ngày · quét planogram 45 ngày) và PHU-TRACH chỉ giữ lượt GẦN NHẤT mỗi vị trí — ô nào 45 ngày
 * không ai báo cáo thì pop-up không có ngày nào để hiện, đành in "không rõ ngày". Đây là nguồn duy
 * nhất đối chiếu được "ai đã làm ô này, lúc mấy giờ" trong 60 ngày. Nạp BẬC 3 (lúc mở pop-up ô). */
var TAB_LS = "VESINH-LICHSU";
var LS_NGAY = 60;                   // cửa sổ lịch sử (phải khớp VS_LS_NGAY của sync-vesinh-all.js)
/* CHẤM CÔNG THEO NGÀY 60 ngày (sync-vesinh-all.js gói theo người). Pop-up ô cho chọn NGÀY, mà
 * CHAMCONG-VESINH chỉ có HÔM NAY → xem lại ngày cũ không biết "hôm đó phụ trách CÓ ĐI LÀM mà không
 * báo cáo (đáng truy) hay NGHỈ (phải bố trí người khác)". Nạp BẬC 3 cùng lúc mở pop-up. */
var TAB_CCN = "VESINH-CHAMCONG-NGAY";
var TAB_AI = "VESINH-AI";           // AI xét duyệt ảnh (sync-vesinh-ai.mjs — Claude chấm từng yêu cầu)
/* Bảng phân công phụ trách theo vị trí (sync-phancong.mjs): g-sheet phân công gốc của bộ phận,
 * vị trí nào g-sheet bỏ trống thì bù bằng người báo cáo gần nhất 30 ngày → LUÔN có người.
 * Đây là nguồn CHÍNH THỨC cho "ai phụ trách ô này", thay cho suy đoán "executor gần nhất":
 * đối chiếu 7 ngày báo cáo thật cho thấy 205/205 lượt đều do đúng người được giao làm. */
var TAB_PC = "VESINH-PHANCONG";
var APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
var PG_BASE = "https://planogram.hasaki.vn/asset-management/request-of-declaration";
var STALE_MS = 5 * 60 * 1000;
var CAP = 500;

/* Khu vực -> nhóm vệ sinh (đồng bộ purpose_type planogram: F0-A1 = quầy kệ, F0-A8 = không gian làm việc) */
var AREAS = [
  { k: "A1", lb: "Vệ sinh tủ quầy kệ",         short: "Quầy kệ (F0-A1)",           c: "#2563eb", re: /^F0-A1/i },
  { k: "A8", lb: "Vệ sinh không gian làm việc", short: "Không gian làm việc (F0-A8)", c: "#0891b2", re: /^F0-A8/i }
];
var ST = {
  done:    { k: "done",    lb: "Đã có người phụ trách", c: "#059669" },
  pending: { k: "pending", lb: "Chưa báo cáo",          c: "#9ca3af" }
};
/* Nhóm HÀNH ĐỘNG của 1 yêu cầu vệ sinh.
 * 03/08/2026: dùng được cho CẢ NGÀY QUÁ KHỨ, không chỉ hôm nay. Trước đây phần "phụ trách có
 * chấm công hay không" chỉ có nguồn cho hôm nay (cột PT đi làm của VESINH-YEUCAU) nên xem lại
 * ngày cũ chỉ còn Đã/Chưa — đúng câu hỏi quan trọng nhất ("hôm đó ai ĐI LÀM mà KHÔNG báo cáo?")
 * lại phải bấm từng ô mới biết. Từ 01/08 đã có VESINH-CHAMCONG-NGAY (60 ngày) nên tách được.
 * Nhãn viết trung tính cho cả 2 mốc thời gian (xem YCST_CU cho phần phụ đề của ngày cũ). */
var YCST = [
  { k: "da",    lb: "Đã vệ sinh",           sub: "báo cáo hoàn tất",                     c: "#059669" },
  { k: "nhac",  lb: "Chưa vệ sinh",         sub: "phụ trách CÓ chấm công — cần nhắc",     c: "#dc2626" },
  { k: "khong", lb: "Không có ca làm việc",  sub: "phụ trách nghỉ / chưa có người nhận",   c: "#9ca3af" }
];
/* Phụ đề khi soi NGÀY QUÁ KHỨ: việc phải làm khác hẳn (đi truy chứ không đi nhắc) */
var YCST_CU = { nhac: "phụ trách ĐI LÀM mà không báo cáo", khong: "phụ trách nghỉ hôm đó — không phải lỗi họ" };
var META_CHUA = { k: "chua", lb: "Chưa vệ sinh", sub: "không có báo cáo trong ngày", c: "#dc2626" };

/* ===== HỆ TRẠNG THÁI Ô SƠ ĐỒ (nhiều màu ↔ nhiều việc) — palette status đã kiểm CVD/tương phản.
 * NGUYÊN TẮC: màu status luôn kèm NHÃN (chú giải) + TOOLTIP; chất lượng AI phân biệt thêm bằng HÌNH DẠNG
 * (chấm tròn = Cần xem, tam giác = làm lại) + VẠCH XANH mép trái (đã báo cáo) — không bao giờ chỉ dựa
 * vào màu. Bảng màu và lý do chọn từng màu: xem khối chú giải ngay trên CELLST bên dưới. */
var NGUONG_CANHBAO = 3;   // ≥3 ngày yêu cầu liên tiếp không báo cáo → cảnh báo quá hạn
/* Phụ trách vị trí = executor GẦN NHẤT 45 ngày (heuristic). Backtest 45n (26/07/2026, 250 lượt):
 * A1 98,8% · A8 100% đoán đúng người làm lần kế — NHƯNG mọi lượt đúng đều có bằng chứng ≤7 ngày.
 * Bằng chứng cũ hơn là ngoài vùng kiểm chứng (người có thể đã đổi vị trí/nghỉ) → hạ mức "CHƯA CHẮC":
 * vẫn tô đỏ Chưa VS nhưng gắn badge ? và tách nhóm riêng — KHÔNG réo tên như nhóm chắc chắn. */
var NGUONG_PT_CU = 7;     // bằng chứng phụ trách cũ hơn N ngày → CHƯA CHẮC còn phụ trách
function tuoiNgay(iso){ var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return null;
  var t = new Date(); return Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(+m[1], +m[2] - 1, +m[3])) / 86400000); }
function ptTuoi(r){ return r && r.pt ? tuoiNgay(ptAtCua(r)) : null; }
function ptKhongChac(r){ var t = ptTuoi(r); return t != null && t > NGUONG_PT_CU; }
/* Khoá Ô sơ đồ: A1 gom theo KỆ (dãy-kệ) vì 1 kệ có thể mang nhiều mã mâm-bin qua các ngày
 * (alias — vd kệ 513-02 có 4 mã); tra theo mã đúng từng ký tự sẽ lạc dữ liệu sang ô "trống".
 * A8 giữ nguyên mã đầy đủ (mỗi ô bàn/băng chuyền 1 mã ổn định). */
function khoaO(loc){ var m = String(loc).match(/^F0-A1-(\d{3})-(\d{2})-/); return m ? "F0-A1-" + m[1] + "-" + m[2] : String(loc); }
/* Yêu cầu ĐẠI DIỆN của 1 ô trong 1 ngày (ô alias có thể dính nhiều mã cùng ngày): ưu tiên bản ĐÃ vệ sinh. */
function repCua(list){ if (!list || !list.length) return null;
  for (var i = 0; i < list.length; i++) if (list[i].bk === "da") return list[i];
  return list[0]; }
/* ---------------------------------------------------------------------------
 * PALETTE Ô SƠ ĐỒ (sửa 31/07/2026) — 1 MÀU = 1 BẢN CHẤT, không để hai nghĩa trái ngược
 * nằm cạnh nhau trên vòng màu. Bố cục 2 TRỤC:
 *
 *   TRỤC 1 — HÀNH ĐỘNG (đã báo cáo hay chưa) quyết định HỆ MÀU:
 *      ĐÃ báo cáo   → xanh lá · hổ phách · tím   (+ vạch xanh mép trái, xem `da`)
 *      CHƯA báo cáo → ĐỎ (nhắc được: phụ trách đi làm) · XÁM XANH (không nhắc được: nghỉ/chưa nhận)
 *      Không phát yêu cầu → nét đứt, KHÔNG tô nền (ngoài phạm vi đánh giá)
 *   TRỤC 2 — CHẤT LƯỢNG AI chỉ đổi màu TRONG hệ "đã báo cáo", TUYỆT ĐỐI không mượn đỏ/xám:
 *      đạt hoặc chờ chấm = xanh lá · cần xem lại = hổ phách · không đạt = TÍM
 *
 * Vì sao BỎ cam #ea580c của "AI không đạt": cam sát đỏ #dc2626 → ô "đã làm nhưng AI loại"
 *   trông y như ô "chưa làm", đọc SAI BẢN CHẤT (đúng phản hồi 31/07). Tím nằm đối diện trục
 *   đỏ↔lá nên nhìn là biết "có làm rồi, nhưng phải làm lại"; tím cũng là màu người mù màu
 *   đỏ-lục (deuteran/protan) phân biệt tốt nhất so với cả đỏ và xanh lá.
 * Vì sao KHÔNG dùng xám cho "AI không đạt": xám đã mang nghĩa "ngoài tầm nhắc" (phụ trách nghỉ)
 *   và nét đứt xám = "không có yêu cầu" → dùng lại là chồng nghĩa, đúng cái đang gặp.
 * Vì sao "AI cần xem lại" tách khỏi xanh lá: nó là VIỆC CỦA QUẢN LÝ (vào xem ảnh), không phải
 *   "xong hẳn"; để chung xanh thì không ai biết còn tồn việc. Hổ phách = chờ người phán.
 * remind và chua CÙNG một đỏ vì cùng nghĩa "chưa vệ sinh" — và không bao giờ hiện cùng lúc
 *   (remind chỉ khi xem đúng hôm nay, chua chỉ khi xem quá khứ/khoảng nhiều ngày).
 *
 * Ba trường phụ trợ:
 *   da   = thuộc hệ "đã báo cáo" → thêm VẠCH XANH mép trái ô (kênh thứ 2, không chỉ dựa vào màu)
 *   ink  = "dark": nền sáng (hổ phách) nên chữ trong ô đổi sang mực đậm cho đủ tương phản
 *   ct   = màu CHỮ khi vẽ dạng badge nền nhuộm nhạt (phải đậm hơn màu tô ô mới đọc được)
 * --------------------------------------------------------------------------- */
/* lb = nhãn ĐẦY ĐỦ (tooltip ô, badge pop-up) · sh = nhãn NGẮN cho chú giải 1 hàng: hàng chú giải
   bị chốt 1 dòng (tràn thì cuộn ngang), dùng nhãn dài thì 2 mục cuối bị đẩy ra ngoài màn — chú giải
   đọc không được thì hệ màu coi như không có. Luật đọc đầy đủ nằm ở dòng gợi ý dưới sơ đồ. */
var CELLST = {
  noreq:  { c: "",         lb: "Không có yêu cầu",                    sh: "Không có yêu cầu", dashed: true },
  done:   { c: "#059669",  lb: "Đã vệ sinh (đạt / chờ AI)",           sh: "Đã VS · đạt",           da: true },
  review: { c: "#f59e0b",  lb: "Đã vệ sinh · AI cần xem lại",         sh: "Đã VS · AI cần xem",    da: true, ink: "dark", ct: "#b45309", dot: "#78350f" },
  rework: { c: "#7c3aed",  lb: "Đã vệ sinh · AI không đạt — làm lại", sh: "Đã VS · làm lại",       da: true, ct: "#6d28d9", tri: true },
  /* 03/08/2026 đổi nhãn cho trung tính về thời gian: ô này nay xuất hiện cả khi soi NGÀY CŨ
     (nguồn VESINH-CHAMCONG-NGAY 60 ngày), lúc đó việc phải làm là ĐI TRUY chứ không "nhắc ngay". */
  remind: { c: "#dc2626",  lb: "Chưa vệ sinh · phụ trách CÓ đi làm hôm đó", sh: "Chưa VS · có đi làm" },
  chua:   { c: "#dc2626",  lb: "Chưa vệ sinh",                        sh: "Chưa vệ sinh" },
  noshift:{ c: "#64748b",  lb: "Chưa vệ sinh · phụ trách nghỉ / chưa nhận", sh: "Chưa VS · nghỉ / chưa nhận" }
};
function cellMeta(k){ return CELLST[k] || CELLST.noreq; }
/* Màu CHỮ cho badge nền nhuộm nhạt — nền ô sáng (hổ phách) phải dùng bản đậm hơn */
function cellInk(m){ return m.ct || m.c || "#6b7280"; }
/* Class phụ của ô theo palette: vạch "đã báo cáo" + mực đậm khi nền sáng.
   Ô "done" bỏ vạch — nền đã chính là màu xanh đó, vẽ thêm chỉ là vạch xanh trên xanh. */
function cellCls(m){ return (m.da && !m.dashed && m.c !== CELLST.done.c ? " dalam" : "") + (m.ink === "dark" ? " inkdark" : ""); }
/* NGƯỜI PHỤ TRÁCH ô này HÔM ĐÓ CÓ ĐI LÀM KHÔNG? true / false / null = chưa biết (03/08/2026).
 * Hai nguồn, theo thứ tự tin cậy:
 *   1) VESINH-CHAMCONG-NGAY — chấm công thật theo từng ngày, 60 ngày (nguồn duy nhất cho ngày cũ)
 *   2) cột "PT đi làm" của VESINH-YEUCAU — CHỈ đúng cho hôm nay, dùng khi tab (1) chưa về
 * null có nghĩa "chưa đủ dữ liệu để phán", KHÔNG phải "nghỉ" — phải giữ tách bạch để không tô đỏ
 * oan người nghỉ phép, cũng không xoá dấu người đi làm mà im lặng.
 * Chủ ô lấy theo BẢNG PHÂN CÔNG trước (pcCua — nguồn chính thức, nạp bậc 1), rớt về cột của yêu cầu. */
function ptDiLamNgay(r, dd){
  if (!r || !dd) return null;
  var pc = pcCua(r.loc);
  var em = (pc && pc.em) || r.pt, code = (pc && pc.code) || r.ptCode;
  if (!em && !code) return null;
  if (S.ccn.ok){
    var cn = ccNgayCua(em, code, dd);
    /* ngoaiTam = ngày đó không có dòng chấm công nào của cả đội (ngoài 60 ngày / cả đội nghỉ)
       → không kết luận được, rơi xuống nguồn 2. */
    if (cn && !cn.ngoaiTam) return !!cn.co;
  }
  if (dd === isoToday()) return !!r.ptDiLam;
  return null;
}
/* trạng thái 1 ô cho 1 NGÀY cụ thể dd (r = yêu cầu của ô ngày đó, hoặc null) */
function cellStateDay(r, dd){
  if (!r) return "noreq";
  if (r.bk === "da"){
    var ai = aiOf(r);
    if (ai){ if (ai.kl === "KHONG_DAT") return "rework"; if (ai.kl === "CAN_XEM") return "review"; }
    return "done";
  }
  var dl = ptDiLamNgay(r, dd);
  if (dl === true) return "remind";     // chưa vệ sinh mà hôm đó CÓ đi làm
  if (dl === false) return "noshift";   // nghỉ / không chấm công → lỗi bố trí, không đi truy
  return dd === isoToday() ? "noshift" : "chua";   // chưa đủ dữ liệu chấm công → chỉ nói "chưa vệ sinh"
}
function cellState1(r){ return cellStateDay(r, ngayXem()); }
/* trạng thái 1 ô cho KHOẢNG nhiều ngày (list = các yêu cầu của ô trong khoảng) */
function cellStateN(list){
  if (!list || !list.length) return "noreq";
  if (list.some(function(r){ return r.bk !== "da"; })) return "chua";      // có ngày chưa VS
  if (list.some(function(r){ var a = aiOf(r); return a && a.kl === "KHONG_DAT"; })) return "rework";
  return "done";
}
/* Cảnh báo quá hạn: mỗi vị trí, đếm số NGÀY yêu cầu GẦN NHẤT LIÊN TIẾP không báo cáo (toàn bộ dữ liệu) */
function tinhCanhBao(){
  if (!S.yc.ok) return {};
  /* gom theo KHOÁ Ô rồi theo NGÀY: ô alias (A1) nhiều mã cùng kệ không làm gãy chuỗi;
     1 ngày có nhiều yêu cầu thì "đã báo cáo" khi BẤT KỲ yêu cầu nào của ngày đó đã VS. */
  var byLoc = {}; S.yc.rows.forEach(function(r){ var k = khoaO(r.loc);
    var m = byLoc[k] = byLoc[k] || {}; (m[r.ngay] = m[r.ngay] || []).push(r); });
  var al = {};
  Object.keys(byLoc).forEach(function(loc){
    var days = Object.keys(byLoc[loc]).sort().reverse();   // mới → cũ
    var streak = 0;
    for (var i = 0; i < days.length; i++){
      if (byLoc[loc][days[i]].some(function(r){ return r.bk === "da"; })) break;
      streak++;
    }
    if (streak >= NGUONG_CANHBAO) al[loc] = streak;
  });
  return al;
}
function ycMeta(k){ if (k === "chua") return META_CHUA;
  for (var i = 0; i < YCST.length; i++) if (YCST[i].k === k) return YCST[i]; return { k: k, lb: k, sub: "", c: "#6b7280" }; }
function ycBucket(r){
  if (r.stId === 3 || r.stId === 4 || /approve/i.test(r.st)) return "da";
  if (r.pt && r.ptDiLam) return "nhac";
  return "khong";
}
/* KHOẢNG NGÀY đang xem (S.dTu → S.dDen). Đúng 1 ngày = hôm nay → chia 3 nhóm hành động
 * (nhắc được theo chấm công hôm nay); mọi khoảng khác chỉ còn Đã/Chưa vệ sinh. */
function ngayXem(){ return S.dDen || S.yc.ngay; }
function khoang(){ var d = ngayXem(); return [S.dTu || d, S.dDen || d]; }
function laHomNay(){ var k = khoang(); return k[0] === isoToday() && k[1] === isoToday(); }
function la1Ngay(){ var k = khoang(); return k[0] === k[1]; }
/* CÓ TÁCH ĐƯỢC "đi làm mà không báo cáo" ↔ "nghỉ" cho khoảng đang xem không? (03/08/2026)
 * Cần: đúng 1 ngày (gộp nhiều ngày thì một người vừa đi làm vừa nghỉ, tách ra vô nghĩa) VÀ có
 * nguồn chấm công của ngày đó — hôm nay thì luôn có, ngày cũ thì phải chờ VESINH-CHAMCONG-NGAY. */
function coTachCa(){ if (!la1Ngay()) return false;
  return laHomNay() || !!(S.ccn.ok && S.ccn.ngay[ngayXem()]); }
function bkNgay(r){
  if (r.bk === "da") return "da";
  if (!la1Ngay()) return "chua";           // khoảng nhiều ngày → chỉ Đã/Chưa
  var dl = ptDiLamNgay(r, ngayXem());
  if (dl === true) return "nhac";
  if (dl === false) return "khong";
  return laHomNay() ? r.bk : "chua";       // chưa đủ dữ liệu chấm công của ngày cũ
}
function ycDates(){ var s = {}; S.yc.rows.forEach(function(r){ if (r.ngay) s[r.ngay] = 1; }); return Object.keys(s).sort().reverse(); }
function nhanKhoang(){
  var k = khoang();
  if (k[0] === k[1]) return (k[0] === isoToday() ? "Hôm nay · " : "") + thuVN(k[0]) + " " + ngayVN(k[0]);
  return ngayVN(k[0]) + " – " + ngayVN(k[1]) + " (" + (ycDates().filter(function(d){ return d >= k[0] && d <= k[1]; }).length) + " ngày)";
}
function setKhoang(tu, den){
  if (tu > den){ var t = tu; tu = den; den = t; }
  S.dTu = tu; S.dDen = den; S.ptHi = "";   // đổi khoảng ngày → bỏ chế độ soi NV (nhóm NV đổi theo ngày)
  /* 03/08/2026: soi 1 NGÀY CŨ cũng tách được "đi làm mà không báo cáo" ↔ "nghỉ", nhưng phải có
     VESINH-CHAMCONG-NGAY. Bình thường loadData đã nạp trước ở giây thứ 4; gọi lại ở đây để người
     bấm ngày sớm hơn thế (hoặc lượt nạp trước hỏng) vẫn có, thay vì im lặng tụt về "chỉ Đã/Chưa". */
  if (tu === den && tu !== isoToday()) canCCN();
  /* Ảnh: chỉ đi tìm khi người dùng ĐÃ từng cần ảnh trong phiên này (S.anh.ok) — canAnhNgay tự
     đứng im nếu tab nhanh đã phủ khoảng ngày mới chọn. */
  canAnhNgay();
  renderWhBar(); renderToday(); renderList();
}
function setPtHi(e){ S.ptHi = (S.ptHi === e || !e) ? "" : e; renderMap(); }
function togglePtNhac(){ S.ptOpen = !S.ptOpen; renderMap(); }
function setNgay(d){ setKhoang(d, d); }
function chonNgay(v){
  var ds = ycDates();   // giảm dần, ds[0] = mới nhất
  if (!ds.length) return;
  if (v === "hnay") setKhoang(ds[0], ds[0]);
  else if (v === "hqua") setKhoang(ds[1] || ds[0], ds[1] || ds[0]);
  else if (v === "3n") setKhoang(ds[Math.min(2, ds.length - 1)], ds[0]);
  else if (v === "7n") setKhoang(ds[ds.length - 1], ds[0]);
  else setKhoang(v, v);
}
function moNgayMenu(){
  var m = $id("hpNgayMenu"); if (!m) return;
  m.classList.toggle("show");
}
/* Badge trạng thái HỆ THỐNG planogram của 1 yêu cầu */
function stBadge(r){
  var lb = r.st || "—", c = "#6b7280";
  if (r.stId === 1 || /new/i.test(r.st)){ lb = "Chưa vệ sinh"; c = "#dc2626"; }
  else if (/waiting/i.test(r.st) || r.stId === 3){ lb = "Chờ duyệt"; c = "#0891b2"; }
  else if (/approved/i.test(r.st) || r.stId === 4){ lb = "Đã duyệt"; c = "#059669"; }
  else if (/reject/i.test(r.st)){ lb = "Bị từ chối"; c = "#ef4444"; }
  else if (/cancel/i.test(r.st)){ lb = "Huỷ"; c = "#6b7280"; }
  return '<span class="badge" title="' + esc(r.st || "") + '" style="background:color-mix(in srgb,' + c + ' 15%,transparent);color:' + c + '">' + esc(lb) + '</span>';
}
var PAL = ["#f59e0b", "#8b5cf6", "#ef4444", "#10b981", "#ec4899", "#6366f1", "#0891b2", "#84cc16", "#2563eb", "#d97706"];
/* Nhận diện cột theo NHÃN header (chấp nhận tiếng Anh/Việt/snake_case) */
var COLS = {
  loc:   ["location", "mã vị trí", "ma vi tri", "vị trí", "vi tri"],
  email: ["executed by", "executed_by", "email", "mail", "mail hasaki", "mail hsk"],
  code:  ["code", "mã nv", "ma nv", "mã nhân viên", "id nhân viên", "id nhan vien"],
  name:  ["name", "tên", "ten", "tên nhân viên", "ten nhan vien", "họ tên", "ho ten"],
  at:    ["executed at", "executed_at"]
};
/* Cột tab CHAMCONG-VESINH */
var COLS_CC = {
  code:  ["code", "mã nv", "ma nv"],
  name:  ["name", "tên", "ten", "họ tên"],
  email: ["email", "mail", "mail hasaki"],
  major: ["major", "nghiệp vụ", "nghiep vu"],
  ci:    ["giờ vào", "gio vao", "check in", "check_in"],
  co:    ["giờ ra", "gio ra", "check out", "check_out"],
  vs:    ["đã vệ sinh hôm nay", "da ve sinh hom nay", "đã vệ sinh", "da ve sinh"],
  loc:   ["vị trí gần nhất", "vi tri gan nhat", "vị trí", "location"],
  tt:    ["trạng thái", "trang thai", "status"]
};
/* Cột tab VESINH-YEUCAU.
 * 03/08/2026 — sync BỎ 5 cột suy được (tab 246KB → 113KB, tab nặng nhất lúc mở trang):
 *   Khu vực    → dashboard vốn đã tự suy từ tiền tố Location (areaOf), chưa từng đọc cột này
 *   Trạng thái → ST_TEN[Status ID] (đo 1.246 dòng: ánh xạ 1:1, không ngoại lệ)
 *   PT Name    → tenNm(email) từ PHU-TRACH + VESINH-PHANCONG (0/47 email tra không ra)
 *   PT lần cuối→ cột Executed At của PHU-TRACH-QUAY-KE cùng Location (khớp 1246/1246)
 *   Ảnh        → tab VESINH-ANH riêng, nạp bậc 3
 * VẪN khai báo tên cột cũ: sheet/cache phiên có thể còn dữ liệu bản cũ, đọc được thì ưu tiên dùng. */
var COLS_YC = {
  id:     ["request id", "request_id", "id"],
  ngay:   ["ngày", "ngay", "date"],
  loc:    ["location", "vị trí", "vi tri"],
  stid:   ["status id", "status_id"],
  st:     ["trạng thái", "trang thai", "status"],
  email:  ["executed by", "executed_by"],
  at:     ["executed at", "executed_at"],
  pt:     ["phụ trách", "phu trach"],
  ptcode: ["pt code"],
  ptname: ["pt name"],
  ptdilam:["pt đi làm", "pt di lam"],
  ptci:   ["pt giờ vào", "pt gio vao"],
  anh:    ["ảnh", "anh", "images"],
  ptat:   ["pt lần cuối", "pt lan cuoi"]
};
/* Status ID → tên trạng thái WMS. Đo trên toàn bộ 1.246 dòng đang chạy (03/08/2026):
   1 New ×174 · 3 Waiting For Approve ×154 · 4 Approved ×5 · 7 Not Performed ×913.
   Mã lạ ngoài bảng → hiện "#<id>"; sync-vesinh-all.js cũng log cảnh báo khi WMS đẻ mã mới. */
/* 2 = Processing: bộ sync đã cảnh báo "STATUS LẠ ngoài bảng tra" ngày 12/08/2026 (2 yêu cầu) —
   thiếu nhãn thì badge in "#2". Chỉ là TÊN hiển thị: ycBucket phân nhóm theo stId 3/4 nên thêm
   dòng này không dịch chuyển con số nào của KPI. */
var ST_TEN = { 1: "New", 2: "Processing", 3: "Waiting For Approve", 4: "Approved", 7: "Not Performed" };
/* Cột tab VESINH-ANH (ảnh báo cáo tách khỏi VESINH-YEUCAU) */
var COLS_ANH = { id: ["request id", "request_id", "id"], ngay: ["ngày", "ngay"], anh: ["ảnh", "anh", "images"] };
/* Cột tab VESINH-AI + nhãn kết luận AI */
var COLS_AI = {
  id:     ["request id", "request_id", "id"],
  ngay:   ["ngày", "ngay", "date"],
  loc:    ["location", "vị trí", "vi tri"],
  exec:   ["executor", "executed by", "email"],
  at:     ["executed at", "executed_at"],
  kl:     ["kết luận", "ket luan", "verdict"],
  diem:   ["điểm", "diem", "score"],
  tincay: ["tin cậy", "tin cay", "confidence"],
  lydo:   ["lý do", "ly do", "reason"],
  anhloi: ["ảnh lỗi", "anh loi"],
  model:  ["model"],
  jat:    ["judged at", "judged_at"]
};
/* Màu kết luận AI phải KHỚP màu ô sơ đồ (CELLST bên dưới) — cùng một sự thật thì cùng một màu,
 * nếu không người dùng thấy ô tím trên sơ đồ mà chip dưới danh sách lại đỏ, hiểu thành 2 việc khác nhau.
 * KHONG_DAT đổi đỏ → TÍM 31/07: đỏ được giữ riêng cho "CHƯA vệ sinh"; AI loại là "đã làm, phải làm lại".
 * CAN_XEM dùng bản hổ phách ĐẬM hơn ô (#d97706 vs #f59e0b) vì ở đây màu vừa tô chấm vừa làm màu CHỮ
 * trên badge nền nhuộm nhạt — hổ phách sáng làm chữ thì không đọc được. */
var AIST = [
  { k: "DAT",       lb: "AI: Đạt",       c: "#059669" },
  { k: "KHONG_DAT", lb: "AI: Không đạt", c: "#7c3aed" },
  { k: "CAN_XEM",   lb: "AI: Cần xem",   c: "#d97706" }
];
function aiMeta(k){ for (var i = 0; i < AIST.length; i++) if (AIST[i].k === k) return AIST[i]; return null; }
/* Cột tab VESINH-PHANCONG (Location đã ở dạng khoá ô: A1 = mức KỆ, A8 = mã đầy đủ) */
var COLS_PC = {
  loc:   ["location", "vị trí", "vi tri"],
  em:    ["responsible by", "responsible", "email", "phụ trách"],
  code:  ["code", "msnv", "mã nv"],
  ten:   ["name", "tên", "họ và tên"],
  nguon: ["nguồn", "nguon", "source"],
  bc:    ["bằng chứng", "bang chung"],
  gc:    ["ghi chú", "ghi chu", "note"]
};
/* Cột tab VESINH-LICHSU (1 dòng = 1 lượt báo cáo thật: vị trí + ngày + GIỜ + người) */
var COLS_LS = {
  ngay:  ["ngày", "ngay", "date"],
  gio:   ["giờ", "gio", "time"],
  loc:   ["location", "vị trí", "vi tri"],
  email: ["executed by", "executed_by", "email"],
  code:  ["code", "mã nv", "ma nv"],
  name:  ["name", "tên", "ten"],
  id:    ["request id", "request_id"]
};
/* Cột tab VESINH-CHAMCONG-NGAY (chấm công gói theo người: 1 dòng = 1 NV × nhiều ngày) */
var COLS_CCN = {
  code:  ["code", "mã nv", "ma nv"],
  name:  ["name", "tên", "ten"],
  email: ["email", "mail"],
  ds:    ["chấm công theo ngày (ngày vào-ra)", "chấm công theo ngày", "chấm công", "cham cong"]
};
/* Nhóm trạng thái chấm công (màu + nhãn) */
var CCST = [
  { k: "chua", lb: "Đi làm - chưa vệ sinh", short: "Chưa vệ sinh", c: "#dc2626" },
  { k: "da",   lb: "Đi làm - đã vệ sinh",   short: "Đã vệ sinh",   c: "#059669" },
  { k: "nghi", lb: "Nghỉ / không chấm công", short: "Nghỉ",        c: "#9ca3af" }
];
function ccBucket(tt){ tt = String(tt || "").toLowerCase();
  if (/nghỉ|nghi|không chấm|khong cham/.test(tt)) return "nghi";
  if (/chưa|chua/.test(tt)) return "chua";
  if (/đã|da/.test(tt)) return "da";
  return "nghi";
}
function ccMeta(k){ for (var i = 0; i < CCST.length; i++) if (CCST[i].k === k) return CCST[i]; return { k: k, lb: k, short: k, c: "#6b7280" }; }
/* Google Sheet tự nhận "07:52" thành kiểu GIỜ → gviz trả "Date(1899,11,30,7,52,0)". Chuẩn hoá về HH:MM. */
function fmtHM(v){ v = String(v == null ? "" : v).trim();
  var m = v.match(/^Date\(\d+,\d+,\d+,(\d+),(\d+)/); if (!m) return v;
  var h = Number(m[1]), mi = Number(m[2]); return (h < 10 ? "0" : "") + h + ":" + (mi < 10 ? "0" : "") + mi; }
function p2(n){ return (n < 10 ? "0" : "") + n; }
/* Chuẩn hoá ô NGÀY về ISO yyyy-mm-dd (Sheet có thể trả Date(...) / ISO / dd/mm/yyyy) */
function fmtNgay(v){ v = String(v == null ? "" : v).trim();
  var m = v.match(/^Date\((\d+),(\d+),(\d+)/); if (m) return m[1] + "-" + p2(+m[2] + 1) + "-" + p2(+m[3]);
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + "-" + m[2] + "-" + m[3];
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return m[3] + "-" + p2(+m[2]) + "-" + p2(+m[1]);
  return v; }
/* Chuẩn hoá ô NGÀY+GIỜ (Executed At) — gviz có thể trả "Date(2026,6,25,6,1,41)" */
function fmtNgayGio(v){ v = String(v == null ? "" : v).trim();
  var m = v.match(/^Date\((\d+),(\d+),(\d+),(\d+),(\d+)/);
  if (m) return m[1] + "-" + p2(+m[2] + 1) + "-" + p2(+m[3]) + " " + p2(+m[4]) + ":" + p2(+m[5]);
  return v; }
function isoToday(){ var d = new Date(); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }
function ngayVN(iso){ var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "/" + m[2] : iso; }
function thuVN(iso){ var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return "";
  var d = new Date(+m[1], +m[2] - 1, +m[3]).getDay(); return d === 0 ? "CN" : "T" + (d + 1); }
/* Ảnh báo cáo: MỌI url ảnh planogram dùng chung 76 ký tự đầu, đúng một nửa độ dài trung bình
 * (đo 30/07: 1000 ảnh × 154 ký tự). sync-vesinh-all.js ghi vào Sheet phần ĐUÔI, dashboard ghép
 * lại tiền tố → payload tab VESINH-YEUCAU nhẹ đi 74KB mỗi lượt tải mà không mất gì.
 * Vẫn nhận url đầy đủ để đọc được dòng cũ trong Sheet / bản sync chưa cập nhật. */
var ANH_PREFIX = "https://wms-gw-external.hasaki.vn/api/v1/filesmanagement/planogram/standard/";
function urlAnh(s){ s = String(s || ""); return (!s || /^https?:\/\//i.test(s)) ? s : ANH_PREFIX + s; }
/* Link planogram */
function pgDetailUrl(id){ return PG_BASE + "/details/" + id; }
function pgListUrl(isoNgay, areaK, stIds, isoNgayDen){
  function moc(iso){ var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return (m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date()).getTime(); }
  var f = moc(isoNgay), t = moc(isoNgayDen || isoNgay) + 86399999;
  var u = PG_BASE + "/list?company_ids=1001&warehouse_ids=863&keyword_type=sku_or_barcode&page=1&size=100&from_date=" + f + "&to_date=" + t;
  if (areaK) u += "&location_description=F0-" + areaK;
  if (stIds) u += "&status_ids=" + stIds;
  return u;
}
/* Lịch của ĐÚNG 1 vị trí (45 ngày) — dùng cho vị trí KHÔNG có yêu cầu: mở planogram xem
 * vị trí đó còn lịch nào không, thay vì mở danh sách cả khu vực rồi tự dò. */
function pgLocUrl(loc){
  var t = new Date().getTime(), f = t - 45 * 86400000;
  return PG_BASE + "/list?company_ids=1001&warehouse_ids=863&keyword_type=sku_or_barcode&page=1&size=100&from_date=" + f + "&to_date=" + t +
    "&location_description=" + encodeURIComponent(loc);
}

/* ===== STATE ===== */
/* dang = ĐANG chờ mạng cho nguồn đó (nạp phân bậc) → UI hiện "đang tải" thay vì "không có dữ liệu" */
var S = { ok: false, dangPT: false, all: [], area: "", lastAt: 0, tsData: 0,
  cc: { ok: false, dang: false, rows: [], ts: 0 }, ccStatus: "", ccQ: "",
  yc: { ok: false, dang: false, rows: [], ts: 0, ngay: "" },
  ls: { ok: false, dang: false, by: {}, ev: [], ts: 0, n: 0 },   // by[khoá ô] = [lượt báo cáo] mới → cũ (60 ngày) — nguồn "báo cáo gần nhất" của pop-up
  ccn: { ok: false, dang: false, em: {}, code: {}, ts: 0, ngay: {} },   // chấm công theo ngày: em/code -> { ten, d:{ngày:{vao,ra}} } · ngay = tập ngày CÓ dữ liệu
  anh: { ok: false, dang: false, by: {}, ts: 0, ngay: {} },   // ảnh báo cáo tách tab (bậc 3): by[request id] = [url…] · ngay = tập NGÀY có trong tab nhanh
  anhcu: { ok: false, dang: false, ts: 0 },   // ảnh ngày 4→7 (tab VESINH-ANH-CU) — nạp thêm khi soi ngày cũ, gộp thẳng vào anh.by
  ai: { ok: false, dang: false, by: {}, rows: [], ts: 0 }, aiKl: "", aiQ: "",
  pc: { ok: false, dang: false, by: {}, ts: 0 },   // by[khoá ô] = { em, code, ten, nguon, bc, gc }
  dTu: "", dDen: "", listMode: "ai", ptHi: "", ptOpen: false };   // dTu→dDen = KHOẢNG NGÀY đang xem; listMode = panel danh sách (ai | nv); ptHi = email NV đang SOI; ptOpen = panel cần-nhắc đang xổ
var MODAL = { base: [], preset: null, mode: "loc" };
var NK = { email: "", q: "" };
var PANE = null, _nmColor = {}, _nmCi = 0, _deb = null, _debT = null, _ccDeb = null, _nkDeb = null, _fitT = null, _animT = null, _fitW = 0, _fitZ = 0;   // _fitW/_fitZ: bề rộng + hệ số zoom lượt fit trước (chống rung)
/* Bật animation VÀO cho lượt vẽ kế tiếp rồi tự tắt — chỉ dùng khi nội dung MỚI THẬT
 * (tải đầu / Làm mới). Re-render do bấm lọc thì render tức thì, không chớp trắng. */
function animBat(){
  if (!PANE) return;
  PANE.classList.add("hp-anim");
  clearTimeout(_animT);
  _animT = setTimeout(function(){ if (PANE) PANE.classList.remove("hp-anim"); }, 900);
}
var _emNm = {};   // email(lower) -> { code, name } (gom từ PT + NK để hiện tên người thực hiện)

var $id = function(s){ return document.getElementById(s); };
function nf(x){ return (x || 0).toLocaleString("vi-VN"); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function fmtTime(ms){ var d = new Date(ms); function p(n){ return (n < 10 ? "0" : "") + n; }
  return p(d.getHours()) + ":" + p(d.getMinutes()) + " " + p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); }
function idxOf(H, aliases){ for (var i = 0; i < aliases.length; i++){ var j = H.indexOf(aliases[i]); if (j >= 0) return j; } return -1; }
function areaOf(loc){ for (var i = 0; i < AREAS.length; i++) if (AREAS[i].re.test(loc)) return AREAS[i]; return null; }
function areaMeta(k){ for (var i = 0; i < AREAS.length; i++) if (AREAS[i].k === k) return AREAS[i]; return { k: k, lb: k, short: k, c: "#6b7280" }; }
function nmColor(n){ if (!_nmColor[n]) _nmColor[n] = PAL[_nmCi++ % PAL.length]; return _nmColor[n]; }
function pct(a, b){ return b ? Math.round(a / b * 100) : 0; }
function ghiNhoNm(email, code, name){ var k = String(email || "").toLowerCase(); if (!k) return;
  var o = _emNm[k] || (_emNm[k] = { code: "", name: "" }); if (code && !o.code) o.code = code; if (name && !o.name) o.name = name; }
function tenNm(email){ var o = _emNm[String(email || "").toLowerCase()]; return (o && o.name) ? o.name : ""; }

/* ===== CSS — bơm 1 lần, neo #pane-planogram / .hp-modal (khuôn ht-*) ===== */
var CSS = [
"#pane-planogram .hp-srcbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0 10px;font-size:12.5px;}",
/* nguồn/mô tả/Làm mới ĐƯA XUỐNG CHÂN tab — đồng bộ với footer .foot của các tab native (ghi chú ở dưới) */
"#pane-planogram .hp-srcfoot{margin-top:10px;padding-top:10px;border-top:1px solid var(--border,#e8ecf1);text-align:center;}",
"#pane-planogram .hp-srcfoot .hp-srcbar{margin:0 0 6px;justify-content:center;font-size:12px;}",
"#pane-planogram .hp-srcfoot .hp-hint{display:inline;}",
"#pane-planogram .hp-chip{background:color-mix(in srgb, var(--accent,#326e51) 14%, transparent);color:var(--accent,#326e51);border-radius:999px;padding:4px 13px;font-weight:650;font-size:12px;}",
"#pane-planogram .hp-srcbar a,#pane-planogram .hp-ext,.hp-modal .hp-ext{color:var(--accent,#326e51);text-decoration:none;font-weight:600;}",
"#pane-planogram .hp-srcbar a:hover,#pane-planogram .hp-ext:hover,.hp-modal .hp-ext:hover{text-decoration:underline;}",
/* .hp-hint / .hp-badge phải phủ CẢ pop-up: modal được append vào <body> nên nằm NGOÀI
   #pane-planogram — trước 31/07 hai class này trong pop-up vị trí không ăn style nào
   (chữ phụ to bằng chữ chính, badge mất viên thuốc), cùng khuôn với .hp-ext đã làm sẵn. */
"#pane-planogram .hp-hint,.hp-modal .hp-hint{color:var(--muted,#9ca3af);font-size:11.5px;font-weight:400;}",
"#hpReload,#pane-planogram .hp-btn{background:var(--accent,#326e51);color:var(--accent-text,#fff);border:0;border-radius:9px;padding:8px 15px;font-size:12.5px;font-weight:650;cursor:pointer;min-height:36px;transition:transform .16s cubic-bezier(.32,.72,0,1),box-shadow .25s ease;}",
"#pane-planogram .hp-btn:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(16,24,40,.16);}",
"#hpReload:disabled{background:color-mix(in srgb, var(--muted,#9ca3af) 42%, var(--surface,#fff));color:var(--muted,#9ca3af);cursor:not-allowed;}",
"#pane-planogram .hp-whbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px;}",
"#pane-planogram .hp-whtab{border:1px solid var(--border,#e8ecf1);background:var(--surface,#fff);color:var(--text,#374151);border-radius:999px;padding:6px 13px;font-size:12px;font-weight:600;cursor:pointer;min-height:32px;display:inline-flex;align-items:center;gap:7px;transition:background .16s ease,border-color .16s ease;}",
"#pane-planogram .hp-whtab:hover{background:color-mix(in srgb, var(--accent,#326e51) 8%, transparent);}",
"#pane-planogram .hp-whtab.active{background:var(--accent,#326e51);color:var(--accent-text,#fff);border-color:var(--accent,#326e51);}",
"#pane-planogram .hp-whtab b{font-variant-numeric:tabular-nums;}",
"#pane-planogram .hp-datesel{border:1px solid var(--border,#d5dbe4);background:var(--surface,#fff);color:var(--text,#1f2937);border-radius:999px;padding:6px 13px;font-size:12px;font-weight:600;min-height:32px;cursor:pointer;transition:border-color .16s ease;}",
"#pane-planogram .hp-datesel:hover{border-color:var(--accent,#326e51);}",
"#pane-planogram .hp-datesel:focus{outline:0;border-color:var(--accent,#326e51);}",
"@media(max-width:768px){#pane-planogram .hp-datesel{min-height:44px;}}",
"#pane-planogram .hp-dot,.hp-modal .hp-dot{display:inline-block;width:9px;height:9px;border-radius:50%;flex:none;vertical-align:middle;}",
/* KPI XẾP DỌC (30/07) — mỗi chỉ số MỘT HÀNG: số to bên trái, nhãn + phụ đề bên phải.
   Cột phải chỉ 380px: 4 thẻ nằm ngang thì mỗi thẻ còn ~87px, nhãn vỡ 3 dòng, chữ chen nhau.
   Xếp dọc đọc thẳng một mạch và lấp phần trống chân cột (cột sơ đồ bên trái vốn cao hơn).
   Vị trí .k/.l/.s đặt bằng grid-column/row → KHÔNG phải bọc thêm thẻ HTML. */
"#pane-planogram .hp-tiles{display:grid;grid-auto-flow:row;grid-template-columns:minmax(0,1fr);gap:6px;margin:4px 0 8px;}",
"#pane-planogram .hp-tile{--cc:var(--accent,#326e51);display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto auto;align-items:center;column-gap:12px;background:color-mix(in srgb, var(--cc) 8%, var(--surface,#fff));border:1px solid color-mix(in srgb, var(--cc) 22%, var(--border,#e2e8f0));border-radius:10px;padding:9px 12px;cursor:pointer;transition:transform .16s cubic-bezier(.32,.72,0,1),box-shadow .25s ease;}",
"#pane-planogram .hp-tile:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(16,24,40,.12);}",
"#pane-planogram .hp-tile .k{grid-column:1;grid-row:1/span 2;min-width:46px;text-align:center;font-size:21px;font-weight:780;font-variant-numeric:tabular-nums;line-height:1;color:var(--cc);}",
"#pane-planogram .hp-tile.tot{--cc:#64748b;}",
"#pane-planogram .hp-tile.tot .k{color:var(--text,#1f2937);}",
"#pane-planogram .hp-tile .l{grid-column:2;grid-row:1;margin:0;font-size:11.5px;font-weight:650;line-height:1.25;color:var(--text,#374151);}",
"#pane-planogram .hp-tile .s{grid-column:2;grid-row:2;margin-top:2px;font-size:10.5px;line-height:1.25;color:var(--muted,#9ca3af);}",
/* hero "hôm nay": thanh tiến độ mỏng 6px xếp chồng (.hp-track.hp-herobar thắng height 16px của .hp-track) */
"#pane-planogram .hp-track.hp-herobar{height:6px;margin:8px 0 6px;}",
/* chips AI xét duyệt thu nhỏ + neo đáy panel (cột phải giãn cao bằng cột trái) */
"#pane-planogram .hp-aimini{margin:auto 0 0;padding-top:10px;gap:4px;}",
"#pane-planogram .hp-aimini .hp-whtab{font-size:11px;padding:2px 8px;min-height:22px;gap:5px;}",
"@media(max-width:768px){#pane-planogram .hp-aimini .hp-whtab{min-height:36px;}}",
"#pane-planogram .hp-aimini .hp-hint{font-size:10.5px;width:100%;}",
"#pane-planogram .hp-grid2{display:grid;grid-template-columns:1.35fr 1fr;gap:12px;margin-top:12px;}",
"@media(max-width:1024px){#pane-planogram .hp-grid2{grid-template-columns:1fr;}}",
"#pane-planogram .hp-panel{background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:12px 14px;box-shadow:0 1px 3px rgba(0,0,0,.05);}",
/* hàng trên 2 cột (30/07 nén dọc): TRÁI = sơ đồ ăn hết bề rộng còn lại (fitMaps phóng theo cột
   VÀ chặn theo chiều cao — A1+A8 lọt trọn khung nhìn), PHẢI = Vệ sinh CỐ ĐỊNH 380px GIÃN CAO
   bằng cột trái (stretch, chips AI neo đáy) — 2 cột cân nhau, hết trống chân trang.
   30/07 chống layout-shift: cột phải chốt cứng 380px (bỏ minmax co theo nội dung) — bề rộng
   cột trái BẤT BIẾN từ 0ms, data/font về sau không làm sơ đồ bị "đá ngang" trái↔giữa. */
"#pane-planogram .hp-main{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:10px 12px;align-items:stretch;margin-top:10px;}",
"#pane-planogram #hpToday > .hp-panel{height:100%;box-sizing:border-box;display:flex;flex-direction:column;align-items:stretch;}",
/* cột sơ đồ: căn giữa/giữ chỗ THUẦN CSS ngay khung hình đầu — flex dọc + min-height khi có ruột
   (skeleton lúc tải cũng tính), panel giãn hết cao; :empty (không có dữ liệu) thì xẹp tự nhiên */
"#pane-planogram #hpMap{display:flex;flex-direction:column;align-items:stretch;min-width:0;}",
"#pane-planogram #hpMap:not(:empty){min-height:380px;}",
"#pane-planogram #hpMap > .hp-panel{flex:1;}",
"@media(max-width:1150px){#pane-planogram .hp-main{grid-template-columns:minmax(0,1fr);}#pane-planogram #hpToday > .hp-panel{height:auto;}}",
"#pane-planogram .hp-panel h2{margin:0 0 8px;font-size:14px;font-weight:680;color:var(--text,#374151);display:flex;align-items:center;gap:8px;flex-wrap:wrap;}",
"#pane-planogram .hp-legend{display:inline-flex;flex-wrap:wrap;gap:3px 10px;font-weight:400;font-size:10.5px;color:var(--muted,#6b7280);}",
"#pane-planogram .hp-legend span{display:inline-flex;align-items:center;gap:5px;}",
/* chú giải sơ đồ (cột trái): GOM 1 HÀNG — tràn thì cuộn ngang, không bung nhiều dòng */
"#pane-planogram #hpMap .hp-panel h2{flex-wrap:nowrap;}",
"#pane-planogram #hpMap .hp-panel h2 .hp-chip{flex:none;white-space:nowrap;}",
"#pane-planogram #hpMap .hp-legend{flex:1;min-width:0;flex-wrap:nowrap;gap:8px;font-size:11px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px;}",
"#pane-planogram #hpMap .hp-legend::-webkit-scrollbar{display:none;}",
"#pane-planogram #hpMap .hp-legend > span{white-space:nowrap;flex:none;}",
"#pane-planogram .hp-legend i{width:9px;height:9px;border-radius:3px;display:inline-block;flex:none;}",
"#pane-planogram .hp-chart{display:flex;flex-direction:column;gap:1px;max-height:330px;overflow-y:auto;padding-right:6px;}",
"#pane-planogram .hp-row{display:grid;grid-template-columns:210px 1fr 92px;align-items:center;gap:10px;padding:5px 6px;border-radius:8px;cursor:pointer;transition:background .16s ease;}",
"#pane-planogram .hp-row:hover{background:color-mix(in srgb, var(--accent,#326e51) 7%, transparent);}",
"#pane-planogram .hp-rl{font-size:11.5px;font-weight:600;color:var(--text,#1f2937);white-space:normal;word-break:break-word;line-height:1.3;display:flex;align-items:center;gap:7px;}",
"#pane-planogram .hp-track{background:color-mix(in srgb, var(--muted,#9ca3af) 20%, transparent);border-radius:6px;height:16px;overflow:hidden;}",
"#pane-planogram .hp-fill{height:100%;display:flex;width:0;border-radius:6px;overflow:hidden;transition:width .85s cubic-bezier(.4,0,.2,1);}",
"#pane-planogram .hp-fill i{display:block;height:100%;min-width:1px;}",
"#pane-planogram .hp-rv{text-align:right;font-variant-numeric:tabular-nums;font-size:12px;line-height:1.15;}",
"#pane-planogram .hp-rv b{font-size:13px;color:var(--text,#1f2937);} #pane-planogram .hp-rv small{display:block;color:var(--muted,#9ca3af);font-size:10px;font-weight:500;}",
"@media(max-width:640px){#pane-planogram .hp-row{grid-template-columns:1fr 84px;grid-template-areas:'l l' 't v';row-gap:5px;gap:8px;padding:7px 6px;}#pane-planogram .hp-rl{grid-area:l;}#pane-planogram .hp-track{grid-area:t;}#pane-planogram .hp-rv{grid-area:v;}}",
"#pane-planogram .hp-empty{color:var(--muted,#9ca3af);font-size:12.5px;padding:18px 2px;text-align:center;}",
"#pane-planogram .hp-mini{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 12px;}",
/* segmented control (chuyển chế độ trong 1 panel) — cùng họ với hp-whtab nhưng dính liền */
"#pane-planogram .hp-seg{display:inline-flex;border:1px solid var(--border,#e8ecf1);border-radius:999px;overflow:hidden;background:var(--surface,#fff);}",
"#pane-planogram .hp-seg button{border:0;background:transparent;padding:7px 15px;font-size:12px;font-weight:600;color:var(--muted,#6b7280);cursor:pointer;min-height:32px;transition:background .16s ease,color .16s ease;display:inline-flex;align-items:center;gap:6px;}",
"#pane-planogram .hp-seg button b{font-variant-numeric:tabular-nums;font-weight:700;}",
"#pane-planogram .hp-seg button:hover{background:color-mix(in srgb, var(--accent,#326e51) 7%, transparent);}",
"#pane-planogram .hp-seg button.on{background:var(--accent,#326e51);color:var(--accent-text,#fff);}",
"@media(max-width:768px){#pane-planogram .hp-seg button{min-height:42px;}}",
/* sơ đồ mặt bằng — A1 (16 dãy kệ) + A8 (4 cụm bàn + băng chuyền) */
"#pane-planogram .hp-maphdr{font-size:12px;font-weight:700;color:var(--muted,#64748b);text-transform:uppercase;letter-spacing:.05em;margin:12px 2px 6px;}",
/* tỷ lệ thực địa ~10px/m: cặp dãy A1 lưng giáp lưng (3px), lối đi xen kẽ 1,5m=15px / 3m=30px; cụm A8 cách đều 2m=20px */
"#pane-planogram .hp-mapscroll{overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px;}",
"#pane-planogram .hp-mapscroll > .hp-map{width:max-content;margin:0 auto;}",
"#pane-planogram .hp-map.hp-mapa1{gap:0;flex-wrap:nowrap;justify-content:flex-start;}",
"#pane-planogram .hp-map.hp-mapa8{gap:22px 20px;flex-wrap:nowrap;justify-content:flex-start;}",
"#pane-planogram .hp-mapc1{display:flex;gap:3px;padding-bottom:6px;}",
"#pane-planogram .hp-mapc1.hp-kc15{margin-right:15px;}",
"#pane-planogram .hp-mapc1.hp-kc3{margin-right:30px;}",
"#pane-planogram .hp-mapc1 .hp-mapcell{width:30px;}",
"#pane-planogram .hp-map{display:flex;flex-wrap:wrap;gap:22px 34px;justify-content:space-evenly;padding:4px 2px 0;}",
"#pane-planogram .hp-mapc{display:grid;grid-template-columns:56px 34px 56px;gap:0 7px;align-items:stretch;}",
"#pane-planogram .hp-mapcol{display:flex;flex-direction:column;gap:2px;}",
"#pane-planogram .hp-mapcol .cl{text-align:center;font-size:10px;font-weight:700;color:var(--muted,#6b7280);margin-bottom:4px;letter-spacing:.03em;}",
"#pane-planogram .hp-mapcell{height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff;cursor:pointer;border:1px solid transparent;transition:transform .16s cubic-bezier(.32,.72,0,1),box-shadow .2s ease;}",
"#pane-planogram .hp-mapcell:hover{transform:scale(1.14);box-shadow:0 4px 14px rgba(16,24,40,.25);z-index:2;}",
"#pane-planogram .hp-mapcell.trong{background:transparent;border:1px dashed color-mix(in srgb, var(--muted,#9ca3af) 55%, transparent);color:var(--muted,#9ca3af);}",
"#pane-planogram .hp-mapcell{position:relative;}",
/* badge góc: chấm tròn = AI cần xem · tam giác = làm lại (phân biệt bằng HÌNH DẠNG, không chỉ màu) */
"#pane-planogram .hp-cdot{position:absolute;top:2px;right:2px;width:7px;height:7px;border-radius:50%;box-shadow:0 0 0 1.5px rgba(255,255,255,.9);}",
"#pane-planogram .hp-ctri{position:absolute;top:0;right:0;width:0;height:0;border-top:9px solid rgba(255,255,255,.92);border-left:9px solid transparent;}",
/* KÊNH THỨ 2 của palette (31/07): VẠCH XANH mép trái = ĐÃ BÁO CÁO. Nhờ nó ô hổ phách (AI cần xem)
   và ô tím (AI không đạt) vẫn đọc ngay ra "đã làm rồi, còn tồn việc chất lượng" — không bị hiểu
   thành "chưa làm" như bản cam cũ. Dùng ::after (không dùng box-shadow inset) để KHÔNG tranh chấp
   với vòng .canhbao / .hi vốn cũng là box-shadow; belt đã chiếm ::after nên dùng ::before.
   Vạch THỤT VÀO 3-4px mỗi phía: đặt sát mép (left/top/bottom:0) thì vạch thẳng chìa ra ngoài
   góc bo của ô, nhìn thành cái tai xanh dính bên ngoài chứ không phải dấu hiệu trong ô. */
"#pane-planogram .hp-mapcell.dalam::after,#pane-planogram .hp-mapbelt.dalam::before,.hp-vthist.dalam::after{content:'';position:absolute;left:3px;top:4px;bottom:4px;width:3px;border-radius:2px;background:#059669;pointer-events:none;}",
/* nền sáng (hổ phách) → mực đậm cho đủ tương phản chữ trong ô / chữ dọc băng chuyền */
"#pane-planogram .hp-mapcell.inkdark{color:#422006;}",
"#pane-planogram .hp-mapbelt.inkdark span{color:rgba(66,32,6,.92);}",
/* Cảnh báo trên Ô: viền TĨNH + ⚠ nhỏ (không nhấp nháy — tránh nhiễu khi nhiều ô cùng cảnh báo). Nhấp nháy chỉ ở banner. */
"#pane-planogram .hp-cwarn{position:absolute;bottom:-4px;left:-4px;font-size:10.5px;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4));}",
/* ⚠ trên Ô thu 0.7 lần để không che số (bản trong chú giải giữ nguyên cỡ) */
"#pane-planogram .hp-mapcell .hp-cwarn,#pane-planogram .hp-mapbelt .hp-cwarn{transform:scale(.7);transform-origin:bottom left;bottom:-3px;left:-3px;}",
"#pane-planogram .hp-mapcell.canhbao,#pane-planogram .hp-mapbelt.canhbao{box-shadow:0 0 0 2px #dc2626;}",
"@keyframes hp-blink{0%,100%{opacity:1}50%{opacity:.4}}",
/* Compact Alert Strip — dải cảnh báo mỏng, không chiếm chiều cao sơ đồ */
"#pane-planogram .hp-alertbar{display:flex;align-items:center;gap:8px;margin:0 0 8px;padding:4px 12px;border-radius:6px;background:color-mix(in srgb,#dc2626 9%,var(--surface,#fff));border:1px solid color-mix(in srgb,#dc2626 35%,transparent);color:var(--text,#7f1d1d);font-size:12px;font-weight:600;cursor:pointer;transition:background .16s ease;}",
"#pane-planogram .hp-alertbar:hover{background:color-mix(in srgb,#dc2626 15%,var(--surface,#fff));}",
"#pane-planogram .hp-alertbar .ic{font-size:13px;animation:hp-blink 1.5s ease-in-out infinite;}",
"#pane-planogram .hp-alertbar b{color:#dc2626;font-size:12.5px;font-variant-numeric:tabular-nums;}",
/* Biến thể dải cảnh báo: warn = THIẾU yêu cầu (cam, bấm xem) · ok = đủ (xanh, không nhấp nháy) */
"#pane-planogram .hp-alertbar.warn{background:color-mix(in srgb,#d97706 9%,var(--surface,#fff));border-color:color-mix(in srgb,#d97706 35%,transparent);}",
"#pane-planogram .hp-alertbar.warn:hover{background:color-mix(in srgb,#d97706 16%,var(--surface,#fff));}",
"#pane-planogram .hp-alertbar.warn b{color:#d97706;}",
"#pane-planogram .hp-alertbar.ok{background:color-mix(in srgb,#059669 8%,var(--surface,#fff));border-color:color-mix(in srgb,#059669 30%,transparent);cursor:default;}",
"#pane-planogram .hp-alertbar.ok b{color:#059669;}",
"#pane-planogram .hp-alertbar.ok .ic{color:#059669;animation:none;}",
/* ĐỘ PHỦ YÊU CẦU (panel Vệ sinh): mỗi khu vực 1 dòng — tên · thanh 6px · x/y, nén cho cột 380px */
"#pane-planogram .hp-cov{margin:10px 0 0;}",
"#pane-planogram .hp-cov .hp-alertbar{margin:8px 0 0;align-items:flex-start;line-height:1.4;}",
"#pane-planogram .hp-cov .hp-alertbar .ic{flex:none;line-height:1.4;}",
"#pane-planogram .hp-covhd{display:flex;align-items:center;gap:8px;margin:0 0 5px;font-size:10.5px;font-weight:700;color:var(--muted,#64748b);text-transform:uppercase;letter-spacing:.05em;}",
"#pane-planogram .hp-covhd b{margin-left:auto;font-size:11.5px;font-weight:700;text-transform:none;letter-spacing:0;font-variant-numeric:tabular-nums;color:var(--text,#1f2937);}",
"#pane-planogram .hp-covrow{display:grid;grid-template-columns:minmax(0,1fr) 72px auto;align-items:center;gap:8px;padding:2px 0;font-size:11.5px;color:var(--text,#374151);}",
"#pane-planogram .hp-covrow .nm{display:flex;align-items:center;gap:6px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
"#pane-planogram .hp-covrow .hp-track{height:6px;}",
"#pane-planogram .hp-covrow .v{font-variant-numeric:tabular-nums;font-weight:700;text-align:right;}",
"#pane-planogram .hp-legend .hp-cdot{position:static;width:8px;height:8px;box-shadow:none;}",
/* badge ? = phụ trách suy từ báo cáo cũ (>NGUONG_PT_CU ngày) — CHƯA CHẮC, tránh réo nhầm người */
"#pane-planogram .hp-cq{position:absolute;top:-5px;right:-5px;width:13px;height:13px;border-radius:50%;background:#d97706;color:#fff;font-size:9.5px;font-weight:800;display:flex;align-items:center;justify-content:center;font-style:normal;line-height:1;box-shadow:0 0 0 1.5px rgba(255,255,255,.9);}",
/* chế độ SOI theo NV: ô của NV được chọn nổi vòng accent, ô khác mờ đi */
"#pane-planogram .hp-mapcell.dim,#pane-planogram .hp-mapbelt.dim{opacity:.16;filter:saturate(.35);}",
"#pane-planogram .hp-mapcell.hi,#pane-planogram .hp-mapbelt.hi{box-shadow:0 0 0 2px var(--accent,#326e51);z-index:1;}",
"#pane-planogram .hp-ptnhac{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0 0;}",
"#pane-planogram .hp-ptchip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;min-height:26px;border-radius:999px;border:1px solid var(--border,#d5dbe4);background:var(--surface,#fff);color:var(--text,#1f2937);font-size:12px;font-weight:600;cursor:pointer;transition:transform .16s cubic-bezier(.32,.72,0,1),box-shadow .2s ease,border-color .16s ease;}",
"#pane-planogram .hp-ptchip:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(16,24,40,.14);}",
"#pane-planogram .hp-ptchip.on{border-color:#dc2626;background:color-mix(in srgb,#dc2626 12%,var(--surface,#fff));color:#dc2626;}",
"#pane-planogram .hp-ptchip b{font-weight:780;font-variant-numeric:tabular-nums;}",
"#pane-planogram .hp-ptchip .q{width:13px;height:13px;border-radius:50%;background:#d97706;color:#fff;font-size:9px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;font-style:normal;line-height:1;}",
"#pane-planogram .hp-ptchip.clear{color:var(--muted,#6b7280);border-style:dashed;}",
/* nút xổ/thu panel cần-nhắc: mặc định THU GỌN toàn thời gian, bấm mới xổ chips */
"#pane-planogram .hp-ptchip.tog{border-color:color-mix(in srgb,#dc2626 40%,transparent);color:#dc2626;background:color-mix(in srgb,#dc2626 6%,var(--surface,#fff));}",
"#pane-planogram .hp-ptchip.tog .car{font-size:10px;transition:transform .2s ease;}",
"#pane-planogram .hp-ptchip.tog.mo{background:color-mix(in srgb,#dc2626 12%,var(--surface,#fff));}",
"#pane-planogram .hp-mapgap{height:8px;flex:none;}",
"#pane-planogram .hp-mapc > .hp-mapcol:first-of-type{grid-column:1;grid-row:1;}",
"#pane-planogram .hp-mapc > .hp-mapcol:last-of-type{grid-column:3;grid-row:1;}",
"#pane-planogram .hp-mapbelt{grid-column:2;grid-row:1;margin-top:18px;border-radius:9px 9px 3px 3px;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;transition:filter .16s ease;min-height:200px;}",
"#pane-planogram .hp-mapbelt:hover{filter:brightness(1.12);}",
"#pane-planogram .hp-mapbelt span{writing-mode:vertical-rl;font-size:9px;font-weight:750;color:rgba(255,255,255,.92);letter-spacing:.14em;white-space:nowrap;}",
"#pane-planogram .hp-mapbelt::after{content:'';position:absolute;bottom:-14px;left:4px;right:4px;height:12px;border-radius:0 0 4px 4px;background:repeating-linear-gradient(45deg,color-mix(in srgb, var(--muted,#9ca3af) 55%, transparent) 0 4px,transparent 4px 8px);}",
"#pane-planogram .hp-mapc{padding-bottom:14px;}",
"@media(max-width:760px){#pane-planogram .hp-mapc{grid-template-columns:48px 30px 48px;}}",   /* giữ nguyên gap tỷ lệ — sơ đồ rộng thì cuộn ngang trong .hp-mapscroll */
/* panel đối chiếu chấm công */
"#pane-planogram .hp-cc{margin-top:12px;}",
"#pane-planogram .hp-ccsearch{width:100%;max-width:340px;padding:9px 11px;border:1px solid var(--border,#d5dbe4);border-radius:9px;font-size:12.5px;background:var(--surface,#fff);color:var(--text,#1f2937);min-height:36px;margin:2px 0 10px;}",
"#pane-planogram .hp-ccsearch:focus{outline:0;border-color:var(--accent,#326e51);}",
"#pane-planogram .hp-ccwrap{overflow-x:auto;-webkit-overflow-scrolling:touch;max-height:520px;overflow-y:auto;border:1px solid var(--border,#e8ecf1);border-radius:12px;}",
"#pane-planogram .hp-cctbl{width:100%;border-collapse:collapse;font-size:12.5px;color:var(--text,#1f2937);min-width:720px;}",
"#pane-planogram .hp-cctbl thead th{position:sticky;top:0;background:var(--accent,#326e51);color:var(--accent-text,#fff);padding:9px 11px;text-align:left;font-weight:600;font-size:11px;z-index:1;white-space:nowrap;}",
"#pane-planogram .hp-cctbl td{padding:8px 11px;border-bottom:1px solid var(--border,#f1f4f8);white-space:nowrap;}",
"#pane-planogram .hp-cctbl tr[data-em]{cursor:pointer;}",
"#pane-planogram .hp-cctbl tr:hover td{background:color-mix(in srgb, var(--accent,#326e51) 5%, transparent);}",
"#pane-planogram .hp-cctbl .num{text-align:right;font-variant-numeric:tabular-nums;}",
"#pane-planogram .hp-cctbl .mut{color:var(--muted,#9ca3af);}",
"#pane-planogram .hp-cctbl .empty{text-align:center;color:var(--muted,#9ca3af);padding:26px;}",
"#pane-planogram .hp-cctbl td.wrap{white-space:normal;min-width:280px;max-width:520px;line-height:1.5;}",
"#pane-planogram .hp-badge,.hp-modal .hp-badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:650;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom;}",
"#pane-planogram .hp-state{padding:56px 20px;text-align:center;color:var(--muted,#6b7280);}",
"#pane-planogram .hp-spin{width:32px;height:32px;border:3px solid var(--border,#d5dbe4);border-top-color:var(--accent,#326e51);border-radius:50%;margin:0 auto 16px;animation:hp-sp .8s linear infinite;}",
"@keyframes hp-sp{to{transform:rotate(360deg)}}",
/* ANIMATION VÀO chỉ chạy khi pane mang class hp-anim (lần tải đầu / nút Làm mới — animBat()).
   Bấm lọc khu vực/ngày KHÔNG animate lại: tránh 3-4 khung trắng + panel trượt gây cảm giác giật. */
"#pane-planogram.hp-anim .hp-fade{animation:hp-in .45s cubic-bezier(.32,.72,0,1) both;}",
"#pane-planogram.hp-anim .hp-tile{animation:hp-in .3s ease both;}",
"#pane-planogram.hp-anim .hp-mapc1,#pane-planogram.hp-anim .hp-mapc,#pane-planogram.hp-anim .hp-ptnhac{animation:hp-in .35s ease both;}",
"@keyframes hp-in{from{opacity:0;transform:translate3d(0,12px,0)}to{opacity:1;transform:none}}",
".hp-modal{display:none;position:fixed;inset:0;background:rgba(17,24,39,.55);backdrop-filter:blur(6px);z-index:1200;align-items:center;justify-content:center;padding:18px;opacity:0;transition:opacity .22s;}",
".hp-modal.show{opacity:1;}",
".hp-modalbox{background:var(--surface,#fff);color:var(--text,#1f2937);border-radius:18px;width:min(1080px,96vw);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(16,24,40,.3);transform:translateY(12px) scale(.985);opacity:.6;transition:transform .26s,opacity .26s;}",
".hp-modal.show .hp-modalbox{transform:none;opacity:1;}",
".hp-modalhd{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border,#e8ecf1);gap:10px;}",
".hp-modalhd .mt{font-weight:700;font-size:15.5px;} .hp-modalhd .mtsub{font-size:11.5px;color:var(--muted,#9ca3af);margin-top:2px;}",
".hp-mclose{background:0;border:0;font-size:24px;line-height:1;cursor:pointer;color:var(--muted,#9ca3af);padding:6px 10px;border-radius:8px;min-width:44px;min-height:40px;flex:none;}",
".hp-mclose:hover{color:#ef4444;background:color-mix(in srgb,#ef4444 12%,transparent);}",
".hp-mfilters{display:grid;grid-template-columns:1fr 1fr 1.3fr 1.6fr;gap:8px;padding:12px 20px;border-bottom:1px solid var(--border,#e8ecf1);}",
"@media(max-width:720px){.hp-mfilters{grid-template-columns:1fr 1fr;}}",
".hp-mfilters .fld{display:flex;flex-direction:column;gap:3px;}",
".hp-mfilters label{font-size:10px;font-weight:650;color:var(--muted,#9ca3af);text-transform:uppercase;letter-spacing:.04em;}",
".hp-mfilters input{padding:9px 10px;border:1px solid var(--border,#d5dbe4);border-radius:9px;font-size:12.5px;background:var(--surface,#fff);color:var(--text,#1f2937);width:100%;min-height:38px;}",
".hp-mfilters input:focus{outline:0;border-color:var(--accent,#326e51);}",
".hp-combo{position:relative;}",
".hp-combo-menu{position:absolute;top:calc(100% + 5px);left:0;right:0;z-index:40;background:var(--surface,#fff);border:1px solid var(--border,#e8ecf1);border-radius:11px;box-shadow:0 24px 60px rgba(16,24,40,.28);max-height:250px;overflow-y:auto;overscroll-behavior:contain;padding:5px;opacity:0;visibility:hidden;transform:translateY(-6px);transition:.16s;}",
".hp-combo-menu.show{opacity:1;visibility:visible;transform:none;}",
".hp-combo-item{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 11px;border-radius:8px;font-size:12.5px;cursor:pointer;color:var(--text,#1f2937);white-space:nowrap;overflow:hidden;}",
".hp-combo-item .nm{overflow:hidden;text-overflow:ellipsis;} .hp-combo-item .c{color:var(--muted,#9ca3af);font-size:11px;flex:none;}",
".hp-combo-item:hover{background:color-mix(in srgb, var(--accent,#326e51) 10%, transparent);color:var(--accent,#326e51);}",
".hp-combo-item.all{border-bottom:1px solid var(--border,#e8ecf1);font-weight:600;}",
".hp-combo-item.on{background:color-mix(in srgb, var(--accent,#326e51) 12%, transparent);color:var(--accent,#326e51);font-weight:650;}",
".hp-combo-empty{padding:12px;font-size:12px;color:var(--muted,#9ca3af);text-align:center;}",
".hp-msum{padding:9px 20px;font-size:12px;color:var(--muted,#6b7280);border-bottom:1px solid var(--border,#e8ecf1);font-variant-numeric:tabular-nums;}",
".hp-modalbody{overflow:auto;padding:0 20px 20px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;}",
".hp-mtbl{width:100%;border-collapse:collapse;font-size:12.5px;color:var(--text,#1f2937);}",
".hp-mtbl thead th{position:sticky;top:0;background:var(--accent,#326e51);color:var(--accent-text,#fff);padding:9px 11px;text-align:left;font-weight:600;font-size:11px;z-index:1;white-space:nowrap;}",
".hp-mtbl td{padding:8px 11px;border-bottom:1px solid var(--border,#f1f4f8);vertical-align:top;white-space:nowrap;}",
".hp-mtbl .empty{text-align:center;color:var(--muted,#9ca3af);padding:28px;}",
".hp-mtbl .nm{white-space:normal;min-width:150px;}",
".hp-mtbl .mut{color:var(--muted,#9ca3af);}",
".hp-mtbl .badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:650;}",
".hp-mtbl tbody.is-filtering{opacity:.45;transition:opacity .12s;}",
".hp-mtbl small{display:block;color:var(--muted,#9ca3af);font-size:10px;}",
/* thumbnail ảnh báo cáo trong pop-up (lazy — chỉ tải khi cuộn tới) */
".hp-thumbs{display:inline-flex;align-items:center;gap:5px;}",
".hp-thumbs img{width:34px;height:34px;object-fit:cover;border-radius:7px;border:1px solid var(--border,#e8ecf1);cursor:zoom-in;display:block;transition:transform .16s cubic-bezier(.32,.72,0,1);background:color-mix(in srgb, var(--muted,#9ca3af) 14%, transparent);}",
".hp-thumbs img:hover{transform:scale(1.12);}",
".hp-thumbs .more{border:1px solid var(--border,#e8ecf1);background:var(--surface,#fff);color:var(--accent,#326e51);border-radius:7px;min-width:34px;height:34px;font-size:11px;font-weight:650;cursor:pointer;}",
".hp-thumbs .more:hover{background:color-mix(in srgb, var(--accent,#326e51) 10%, transparent);}",
/* pop-up CHI TIẾT VỊ TRÍ (bấm ô sơ đồ) — dải lịch sử 7 ngày + hàng nhãn/giá trị */
".hp-vthistrow{display:flex;gap:6px;flex-wrap:wrap;margin:2px 0 14px;}",
".hp-vthist{position:relative;min-width:52px;padding:5px 8px;border-radius:9px;text-align:center;font-size:10.5px;font-weight:650;color:#fff;cursor:pointer;line-height:1.3;border:2px solid transparent;transition:transform .16s cubic-bezier(.32,.72,0,1);}",
".hp-vthist.inkdark{color:#422006;}",
".hp-vthist b{display:block;font-size:9px;opacity:.85;}",
".hp-vthist.trong{background:transparent;border:2px dashed color-mix(in srgb, var(--muted,#9ca3af) 50%, transparent);color:var(--muted,#9ca3af);}",
".hp-vthist.on{border-color:var(--text,#1f2937);transform:scale(1.08);box-shadow:0 4px 14px rgba(16,24,40,.18);}",
".hp-vthist:hover{transform:scale(1.08);}",
".hp-vtrow{display:grid;grid-template-columns:150px 1fr;gap:12px;padding:10px 0;border-bottom:1px solid var(--border,#f1f4f8);font-size:12.5px;color:var(--text,#1f2937);}",
".hp-vtrow:last-child{border-bottom:0;}",
".hp-vtrow label{font-size:10.5px;font-weight:650;color:var(--muted,#9ca3af);text-transform:uppercase;letter-spacing:.04em;padding-top:2px;}",
/* Badge trong hàng chi tiết được XUỐNG DÒNG: nhãn trạng thái ô đã dài ra (kèm luôn lý do,
   vd "Chưa vệ sinh · có người đi làm (nhắc ngay)") — giữ max-width 180px của badge chung
   thì cắt mất đúng phần mang thông tin. Badge trong tiêu đề thẻ vẫn ngắn nên để nguyên. */
".hp-modal .hp-vtrow .hp-badge{max-width:none;white-space:normal;}",
"@media(max-width:560px){.hp-vtrow{grid-template-columns:1fr;gap:4px;}}",
".hp-vtthumbs{display:flex;flex-wrap:wrap;gap:6px;}",
".hp-vtthumbs img{width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--border,#e8ecf1);cursor:zoom-in;transition:transform .16s cubic-bezier(.32,.72,0,1);background:color-mix(in srgb, var(--muted,#9ca3af) 14%, transparent);}",
".hp-vtthumbs img:hover{transform:scale(1.1);}",
  ".hp-vtmore{width:56px;height:56px;border-radius:8px;border:1px dashed var(--border,#e8ecf1);background:var(--surface,#fff);color:var(--accent,#326e51);font-size:12px;font-weight:650;cursor:pointer;transition:background .16s;}",
  ".hp-vtmore:hover{background:color-mix(in srgb, var(--accent,#326e51) 10%, transparent);}",
  ".hp-lz{background:color-mix(in srgb, var(--muted,#9ca3af) 18%, transparent);}",   /* ô chờ ảnh — hoãn tải tới khi lọt khung nhìn */
/* HAI THẺ SONG SONG trong pop-up vị trí: TRÁI Phụ trách (nhấn accent — đây là người phải chịu
   trách nhiệm) · PHẢI Báo cáo gần nhất (nền trung tính — chỉ để tham khảo/đối chiếu).
   Tái dùng keyframes hp-in + easing/độ mượt sẵn có của module, không chế animation mới. */
".hp-vtduo{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0 0;}",
"@media(max-width:560px){.hp-vtduo{grid-template-columns:1fr;}}",
".hp-vtcard{border:1px solid var(--border,#e8ecf1);border-radius:12px;padding:11px 12px;display:flex;flex-direction:column;gap:8px;background:color-mix(in srgb, var(--muted,#9ca3af) 6%, var(--surface,#fff));animation:hp-in .34s cubic-bezier(.32,.72,0,1) both;}",
".hp-vtcard.pt{border-color:color-mix(in srgb, var(--accent,#326e51) 32%, transparent);background:color-mix(in srgb, var(--accent,#326e51) 7%, var(--surface,#fff));}",
".hp-vtcard.ref{animation-delay:.06s;}",
".hp-vtcard .hd{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:10.5px;font-weight:700;color:var(--muted,#6b7280);text-transform:uppercase;letter-spacing:.04em;}",
/* badge nguồn phân công ("Suy từ báo cáo gần nhất") dài hơn max-width mặc định của .hp-badge →
   bị cắt còn "SUY TỪ BÁO CÁO GẦN NH…", đọc không ra nguồn. Trong thẻ pop-up cho xuống dòng. */
".hp-modal .hp-vtcard .hd .hp-badge{max-width:none;white-space:normal;}",
".hp-vtcard .who{display:flex;align-items:center;gap:9px;min-width:0;}",
".hp-vtcard .who > div{min-width:0;}",
".hp-vtcard .av{width:34px;height:34px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:750;color:#fff;letter-spacing:.02em;}",
".hp-vtcard .who b{display:block;font-size:13px;font-weight:700;line-height:1.3;color:var(--text,#1f2937);}",
".hp-vtcard .who small{display:block;font-size:10.5px;font-weight:500;color:var(--muted,#9ca3af);line-height:1.4;word-break:break-all;}",
/* dòng chấm công: chấm màu trạng thái + nhãn đậm + phụ đề (cùng khuôn .hp-dot dùng khắp module) */
".hp-vtcard .cc{display:flex;align-items:flex-start;gap:7px;padding-top:7px;border-top:1px dashed var(--border,#e2e8f0);}",
".hp-vtcard .cc .hp-dot{margin-top:4px;}",
".hp-vtcard .cc b{display:block;font-size:12px;font-weight:700;line-height:1.35;}",
".hp-vtcard .cc small{display:block;font-size:10.5px;color:var(--muted,#9ca3af);line-height:1.4;margin-top:1px;}",
".hp-vtcard .ln{font-size:11.5px;line-height:1.45;color:var(--text,#374151);}",
".hp-vtcard .ln.mut{color:var(--muted,#9ca3af);}",
/* pop-up TRA CỨU THEO NHÂN VIÊN (nhật ký theo ngày) */
".hp-nk-grid{display:grid;grid-template-columns:280px 1fr;gap:0;flex:1;min-height:0;}",
".hp-nk-left{border-right:1px solid var(--border,#e8ecf1);display:flex;flex-direction:column;min-height:0;}",
".hp-nk-left input{margin:12px 14px 8px;padding:9px 11px;border:1px solid var(--border,#d5dbe4);border-radius:9px;font-size:12.5px;background:var(--surface,#fff);color:var(--text,#1f2937);min-height:38px;}",
".hp-nk-left input:focus{outline:0;border-color:var(--accent,#326e51);}",
".hp-nk-list{overflow-y:auto;overscroll-behavior:contain;padding:0 8px 12px;flex:1;min-height:0;}",
".hp-nk-item{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;cursor:pointer;transition:background .16s ease;}",
".hp-nk-item:hover{background:color-mix(in srgb, var(--accent,#326e51) 8%, transparent);}",
".hp-nk-item.active{background:var(--accent,#326e51);color:var(--accent-text,#fff);}",
".hp-nk-item .nm{font-size:12.5px;font-weight:600;line-height:1.25;overflow:hidden;text-overflow:ellipsis;}",
".hp-nk-item .nm small{display:block;font-weight:500;font-size:10.5px;color:var(--muted,#9ca3af);}",
".hp-nk-item.active .nm small{color:color-mix(in srgb, var(--accent-text,#fff) 70%, transparent);}",
".hp-nk-item .c{font-size:10.5px;color:var(--muted,#9ca3af);text-align:right;flex:none;font-variant-numeric:tabular-nums;}",
".hp-nk-item.active .c{color:color-mix(in srgb, var(--accent-text,#fff) 75%, transparent);}",
".hp-nk-right{overflow-y:auto;overscroll-behavior:contain;padding:14px 18px 18px;min-height:0;}",
".hp-nk-right .hd{font-weight:700;font-size:14px;margin-bottom:2px;}",
".hp-nk-right .sub{font-size:11.5px;color:var(--muted,#9ca3af);margin-bottom:12px;}",
".hp-nk-day{border-left:3px solid var(--accent,#326e51);padding:6px 0 8px 12px;margin:0 0 10px;animation:hp-in .3s ease both;}",
".hp-nk-day .d{font-size:12px;font-weight:700;color:var(--text,#1f2937);margin-bottom:5px;display:flex;gap:8px;align-items:center;}",
".hp-nk-day .d .today{font-size:10px;font-weight:650;color:var(--accent,#326e51);background:color-mix(in srgb, var(--accent,#326e51) 12%, transparent);border-radius:999px;padding:2px 8px;}",
".hp-nk-khu{display:flex;gap:6px;align-items:flex-start;margin:3px 0;flex-wrap:wrap;}",
".hp-nk-khu .kdot{margin-top:5px;}",
".hp-nk-loc{display:inline-block;font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:6px;margin:1px 2px 1px 0;text-decoration:none;color:var(--text,#374151);background:color-mix(in srgb, var(--muted,#9ca3af) 14%, transparent);transition:background .16s ease,color .16s ease;}",
".hp-nk-loc:hover{background:color-mix(in srgb, var(--accent,#326e51) 14%, transparent);color:var(--accent,#326e51);}",
".hp-nk-empty{color:var(--muted,#9ca3af);font-size:12.5px;padding:40px 16px;text-align:center;}",
"@media(max-width:768px){.hp-modal{padding:0;align-items:stretch;justify-content:stretch;}.hp-modalbox{width:100vw!important;max-height:100vh!important;height:100vh;border-radius:0;}.hp-mclose{font-size:30px;min-width:48px;min-height:48px;}.hp-mfilters input{min-height:44px;}#pane-planogram .hp-whtab{min-height:44px;}#hpReload,#pane-planogram .hp-btn{min-height:44px;width:100%;}",
".hp-nk-grid{grid-template-columns:1fr;grid-template-rows:auto 1fr;}.hp-nk-left{border-right:0;border-bottom:1px solid var(--border,#e8ecf1);}.hp-nk-list{max-height:200px;}}",
/* lightbox host phải nổi TRÊN pop-up module (host để z-index 60, pop-up 1200) */
"#lightbox{z-index:1400;}",

/* ===== KHUÔN THẺ DI ĐỘNG `table.mbcard` + dọn thanh điều khiển (21/08/2026) =====================
 * NGÒI NỔ: người dùng gửi lại chính màn này từ điện thoại — "Danh sách theo dõi › AI xét duyệt ảnh"
 * là bảng 8 cột rộng 1010px trong khung cuộn ngang, mà cột "Lý do AI đưa ra" là ĐOẠN VĂN 256-438 ký
 * tự (bộ đo đếm được 108 ô vỡ 7-11 dòng). Trên màn 360px người ta thấy 3 cột, muốn đọc cột thứ 4
 * phải kéo ngang từng dòng. Thanh "Khu vực · Ngày · Tra cứu NV · Toàn bộ vị trí" thì vỡ 5 hàng /
 * 144px trước khi thấy số liệu.
 *
 * KHUÔN `table.mbcard` nay khai Ở HOST (`kiemsoatkho/index.html`, cuối <style>) cho MỌI module
 * dùng chung — dưới đây chỉ còn phần RIÊNG của tab Planogram. Cùng tên lớp với dashboard Audit
 * Factory (`factory/index.html`) — lệ đồng bộ của dự án:
 *   mb-hd   ô tiêu đề thẻ (mã vị trí / tên người) · mb-tag  nhãn trạng thái ghim mép phải
 *   mb-full ô chiếm trọn 1 hàng (đoạn văn)        · mb-0    ô KHÔNG mang tin ⇒ ẩn hẳn (luật ③)
 * Nhãn dán bằng `::before{content:attr(data-lb)}` — nhắm theo THUỘC TÍNH, KHÔNG theo nth-child
 * (nth-child âm thầm sai ngày nào thêm/bớt cột — dự án đã dính một lần ở pop-up in tem).
 *
 * ⚠ VÌ SAO PHẢI `!important` Ở ĐÂY (không phải làm bừa): bản BẢNG của module khai ở trên có
 * specificity cấp ID (`#pane-planogram .hp-cctbl td`, `.hp-cctbl td.wrap`), nên rule thẻ viết bằng
 * `table.mbcard td` luôn thua dù đứng sau. Chỉ đánh `!important` vào ĐÚNG mấy thuộc tính tranh nhau
 * (white-space / min-width / max-width / padding / border / text-align), không quét cả khối. */
"@media(max-width:768px){",
/* Cột Model là thông tin KỸ THUẬT (gemini-3.5-flash-lite) — dòng tổng kết dưới bảng đã liệt kê đủ
   các model đã dùng, nên trong thẻ nó chỉ là chữ lạ chiếm chỗ. Ẩn trên điện thoại, giữ ở máy tính. */
"#pane-planogram table.mbcard td.ai-model{display:none;}",
/* Khung bảng: bỏ cuộn-trong-cuộn. Ngón tay kéo trang mà trúng khung con là bẫy chạm kinh điển;
   thẻ chảy theo trang, số dòng đã bị chặn bằng CAP nên không có danh sách dài vô hạn. */
"#pane-planogram .hp-ccwrap:has(table.mbcard){overflow:visible;max-height:none !important;border:0;border-radius:0;}",
/* THANH ĐIỀU KHIỂN ĐẦU TAB (#hpWhBar) — 8 món/5 hàng/144px. Xếp thành 3 hàng ngay ngắn:
   ① chip Khu vực cuộn ngang · ② ô chọn Ngày full · ③ 2 nút hành động chia đôi.
   KHÔNG cho cả thanh thành khung cuộn ngang: menu ngày (.hp-combo-menu) neo absolute bên trong,
   khung cuộn sẽ CẮT MẤT menu — đúng loại lỗi chỉ thấy khi soi ảnh. */
/* iPhone SE (375×667) là màn NGẮN: 3 hàng × 49px = 171px = 26% màn hình, vượt ngưỡng "thanh điều
   khiển không được ăn quá 1/4 màn trước khi thấy số liệu". Nén bằng cách hạ mỗi hàng về đúng
   ngưỡng chạm 40px + thu khe hở, KHÔNG bỏ nhãn "Khu vực:"/"Ngày:" (nhãn là thứ cho biết dải chip
   bên cạnh nói về cái gì) và cũng KHÔNG hạ xuống dưới 40px (thà 3 hàng đọc được còn hơn 2 hàng
   bấm trượt). Còn ~147px = 22%. */
"#pane-planogram #hpWhBar{flex-direction:column;align-items:stretch;flex-wrap:nowrap;gap:6px;}",
"#pane-planogram #hpWhBar .hp-whtab,#pane-planogram #hpWhBar .hp-datesel{min-height:40px;}",
"#pane-planogram #hpWhBar .hp-wb1{display:flex;gap:6px;align-items:center;overflow-x:auto;-webkit-overflow-scrolling:touch;min-width:0;}",
"#pane-planogram #hpWhBar .hp-wb1>*{flex:0 0 auto;}",
"#pane-planogram #hpWhBar .hp-wb2{display:flex;gap:6px;align-items:center;flex-wrap:wrap;min-width:0;}",
"#pane-planogram #hpWhBar .hp-wb2 .hp-combo{flex:1 1 100%;}",
"#pane-planogram #hpWhBar .hp-wb2 .hp-combo>.hp-whtab{width:100%;justify-content:center;}",
"#pane-planogram #hpWhBar .hp-wb2>.hp-whtab{flex:1 1 calc(50% - 3px);justify-content:center;}",
"#pane-planogram #hpWhBar .hp-wbsp{display:none;}",
/* CHIP LỌC trong panel danh sách (Kết luận / Trạng thái): 1 HÀNG CUỘN NGANG — khuôn .toptabs của
   dự án. Không đi đường xếp dọc như #hpWhBar: ở đây mỗi chip là một GIÁ TRỊ cùng loại, xếp dọc
   thành 5 hàng thì mất luôn nghĩa "một dải để so sánh". */
"#pane-planogram .hp-whbar.hp-chipbar{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;min-width:0;padding-bottom:3px;}",
"#pane-planogram .hp-whbar.hp-chipbar>*{flex:0 0 auto;}",
"#pane-planogram .hp-ccsearch{max-width:none;min-height:44px;}",
/* Nhãn dọc trong băng chuyền: 9px là dưới sàn đọc được (luật ⑥). Băng rộng 30px, chữ viết dọc nên
   nới cỡ không làm băng phình ngang. */
"#pane-planogram .hp-mapbelt span{font-size:10.5px;}",
/* Nhãn THỨ trong dải lịch sử 7 ngày của pop-up vị trí (T5/T6/CN) — 9px là dưới sàn đọc được.
   Nó chính là thứ cho biết con số ngày bên cạnh là ngày nào, nên không được nhỏ hơn sàn. */
".hp-vthist b{font-size:10.5px;}",
"}",
/* Chip "0" là bộ lọc dẫn tới danh sách rỗng — làm mờ để dải chip đọc ra ngay chỗ NÀO CÓ SỐ, thay vì
   7 viên nhìn như nhau (người dùng chỉ đúng chỗ này: "Đã vệ sinh 0 · Chưa vệ sinh 0" chen giữa dải).
   Vẫn bấm được: lọc ra 0 dòng là một câu trả lời hợp lệ. */
"#pane-planogram .hp-whtab.hp-z0{opacity:.45;}",
"#pane-planogram .hp-whtab.hp-z0:hover{opacity:.8;}",
/* Hai khung `.hp-wb1/.hp-wb2` chỉ để ĐIỆN THOẠI có chỗ ngắt hàng. Ở máy tính `display:contents`
   làm chúng tan biến, các món vẫn là con TRỰC TIẾP của `.hp-whbar` ⇒ thanh giữ nguyên một hàng
   như trước, không đổi một pixel. (Bẫy đã biết: `display:contents` phải TẮT ở điện thoại, không
   thì rule xếp hàng không bao giờ ăn — đúng thủ phạm của thanh lọc tab Kiểm kê 6 hàng.) */
"#pane-planogram .hp-wb1,#pane-planogram .hp-wb2{display:contents;}",
/* LÝ DO AI — tách 2 phần: câu kết luận + danh sách "ô nào lỗi gì". Trước đây nhồi cả hai vào một
   đoạn văn (phần chi tiết nằm trong ngoặc, ngăn bằng dấu |) nên máy tính đọc cũng mệt, điện thoại
   thì thành khối chữ đặc 11 dòng. Danh sách chi tiết THU sẵn, bấm ô mới trải ra. */
".hp-lydo{display:block;}",
".hp-lydct{display:none;margin-top:5px;}",
".ailydo.mo .hp-lydct{display:block;}",
".hp-lydct .it{display:block;position:relative;padding-left:10px;font-size:11px;line-height:1.5;color:var(--muted,#6b7280);}",
".hp-lydct .it::before{content:'';position:absolute;left:1px;top:7px;width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.6;}",
".hp-lydct .it b{color:var(--text,#374151);font-weight:650;margin-right:5px;font-variant-numeric:tabular-nums;}",
".ailydo{cursor:pointer;}",
".ailydo .hp-lydo{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}",
".ailydo.mo .hp-lydo{-webkit-line-clamp:unset;}",
/* Ô lý do khi CHƯA có danh sách chi tiết: vẫn phải có đường mở rộng, không thì kẹp 3 dòng là ăn
   mất chữ mà không ai mở lại được (kể cả trên máy tính). */
".ailydo::after{content:'xem thêm';display:inline-block;margin-top:3px;font-size:10.5px;font-weight:650;color:var(--accent,#326e51);}",
".ailydo[data-n]::after{content:'xem ' attr(data-n) ' ô lỗi';display:inline-block;margin-top:3px;font-size:10.5px;font-weight:650;color:var(--accent,#326e51);}",
".ailydo.mo::after,.ailydo.mo[data-n]::after{content:'thu gọn';}",
].join("\n");

/* ===== KHUNG HTML ===== */
var KHUNG =
'<div class="hp-whbar" id="hpWhBar"></div>' +
/* Hàng trên 2 cột (30/07 nén dọc): TRÁI = Sơ đồ khu vực (fitMaps phóng theo bề rộng cột,
   chặn theo chiều cao khung nhìn — A1+A8 lọt trọn 1 màn), PHẢI = Vệ sinh trần 380px GIÃN CAO
   bằng cột trái (KPI 1 hàng + progress + Cần nhắc theo NV + chips AI neo đáy).
   Mobile/hẹp (<1150px): xếp dọc Sơ đồ → Vệ sinh. Danh sách theo dõi luôn nằm DƯỚI cả hai. */
'<div class="hp-main" id="hpMain">' +
'  <div id="hpMap"></div>' +
'  <div id="hpToday"></div>' +
'</div>' +
'<div id="hpAI"></div>' +
'<div id="hpState" class="hp-state"><div class="hp-spin"></div>Đang tải dữ liệu vệ sinh…</div>' +
'<div class="hp-srcfoot">' +
'  <div class="hp-srcbar">' +
/* Nút i để NGOÀI chip — nhét trong thì chip nowrap phình ra và tràn mép (bộ rà bắt được ở bản factory) */
'    <span class="hp-chip">Vệ sinh — SHOP - 170 QUOC LO 1A · khu vực F0-A1 &amp; F0-A8</span>' +
  (typeof tipMuc === "function" ? tipMuc(HP_TIP_NGUON) : "") +
(SHOW_SRC ? '    <a href="' + SHEET_URL + '" target="_blank" rel="noopener">Mở Google Sheet</a>' : '') +
'    <span id="hpLoadinfo" class="hp-hint"></span>' +
'    <button id="hpReload" onclick="HPLANOGRAM.reload()" title="Đọc lại dữ liệu mới nhất từ Google Sheet">Làm mới</button>' +
'  </div>' +
'</div>';
/* Đoạn "Nguồn: planogram · cập nhật lúc 8h40…" ĐÃ RỜI KHỎI MÀN (21/08/2026) — dồn vào nút `i` cạnh
   chip nguồn, cùng luật với dashboard Audit Factory.
   Gộp luôn cả phần đang nằm ở thuộc tính `title` (danh sách 6 tab mà bộ sync ghi): `title` là tooltip
   gốc của trình duyệt, trên ĐIỆN THOẠI không có hover nên không ai đọc được — chính là lý do phải
   dùng nút `i` chứ không dựa vào `title`. VĂN BẢN THUẦN vì tooltip dựng bằng content:attr(). */
var HP_TIP_NGUON = 'Nguồn: planogram — bộ sync-vesinh-all.js (cụm 8h40, hoặc khi bấm "Cập nhật ngay") ' +
  'ghi 6 tab: ' + TAB_YC + ', ' + TAB + ', ' + TAB_CC + ', ' + TAB_LS + ' (lịch sử báo cáo ' + LS_NGAY +
  ' ngày), ' + TAB_CCN + ' (chấm công theo ngày), ' + TAB_NK_BO + ' (chỉ để đọc trên Sheet). ' +
  'Ảnh trong pop-up là ảnh nhân viên chụp khi báo cáo — bấm ảnh để phóng to.';

/* Skeleton GIỮ CHỖ 2 cột trong lúc tải (chống layout-shift khi F5): khối sơ đồ + khối KPI
 * có sẵn hình khối ~ nội dung thật (tái dùng shimmer .sk của host) — bề rộng/chiều cao khung
 * không đổi khi data về, sơ đồ vẽ ra là đứng yên ở giữa ngay từ khung hình đầu. */
var SK_MAP =
'<section class="hp-panel" aria-hidden="true">' +
'<div class="sk sk-line" style="width:38%;margin:2px 0 12px"></div>' +
'<div class="sk" style="height:128px;border-radius:9px;margin:0"></div>' +
'<div class="sk sk-line" style="width:30%;margin:16px 0 10px"></div>' +
'<div class="sk" style="height:168px;border-radius:9px;margin:0 0 2px"></div>' +
'</section>';
var SK_TODAY =
'<section class="hp-panel" aria-hidden="true">' +
'<div class="sk sk-line" style="width:55%;margin:2px 0 12px"></div>' +
'<div class="hp-tiles">' +
'<div class="sk" style="height:50px;border-radius:10px"></div>' +
'<div class="sk" style="height:50px;border-radius:10px"></div>' +
'<div class="sk" style="height:50px;border-radius:10px"></div>' +
'<div class="sk" style="height:50px;border-radius:10px"></div>' +
'</div>' +
'<div class="sk" style="height:6px;border-radius:999px;margin:8px 0 6px"></div>' +
'<div class="sk sk-line" style="width:70%;margin:10px 0 14px"></div>' +
/* giữ chỗ khối "Độ phủ yêu cầu vệ sinh": tiêu đề + 2 dòng khu vực + dải cảnh báo */
'<div class="sk sk-line" style="width:62%;margin:0 0 7px"></div>' +
'<div class="sk" style="height:15px;border-radius:6px;margin:0 0 5px"></div>' +
'<div class="sk" style="height:15px;border-radius:6px;margin:0 0 10px"></div>' +
'<div class="sk" style="height:45px;border-radius:6px;margin:0"></div>' +
'</section>';

var MODAL_HTML =
'<div id="hpModal" class="hp-modal">' +
'  <div class="hp-modalbox">' +
'    <div class="hp-modalhd"><div><div class="mt" id="hpMtitle"></div><div class="mtsub" id="hpMsub"></div></div>' +
'      <div style="display:flex;align-items:center;gap:8px;"><a id="hpMPg" class="hp-ext" target="_blank" rel="noopener" style="display:none;font-size:12px;white-space:nowrap;">Mở planogram ↗</a>' +
'      <button class="hp-mclose" onclick="HPLANOGRAM.closeModal()">&times;</button></div></div>' +
'    <div class="hp-mfilters" id="hpMFilters"></div>' +
'    <div class="hp-msum" id="hpMSum"></div>' +
'    <div class="hp-modalbody"><table class="hp-mtbl mbcard"><thead id="hpMHead"></thead><tbody id="hpMBody"></tbody></table></div>' +
'  </div>' +
'</div>' +
'<div id="hpVtModal" class="hp-modal">' +
'  <div class="hp-modalbox" style="width:min(680px,96vw);">' +
'    <div class="hp-modalhd"><div><div class="mt" id="hpVtTitle"></div><div class="mtsub" id="hpVtSub"></div></div>' +
'      <div style="display:flex;align-items:center;gap:8px;"><a id="hpVtPg" class="hp-ext" target="_blank" rel="noopener" style="font-size:12px;white-space:nowrap;"></a>' +
'      <button class="hp-mclose" onclick="HPLANOGRAM.closeVt()">&times;</button></div></div>' +
'    <div class="hp-modalbody" id="hpVtBody" style="padding:14px 20px 20px;"></div>' +
'  </div>' +
'</div>' +
'<div id="hpNkModal" class="hp-modal">' +
'  <div class="hp-modalbox" style="width:min(920px,96vw);height:min(640px,90vh);">' +
'    <div class="hp-modalhd"><div><div class="mt">Tra cứu theo nhân viên</div>' +
'      <div class="mtsub">Nhật ký vệ sinh theo NGÀY (' + LS_NGAY + ' ngày) — quầy kệ F0-A1 thường giữ theo tuần, không gian F0-A8 đổi theo ngày</div></div>' +
'      <button class="hp-mclose" onclick="HPLANOGRAM.closeNk()">&times;</button></div>' +
'    <div class="hp-nk-grid">' +
'      <div class="hp-nk-left"><input id="hpNkQ" autocomplete="off" placeholder="Tìm tên / mã nhân viên…" oninput="HPLANOGRAM.nkSearch(this.value)"><div class="hp-nk-list" id="hpNkList"></div></div>' +
'      <div class="hp-nk-right" id="hpNkRight"></div>' +
'    </div>' +
'  </div>' +
'</div>';

var THEAD_LOC = '<tr><th>Location</th><th>Executed By</th><th>Code</th><th class="nm">Name</th><th>Khu vực</th><th>Trạng thái</th></tr>';
var THEAD_REQ = '<tr><th>Vị trí</th><th>Trạng thái duyệt</th><th>AI xét duyệt</th><th class="nm">Người thực hiện</th><th>Lúc</th><th class="nm">Phụ trách (dự kiến)</th><th>Ảnh</th><th>Planogram</th></tr>';
var THEAD_MISS = '<tr><th>Vị trí</th><th>Khu vực</th><th>Tình trạng lịch</th><th>Yêu cầu gần nhất</th><th class="nm">Vệ sinh gần nhất</th><th>Planogram</th></tr>';
var THEADS = { loc: THEAD_LOC, req: THEAD_REQ, miss: THEAD_MISS };
var NCOL = { loc: 6, req: 8, miss: 6 };

/* ===== TẢI DỮ LIỆU — GAS readTab (SHEET PRIVATE) là đường DUY NHẤT của 9 tab vệ sinh =====
 * VÌ SAO BỎ FALLBACK gviz cho nhóm tab này (sự cố 12/08/2026 "Chưa có dữ liệu vệ sinh"):
 *   9 tab vệ sinh đã chuyển sang sheet PRIVATE rồi purge khỏi sheet public. gviz gọi một tên tab
 *   KHÔNG TỒN TẠI thì KHÔNG báo lỗi — nó trả status:"ok" kèm TAB ĐẦU TIÊN của file (bảng quy định
 *   5S: STT | QUY ĐỊNH CHI TIẾT | LỖI VI PHẠM…). Rác đó lọt qua mọi lớp kiểm: buildYC/buildMain chỉ
 *   thấy "thiếu cột Location" → S.yc.ok = S.ok = false → màn hình in "Chưa có dữ liệu vệ sinh trong
 *   Google Sheet" trong khi Sheet có đủ 1202 dòng, lại còn cacheSet 30' nên F5 vẫn hỏng nguyên.
 *   NGÒI NỔ: readTab của Apps Script CHẬP CHỜN 404 (quá tải / redirect googleusercontent). Đo thật
 *   12/08: cùng một URL, lượt này 404 lượt sau 200 — nên cách chữa là THỬ LẠI readTab, tuyệt đối
 *   không mượn đường gviz. Thà thiếu dữ liệu (nói rõ vì sao) còn hơn có dữ liệu sai. */
var TAB_PRIVATE = [TAB, TAB_CC, TAB_YC, TAB_ANH, TAB_ANH_CU, TAB_NK_BO, TAB_LS, TAB_CCN, TAB_AI, TAB_PC];
/* ĐO THẬT 12/08/2026 (đừng suy đoán lại): độ trễ nền của Apps Script đã rất cao và 404 rơi NGẪU
 * NHIÊN, không theo kích thước — action=bridgeCaps chỉ trả 74 byte JSON tĩnh mà lượt này 404 ở giây
 * 6,5 lượt sau 200 ở giây 7,4; action=lastSync (đọc 1 Script Property) 404 ở giây 47,7; readTab
 * VESINH-YEUCAU 200 ở giây 39,2 — nghĩa là một lượt ĐANG CHẠY BÌNH THƯỜNG cũng vượt watchdog 25s.
 * Vì thế watchdog không được kết luận theo đồng hồ, phải theo "còn lượt nào đang bay hay không". */
var GAS_CHO = [700, 1800, 4000];   // backoff giữa các lượt thử lại readTab
var GAS_KIEN_NHAN = 90000;         // trần chờ tuyệt đối (Apps Script có khi treo im, không bắn onerror)
var LOI_NGUON = {};                // tab -> "gas" (Apps Script không trả được) | "rong" (Sheet không có dòng nào)
var DANG_THU = {};                 // tab -> đang thử lại lượt thứ mấy (watchdog + màn hình đừng kết luận sớm)
function laTabRieng(tab){ return TAB_PRIVATE.indexOf(tab) >= 0; }
function injectJSONP(url, id, onerr){
  var old = $id(id); if (old) old.remove();
  var sc = document.createElement("script"); sc.id = id; sc.src = url;
  sc.onerror = function(){ onerr && onerr(); };
  document.body.appendChild(sc);
}
function gvizHeader(resp){ return ((resp.table && resp.table.cols) || []).map(function(c){ return (c && c.label) || ""; }); }
function gvizRows(resp){ return ((resp.table && resp.table.rows) || []).map(function(r){ return (r.c || []).map(function(c){ return (c && c.v != null) ? c.v : ""; }); }); }
/* nạp 1 tab: GAS readTab, 404 chập chờn thì THỬ LẠI (cbBuild(header, rows2d, ts)) */
function loadTab(tab, cbName, cbBuild, onFail, lan){
  lan = lan || 0;
  var rieng = laTabRieng(tab);
  /* Hỏng đường truyền: tab riêng thì thử lại rồi mới chịu thua; tab còn nằm ở sheet public
     (không có trong TAB_PRIVATE) vẫn dùng gviz làm đường dự phòng THẬT như trước. */
  function thuLai(){
    if (rieng && lan < GAS_CHO.length){
      setTimeout(function(){ loadTab(tab, cbName, cbBuild, onFail, lan + 1); }, GAS_CHO[lan]);
      return;   // DANG_THU giữ nguyên cho tới khi lượt sau tự đặt lại — watchdog vẫn thấy "còn đang chờ"
    }
    delete DANG_THU[tab];
    LOI_NGUON[tab] = "gas";
    if (rieng){ onFail && onFail(); return; }
    loadTabGviz(tab, cbName, cbBuild, onFail);
  }
  window[cbName] = function(j){
    if (j && j.status === "success" && j.header && j.header.length){
      delete LOI_NGUON[tab]; delete DANG_THU[tab];
      cacheSet(tab, j.header, j.rows || [], Number(j.ts) || 0);
      cbBuild(j.header, j.rows || [], Number(j.ts) || 0);
      return;
    }
    /* GAS trả success mà header rỗng = tab thật sự trống (hoặc chưa được tạo) → thử lại vô ích,
       và đây KHÔNG phải lỗi mạng nên phải phân biệt để màn hình nói đúng nguyên nhân. */
    if (j && j.status === "success" && rieng){ delete DANG_THU[tab]; LOI_NGUON[tab] = "rong"; onFail && onFail(); return; }
    thuLai();
  };
  /* Đánh dấu TRƯỚC KHI bắn: khe hở gây ra sự cố 12/08 là lượt ĐẦU chỉ đang chậm (chưa lỗi) —
     DANG_THU rỗng nên watchdog 25s kết luận "Chưa có dữ liệu" trong khi request vẫn đang bay. */
  if (rieng) DANG_THU[tab] = lan + 1;
  injectJSONP(APPSCRIPT_URL + "?action=readTab&tab=" + encodeURIComponent(tab) + "&callback=" + cbName +
    "&_=" + Date.now() + (lan ? "&thu=" + lan : ""), "hp_sc_" + cbName, thuLai);
}

/* ===== CACHE PHIÊN (sessionStorage) =====
 * Quay lại tab / F5 → vẽ NGAY từ cache rồi mới làm mới nền (stale-while-revalidate).
 * DÙNG sessionStorage, KHÔNG localStorage: dữ liệu có email + tên nhân viên, chỉ nên sống
 * trong tab đang mở (đóng tab là mất), không để PII nằm lại trên đĩa máy dùng chung.
 * Nguồn chỉ đổi 1 lần/ngày (cụm 8h40) nên hạn 30' là thừa an toàn. */
/* hpc2 (12/08/2026): đổi tiền tố để BỎ HẲN cache của bản cũ — máy nào đã kịp cache "tab đầu tiên
   của file" do fallback gviz đầu độc thì F5 vẫn hỏng suốt 30' nếu còn đọc lại khoá hpc1. */
var CACHE_V = "hpc2:", CACHE_TTL = 30 * 60 * 1000;
function cacheGet(tab){
  try{ var o = JSON.parse(sessionStorage.getItem(CACHE_V + tab) || "null");
    return (o && o.H && Date.now() - o.at < CACHE_TTL) ? o : null; }catch(e){ return null; }
}
function cacheSet(tab, H, rows, ts){
  try{ sessionStorage.setItem(CACHE_V + tab, JSON.stringify({ at: Date.now(), H: H, rows: rows, ts: ts })); }
  catch(e){ /* hết quota / chế độ riêng tư — bỏ cache, luồng chính không đổi */ }
}

/* ===== NẠP PHÂN BẬC =====
 * ĐO THẬT 30/07 (đừng suy đoán lại): Apps Script cho khoảng 3 request chạy SONG SONG, phần dư
 * mới phải chờ — 5 tab gọi một lượt về ở 1,9s · 1,9s · 1,9s · 2,7s · 3,0s. Đã thử tách riêng
 * VESINH-YEUCAU gọi một mình rồi mới gọi phần còn lại: CHẬM HƠN (6,2s so với 5,0s) vì mất luôn
 * phần song song. Cách đúng là GIẢM SỐ REQUEST TRANH NHAU, không phải xếp chúng nối đuôi:
 *   bậc 1 — bắn CÙNG LÚC 3 nguồn cần để vẽ màn hình: VESINH-YEUCAU (KPI + sơ đồ + độ phủ),
 *           PHU-TRACH (tên người + phân loại vị trí thiếu), VESINH-AI (panel danh sách mặc định).
 *   bậc 3 — CHAMCONG-VESINH chỉ nạp khi mở danh sách "Nhân viên hôm nay" · VESINH-NHATKY chỉ nạp
 *           khi mở pop-up "Tra cứu nhân viên". Trước đây luôn tải dù hầu như không ai mở tới,
 *           lại là 2 tab NẶNG (nhật ký 45 ngày) → chính chúng đẩy nhóm còn lại ra sau hàng đợi. */
var NGUON = [
  { tab: TAB_YC, cb: "hpgv_yc",
    build: function(H, rows, ts){ if (ts > 0){ S.yc.ts = ts; if (!S.tsData) S.tsData = ts; } clearTimeout(_ycTO); S.yc.dang = false; buildYC(H, rows); },
    fail: function(){ clearTimeout(_ycTO); S.yc.ok = false; S.yc.dang = false; renderToday(); renderMap(); } },
  { tab: TAB_PC, cb: "hpgv_pc",
    build: function(H, rows, ts){ if (ts > 0) S.pc.ts = ts; S.pc.dang = false; buildPC(H, rows); },
    fail: function(){ S.pc.ok = false; S.pc.dang = false; } },
  { tab: TAB, cb: "hpgv_pt",
    build: function(H, rows, ts){ if (ts > 0) S.tsData = ts; S.dangPT = false; buildMain(H, rows); if (!ts) loadMeta(); capNhatInfo(); },
    fail: function(){ S.ok = false; S.dangPT = false; render(); } },
  { tab: TAB_AI, cb: "hpgv_ai",
    build: function(H, rows, ts){ if (ts > 0) S.ai.ts = ts; S.ai.dang = false; buildAI(H, rows); },
    fail: function(){ S.ai.ok = false; S.ai.dang = false; renderAI(); } },
  { tab: TAB_CC, cb: "hpgv_cc",
    build: function(H, rows, ts){ if (ts > 0) S.cc.ts = ts; S.cc.dang = false; buildCC(H, rows); },
    fail: function(){ S.cc.ok = false; S.cc.dang = false; renderCC(); } },
  { tab: TAB_LS, cb: "hpgv_ls",
    build: function(H, rows, ts){ if (ts > 0) S.ls.ts = ts; S.ls.dang = false; buildLS(H, rows); },
    fail: function(){ S.ls.ok = false; S.ls.dang = false; veLaiVt(); } },
  { tab: TAB_CCN, cb: "hpgv_ccn",
    build: function(H, rows, ts){ if (ts > 0) S.ccn.ts = ts; S.ccn.dang = false; buildCCN(H, rows); },
    fail: function(){ S.ccn.ok = false; S.ccn.dang = false; veLaiVt(); } },
  { tab: TAB_ANH, cb: "hpgv_anh",
    build: function(H, rows, ts){ if (ts > 0) S.anh.ts = ts; S.anh.dang = false; buildANH(H, rows); },
    fail: function(){ S.anh.ok = false; S.anh.dang = false; } },
  { tab: TAB_ANH_CU, cb: "hpgv_anhcu",
    build: function(H, rows, ts){ if (ts > 0) S.anhcu.ts = ts; S.anhcu.dang = false; buildANHCU(H, rows); },
    fail: function(){ S.anhcu.ok = false; S.anhcu.dang = false; } }
];
var _daGoi = {}, _ycTO = null, _preTO = null;   // _daGoi: tab -> đã bắn request lượt này · _ycTO: watchdog VESINH-YEUCAU
function nguonOf(tab){ for (var i = 0; i < NGUON.length; i++) if (NGUON[i].tab === tab) return NGUON[i]; return null; }
function goiNguon(tab){
  var n = nguonOf(tab); if (!n || _daGoi[tab]) return;
  _daGoi[tab] = 1; loadTab(n.tab, n.cb, n.build, n.fail);
}
function tuCache(tab){   // vẽ ngay từ cache nếu còn hạn → true khi màn hình đã có dữ liệu
  var n = nguonOf(tab), c = n && cacheGet(tab); if (!c) return false;
  n.build(c.H, c.rows, c.ts); return true;
}
/* bậc 1 — 3 nguồn dựng màn hình. VESINH-YEUCAU bắn TRƯỚC một nhịp ngắn: Apps Script phục vụ
 * nối đuôi (đo 30/07: 302 của tab sau chỉ phát sau khi tab trước trả xong), mà YEUCAU vừa nặng
 * nhất vừa là tab quyết định lúc nào màn hình có nội dung → phải chiếm chỗ đầu hàng. */
function bac1(){
  goiNguon(TAB_YC);
  setTimeout(function(){
    goiNguon(TAB_PC);   // nhẹ (~20KB) mà quyết định tên người phụ trách hiện ở tooltip + pop-up
    goiNguon(TAB); goiNguon(TAB_AI);
    if (S.cc.ok || S.cc.dang) goiNguon(TAB_CC);   // đang mở sẵn danh sách NV / pop-up thì làm mới luôn
    if (S.ls.ok || S.ls.dang) goiNguon(TAB_LS);
    if (S.ccn.ok || S.ccn.dang) goiNguon(TAB_CCN);
    if (S.anh.ok || S.anh.dang) goiNguon(TAB_ANH);
    if (S.anhcu.ok || S.anhcu.dang) goiNguon(TAB_ANH_CU);
  }, 250);
}
/* bậc 3 — nạp theo yêu cầu, gọi từ chỗ người dùng thực sự cần dữ liệu đó */
/* Chấm công: vẽ NGAY từ cache nếu còn (pop-up vị trí mở ra là có luôn dòng "hôm nay có đi làm
   không", không phải chờ mạng) rồi vẫn gọi tab để lấy bản mới — đúng nhịp cache-rồi-tải của loadData. */
function canCC(){ if (S.cc.ok || S.cc.dang) return; S.cc.dang = true; tuCache(TAB_CC); goiNguon(TAB_CC); }
/* Lịch sử 60 ngày: cũng vẽ ngay từ cache phiên rồi mới gọi bản mới — pop-up ô vừa mở đã có
   "báo cáo gần nhất + mấy lượt trong 60 ngày", không phải chờ mạng. */
function canLS(){ if (S.ls.ok || S.ls.dang) return; S.ls.dang = true; tuCache(TAB_LS); goiNguon(TAB_LS); }
/* Chấm công THEO NGÀY: pop-up cho chọn ngày cũ nên phải có nguồn theo ngày, không dùng được tab
   chấm công hôm nay. Cũng vẽ ngay từ cache phiên rồi mới gọi bản mới. */
function canCCN(){ if (S.ccn.ok || S.ccn.dang) return; S.ccn.dang = true; tuCache(TAB_CCN); goiNguon(TAB_CCN); }
/* Ảnh báo cáo: nặng thứ nhì (44KB) mà chỉ cần khi người dùng THẬT SỰ nhìn ảnh — mở pop-up ô hoặc
   mở danh sách yêu cầu. Cũng vẽ ngay từ cache phiên rồi mới gọi bản mới. */
function canANH(){ if (!(S.anh.ok || S.anh.dang)){ S.anh.dang = true; tuCache(TAB_ANH); goiNguon(TAB_ANH); } canAnhNgay(); }
/* Ảnh NGÀY CŨ: chỉ gọi khi ngày ĐANG XEM không nằm trong tab nhanh. Nhận biết bằng chính cột
 * "Ngày" của tab nhanh (S.anh.ngay) chứ không hard-code "3 ngày" — sync đổi VS_ANH_NGAY lúc nào
 * dashboard đi theo lúc đó. Tab nhanh chưa về thì chưa biết gì, buildANH gọi lại sau khi nó về.
 * LỖI USER BẮT ĐƯỢC 18/08 (ô F0-A1-511-08-04-01, bấm ngày 14/8): "ngày đang xem" có HAI nguồn —
 * khoảng ngày của màn hình (khoang()) VÀ ngày riêng của pop-up ô (VT.ngay, đổi bằng dải ô ngày
 * trong chính pop-up). Bản đầu chỉ xét khoang() nên bấm ô ngày 14/8 trong pop-up thì tầng ảnh cũ
 * KHÔNG BAO GIỜ được gọi — pop-up báo "Ảnh báo cáo (0)" trong khi Sheet có đủ 16 ảnh. */
function canAnhNgay(){
  if (!S.anh.ok || S.anhcu.ok || S.anhcu.dang) return;
  var k = khoang(), tu = k[0], den = k[1];
  /* Ngày riêng của pop-up ô đang mở (nếu có) — xét trước vì đó là thứ người dùng đang nhìn. */
  var mv = $id("hpVtModal"), dVt = (mv && mv.classList.contains("show") && VT.ngay) ? VT.ngay : "";
  var thieu = !!(dVt && !S.anh.ngay[dVt]);
  /* Rồi tới khoảng ngày của màn hình: duyệt NGÀY CÓ THẬT trong dữ liệu yêu cầu (không cộng chuỗi
     ngày) — khoảng đang xem mà không có yêu cầu nào thì cũng chẳng có ảnh nào để đi tìm. */
  if (!thieu && tu && den){
    var rs = S.yc.rows || [];
    for (var i = 0; i < rs.length; i++){
      var d = rs[i].ngay;
      if (d >= tu && d <= den && !S.anh.ngay[d]){ thieu = true; break; }
    }
  }
  if (!thieu) return;
  S.anhcu.dang = true; tuCache(TAB_ANH_CU); goiNguon(TAB_ANH_CU);
}
function loadTabGviz(tab, cbName, cbBuild, onFail){
  /* CHỐT AN TOÀN: tab private không có bản sao trên sheet public, mà gviz lại trả TAB ĐẦU TIÊN của
     file thay vì báo lỗi → phải chặn ngay ở cửa, đừng để rác đi tiếp vào cache lẫn màn hình. */
  if (laTabRieng(tab)){ LOI_NGUON[tab] = "gas"; onFail && onFail(); return; }
  var cb2 = cbName + "g";
  window[cb2] = function(resp){
    if (!resp || resp.status === "error"){ onFail && onFail(); }
    else { var H = gvizHeader(resp), rows = gvizRows(resp); cacheSet(tab, H, rows, 0); cbBuild(H, rows, 0); }
  };
  var url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json;responseHandler:" + cb2 + "&sheet=" + encodeURIComponent(tab) + "&headers=1";
  injectJSONP(url, "hp_sc_" + cb2, function(){ onFail && onFail(); });
}
function loadData(){
  var st = $id("hpState"); if (!st) return;
  var btn = $id("hpReload"); if (btn) btn.disabled = true;
  _daGoi = {}; S.lastAt = Date.now();
  S.yc.dang = true; S.dangPT = true; S.ai.dang = true; S.pc.dang = true;
  /* 1) VẼ TỪ CACHE trước (đồng bộ): có cache là màn hình đủ dữ liệu ngay từ khung hình đầu —
        không spinner, không skeleton, không animation vào (tránh chớp trên nội dung đang có). */
  var coYc = tuCache(TAB_YC);
  tuCache(TAB); tuCache(TAB_AI); tuCache(TAB_PC);
  if (S.cc.ok || S.cc.dang) tuCache(TAB_CC);
  if (S.ls.ok || S.ls.dang) tuCache(TAB_LS);
  if (S.ccn.ok || S.ccn.dang) tuCache(TAB_CCN);
  if (S.anh.ok || S.anh.dang) tuCache(TAB_ANH);
  if (S.anhcu.ok || S.anhcu.dang) tuCache(TAB_ANH_CU);
  if (!coYc){
    animBat();   // dữ liệu mới thật → cho chạy animation vào 1 lượt
    st.style.display = "block";
    st.innerHTML = '<div class="hp-spin"></div>Đang tải dữ liệu vệ sinh…';
    /* KHÔNG xoá trắng 2 cột — đổ skeleton giữ chỗ để khung không co về 0 rồi bung ra (giật) */
    $id("hpToday").innerHTML = SK_TODAY; $id("hpMap").innerHTML = SK_MAP;
    $id("hpAI").innerHTML = ""; $id("hpWhBar").innerHTML = "";
  }
  /* 2) BẬC 1: 3 nguồn dựng màn hình (CHAMCONG + NHATKY để dành bậc 3) */
  bac1();
  /* 2b) NẠP TRƯỚC 2 nguồn của pop-up ô (lịch sử báo cáo + chấm công theo ngày) sau khi màn hình đã
     dựng xong. Đợi tới lúc bấm mới gọi thì cú bấm ĐẦU TIÊN phải chờ Apps Script 4-8s (nó phục vụ
     NỐI ĐUÔI, đo 30/07) — thấy rõ dòng "đang tra chấm công…". Trễ 4s nên không tranh chỗ với 3
     nguồn dựng màn hình; lượt sau đã có cache phiên nên không gọi lại. */
  /* SỬA 12/08/2026: mốc 4s cố định là đoán, và đoán sai khi Apps Script chậm — readTab đo được
     7-40s/lượt, nên 2 request nạp trước này chen vào ĐÚNG lúc VESINH-YEUCAU còn đang xếp hàng,
     làm chậm thêm chính tab quyết định màn hình có nội dung. Chờ bậc 1 về THẬT rồi mới nạp trước. */
  clearTimeout(_preTO);
  var thu0 = Date.now();
  _preTO = setTimeout(function choNapTruoc(){
    if (S.yc.ok){ canLS(); canCCN(); return; }
    if (Date.now() - thu0 > 60000) return;   // bậc 1 hỏng hẳn thì thôi, đừng nạp trước làm gì
    _preTO = setTimeout(choNapTruoc, 3000);
  }, 4000);
  /* Watchdog: JSONP không phải lúc nào cũng bắn onerror (Apps Script quá tải có khi im luôn) —
     quá 25s chưa thấy YEUCAU thì thôi giữ skeleton, hiện thẳng thông báo để người dùng biết đường xử lý. */
  clearTimeout(_ycTO);
  var t0 = Date.now();
  _ycTO = setTimeout(function ktraYc(){
    if (!S.yc.dang) return;
    /* Còn lượt đang bay thì CHỜ TIẾP (trong trần kiên nhẫn) — kết luận lúc này là in "không có dữ
       liệu" trong khi request vẫn đang chạy và thường về đủ 1202 dòng ở giây 39 (sự cố 12/08).
       Vẫn phải có TRẦN: Apps Script quá tải có khi im hẳn, không bắn onerror để mình biết. */
    if (DANG_THU[TAB_YC] && Date.now() - t0 < GAS_KIEN_NHAN){
      /* Ghi thẳng dòng chờ, KHÔNG gọi render(): lúc này S.yc.dang vẫn true nên render() sẽ đi
         qua nhánh thông báo rồi vẽ panel rỗng — mất luôn spinner đang có. */
      st.innerHTML = '<div class="hp-spin"></div>Apps Script đang trả lời chậm — chờ lượt ' +
        DANG_THU[TAB_YC] + '/' + (GAS_CHO.length + 1) + '…';
      st.style.display = "block";
      _ycTO = setTimeout(ktraYc, 5000); return;
    }
    if (DANG_THU[TAB_YC]){ delete DANG_THU[TAB_YC]; LOI_NGUON[TAB_YC] = "gas"; }   // hết trần mà vẫn treo
    S.yc.dang = false; xongTai(); renderToday(); renderMap(); render();
  }, 25000);
}
/* Chip giờ dữ liệu: hỏi GAS lastSync (mốc apiAt lúc bộ sync ghi) — chỉ cần khi rơi về gviz */
function loadMeta(){
  window.hpgv_last = function(j){ try{ if (j && j.status === "success" && Number(j.ts) > 0){ S.tsData = Number(j.ts); capNhatInfo(); } }catch(e){} };
  injectJSONP(APPSCRIPT_URL + "?action=lastSync&tab=" + encodeURIComponent(TAB) + "&callback=hpgv_last", "hp_sc_meta");
}

/* ===== BUILD 4 NGUỒN ===== */
function buildMain(H, rows2d){
  var hl = H.map(function(h){ return String(h).replace(/\s+/g, " ").trim().toLowerCase(); });
  var idx = {}; Object.keys(COLS).forEach(function(k){ idx[k] = idxOf(hl, COLS[k]); });
  if (idx.loc < 0){ S.ok = false; S.all = []; render(); return; }   // tab chưa có/không đúng nguồn
  var arr = [];
  rows2d.forEach(function(row){
    function gv(i){ return (i >= 0 && row[i] != null) ? row[i] : ""; }
    var loc = String(gv(idx.loc)).trim(); if (!loc) return;
    var a = areaOf(loc); if (!a) return;    // chỉ giữ F0-A1 / F0-A8
    var email = String(gv(idx.email) || "").trim();
    var code = String(gv(idx.code) || "").trim(), name = String(gv(idx.name) || "").trim();
    ghiNhoNm(email, code, name);
    arr.push({ loc: loc, area: a.k, email: email, code: code, name: name, at: fmtNgayGio(gv(idx.at)), done: !!email });
  });
  S.ok = true; S.all = arr;
  /* Chỉ mục NGÀY báo cáo gần nhất theo vị trí — thay cột "PT lần cuối" đã bỏ khỏi VESINH-YEUCAU
     (ptAtCua). Khoá bằng mã vị trí ĐẦY ĐỦ, y như cột cũ được sync ghi ra. */
  _ptAtBy = {};
  arr.forEach(function(x){ if (x.at) _ptAtBy[x.loc] = String(x.at).slice(0, 10); });
  render();
}
function buildCC(H, rows2d){
  var hl = H.map(function(h){ return String(h).replace(/\s+/g, " ").trim().toLowerCase(); });
  var idx = {}; Object.keys(COLS_CC).forEach(function(k){ idx[k] = idxOf(hl, COLS_CC[k]); });
  _ccIdx = null;   // bảng tra chấm công (ccIndex) dựng lại theo dữ liệu mới
  if (idx.name < 0 || idx.tt < 0){ S.cc.ok = false; S.cc.rows = []; renderCC(); return; }
  var arr = [];
  rows2d.forEach(function(row){
    function gv(i){ return (i >= 0 && row[i] != null) ? row[i] : ""; }
    var name = String(gv(idx.name)).trim(); if (!name) return;
    var tt = String(gv(idx.tt)).trim();
    var email = String(gv(idx.email) || "").trim();
    ghiNhoNm(email, String(gv(idx.code) || "").trim(), name);
    arr.push({ code: String(gv(idx.code) || "").trim(), name: name, email: email,
      major: String(gv(idx.major) || "").trim(), ci: fmtHM(gv(idx.ci)), co: fmtHM(gv(idx.co)),
      vs: Number(gv(idx.vs)) || 0, loc: String(gv(idx.loc) || "").trim(), tt: tt, bk: ccBucket(tt) });
  });
  S.cc.ok = true; S.cc.rows = arr; renderCC();
  /* Chấm công là nguồn BẬC 3 (nạp muộn) nhưng pop-up vị trí + tooltip ô đều cần nó để trả lời
     "phụ trách hôm nay có đi làm không" → vẽ lại cả hai khi dữ liệu về. */
  renderMap();
  var mv = $id("hpVtModal");
  if (mv && mv.classList.contains("show")) renderVt();
}
function buildYC(H, rows2d){
  var hl = H.map(function(h){ return String(h).replace(/\s+/g, " ").trim().toLowerCase(); });
  var idx = {}; Object.keys(COLS_YC).forEach(function(k){ idx[k] = idxOf(hl, COLS_YC[k]); });
  /* Chốt nguồn: cần Location + Status ID. Trước 03/08 chốt bằng cột "Trạng thái", nhưng cột đó
     nay đã bỏ (suy từ Status ID) — giữ chốt cũ là tab mới về sẽ bị coi như "không đúng nguồn". */
  if (idx.loc < 0 || idx.stid < 0){ S.yc.ok = false; S.yc.rows = []; renderToday(); return; }
  var arr = [], ngay = "";
  rows2d.forEach(function(row){
    function gv(i){ return (i >= 0 && row[i] != null) ? row[i] : ""; }
    var loc = String(gv(idx.loc)).trim(); if (!loc) return;
    var a = areaOf(loc); if (!a) return;
    var stId = Number(gv(idx.stid)) || 0;
    var r = {
      id: String(gv(idx.id)).replace(/\.0$/, "").trim(),
      ngay: fmtNgay(gv(idx.ngay)),
      loc: loc, area: a.k,
      /* Tên trạng thái: cột cũ nếu tab/cache còn có, không thì tra ST_TEN. Mọi chỗ dùng r.st
         (badge, ycBucket) giữ nguyên regex — chỉ đổi CHỖ LẤY, không đổi giá trị. */
      stId: stId, st: String(gv(idx.st) || ST_TEN[stId] || (stId ? "#" + stId : "")).trim(),
      email: String(gv(idx.email) || "").trim(), at: fmtNgayGio(gv(idx.at)),
      pt: String(gv(idx.pt) || "").trim(),
      ptCode: String(gv(idx.ptcode) || "").trim(),
      ptDiLam: Number(gv(idx.ptdilam)) || 0, ptCi: fmtHM(gv(idx.ptci)),
      anh: []   // đổ từ tab VESINH-ANH (bậc 3) — xem buildANH/ganAnh
    };
    r.bk = ycBucket(r);
    ghiNhoNm(r.pt, r.ptCode, String(gv(idx.ptname) || "").trim());
    if (r.ngay > ngay) ngay = r.ngay;
    arr.push(r);
  });
  ganAnh(arr);   // ảnh đã về trước (cache phiên) thì gắn ngay, không đợi lượt sau
  S.yc.ok = true; S.yc.rows = arr; S.yc.ngay = ngay;
  if (!S.dDen || !arr.some(function(r){ return r.ngay >= (S.dTu || S.dDen) && r.ngay <= S.dDen; })){ S.dTu = ngay; S.dDen = ngay; }
  /* BẬC 1 xong = màn hình đã dùng được: tắt spinner, mở lại nút Làm mới, vẽ cả 3 khối
     (khối danh sách tự hiện trạng thái "đang tải" cho nguồn bậc 2/3 chưa về). */
  xongTai();
  renderWhBar(); renderToday(); renderList(); capNhatInfo();
}
/* ===== HOÃN TẢI ẢNH (18/08/2026) — ĐO THẬT TRƯỚC KHI LÀM, ĐỪNG TỐI ƯU LẠI THEO CẢM TÍNH =====
 * Ảnh báo cáo là FILE GỐC chụp bằng điện thoại: đo 8 ảnh mẫu = 451–769 KB (trung bình ~520 KB).
 * Mở MỘT pop-up ô đang kéo 36 ảnh ⇒ 18,6 MB / 16,8 giây, chỉ để vẽ mấy ô thumbnail 34px.
 * CDN `cdn-media-wms.inshasaki.com` (Cloudflare) KHÔNG bật đường resize — `/cdn-cgi/image/...`
 * trả 404, `?width=` bị bỏ qua, không thương lượng webp — nên không có bản nhỏ nào để xin.
 * ⇒ Cách nhẹ duy nhất: ĐỪNG TẢI ẢNH CHƯA AI NHÌN. imgAnh() cho ANH_TAI_NGAY ảnh đầu tải ngay,
 *   phần còn lại giữ data-src và chỉ đổi thành src khi lọt vào khung nhìn.
 * KHÔNG cần dựng kho ảnh riêng để "khỏi tải lại": đo thật, mở LẠI cùng ô = 0 lượt / 0 KB — WMS
 * trả 302 `immutable` (6 ngày) và CDN trả `max-age=604800` (7 ngày), trình duyệt giữ sẵn hết. */
var ANH_TAI_NGAY = 2;
var ANH_XEM_TRUOC = 4;   // số ô ảnh bày sẵn trong pop-up (còn lại giấu sau nút +N)
var ANH_CHO = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
function imgAnh(u, phu, taiNgay){
  return taiNgay
    ? '<img loading="lazy" src="' + esc(u) + '" alt=""' + phu + '>'
    : '<img class="hp-lz" loading="lazy" src="' + ANH_CHO + '" data-src="' + esc(u) + '" alt=""' + phu + '>';
}
/* Một observer dùng chung cho cả 3 chỗ vẽ ảnh (pop-up ô · danh sách · modal yêu cầu). Đệm 240px
   để ảnh kịp về trước khi cuộn tới. Trình duyệt không có IntersectionObserver thì tải thẳng như cũ. */
var _lzIO = null;
function lazyQuet(){
  var ds = document.querySelectorAll("img.hp-lz[data-src]");
  if (!ds.length) return;
  if (!window.IntersectionObserver){
    [].forEach.call(ds, function(im){ im.src = im.getAttribute("data-src"); im.removeAttribute("data-src"); im.classList.remove("hp-lz"); });
    return;
  }
  if (!_lzIO) _lzIO = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if (!e.isIntersecting) return;
      var im = e.target, u = im.getAttribute("data-src");
      if (u){ im.src = u; im.removeAttribute("data-src"); im.classList.remove("hp-lz"); }
      _lzIO.unobserve(im);
    });
  }, { rootMargin: "240px" });
  [].forEach.call(ds, function(im){ _lzIO.observe(im); });
}
/* ẢNH BÁO CÁO (tab VESINH-ANH, tách khỏi VESINH-YEUCAU 03/08/2026 — bậc 3).
 * Gắn thẳng vào r.anh của dòng yêu cầu để 4 chỗ vẽ ảnh (danh sách NV, pop-up ô, modal yêu cầu,
 * lightbox) không phải đổi gì. Tab chưa về = r.anh rỗng = không có thumbnail, không lỗi. */
function ganAnh(rows){
  if (!S.anh.ok || !rows) return 0;
  var n = 0;
  rows.forEach(function(r){ var a = S.anh.by[String(r.id)]; if (a && a.length){ r.anh = a; n++; } });
  return n;
}
function docANH(H, rows2d, by, ngay){
  var hl = H.map(function(h){ return String(h).replace(/\s+/g, " ").trim().toLowerCase(); });
  var idx = {}; Object.keys(COLS_ANH).forEach(function(k){ idx[k] = idxOf(hl, COLS_ANH[k]); });
  if (idx.id < 0 || idx.anh < 0) return false;
  rows2d.forEach(function(row){
    function gv(i){ return (i >= 0 && row[i] != null) ? row[i] : ""; }
    var id = String(gv(idx.id)).replace(/\.0$/, "").trim(); if (!id) return;
    var d = String(gv(idx.ngay) || "").slice(0, 10); if (d && ngay) ngay[d] = 1;
    var a = String(gv(idx.anh) || "").split(/\s*\|\s*/).filter(Boolean).map(urlAnh);
    if (a.length) by[id] = a;
  });
  return true;
}
/* Vẽ lại 4 chỗ có ảnh sau khi một tab ảnh về (dùng chung cho tab nhanh lẫn tab ngày cũ). */
function veLaiAnh(){
  if (!ganAnh(S.yc.rows)) return;   // chưa có dòng nào nhận ảnh → khỏi vẽ lại
  renderList();                     // cột thumbnail của danh sách nhân viên/AI
  veLaiVt();                        // pop-up ô đang mở
  var m = $id("hpModal");           // modal danh sách yêu cầu đang mở
  if (m && m.classList.contains("show")) mRender();
}
function buildANH(H, rows2d){
  var by = {}, ngay = {};
  if (!docANH(H, rows2d, by, ngay)){ S.anh.ok = false; S.anh.by = {}; S.anh.ngay = {}; return; }
  /* Gộp phần ảnh ngày cũ đã nạp trước đó (nếu có) — lượt Làm mới nạp lại tab nhanh không được
     xoá mất ảnh cũ đang hiển thị trong pop-up. */
  if (S.anhcu.ok) for (var k in S.anh.by) if (!by[k]) by[k] = S.anh.by[k];
  S.anh.ok = true; S.anh.by = by; S.anh.ngay = ngay;
  canAnhNgay();   // tab nhanh về rồi mới biết nó phủ ngày nào → giờ mới quyết được có cần tab cũ không
  veLaiAnh();
}
/* Ảnh ngày 4→7: GỘP vào chính S.anh.by (ganAnh chỉ đọc một sổ) chứ không giữ sổ riêng. */
function buildANHCU(H, rows2d){
  if (!docANH(H, rows2d, S.anh.by, null)){ S.anhcu.ok = false; return; }
  S.anhcu.ok = true;
  veLaiAnh();
}
/** Tên người phụ trách của 1 yêu cầu — cột "PT Name" đã bỏ, tra từ sổ tên chung (PHU-TRACH +
 *  VESINH-PHANCONG đều nạp ở bậc 1 và cả hai đều gọi ghiNhoNm). Chưa có tên thì hiện email. */
function ptTen(r){ return (r && r.pt) ? (tenNm(r.pt) || r.pt) : ""; }
/** NGÀY bằng chứng phụ trách ("PT lần cuối" cũ) = Executed At của chính vị trí đó ở tab PHU-TRACH.
 *  Đối chiếu 1246/1246 dòng ngày 03/08/2026 trước khi bỏ cột. PHU-TRACH chưa về → "" (ptKhongChac
 *  trả false → không gắn badge "chưa chắc" chứ không kết luận sai). */
var _ptAtBy = {};
function ptAtCua(r){ return (r && r.loc) ? (_ptAtBy[r.loc] || "") : ""; }
/* Lịch sử báo cáo 60 ngày — gom theo KHOÁ Ô (khoaO) vì kệ A1 mang nhiều mã mâm-bin qua các ngày:
   tra theo mã đúng từng ký tự sẽ chia lịch sử của 1 kệ thành nhiều mảnh rời. */
function buildLS(H, rows2d){
  var hl = H.map(function(h){ return String(h).replace(/\s+/g, " ").trim().toLowerCase(); });
  var idx = {}; Object.keys(COLS_LS).forEach(function(k){ idx[k] = idxOf(hl, COLS_LS[k]); });
  if (idx.ngay < 0 || idx.loc < 0){ S.ls.ok = false; S.ls.by = {}; S.ls.ev = []; S.ls.n = 0; _nkRows = null; veLaiVt(); return; }
  var by = {}, ev = [], n = 0;
  rows2d.forEach(function(row){
    function gv(i){ return (i >= 0 && row[i] != null) ? row[i] : ""; }
    var loc = String(gv(idx.loc)).trim(); if (!loc) return;
    var ngay = fmtNgay(gv(idx.ngay)); if (!ngay) return;
    var email = String(gv(idx.email) || "").trim();
    var code = String(gv(idx.code) || "").trim(), name = String(gv(idx.name) || "").trim();
    ghiNhoNm(email, code, name);
    var k = khoaO(loc);
    var luot = { loc: loc, ngay: ngay, gio: fmtHM(gv(idx.gio)), email: email,
      code: code, name: name, id: String(gv(idx.id) || "").replace(/\.0$/, "").trim() };
    (by[k] || (by[k] = [])).push(luot);
    ev.push(luot);   // danh sách PHẲNG: nguồn của nhật ký theo nhân viên (nkRows)
    n++;
  });
  Object.keys(by).forEach(function(k){
    by[k].sort(function(a, b){ return (a.ngay + " " + a.gio) < (b.ngay + " " + b.gio) ? 1 : -1; });   // mới → cũ
  });
  S.ls.ok = true; S.ls.by = by; S.ls.n = n; S.ls.ev = ev; _nkRows = null;
  veLaiVt();
  /* pop-up "Tra cứu theo nhân viên" nay cũng ăn nguồn này (thay tab VESINH-NHATKY) → đang mở thì
     chọn sẵn NV đầu rồi vẽ lại, y như buildNK cũ làm. */
  var mo = $id("hpNkModal");
  if (mo && mo.classList.contains("show")){
    if (!NK.email){ var l = nkStaff(); if (l.length) NK.email = l[0].email.toLowerCase(); }
    renderNkList(); renderNkRight();
  }
  render();   // panel phụ trách hiện số NV có nhật ký
}
/** Lượt báo cáo THẬT của 1 ô trong 60 ngày (mới → cũ). [] khi chưa nạp / ô chưa ai làm. */
function lsCua(loc){ return (S.ls.ok && S.ls.by[khoaO(loc)]) || []; }
/** Pop-up vị trí có thể đang mở khi nguồn bậc 3 về → vẽ lại đúng chỗ đó (giống buildCC). */
function veLaiVt(){ var m = $id("hpVtModal"); if (m && m.classList.contains("show")) renderVt(); }
/* CHẤM CÔNG THEO NGÀY — 1 dòng Sheet = 1 NV, ô cuối gói mọi ngày:
     "2026-08-01 05:54-17:32 | 2026-07-31 05:47-16:58 | …"   (thiếu giờ ghi --:--)
   Tra được bằng EMAIL hoặc MÃ NV vì bảng phân công có dòng chỉ ghi một trong hai. */
function buildCCN(H, rows2d){
  var hl = H.map(function(h){ return String(h).replace(/\s+/g, " ").trim().toLowerCase(); });
  var idx = {}; Object.keys(COLS_CCN).forEach(function(k){ idx[k] = idxOf(hl, COLS_CCN[k]); });
  if (idx.ds < 0){ S.ccn.ok = false; S.ccn.em = {}; S.ccn.code = {}; S.ccn.ngay = {}; veLaiVt(); return; }
  var byEm = {}, byCode = {}, ngay = {};
  rows2d.forEach(function(row){
    function gv(i){ return (i >= 0 && row[i] != null) ? String(row[i]).trim() : ""; }
    var code = gv(idx.code).replace(/\.0$/, ""), em = gv(idx.email).toLowerCase(), ten = gv(idx.name);
    var d = {}, n = 0, m, re = /(\d{4}-\d{2}-\d{2})\s+(\S+?)-(\S+)/g, txt = gv(idx.ds);
    while ((m = re.exec(txt)) !== null){ d[m[1]] = { vao: m[2], ra: m[3] }; ngay[m[1]] = 1; n++; }
    if (!n) return;
    ghiNhoNm(em, code, ten);
    var o = { code: code, em: em, ten: ten, d: d, n: n };
    if (em) byEm[em] = o;
    if (code) byCode[code] = o;
  });
  S.ccn.ok = true; S.ccn.em = byEm; S.ccn.code = byCode; S.ccn.ngay = ngay;
  veLaiVt();
  /* 03/08/2026: tab này nay còn quyết định MÀU Ô + 3 thẻ KPI + panel "cần nhắc" khi soi NGÀY CŨ
     (trước chỉ pop-up dùng nó) → về tới là phải vẽ lại cả màn hình, không chỉ pop-up. */
  if (!laHomNay() && la1Ngay()){ renderToday(); render(); }
}
var GIO_TRONG = "??:??";   // khớp sync-vesinh-all.js: ô giờ thiếu (chưa chấm ra / quên chấm)
/** Chấm công của 1 người trong 1 NGÀY: null = chưa nạp được · {co:false} = hôm đó KHÔNG chấm công */
function ccNgayCua(email, code, ngay){
  if (!S.ccn.ok || !ngay) return null;
  var o = S.ccn.em[String(email || "").toLowerCase()] || S.ccn.code[String(code || "").trim()];
  /* Không có NGÀY đó trong tab (ngoài cửa sổ 60 ngày / chưa sync tới) khác hẳn "có ngày mà người
     này không chấm công" — phân biệt để không kết tội oan người nghỉ phép hợp lệ. */
  if (!S.ccn.ngay[ngay]) return { ngoaiTam: true };
  if (!o) return { co: false, ngoaiBang: true };
  var x = o.d[ngay];
  if (!x) return { co: false };
  return { co: true, vao: x.vao === GIO_TRONG ? "" : x.vao, ra: x.ra === GIO_TRONG ? "" : x.ra };
}
function buildAI(H, rows2d){
  var hl = H.map(function(h){ return String(h).replace(/\s+/g, " ").trim().toLowerCase(); });
  var idx = {}; Object.keys(COLS_AI).forEach(function(k){ idx[k] = idxOf(hl, COLS_AI[k]); });
  if (idx.id < 0 || idx.kl < 0){ S.ai.ok = false; S.ai.by = {}; S.ai.rows = []; renderAI(); return; }
  var by = {}, arr = [];
  rows2d.forEach(function(row){
    function gv(i){ return (i >= 0 && row[i] != null) ? row[i] : ""; }
    var id = String(gv(idx.id)).replace(/\.0$/, "").trim(); if (!id) return;
    var loc = String(gv(idx.loc) || "").trim();
    var a = areaOf(loc);
    var r = { id: id, ngay: fmtNgay(gv(idx.ngay)), loc: loc, area: a ? a.k : "",
      exec: String(gv(idx.exec) || "").trim(), at: fmtNgayGio(gv(idx.at)),
      kl: String(gv(idx.kl)).trim().toUpperCase().replace(/\s+/g, "_"),
      diem: Number(gv(idx.diem)) || 0, tincay: Number(gv(idx.tincay)) || 0,
      lydo: String(gv(idx.lydo) || "").trim(), anhloi: String(gv(idx.anhloi) || "").trim(),
      model: String(gv(idx.model) || "").trim(), jat: fmtNgayGio(gv(idx.jat)) };
    by[id] = r; arr.push(r);
  });
  arr.sort(function(a, b){ return String(b.ngay).localeCompare(String(a.ngay)) || String(b.at).localeCompare(String(a.at)); });
  S.ai.ok = true; S.ai.by = by; S.ai.rows = arr;
  renderToday();   // vẽ lại chip AI ở hero
  renderAI();      // khối "AI xét duyệt ảnh"
}
function aiOf(r){ return S.ai.ok ? (S.ai.by[String(r.id)] || null) : null; }
function buildPC(H, rows2d){
  var hl = H.map(function(h){ return String(h).replace(/\s+/g, " ").trim().toLowerCase(); });
  var idx = {}; Object.keys(COLS_PC).forEach(function(k){ idx[k] = idxOf(hl, COLS_PC[k]); });
  if (idx.loc < 0 || idx.em < 0){ S.pc.ok = false; S.pc.by = {}; return; }
  var by = {};
  rows2d.forEach(function(row){
    function gv(i){ return (i >= 0 && row[i] != null) ? String(row[i]).trim() : ""; }
    var loc = gv(idx.loc); if (!loc) return;
    var o = { em: gv(idx.em).toLowerCase(), code: gv(idx.code), ten: gv(idx.ten),
      nguon: gv(idx.nguon), bc: gv(idx.bc), gc: gv(idx.gc) };
    ghiNhoNm(o.em, o.code, o.ten);   // để mọi chỗ khác hiện được TÊN thay vì email
    by[khoaO(loc)] = o;
  });
  S.pc.ok = true; S.pc.by = by;
  renderMap();      // tooltip ô + panel cần nhắc dùng tên phụ trách
  renderToday();
}
/** Người phụ trách CHÍNH THỨC của 1 vị trí (theo bảng phân công) — null nếu chưa nạp/không có */
function pcCua(loc){ return S.pc.ok ? (S.pc.by[khoaO(loc)] || null) : null; }
/* --- CHẤM CÔNG HÔM NAY CỦA 1 NGƯỜI (tab CHAMCONG-VESINH) ---
 * Dùng cho pop-up vị trí: biết ai phụ trách thì phải biết LUÔN hôm nay người đó có đi làm không,
 * nếu không thì "chưa vệ sinh" của ô đó là chuyện phải bố trí người khác, chứ không phải đi nhắc.
 * Khớp theo EMAIL trước (khoá chắc nhất), rớt về MÃ NV cho dòng g-sheet chỉ ghi mã.
 * Lưu ý: tab này chỉ có DỮ LIỆU HÔM NAY — không tra được chấm công ngày quá khứ. */
var _ccIdx = null;   // buildCC() xoá về null mỗi lượt nạp lại → không bao giờ tra bản cũ
function ccIndex(){
  if (_ccIdx) return _ccIdx;
  var byEm = {}, byCode = {};
  S.cc.rows.forEach(function(x){
    var e = String(x.email || "").toLowerCase(); if (e && !byEm[e]) byEm[e] = x;
    var c = String(x.code || "").trim(); if (c && !byCode[c]) byCode[c] = x;
  });
  _ccIdx = { em: byEm, code: byCode };
  return _ccIdx;
}
function ccCua(email, code){
  if (!S.cc.ok || !S.cc.rows.length) return null;
  var ix = ccIndex();
  return ix.em[String(email || "").toLowerCase()] || ix.code[String(code || "").trim()] || null;
}
/* Chấm công hôm nay để hiển thị: { c, lb, sub, subC }.
 * TÁCH ĐÔI HAI SỰ THẬT, đừng nhuộm chung một màu:
 *   dòng ĐẬM + chấm màu = CÓ ĐI LÀM HAY KHÔNG (xanh lá đi làm · xám nghỉ · xám mờ ngoài danh sách)
 *   dòng phụ = đã/chưa báo cáo vệ sinh trong ngày, ĐỎ khi chưa — đúng luật màu của sơ đồ
 *     (đỏ chỉ dành cho "chưa vệ sinh", không dành cho "có chấm công").
 * Trộn hai thứ vào một màu thì "Hôm nay có chấm công" hiện màu đỏ, đọc ra như thể đi làm là lỗi. */
function ccTrangThai(email, code){
  if (S.cc.dang) return { c: "#6b7280", lb: "đang tra chấm công…", sub: "", dang: true };
  if (!S.cc.ok) return { c: "#6b7280", lb: "chưa đọc được chấm công", sub: "tab " + TAB_CC, dang: true };
  var x = ccCua(email, code);
  if (!x) return { c: "#9ca3af", lb: "Không có trong bảng chấm công hôm nay", sub: "không thuộc danh sách nghiệp vụ vệ sinh đang theo dõi" };
  if (x.bk === "nghi") return { c: "#64748b", lb: "Hôm nay KHÔNG chấm công",
    sub: (x.tt || "nghỉ / chưa vào ca") + " — nhắc không tới, cần bố trí người khác", x: x };
  var gio = (x.ci ? "vào " + x.ci : "") + (x.co ? (x.ci ? " · ra " + x.co : "ra " + x.co) : "");
  return { c: "#059669", lb: "Hôm nay ĐI LÀM" + (gio ? " · " + gio : ""),
    sub: x.bk === "da" ? "đã báo cáo vệ sinh trong ngày" + (x.vs > 1 ? " (" + x.vs + " lượt)" : "") : "chưa báo cáo vệ sinh nào trong ngày — nhắc được ngay",
    subC: x.bk === "da" ? "" : "#dc2626", x: x };
}
/* Chữ đầu của tên (avatar) — bỏ dấu không cần, chỉ lấy 2 ký tự đầu của 2 từ cuối */
function chuDau(s){
  var w = String(s || "").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[w.length - 2].charAt(0) + w[w.length - 1].charAt(0)).toUpperCase();
}
/* --- KHỐI 1b: PANEL DANH SÁCH — 1 panel duy nhất, 2 chế độ: AI XÉT DUYỆT · NHÂN VIÊN --- */
function aiSetKl(k){ if (S.aiKl === k) k = ""; S.aiKl = k; renderList(); }
var _aiDeb = null;
function aiSearch(v){ S.aiQ = String(v || "").trim().toLowerCase(); clearTimeout(_aiDeb); _aiDeb = setTimeout(renderList, 130); }
/* LÝ DO AI → 2 phần. `lydo` là câu kết luận; `anhloi` là chi tiết từng ô, do bộ sync-vesinh-ai
 * ghi dạng "F0-A1-…: lý do | F0-A1-…: lý do". Trước đây dán cả cụm vào trong ngoặc ngay sau câu kết
 * luận ⇒ một ô 438 ký tự vỡ 11 dòng trên điện thoại (bộ đo bắt được 108 ô như vậy). Nay: câu kết
 * luận kẹp 3 dòng, chi tiết thành danh sách THU sẵn — bấm mới trải ra. `title` giữ nguyên văn đầy
 * đủ cho người dùng máy tính rê chuột.
 * Dùng ở HAI chỗ nên tách phần RUỘT riêng: ô bảng (panel danh sách) và khối div (pop-up 1 vị trí).
 * Nhét cùng một chuỗi vào cả hai bằng replace() là cách sinh ra thẻ có 2 thuộc tính class. */
function aiLyDoRuot(lydo, anhloi){
  var ct = String(anhloi || "").split("|").map(function(x){ return x.trim(); }).filter(Boolean);
  var ds = ct.length ? '<span class="hp-lydct">' + ct.map(function(t){
      var i = t.indexOf(":");
      var ma = i > 0 ? t.slice(0, i).trim() : "";
      var ly = i > 0 ? t.slice(i + 1).trim() : t;
      return '<span class="it">' + (ma ? '<b>' + esc(ma) + '</b>' : "") + esc(ly) + '</span>';
    }).join("") + '</span>' : "";
  return { n: ct.length,
    tip: esc(String(lydo || "") + (anhloi ? " (" + anhloi + ")" : "")),
    html: '<span class="hp-lydo">' + esc(lydo || "") + '</span>' + ds };
}
var AI_LYDO_TAP = ' onclick="event.stopPropagation();this.classList.toggle(\'mo\')"';
function aiLyDoCell(lydo, anhloi){
  var o = aiLyDoRuot(lydo, anhloi);
  return '<td class="wrap mb-full ailydo"' + (o.n ? ' data-n="' + o.n + '"' : "") +
    ' title="' + o.tip + '"' + AI_LYDO_TAP + '>' + o.html + '</td>';
}
function aiLyDoKhoi(lydo, anhloi){
  var o = aiLyDoRuot(lydo, anhloi);
  return '<div class="ailydo" style="margin-top:5px;line-height:1.55"' + (o.n ? ' data-n="' + o.n + '"' : "") +
    ' title="' + o.tip + '"' + AI_LYDO_TAP + '>' + o.html + '</div>';
}
function renderList(){
  var box = $id("hpAI"); if (!box) return;
  if (!S.ai.ok && !S.cc.ok && !S.ai.dang && !S.cc.dang){ box.innerHTML = ""; return; }
  /* Số trên nút: chỉ hiện khi nguồn đã về — nguồn bậc 2/3 chưa tải thì để "…" cho khỏi
     hiểu nhầm là "có 0 kết quả". */
  var nAi = S.ai.ok ? '<b>' + nf(S.ai.rows.filter(function(r){ return !S.area || r.area === S.area; }).length) + '</b>' : (S.ai.dang ? '<b class="hp-hint">…</b>' : '');
  var nCc = S.cc.ok ? '<b>' + nf(S.cc.rows.length) + '</b>' : (S.cc.dang ? '<b class="hp-hint">…</b>' : '');
  var modes =
    '<span class="hp-seg">' +
    '<button class="' + (S.listMode === "ai" ? "on" : "") + '" onclick="HPLANOGRAM.setListMode(\'ai\')">AI xét duyệt ảnh ' + nAi + '</button>' +
    '<button class="' + (S.listMode === "nv" ? "on" : "") + '" onclick="HPLANOGRAM.setListMode(\'nv\')">Nhân viên hôm nay ' + nCc + '</button>' +
    '</span>';
  box.innerHTML =
    '<section class="hp-panel hp-fade" style="margin-top:10px">' +
    '<h2>Danh sách theo dõi<span style="flex:1"></span>' + modes + '</h2>' +
    (S.listMode === "nv" ? htmlNhanVien() : htmlAiXetDuyet()) +
    '</section>';
  lazyQuet();
}
function renderAI(){ renderList(); }
function htmlAiXetDuyet(){
  if (!S.ai.ok && S.ai.dang) return '<div class="hp-empty"><div class="hp-spin" style="width:22px;height:22px;border-width:2px;margin-bottom:10px"></div>Đang tải kết quả AI xét duyệt ảnh…</div>';
  if (!S.ai.ok || !S.ai.rows.length) return '<div class="hp-empty">Chưa có kết quả AI (tab <code>VESINH-AI</code>) — bộ <code>sync-vesinh-ai.mjs</code> chạy cùng cụm 8h40 / nút Cập nhật ngay.</div>';
  var all = S.ai.rows.filter(function(r){ return !S.area || r.area === S.area; });
  var cnt = { DAT: 0, KHONG_DAT: 0, CAN_XEM: 0 };
  all.forEach(function(r){ if (cnt[r.kl] != null) cnt[r.kl]++; });
  /* Chưa chấm = yêu cầu "Chờ duyệt" của ngày đang xem chưa có kết quả AI */
  var nCho = 0;
  if (S.yc.ok) ycInScope().forEach(function(r){ if (r.stId === 3 && !S.ai.by[String(r.id)]) nCho++; });
  var models = {}; all.forEach(function(r){ if (r.model) models[r.model] = 1; });

  var q = S.aiQ;
  var rows = all.filter(function(r){
    if (S.aiKl && r.kl !== S.aiKl) return false;
    if (q && ((r.loc + " " + r.exec + " " + tenNm(r.exec) + " " + r.lydo + " " + r.anhloi + " " + r.model).toLowerCase().indexOf(q) < 0)) return false;
    return true;
  });

  var chips = '<span class="hp-hint" style="font-weight:650">Kết luận:</span>' +
    '<button class="hp-whtab' + (S.aiKl ? "" : " active") + '" onclick="HPLANOGRAM.aiSetKl(\'\')">Tất cả · ' + nf(all.length) + '</button>' +
    AIST.map(function(m){
      /* `hp-z0` = chip đếm 0: làm mờ để mắt bắt ngay chỗ CÓ SỐ. Vẫn bấm được (lọc ra 0 dòng là một
         câu trả lời hợp lệ) — chỉ bỏ cái vẻ "mọi viên đều quan trọng như nhau". */
      return '<button class="hp-whtab' + (S.aiKl === m.k ? " active" : (cnt[m.k] ? "" : " hp-z0")) + '" data-k="' + m.k + '" onclick="HPLANOGRAM.aiSetKl(this.getAttribute(\'data-k\'))"><span class="hp-dot" style="background:' + m.c + '"></span>' + esc(m.lb.replace("AI: ", "")) + ' <b>' + nf(cnt[m.k]) + '</b></button>';
    }).join("") +
    (nCho ? '<span class="hp-hint" title="Yêu cầu Chờ duyệt của ngày đang xem chưa được AI chấm — tự chấm ở lượt kế tiếp">· còn ' + nf(nCho) + ' chờ AI chấm</span>' : "");

  var CAPAI = 300;
  var body = rows.length ? rows.slice(0, CAPAI).map(function(r){
    var m = aiMeta(r.kl) || { lb: r.kl, c: "#6b7280" };
    var badge = '<span class="hp-badge" style="background:color-mix(in srgb,' + m.c + ' 15%,transparent);color:' + m.c + '" title="Tin cậy ' + r.tincay + '%">' + esc(m.lb.replace("AI: ", "")) + (r.diem ? " · " + r.diem : "") + '</span>';
    var nvName = tenNm(r.exec);
    var yc = S.yc.ok ? S.yc.rows.filter(function(y){ return String(y.id) === r.id; })[0] : null;
    var anh = (yc && yc.anh.length)
      ? '<span class="hp-thumbs">' + imgAnh(yc.anh[0], ' data-rid="' + esc(r.id) + '" onclick="event.stopPropagation();HPLANOGRAM.openAnh(this.getAttribute(\'data-rid\'),0)" title="Xem ' + yc.anh.length + ' ảnh báo cáo"', false) + (yc.anh.length > 1 ? '<button class="more" data-rid="' + esc(r.id) + '" onclick="event.stopPropagation();HPLANOGRAM.openAnh(this.getAttribute(\'data-rid\'),0)">+' + (yc.anh.length - 1) + '</button>' : '') + '</span>'
      : '<span class="mut">—</span>';
    /* Thứ tự <td> PHẢI khớp <thead> (bản máy tính vẫn là bảng); thứ tự đọc trên THẺ do CSS `order`
       quyết định — xem khối `table.mbcard` ở đầu tệp. */
    var coAnh = !!(yc && yc.anh.length);
    return '<tr>' +
      '<td class="ai-ngay" data-lb="Ngày">' + ngayVN(r.ngay) + '</td>' +
      '<td class="mb-hd">' + esc(r.loc) + '</td>' +
      '<td class="mb-tag">' + badge + '</td>' +
      aiLyDoCell(r.lydo, r.anhloi) +
      '<td class="ai-nv' + (nvName || r.exec ? "" : " mb-0") + '" data-lb="NV" title="' + esc(r.exec) + '">' + (nvName ? esc(nvName) : esc(r.exec || "—")) + '</td>' +
      '<td class="ai-anh' + (coAnh ? "" : " mb-0") + '" data-lb="Ảnh">' + anh + '</td>' +
      '<td class="mut ai-model" style="font-size:10.5px">' + esc((r.model || "").replace(/^gemini-|^claude-/, "")) + '</td>' +
      '<td class="mb-act"><a class="hp-ext" target="_blank" rel="noopener" href="' + esc(pgDetailUrl(r.id)) + '">Mở ↗</a></td></tr>';
  }).join("") : '<tr><td colspan="8" class="empty">Không có kết quả phù hợp bộ lọc.</td></tr>';
  var capNote = rows.length > CAPAI ? '<tr><td colspan="8" class="empty">Hiển thị ' + nf(CAPAI) + ' / ' + nf(rows.length) + ' dòng — dùng bộ lọc để thu hẹp.</td></tr>' : "";

  return '<div class="hp-whbar hp-chipbar">' + chips + '</div>' +
    '<input class="hp-ccsearch" placeholder="Tìm vị trí / nhân viên / lý do…" value="' + esc(S.aiQ || "") + '" oninput="HPLANOGRAM.aiSearch(this.value)">' +
    '<div class="hp-ccwrap" style="max-height:440px"><table class="hp-cctbl mbcard" style="min-width:980px"><thead><tr>' +
    '<th>Ngày</th><th>Vị trí</th><th>Kết luận</th><th>Lý do AI đưa ra</th><th>Người thực hiện</th><th>Ảnh</th><th>Model</th><th>Planogram</th>' +
    '</tr></thead><tbody>' + body + capNote + '</tbody></table></div>' +
    '<p class="hp-hint" style="margin:10px 0 0" title="Ảnh trùng/thiếu được chốt cứng tại máy (đúng 100%); kết luận mơ hồ AI tự xếp “Cần xem” để người duyệt quyết.">Đang hiển thị ' + nf(Math.min(rows.length, CAPAI)) + ' / ' + nf(all.length) + ' kết quả' + (S.ai.ts ? ' · AI chấm lúc ' + fmtTime(S.ai.ts) : '') + (Object.keys(models).length ? ' · ' + esc(Object.keys(models).join(", ")) : '') + '.</p>';
}
function capNhatInfo(){
  var el = $id("hpLoadinfo"); if (!el) return;
  var n = S.yc.rows.length || S.all.length;
  el.textContent = (n ? nf(n) + (S.yc.rows.length ? " yêu cầu" : " vị trí") : "") + (S.tsData ? (n ? " · " : "") + "cập nhật " + fmtTime(S.tsData) : "");
}

/* ===== LỌC + RENDER ===== */
function rowsInScope(){ return S.all.filter(function(r){ return !S.area || r.area === S.area; }); }
function ycInScope(){ var k = khoang(); return S.yc.rows.filter(function(r){ return r.ngay >= k[0] && r.ngay <= k[1] && (!S.area || r.area === S.area); }); }
function setArea(a){ if (S.area === a) a = ""; S.area = a; S.ptHi = ""; renderWhBar(); renderToday(); renderList(); }
/* THANH ĐIỀU KHIỂN duy nhất: Ngày · Khu vực · Tra cứu NV · Toàn bộ vị trí (45n) */
function renderWhBar(){
  var el = $id("hpWhBar"); if (!el) return;
  /* `html` = hàng 1 (khu vực) · `h2` = hàng 2 (ngày + 2 nút hành động). Máy tính: hai khung
     `display:contents` nên thanh vẫn đúng MỘT hàng như cũ. Điện thoại: khung 1 thành dải chip cuộn
     ngang, khung 2 xuống dòng — trước đây cả 8 món tự thương lượng và ra 5 hàng / 144px. */
  var html = "", h2 = "";
  /* KHU VỰC trước — NGÀY sau (ô chọn gọn, không xổ 7 chips) */
  /* Đếm theo CẢ 2 nguồn: bậc 1 (VESINH-YEUCAU) về trước PHU-TRACH — chỉ dựa vào S.all thì
     thanh lọc Khu vực trống trong giây đầu rồi mới bật ra (nhìn như giật). */
  var cnt = {};
  S.all.forEach(function(r){ cnt[r.area] = (cnt[r.area] || 0) + 1; });
  S.yc.rows.forEach(function(r){ cnt[r.area] = (cnt[r.area] || 0) + 1; });
  var keys = AREAS.filter(function(a){ return cnt[a.k]; });
  if (keys.length){
    html += '<span class="hp-hint" style="font-weight:650">Khu vực:</span>' +
      '<button class="hp-whtab' + (S.area ? "" : " active") + '" onclick="HPLANOGRAM.setArea(\'\')">Tất cả</button>' +
      keys.map(function(a){
        return '<button class="hp-whtab' + (S.area === a.k ? " active" : "") + '" data-a="' + a.k + '" title="' + esc(a.lb) + '" ' +
          'onclick="HPLANOGRAM.setArea(this.getAttribute(\'data-a\'))"><span class="hp-dot" style="background:' + a.c + '"></span>' + esc(a.short) + '</button>';
      }).join("");
  }
  var dates = ycDates();
  if (dates.length){
    var k = khoang();
    var mucNgay = function(v, lb, sub){
      var on = false;
      if (v === "hnay") on = k[0] === dates[0] && k[1] === dates[0];
      else if (v === "hqua") on = dates[1] && k[0] === dates[1] && k[1] === dates[1];
      else if (v === "3n") on = k[0] === dates[Math.min(2, dates.length - 1)] && k[1] === dates[0];
      else if (v === "7n") on = k[0] === dates[dates.length - 1] && k[1] === dates[0];
      else on = k[0] === v && k[1] === v;
      return '<div class="hp-combo-item' + (on ? " on" : "") + '" data-v="' + v + '" onclick="HPLANOGRAM.chonNgay(this.getAttribute(\'data-v\'))"><span class="nm">' + esc(lb) + '</span>' + (sub ? '<span class="c">' + esc(sub) + '</span>' : "") + '</div>';
    };
    h2 += '<span class="hp-wbsp" style="width:8px"></span><span class="hp-hint" style="font-weight:650">Ngày:</span>' +
      '<div class="hp-combo" style="display:inline-block">' +
      '<button class="hp-whtab active" onclick="HPLANOGRAM.moNgayMenu();event.stopPropagation();">' + esc(nhanKhoang()) + ' <span style="font-size:9px;opacity:.75">▼</span></button>' +
      '<div class="hp-combo-menu" id="hpNgayMenu" style="min-width:230px;right:auto;">' +
        mucNgay("hnay", "Hôm nay", ngayVN(dates[0])) +
        (dates[1] ? mucNgay("hqua", "Hôm qua", ngayVN(dates[1])) : "") +
        (dates.length > 2 ? mucNgay("3n", "3 ngày gần nhất", ngayVN(dates[Math.min(2, dates.length - 1)]) + " – " + ngayVN(dates[0])) : "") +
        (dates.length > 3 ? mucNgay("7n", dates.length + " ngày gần nhất", ngayVN(dates[dates.length - 1]) + " – " + ngayVN(dates[0])) : "") +
        '<div class="hp-combo-item all" style="pointer-events:none"><span class="nm hp-hint">Hoặc chọn 1 ngày</span></div>' +
        dates.slice(0, 7).map(function(d){ return mucNgay(d, thuVN(d) + " " + ngayVN(d), d === isoToday() ? "hôm nay" : ""); }).join("") +
      '</div></div>';
  }
  var nNk = 0; if (S.ls.ok){ var em = {}; nkRows().forEach(function(r){ em[r.email.toLowerCase()] = 1; }); nNk = Object.keys(em).length; }
  /* Nút LUÔN hiện: nguồn nhật ký nạp bậc 3 (nạp trước sau 4s) nên không chờ dữ liệu mới cho bấm */
  h2 += '<span class="hp-wbsp" style="flex:1"></span>' +
    '<button class="hp-whtab" onclick="HPLANOGRAM.openNk()" title="Xem 1 nhân viên làm việc ở đâu theo từng ngày (' + LS_NGAY + ' ngày)">Tra cứu nhân viên' + (nNk ? ' · ' + nf(nNk) : '') + '</button>' +
    (S.all.length ? '<button class="hp-whtab" onclick="HPLANOGRAM.openAll()" title="Danh sách toàn bộ vị trí + người phụ trách gần nhất (45 ngày)">Toàn bộ vị trí · ' + nf(rowsInScope().length) + '</button>' : "");
  el.innerHTML = '<div class="hp-wb1">' + html + '</div><div class="hp-wb2">' + h2 + '</div>';
}
/* --- KHỐI 1: VỆ SINH HÔM NAY (tab VESINH-YEUCAU) — 4 thẻ hành động + thanh tiến độ --- */
/* Khối "Đủ yêu cầu vệ sinh chưa?" trong panel Vệ sinh: mỗi khu vực 1 thanh độ phủ
 * (vị trí ĐƯỢC phát yêu cầu / tổng vị trí trên mặt bằng) + dải cảnh báo bấm mở danh sách
 * vị trí bị bỏ sót. Nhiều ngày: tính "có yêu cầu" = có ít nhất 1 ngày trong khoảng. */
function htmlDoPhu(){
  if (!S.yc.ok) return "";
  var dp = doPhu(); if (!dp.tot) return "";
  var du = dp.co >= dp.tot;
  var rows = AREAS.filter(function(a){ return dp.theoKhu[a.k] && dp.theoKhu[a.k].tot; }).map(function(a){
    var t = dp.theoKhu[a.k], p = pct(t.co, t.tot), duKhu = t.co >= t.tot, mau = duKhu ? "#059669" : "#d97706";
    return '<div class="hp-covrow" title="' + esc(a.lb + ": " + t.co + "/" + t.tot + " vị trí được phát yêu cầu" +
        (duKhu ? " — đủ" : " — thiếu " + (t.tot - t.co))) + '">' +
      '<span class="nm"><span class="hp-dot" style="background:' + a.c + '"></span>' + esc(a.short) + '</span>' +
      '<div class="hp-track"><span class="hp-fill" style="width:' + p + '%"><i style="width:100%;background:' + mau + '"></i></span></div>' +
      '<span class="v" style="color:' + mau + '">' + nf(t.co) + '/' + nf(t.tot) + '</span></div>';
  }).join("");
  /* Chữ gói TRONG 1 span: .hp-alertbar là flex — để chữ trần thì mỗi <b> thành một ô flex
     riêng, xuống dòng là câu bị xé rời từng mảnh. */
  var banner = du
    ? '<div class="hp-alertbar ok"><span class="ic">✓</span><span>Đủ yêu cầu vệ sinh cho <b>' + nf(dp.tot) + '</b> vị trí trên mặt bằng</span></div>'
    : '<div class="hp-alertbar warn" onclick="HPLANOGRAM.openThieu()" title="Bấm xem danh sách vị trí planogram không phát yêu cầu vệ sinh">' +
      '<span class="ic">⚠</span><span><b>' + nf(dp.tot - dp.co) + '</b> vị trí không có yêu cầu báo cáo vệ sinh' +
      (S.ok && dp.nChua ? ' · <b>' + nf(dp.nChua) + '</b> chưa khai báo lịch' : '') + ' — bấm xem</span></div>';
  return '<div class="hp-cov">' +
    '<div class="hp-covhd" title="Danh mục vị trí lấy theo MẶT BẰNG THẬT (quầy kệ ' + (A1_DAY_DEN - A1_DAY_TU + 1) + ' dãy × ' + A1_SO_KE +
      ' kệ · bản vẽ bàn đóng gói &amp; băng chuyền), không lấy từ chính dữ liệu yêu cầu — có vậy vị trí bị bỏ quên mới lộ ra.' +
      (la1Ngay() ? '' : ' Khoảng nhiều ngày: tính có yêu cầu khi trúng ít nhất 1 ngày.') + '">Độ phủ yêu cầu vệ sinh' +
      '<b style="color:' + (du ? "#059669" : "#d97706") + '">' + nf(dp.co) + '/' + nf(dp.tot) + ' vị trí</b></div>' +
    rows + banner +
    (S.ok ? '' : '<p class="hp-hint" style="margin:6px 0 0">' + (S.dangPT
      ? 'Đang tải danh sách phụ trách — tách được "đã dừng phát" ↔ "chưa khai báo" ngay sau đó.'
      : 'Chưa đọc được tab ' + esc(TAB) + ' — chưa tách được "đã dừng phát" và "chưa khai báo".') + '</p>') +
    '</div>';
}
function renderToday(){
  var box = $id("hpToday"); if (!box) return;
  if (!S.yc.ok || !S.yc.rows.length){
    /* YEUCAU là tab nặng nhất nên hay về SAU PHU-TRACH — mà PHU-TRACH về là render() chạy.
       Còn đang tải thì GIỮ SKELETON, tuyệt đối không báo "chưa có dữ liệu": vài giây sau tab
       về là có đủ, báo sớm khiến người dùng tưởng mất dữ liệu và đi chạy lại bộ sync. */
    if (S.yc.dang){ box.innerHTML = SK_TODAY; return; }
    box.innerHTML = S.ok ? ('<section class="hp-panel hp-fade"><div class="hp-empty">Chưa có dữ liệu yêu cầu vệ sinh trong ngày (tab <code>' + esc(TAB_YC) + '</code>) — chạy <code>sync-vesinh-all.js</code> hoặc bấm "Cập nhật ngay" ở tab Tổng quan.</div></section>') : "";
    return;
  }
  var rows = ycInScope(), nTot = rows.length;
  var homNay = laHomNay(), k = khoang();
  var cnt = { da: 0, nhac: 0, khong: 0, chua: 0 }, nvDa = {};
  rows.forEach(function(r){ cnt[bkNgay(r)]++; if (r.bk === "da" && r.email) nvDa[r.email.toLowerCase()] = 1; });
  var nNvDa = Object.keys(nvDa).length;
  var chipNgay = '<span class="hp-chip" title="Khoảng ngày đang xem — đổi ở ô Ngày phía trên">' + esc(nhanKhoang()) + '</span>';

  /* Không có yêu cầu trong khoảng → empty-state gọn thay vì 4 thẻ số 0 */
  if (!nTot){
    box.innerHTML = '<section class="hp-panel hp-fade hp-hero"><h2>Vệ sinh ' + chipNgay +
      (S.area ? ' <span class="hp-hint">' + esc(areaMeta(S.area).short) + '</span>' : '') + '</h2>' +
      '<div class="hp-empty">Không có yêu cầu vệ sinh trong khoảng này' + (S.area ? ' ở ' + esc(areaMeta(S.area).short) : '') + '. Chọn khoảng ngày khác ở ô Ngày phía trên.</div></section>';
    renderMap(); return;
  }

  /* 1 ngày + có chấm công của ngày đó → chia 3 nhóm hành động (kể cả NGÀY CŨ, từ 03/08/2026:
     nguồn VESINH-CHAMCONG-NGAY 60 ngày). Khoảng nhiều ngày / chưa có chấm công → chỉ Đã/Chưa. */
  var tach = coTachCa();
  var nhom = tach ? YCST : [ycMeta("da"), META_CHUA];
  var tiles =
    '<div class="hp-tile tot" onclick="HPLANOGRAM.openYc(\'\')" title="Xem mọi yêu cầu vệ sinh trong ngày"><div class="k">' + nf(nTot) + '</div><div class="l">Tổng yêu cầu vệ sinh</div><div class="s">' + (S.area ? esc(areaMeta(S.area).short) : "F0-A1 + F0-A8") + '</div></div>' +
    nhom.map(function(m){
      /* Ngày cũ: cùng con số nhưng VIỆC PHẢI LÀM khác — "đi truy" chứ không "đi nhắc". */
      var sub = (!homNay && YCST_CU[m.k]) ? YCST_CU[m.k] : m.sub;
      var extra = m.k === "da" ? (pct(cnt.da, nTot) + "% · " + nf(nNvDa) + " nhân viên") : sub;
      return '<div class="hp-tile" style="--cc:' + m.c + '" data-k="' + m.k + '" onclick="HPLANOGRAM.openYc(this.getAttribute(\'data-k\'))" title="' + esc(m.lb + (sub ? " — " + sub : "")) + '"><div class="k">' + nf(cnt[m.k]) + '</div><div class="l">' + esc(m.lb) + '</div><div class="s">' + esc(extra) + '</div></div>';
    }).join("");

  var bar =
    '<div class="hp-track hp-herobar"><span class="hp-fill" data-w="100" style="width:100%">' +
      nhom.map(function(m){
        return '<i style="width:' + pct(cnt[m.k], nTot) + '%;background:' + m.c + '" title="' + esc(m.lb) + ': ' + nf(cnt[m.k]) + '"></i>';
      }).join("") +
    '</span></div>';
    /* KHÔNG kèm chú giải chữ: từ khi KPI xếp dọc (30/07), mỗi nhóm đã có đủ màu + nhãn + số ở
       thẻ ngay bên trên — chú giải lặp lại y nguyên 3 dòng đó, chỉ làm rối. Từng khúc của
       thanh vẫn có tooltip nhãn + số khi rê chuột. */

  /* Chip AI xét duyệt (nếu bộ sync-vesinh-ai.mjs đã chạy) — bấm chip mở pop-up lọc sẵn */
  var aiLine = "";
  if (S.ai.ok){
    var ac = { DAT: 0, KHONG_DAT: 0, CAN_XEM: 0 }, nAi = 0;
    rows.forEach(function(r){ var a2 = aiOf(r); if (a2 && ac[a2.kl] != null){ ac[a2.kl]++; nAi++; } });
    if (nAi){
      aiLine = '<div class="hp-whbar hp-aimini">' +
        '<span class="hp-hint" style="font-weight:650">AI xét duyệt ảnh:</span>' +
        AIST.map(function(m){
          return '<button class="hp-whtab" data-k="' + m.k + '" title="' + esc(m.lb) + ' — bấm xem danh sách" onclick="HPLANOGRAM.openYcAi(this.getAttribute(\'data-k\'))"><span class="hp-dot" style="background:' + m.c + '"></span>' + esc(m.lb.replace("AI: ", "")) + ' <b>' + nf(ac[m.k]) + '</b></button>';
        }).join("") +
        '<span class="hp-hint">' + nf(nAi) + '/' + nf(nTot) + ' yêu cầu đã được AI chấm ảnh' + (S.ai.ts ? ' · ' + fmtTime(S.ai.ts) : '') + '</span></div>';
    }
  }
  /* hpNhacSlot: renderMap đổ panel "Cần nhắc theo nhân viên" vào đây (cột phải) —
     dời khỏi cột sơ đồ để 2 cột cân cao và sơ đồ không bị đẩy tràn khung nhìn */
  box.innerHTML =
    '<section class="hp-panel hp-fade hp-hero">' +
    '<h2>Vệ sinh ' + chipNgay + '<span style="flex:1"></span><a class="hp-ext" style="font-size:12px" target="_blank" rel="noopener" href="' + esc(pgListUrl(k[0], S.area, "", k[1])) + '">Mở planogram ↗</a></h2>' +
    '<div class="hp-tiles">' + tiles + '</div>' + bar + htmlDoPhu() +
    '<div id="hpNhacSlot"></div>' + aiLine +
    '</section>';
  renderMap();   // sơ đồ mặt bằng đi theo khoảng ngày đang xem
}
/* Bậc nào về trước cũng dùng chung: tắt spinner + mở lại nút Làm mới */
function xongTai(){
  var st = $id("hpState"); if (st) st.style.display = "none";
  var btn = $id("hpReload"); if (btn) btn.disabled = false;
  hamNongCC();
}
/* HÂM NÓNG CHẤM CÔNG khi màn hình đã dùng được (bậc 1 xong, hàng đợi Apps Script đã rỗng).
 * Pop-up vị trí nào cũng cần trả lời "phụ trách hôm nay có đi làm không"; đợi tới lúc bấm ô
 * mới gọi thì người dùng thấy "đang tra chấm công…" một nhịp. CHAMCONG-VESINH là tab NHẸ
 * (1 dòng/NV nghiệp vụ vệ sinh, ~40 dòng) — khác VESINH-NHATKY 45 ngày vẫn để lazy hẳn.
 * Hoãn tới lúc nhàn rỗi để không tranh chỗ với bậc 1: đó mới là thứ dựng màn hình. */
var _ccWarm = false;
function hamNongCC(){
  if (_ccWarm || S.cc.ok || S.cc.dang) return;
  _ccWarm = true;
  var go = function(){ canCC(); };
  if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 2500 });
  else setTimeout(go, 1200);
}
/* --- KHỐI 2: TỔNG ĐIỀU PHỐI (dữ liệu PT/NK về sau thì vẽ lại các khối dùng tên NV) --- */
function render(){
  var st = $id("hpState"); if (!st) return;
  var btn = $id("hpReload"); if (btn) btn.disabled = false;
  if (!S.ok && !S.yc.ok && !S.yc.dang){   // YEUCAU còn đang tải thì chưa kết luận "không có dữ liệu"
    $id("hpWhBar").innerHTML = "";
    $id("hpMap").innerHTML = ""; $id("hpToday").innerHTML = "";   // dọn skeleton giữ chỗ
    st.style.display = "block";
    /* NÓI ĐÚNG NGUYÊN NHÂN (12/08/2026): trước đây mọi kiểu hỏng đều in "Chưa có dữ liệu trong
       Google Sheet" — trong khi Sheet vẫn đủ dòng, chỉ Apps Script không trả được. Chẩn đoán sai
       như vậy đẩy người đọc đi kiểm bộ sync (vô can) thay vì bấm Làm mới là xong. */
    var loiGas = [TAB_YC, TAB].filter(function(t){ return LOI_NGUON[t] === "gas"; });
    st.innerHTML = '<div style="max-width:720px;margin:0 auto;text-align:left;line-height:1.75;color:var(--muted,#6b7280)">' +
      (loiGas.length
        ? '<b style="color:var(--text,#1f2937)">Không đọc được dữ liệu từ Apps Script.</b><br>' +
          'Đã thử lại ' + (GAS_CHO.length + 1) + ' lượt cho <code>' + loiGas.map(esc).join('</code>, <code>') + '</code> mà vẫn không có phản hồi — ' +
          'Apps Script hay trả 404 chập chờn lúc quá tải. <b>Dữ liệu trong Google Sheet không mất</b>; ' +
          'bấm <b>Làm mới</b> một lượt nữa là thường có ngay.'
        : '<b style="color:var(--text,#1f2937)">Chưa có dữ liệu vệ sinh trong Google Sheet.</b><br>' +
          'Tab này đọc từ các sheet <code>' + esc(TAB_YC) + '</code>, <code>' + esc(TAB) + '</code>… — bộ đồng bộ <code>sync-vesinh-all.js</code> (cụm 8h40) sẽ ghi dữ liệu ' +
          'khu vực F0-A1 &amp; F0-A8 (kho SHOP - 170 QUOC LO 1A, nguồn planogram) vào đó.') +
      '</div>';
    capNhatInfo();
    return;
  }
  st.style.display = "none";
  renderWhBar();
  renderToday();   // KPI + sơ đồ (renderMap gọi bên trong)
  renderList();    // panel danh sách (AI / Nhân viên)
  capNhatInfo();
}

/* --- KHỐI 3: chế độ NHÂN VIÊN của panel danh sách (đội vệ sinh × chấm công hôm nay) --- */
function ccSetStatus(k){ if (S.ccStatus === k) k = ""; S.ccStatus = k; renderList(); }
function ccSearch(v){ S.ccQ = v; clearTimeout(_ccDeb); _ccDeb = setTimeout(renderList, 130); }
/* Đổi chế độ danh sách: "nv" mới cần tab CHAMCONG → nạp lúc này (bậc 3) thay vì tải sẵn */
function setListMode(m){ if (S.listMode === m) return; S.listMode = m; if (m === "nv") canCC(); renderList(); }
function renderCC(){ renderList(); }
function htmlNhanVien(){
  if (!S.cc.ok && S.cc.dang) return '<div class="hp-empty"><div class="hp-spin" style="width:22px;height:22px;border-width:2px;margin-bottom:10px"></div>Đang tải chấm công hôm nay…</div>';
  if (!S.cc.ok || !S.cc.rows.length) return '<div class="hp-empty">Chưa có dữ liệu chấm công (tab <code>' + esc(TAB_CC) + '</code>).</div>';
  var all = S.cc.rows;
  var cnt = { chua: 0, da: 0, nghi: 0 };
  all.forEach(function(r){ cnt[r.bk] = (cnt[r.bk] || 0) + 1; });
  var nDiLam = cnt.chua + cnt.da, nTot = all.length;
  var q = String(S.ccQ || "").trim().toLowerCase();
  var rows = all.filter(function(r){
    if (S.ccStatus && r.bk !== S.ccStatus) return false;
    if (q && ((r.name + " " + r.code + " " + r.email + " " + r.major + " " + r.loc).toLowerCase().indexOf(q) < 0)) return false;
    return true;
  });
  var chips = '<span class="hp-hint" style="font-weight:650">Trạng thái:</span>' +
    '<button class="hp-whtab' + (S.ccStatus ? "" : " active") + '" onclick="HPLANOGRAM.ccSetStatus(\'\')">Tất cả · ' + nf(nTot) + '</button>' +
    CCST.map(function(s){
      return '<button class="hp-whtab' + (S.ccStatus === s.k ? " active" : (cnt[s.k] ? "" : " hp-z0")) + '" onclick="HPLANOGRAM.ccSetStatus(\'' + s.k + '\')"><span class="hp-dot" style="background:' + s.c + '"></span>' + esc(s.short) + ' <b>' + nf(cnt[s.k] || 0) + '</b></button>';
    }).join("");
  var body = rows.length ? rows.map(function(r){
    var m = ccMeta(r.bk);
    var badge = '<span class="hp-badge" style="background:color-mix(in srgb,' + m.c + ' 16%,transparent);color:' + (r.bk === "nghi" ? "var(--muted,#6b7280)" : m.c) + '">' + esc(r.tt || m.lb) + '</span>';
    return '<tr data-em="' + esc(r.email) + '" title="Bấm xem nhật ký vệ sinh theo ngày của ' + esc(r.name) + '" onclick="HPLANOGRAM.openNk(this.getAttribute(\'data-em\'))">' +
      '<td class="mb-hd">' + esc(r.name) + '</td>' +
      '<td class="cc-code' + (r.code ? "" : " mb-0") + '" data-lb="Mã">' + (r.code ? esc(r.code) : '<span class="mut">—</span>') + '</td>' +
      '<td class="cc-ci' + (r.ci ? "" : " mb-0") + '" data-lb="Vào">' + (r.ci ? esc(r.ci) : '<span class="mut">—</span>') + '</td>' +
      '<td class="cc-co' + (r.co ? "" : " mb-0") + '" data-lb="Ra">' + (r.co ? esc(r.co) : '<span class="mut">—</span>') + '</td>' +
      '<td class="num cc-vs" data-lb="Đã vệ sinh">' + (r.vs ? nf(r.vs) : '<span class="mut">0</span>') + '</td>' +
      '<td class="cc-loc' + (r.loc ? "" : " mb-0") + '" data-lb="Vị trí gần nhất">' + (r.loc ? esc(r.loc) : '<span class="mut">—</span>') + '</td>' +
      '<td class="mb-tag">' + badge + '</td></tr>';
  }).join("") : '<tr><td colspan="7" class="empty">Không có nhân viên phù hợp bộ lọc.</td></tr>';
  return '<div class="hp-whbar hp-chipbar">' + chips + '</div>' +
    '<input class="hp-ccsearch" placeholder="Tìm tên / mã / email / vị trí…" value="' + esc(S.ccQ || "") + '" oninput="HPLANOGRAM.ccSearch(this.value)">' +
    '<div class="hp-ccwrap"><table class="hp-cctbl mbcard"><thead><tr>' +
    '<th>Nhân viên</th><th>Code</th><th>Giờ vào</th><th>Giờ ra</th><th class="num">Đã vệ sinh</th><th>Vị trí gần nhất</th><th>Trạng thái</th>' +
    '</tr></thead><tbody>' + body + '</tbody></table></div>' +
    '<p class="hp-hint" style="margin:10px 0 0">' + nf(rows.length) + ' / ' + nf(nTot) + ' nhân viên · đi làm hôm nay ' + nf(nDiLam) + (S.cc.ts ? ' · cập nhật ' + fmtTime(S.cc.ts) : '') + '.</p>';
}

/* ===== SƠ ĐỒ MẶT BẰNG KHU ĐÓNG GÓI F0-A8 (theo bản vẽ BDG 25/07/2026) =====
 *  4 cụm — mỗi cụm 2 DÃY BÀN (8 ô/dãy, ghép cặp 01-02/03-04/05-06/07-08) kẹp 1 BĂNG CHUYỀN:
 *  501|502|503 · 504|505|506 · 507|508|509 · 510|511|512. Dãy giữa (502/505/508/511) chính là
 *  băng chuyền = 1 mã vị trí duy nhất; ô bàn có mã F0-A8-<dãy>-<ô>-01-01. */
var MAP_A8 = [
  { l: "501", b: "502", bc: "F0-A8-502-01-01-01", r: "503" },
  { l: "504", b: "505", bc: "F0-A8-505-01-01-02", r: "506" },
  { l: "507", b: "508", bc: "F0-A8-508-01-01-03", r: "509" },
  { l: "510", b: "511", bc: "F0-A8-511-01-01-04", r: "512" }
];
function moMap(id){ if (id) window.open(pgDetailUrl(id), "_blank", "noopener"); }
/* Danh mục KỆ khu A1 (dãy × kệ → mã vị trí thật) — gom từ dữ liệu 45 ngày (PHU-TRACH) + 7 ngày (YEUCAU).
 * Bản vẽ "Hướng dẫn đường đi soạn hàng" (A0): 16 dãy 501-516 gộp 4 cụm; mỗi dãy ~10 kệ,
 * kệ 01-05 khối trên, 06-10 khối dưới (lối đi giữa). Mã yêu cầu vệ sinh của 1 KỆ ổn định theo ngày. */
function keA1(){
  var ke = {}, suy = {};   // '501|01' -> mã vị trí thật (vd F0-A1-501-01-04-01) · suy = mã còn là suy diễn
  function nap(loc){ var m = String(loc).match(/^F0-A1-(\d{3})-(\d{2})-/); if (!m) return;
    var k = m[1] + "|" + m[2]; if (!ke[k] || suy[k]){ ke[k] = loc; suy[k] = false; } }
  /* GIEO LƯỚI CHUẨN TRƯỚC: kệ bị bỏ quên (không còn yêu cầu, không còn báo cáo) vẫn hiện ô
     nét đứt trên sơ đồ. Không gieo thì kệ đó biến mất khỏi sơ đồ — đúng thứ cần soi lại là
     thứ không nhìn thấy được. Mã thật trong dữ liệu về sau ghi đè mã suy diễn. */
  for (var d = A1_DAY_TU; d <= A1_DAY_DEN; d++)
    for (var i = 1; i <= A1_SO_KE; i++){ var k0 = d + "|" + p2(i); ke[k0] = "F0-A1-" + d + "-" + p2(i) + "-01-01"; suy[k0] = true; }
  S.all.forEach(function(r){ nap(r.loc); });
  S.yc.rows.forEach(function(r){ nap(r.loc); });
  return ke;
}

/* ===== DANH MỤC VỊ TRÍ CHUẨN + ĐỘ PHỦ YÊU CẦU VỆ SINH =====
 * Câu hỏi nghiệp vụ: "planogram đã phát ĐỦ yêu cầu vệ sinh cho mọi kệ / chỗ làm việc chưa?"
 * Danh mục chuẩn phải lấy từ MẶT BẰNG THẬT, KHÔNG lấy từ chính dữ liệu yêu cầu — vị trí bị
 * bỏ quên sẽ vắng mặt trong dữ liệu, tự lấy danh mục từ đó thì không bao giờ phát hiện ra:
 *   A1 — lưới quầy kệ 16 dãy (501-516) × 10 kệ (01-10) = 160 kệ (bản vẽ A0 "đường đi soạn hàng")
 *   A8 — bản vẽ BDG: 4 cụm × (2 dãy × 8 ô bàn) + 4 băng chuyền = 68 vị trí (MAP_A8)
 * Hợp thêm mọi vị trí CÓ trong dữ liệu → kho mở rộng thì danh mục tự lớn theo, khỏi sửa code.
 * Đối chiếu dữ liệu thật 30/07/2026: A1 đủ 160/160 kệ mỗi ngày · A8 chỉ 18/68 ô còn được phát
 * yêu cầu (43 ô rời lịch quanh 08/07/2026, 7 ô chưa từng thấy trong 45 ngày quét). */
var A1_DAY_TU = 501, A1_DAY_DEN = 516, A1_SO_KE = 10;
var MISS = {
  dung: { k: "dung", lb: "Đã dừng phát yêu cầu", sub: "từng có lịch, nay không còn", c: "#d97706" },
  chua: { k: "chua", lb: "Chưa khai báo lịch",   sub: "không thấy trong 45 ngày quét", c: "#dc2626" }
};
function missMeta(k){ return MISS[k] || MISS.chua; }
function dmChuan(){
  var dm = {}, d, i, key;   // khoá ô -> { loc, area, suy } (suy = mã suy diễn, chưa gặp trong dữ liệu)
  for (d = A1_DAY_TU; d <= A1_DAY_DEN; d++)
    for (i = 1; i <= A1_SO_KE; i++){ key = "F0-A1-" + d + "-" + p2(i); dm[key] = { loc: key + "-01-01", area: "A1", suy: true }; }
  MAP_A8.forEach(function(c){
    [c.l, c.r].forEach(function(dd){
      for (var o = 1; o <= 8; o++){ var L = "F0-A8-" + dd + "-" + p2(o) + "-01-01"; dm[L] = { loc: L, area: "A8", suy: true }; }
    });
    dm[c.bc] = { loc: c.bc, area: "A8", suy: true };
  });
  function nap(loc){
    var a = areaOf(loc); if (!a) return;
    var kk = khoaO(loc), o = dm[kk];
    if (!o) dm[kk] = { loc: loc, area: a.k, suy: false };
    else if (o.suy){ o.loc = loc; o.suy = false; }
  }
  S.all.forEach(function(r){ nap(r.loc); });
  S.yc.rows.forEach(function(r){ nap(r.loc); });
  return dm;
}
/* Độ phủ trong KHOẢNG NGÀY đang xem: mỗi vị trí danh mục có ít nhất 1 yêu cầu hay không.
 * Vị trí thiếu chia 2 mức theo BẰNG CHỨNG từng nằm trong lịch:
 *   "dung" — có yêu cầu ở ngày khác, hoặc có mặt trong PHU-TRACH (mọi vị trí planogram phát
 *            ra trong 45 ngày, kể cả chưa ai làm) → LỊCH ĐÃ DỪNG PHÁT, hỏi lại người cấu hình.
 *   "chua" — không thấy ở đâu → CHƯA TỪNG khai báo lịch cho vị trí này. */
function doPhu(){
  var dm = dmChuan(), kg = khoang();
  var coYc = {}, ycCuoi = {};
  S.yc.rows.forEach(function(r){
    var kk = khoaO(r.loc);
    if (!ycCuoi[kk] || r.ngay > ycCuoi[kk]) ycCuoi[kk] = r.ngay;
    if (r.ngay >= kg[0] && r.ngay <= kg[1]) coYc[kk] = 1;
  });
  var coLich = {};   // khoá ô -> { at, email, name }; at rỗng = có lịch nhưng chưa ai từng vệ sinh
  S.all.forEach(function(r){
    var kk = khoaO(r.loc), o = coLich[kk] || (coLich[kk] = { at: "", email: "", name: "" });
    if (r.at && String(r.at) > String(o.at)){ o.at = r.at; o.email = r.email; o.name = r.name; }
  });
  var theoKhu = {}, thieu = [];
  AREAS.forEach(function(a){ theoKhu[a.k] = { tot: 0, co: 0 }; });
  Object.keys(dm).forEach(function(kk){
    var o = dm[kk], t = theoKhu[o.area];
    if (!t || (S.area && o.area !== S.area)) return;
    t.tot++;
    if (coYc[kk]){ t.co++; return; }
    var lich = coLich[kk] || null;
    thieu.push({ loc: o.loc, area: o.area, suy: o.suy,
      kind: (ycCuoi[kk] || lich) ? "dung" : "chua",
      ycCuoi: ycCuoi[kk] || "", vsCuoi: (lich && lich.at) || "",
      email: (lich && lich.email) || "", name: (lich && lich.name) || "" });
  });
  var tot = 0, co = 0, nChua = 0;
  Object.keys(theoKhu).forEach(function(k2){ tot += theoKhu[k2].tot; co += theoKhu[k2].co; });
  thieu.forEach(function(t){ if (t.kind === "chua") nChua++; });
  thieu.sort(function(a, b){ return a.kind === b.kind ? (a.loc < b.loc ? -1 : 1) : (a.kind === "chua" ? -1 : 1); });
  return { tot: tot, co: co, nChua: nChua, theoKhu: theoKhu, thieu: thieu };
}
/* Sơ đồ tự PHÓNG theo bề rộng cột trái: tỷ lệ thực địa (~10px/m) giữ nguyên, chỉ nhân đều bằng
 * zoom (ảnh hưởng layout — Chromium/Safari/FF126+; trình cũ bỏ qua = giữ 1× như cũ). A1 + A8 dùng
 * CHUNG 1 hệ số cho ô đồng cỡ; trần 1.3× để ô không thô.
 * 30/07 (nén dọc): hệ số còn bị chặn theo CHIỀU CAO — phần chữ quanh sơ đồ (header/banner/hint)
 * giữ nguyên, 2 sơ đồ chia phần cao còn lại của khung nhìn để A1 + A8 lọt trọn 1 màn không cuộn.
 * Sàn 0.9× giữ ô đọc được; màn hẹp (<1150px, xếp dọc) bỏ chặn cao — cuộn dọc là bình thường. */
function fitMaps(){
  var box = $id("hpMap"); if (!box || !box.offsetParent) return;
  var scs = box.querySelectorAll(".hp-mapscroll"); if (!scs.length) return;
  var z = 1.3, i, mp, mapsH = 0;
  for (i = 0; i < scs.length; i++){
    mp = scs[i].firstElementChild; if (!mp) continue;
    mp.style.zoom = "";
    z = Math.min(z, (scs[i].clientWidth - 2) / Math.max(1, mp.offsetWidth));
    mapsH += mp.offsetHeight;
  }
  if (mapsH > 0 && window.innerWidth > 1150){
    var sec = box.firstElementChild;
    if (sec){
      var chu = sec.offsetHeight - mapsH;   // phần chữ cố định quanh 2 sơ đồ (đo ở 1×)
      var docTop = sec.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0);
      var cao = window.innerHeight - docTop - 18;   // chỗ còn lại khi trang ở đầu (chừa mép dưới)
      if (cao > chu) z = Math.min(z, (cao - chu) / mapsH);
    }
  }
  /* làm tròn XUỐNG 2 chữ số: hệ số ổn định giữa các lượt đo, không dư sub-pixel gây tràn/rung */
  z = Math.max(0.9, Math.min(1.3, Math.floor(z * 100) / 100));
  /* GIỮ LÌ hệ số: cột không đổi bề rộng + lệch đo ≤0.04 (banner/chips lắt nhắt về sau) → dùng lại
     hệ số cũ, sơ đồ ĐỨNG YÊN giữa các đợt dữ liệu; lệch thật (đổi cỡ cửa sổ…) mới áp số mới */
  var w = scs[0].clientWidth;
  if (w === _fitW && Math.abs(z - _fitZ) <= 0.04) z = _fitZ;
  _fitW = w; _fitZ = z;
  for (i = 0; i < scs.length; i++){ mp = scs[i].firstElementChild; if (mp) mp.style.zoom = z; }
}
function renderMap(){
  var box = $id("hpMap"); if (!box) return;
  if (!S.yc.ok || !S.yc.rows.length){ box.innerHTML = S.yc.dang ? SK_MAP : ""; return; }
  var k = khoang(), homNay = laHomNay(), mot = la1Ngay();
  /* byL gom theo KHOÁ Ô (khoaO) — kệ A1 có mã alias vẫn rơi đúng ô của nó */
  var byL = {}; S.yc.rows.forEach(function(r){ if (r.ngay >= k[0] && r.ngay <= k[1]){ var kk = khoaO(r.loc); (byL[kk] = byL[kk] || []).push(r); } });
  var alert = tinhCanhBao();
  /* vị trí KHÔNG được phát yêu cầu trong khoảng — tra nhanh khi dựng tooltip ô nét đứt */
  var thieuBy = {}; doPhu().thieu.forEach(function(t){ thieuBy[khoaO(t.loc)] = t; });
  var nNgayYc = ycDates().length;   // số ngày tab VESINH-YEUCAU đang lưu (mặc định 7)
  /* Chế độ "gom ô chưa vệ sinh theo NHÂN VIÊN": cần đúng 1 ngày + có chấm công của ngày đó.
     03/08/2026 mở cho cả NGÀY CŨ (VESINH-CHAMCONG-NGAY 60 ngày) — trước chỉ hôm nay. */
  var soiPT = coTachCa();

  function stateCua(list){ return mot ? cellState1(repCua(list)) : cellStateN(list); }
  function tinhTT(loc, list){
    var kk = khoaO(loc);
    var head = alert[kk] ? "⚠ QUÁ HẠN: " + alert[kk] + " ngày yêu cầu liên tiếp chưa báo cáo\n" : "";
    /* Phụ trách theo BẢNG PHÂN CÔNG — hiện ở MỌI ô, kể cả ô chưa ai báo cáo bao giờ.
       Trước đây tooltip chỉ suy từ báo cáo cũ nên ô im lặng không ra được tên ai. */
    var pcO = pcCua(loc);
    var pcT = pcO && pcO.em
      ? "\nPhụ trách: " + (pcO.ten || pcO.em) + (pcO.code ? " (" + pcO.code + ")" : "") +
        (/g-sheet/i.test(pcO.nguon) ? "" : " — suy từ báo cáo gần nhất, g-sheet chưa phân công")
      : "";
    /* Chấm công hôm nay của người phụ trách — chỉ có nghĩa khi đang xem đúng hôm nay */
    if (pcO && pcO.em && homNay){
      var ccP = ccTrangThai(pcO.em, pcO.code);
      if (ccP && !ccP.dang) pcT += "\n   chấm công: " + ccP.lb.replace(/^Hôm nay /, "");
    }
    if (!list || !list.length){
      var mi = thieuBy[kk], vs = "";
      if (mi){
        vs = mi.kind === "chua"
          ? "\n⚠ CHƯA KHAI BÁO LỊCH — 45 ngày quét không thấy yêu cầu nào cho vị trí này"
          : "\n⚠ ĐÃ DỪNG PHÁT YÊU CẦU" + (mi.ycCuoi
              ? "\n   yêu cầu gần nhất: " + ngayVN(mi.ycCuoi)
              : "\n   " + nNgayYc + " ngày gần đây không có yêu cầu (vị trí vẫn nằm trong danh mục 45 ngày)");
        vs += mi.vsCuoi
          ? "\n   vệ sinh gần nhất: " + ngayVN(mi.vsCuoi) + (mi.name || mi.email ? " — " + (mi.name || mi.email) : "")
          : "\n   chưa ai từng vệ sinh vị trí này";
      }
      return head + loc + pcT + "\nKhông có yêu cầu vệ sinh trong khoảng đang xem" + vs + "\n(bấm xem lịch sử 7 ngày + 60 ngày)";
    }
    if (mot){
      var r = repCua(list), st = cellMeta(cellState1(r)), ai = aiOf(r), aim = ai && aiMeta(ai.kl);
      var ptTxt = "";
      if (!r.email){
        /* pcT phía trên đã in "Phụ trách (mã) + chấm công hôm nay" theo BẢNG PHÂN CÔNG — nguồn chính thức.
           Người phụ trách ghi trên chính yêu cầu chỉ nhắc lại khi KHÁC người đó (phân công lệch thực tế,
           đáng biết); trùng nhau thì in 2 lần cùng một cái tên + cùng một trạng thái đi làm. */
        var trungPc = !!(pcO && pcO.em && r.pt && String(r.pt).toLowerCase() === String(pcO.em).toLowerCase());
        if (r.pt && !trungPc){
          ptTxt = "\nPhụ trách theo yêu cầu: " + ptTen(r) + (homNay ? (r.ptDiLam ? " (đi làm" + (r.ptCi ? " · vào " + r.ptCi : "") + ")" : " (nghỉ)") : "");
          var ptA = ptAtCua(r);
          if (ptA) ptTxt += "\n   theo báo cáo gần nhất " + ngayVN(ptA) + (ptKhongChac(r) ? " — ⚠ " + ptTuoi(r) + " ngày trước, CHƯA CHẮC còn phụ trách" : "");
        } else if (trungPc && ptKhongChac(r)){
          ptTxt = "\n   ⚠ bằng chứng phụ trách " + ptTuoi(r) + " ngày trước — chưa chắc còn phụ trách";
        } else if (!r.pt && !(pcO && pcO.em)) ptTxt = "\nChưa có người phụ trách";
      }
      return head + loc + pcT + "\nTrạng thái: " + st.lb +
        (r.email ? "\nNgười làm: " + (tenNm(r.email) || r.email) + (r.at ? " lúc " + String(r.at).slice(11, 16) : "") : ptTxt) +
        (aim ? "\nAI: " + aim.lb.replace("AI: ", "") + (ai.diem ? " · " + ai.diem + " điểm" : "") : "") +
        "\n(bấm xem chi tiết + lịch sử 60 ngày)";
    }
    var dong = list.slice().sort(function(a, b){ return a.ngay < b.ngay ? -1 : 1; }).map(function(r){
      return ngayVN(r.ngay) + ": " + (r.bk === "da" ? "Đã vệ sinh" + (r.email ? " — " + (tenNm(r.email) || r.email) : "") : "Chưa vệ sinh");
    });
    return head + loc + pcT + "\n" + dong.join("\n") + "\n(bấm xem chi tiết từng ngày)";
  }
  function cell(loc, label){
    var kk = khoaO(loc), list = byL[kk], st = stateCua(list), m = cellMeta(st);
    var rep = mot ? repCua(list) : null;
    var badge = m.dot ? '<i class="hp-cdot" style="background:' + m.dot + '"></i>'
              : m.tri ? '<i class="hp-ctri"></i>'
              : (st === "remind" && rep && ptKhongChac(rep) ? '<i class="hp-cq">?</i>' : "");
    var al = alert[kk] ? '<i class="hp-cwarn" title="Quá ' + alert[kk] + ' ngày chưa báo cáo">⚠</i>' : "";
    var cls = "hp-mapcell" + (m.dashed ? " trong" : "") + cellCls(m) + (alert[kk] ? " canhbao" : "");
    if (soiPT && S.ptHi) cls += (rep && bkNgay(rep) === "nhac" && rep.pt === S.ptHi) ? " hi" : " dim";
    var sty = m.dashed ? "cursor:pointer" : "background:" + m.c;
    return '<span class="' + cls + '" style="' + sty + '" title="' + esc(tinhTT(loc, list)) + '" data-l="' + esc(loc) + '" onclick="HPLANOGRAM.openViTri(this.getAttribute(\'data-l\'))">' + label + badge + al + '</span>';
  }
  function cot(day){
    var out = [];
    for (var o = 1; o <= 8; o++){
      out.push(cell("F0-A8-" + day + "-" + p2(o) + "-01-01", p2(o)));
      if (o % 2 === 0 && o < 8) out.push('<span class="hp-mapgap"></span>');
    }
    return '<div class="hp-mapcol"><div class="cl">' + day + '</div>' + out.join("") + '</div>';
  }
  /* --- Khối A8: 4 cụm bàn đóng gói + băng chuyền (theo bản vẽ BDG).
     TỶ LỆ THỰC TẾ (đo 26/07, ~10px/m — chỉ để canh khoảng cách, KHÔNG hiển thị số mét):
     cụm cách cụm 2m đều nhau (503↔504, 506↔507, …) → column-gap cố định 20px, không giãn đều nữa. --- */
  var htmlA8 = "";
  if (S.area !== "A1"){
    htmlA8 = '<div class="hp-maphdr">Bàn đóng gói &amp; băng chuyền (F0-A8)</div><div class="hp-mapscroll"><div class="hp-map hp-mapa8">' +
      MAP_A8.map(function(c){
        var list = byL[c.bc], st = stateCua(list), m = cellMeta(st);
        var rep = mot ? repCua(list) : null;
        var alb = alert[c.bc] ? '<i class="hp-cwarn" title="Quá ' + alert[c.bc] + ' ngày chưa báo cáo">⚠</i>' : "";
        var qb = (st === "remind" && rep && ptKhongChac(rep)) ? '<i class="hp-cq">?</i>' : "";
        var bg = m.dashed ? "color-mix(in srgb, var(--muted,#9ca3af) 35%, transparent)" : m.c;
        var bcls = "hp-mapbelt" + cellCls(m) + (alert[c.bc] ? " canhbao" : "");
        if (soiPT && S.ptHi) bcls += (rep && bkNgay(rep) === "nhac" && rep.pt === S.ptHi) ? " hi" : " dim";
        var belt = '<div class="' + bcls + '" style="background:' + bg + '" title="' + esc(tinhTT(c.bc, list)) + '" data-l="' + esc(c.bc) + '" onclick="HPLANOGRAM.openViTri(this.getAttribute(\'data-l\'))"><span>BĂNG CHUYỀN ' + c.b + '</span>' + qb + alb + '</div>';
        return '<div class="hp-mapc">' + cot(c.l) + belt + cot(c.r) + '</div>';
      }).join("") + '</div></div>';
  }

  /* --- Khối A1: 16 dãy kệ (501-516) gộp 4 cụm, mỗi ô = 1 KỆ (kệ có 4 mâm × 6 bin) --- */
  var htmlA1 = "";
  if (S.area !== "A8"){
    var ke = keA1();
    var theoDay = {};   // '501' -> [{k:'01', loc}, ...]
    Object.keys(ke).forEach(function(key){
      var p = key.split("|");
      (theoDay[p[0]] = theoDay[p[0]] || []).push({ k: p[1], loc: ke[key] });
    });
    var days = Object.keys(theoDay).sort();
    if (days.length){
      days.forEach(function(dd){ theoDay[dd].sort(function(a, b){ return a.k < b.k ? -1 : 1; }); });
      var cotKe = function(dd){
        var out = [];
        theoDay[dd].forEach(function(o, i){
          /* lối đi giữa: tách khối kệ 01-05 (trên) và 06-10 (dưới) như bản vẽ */
          if (i > 0 && Number(o.k) === 6) out.push('<span class="hp-mapgap"></span>');
          out.push(cell(o.loc, o.k));
        });
        return '<div class="hp-mapcol"><div class="cl">' + dd + '</div>' + out.join("") + '</div>';
      };
      /* TỶ LỆ THỰC TẾ (đo 26/07, ~10px/m — chỉ để canh khoảng cách, KHÔNG hiển thị số mét):
         dãy đi theo CẶP lưng giáp lưng (501/502, 503/504, …); lối đi giữa các cặp XEN KẼ
         1,5m (→15px) rồi 3m (→30px): 501/502 ↔503/504 1,5m · 503/504 ↔505/506 3m · cứ thế lặp.
         Ghép cặp theo SỐ DÃY (chẵn/lẻ) chứ không theo thứ tự mảng — thiếu 1 dãy dữ liệu không làm lệch cặp. */
      var capMap = {};
      days.forEach(function(dd){ var g = Math.floor((Number(dd) - 501) / 2); (capMap[g] = capMap[g] || []).push(dd); });
      var gIdx = Object.keys(capMap).map(Number).sort(function(a, b){ return a - b; });
      htmlA1 = '<div class="hp-maphdr">Quầy kệ (F0-A1)</div><div class="hp-mapscroll"><div class="hp-map hp-mapa1">' +
        gIdx.map(function(g, i){
          var kc = i === gIdx.length - 1 ? "" : (g % 2 === 0 ? " hp-kc15" : " hp-kc3");   // sau cặp chẵn 1,5m · cặp lẻ 3m
          return '<div class="hp-mapc1' + kc + '">' + capMap[g].sort().map(cotKe).join("") + '</div>';
        }).join("") + '</div></div>';
    }
  }
  var slot = $id("hpNhacSlot");
  if (!htmlA1 && !htmlA8){ box.innerHTML = ""; if (slot) slot.innerHTML = ""; return; }

  /* Chú giải: liệt kê đủ trạng thái (mỗi màu 1 nghĩa), hình dạng badge, + cảnh báo.
     Ô thuộc hệ "đã báo cáo" (m.da) mang thêm vạch xanh mép trái — swatch chú giải vẽ y hệt
     bằng box-shadow inset để người đọc khớp được vạch trên sơ đồ với nghĩa của nó. */
  var legKeys = mot ? ["done", "review", "rework", "remind", "noshift"] : ["done", "rework", "chua"];
  var legend = '<span class="hp-legend">' +
    legKeys.map(function(kk){ var m = cellMeta(kk);
      var vach = m.da && kk !== "done" ? ";box-shadow:inset 3px 0 0 #059669" : "";
      var mk = '<i style="background:' + m.c + vach + '"></i>' +
        (m.dot ? '<i class="hp-cdot" style="position:static;background:' + m.dot + ';margin-left:-5px"></i>' : "");
      return '<span title="' + esc(m.lb) + '">' + mk + esc(m.sh || m.lb) + '</span>';
    }).join("") +
    '<span><i style="background:transparent;border:1px dashed var(--muted,#9ca3af)"></i>Không có yêu cầu</span>' +
    (soiPT ? '<span title="Phụ trách suy từ báo cáo cũ hơn ' + NGUONG_PT_CU + ' ngày — chưa chắc còn phụ trách"><i class="hp-cq" style="position:static;box-shadow:none">?</i>chưa chắc</span>' : '') +
    '<span title="Quá ' + NGUONG_CANHBAO + ' ngày yêu cầu liên tiếp không có ai báo cáo"><i class="hp-cwarn" style="position:static;color:#dc2626">⚠</i>quá ' + NGUONG_CANHBAO + ' ngày</span></span>';

  var nAlert = Object.keys(alert).length;
  var bannerAlert = nAlert
    ? '<div class="hp-alertbar" onclick="HPLANOGRAM.openCanhBao()" title="Bấm xem danh sách vị trí quá hạn"><span class="ic">⚠</span><b>' + nf(nAlert) + '</b> vị trí quá ' + NGUONG_CANHBAO + ' ngày chưa có ai báo cáo vệ sinh — bấm để xử lý</div>'
    : "";

  /* Panel "ĐI LÀM MÀ KHÔNG BÁO CÁO" (tên cũ: Cần nhắc theo nhân viên): gom các ô Chưa VS mà phụ
     trách CÓ chấm công hôm đó, nhóm theo NV — bấm chip tô nổi đúng các ô của NV đó trên sơ đồ.
     30/07: đổ vào hpNhacSlot ở CỘT PHẢI (panel Vệ sinh) — cột sơ đồ chỉ còn banner + 2 sơ đồ.
     03/08: chạy được cho cả NGÀY CŨ (bkNgay tra VESINH-CHAMCONG-NGAY thay cho cột "PT đi làm"). */
  var htmlNhac = "";
  if (soiPT){
    var nhom = {};
    Object.keys(byL).forEach(function(kk){
      if (S.area && !(areaOf(kk) && areaOf(kk).k === S.area)) return;
      var rep = repCua(byL[kk]);
      if (!rep || bkNgay(rep) !== "nhac") return;
      var g = nhom[rep.pt] || (nhom[rep.pt] = { name: ptTen(rep), n: 0, unsure: 0 });
      g.n++; if (ptKhongChac(rep)) g.unsure++;
    });
    var nvKeys = Object.keys(nhom).sort(function(a, b){ return nhom[b].n - nhom[a].n || String(nhom[a].name).localeCompare(String(nhom[b].name), "vi"); });
    if (nvKeys.length){
      var tongO = 0; nvKeys.forEach(function(e){ tongO += nhom[e].n; });
      /* MẶC ĐỊNH THU GỌN (S.ptOpen) — chỉ 1 nút tóm tắt; bấm xổ chips. Đang soi mà thu gọn
         thì vẫn hiện chip NV đang soi + nút bỏ soi (không bắt xổ ra chỉ để tắt). */
      var nhanNhac = homNay ? "Cần nhắc theo nhân viên" : "Đi làm mà không báo cáo";
      var chips = nvKeys.map(function(e){ var g = nhom[e];
        return '<button class="hp-ptchip' + (S.ptHi === e ? " on" : "") + '" data-e="' + esc(e) + '" onclick="HPLANOGRAM.setPtHi(this.getAttribute(\'data-e\'))" title="' + esc(e) + " — " + g.n + ' vị trí chưa vệ sinh (' + (homNay ? "đang đi làm" : "hôm đó CÓ chấm công") + ')' + (g.unsure ? " · " + g.unsure + " ô suy từ báo cáo cũ, chưa chắc" : "") + '">' + esc(g.name) + ' <b>' + g.n + '</b>' + (g.unsure ? '<i class="q">?</i>' : "") + '</button>';
      }).join("");
      var chipSoi = "";
      if (!S.ptOpen && S.ptHi && nhom[S.ptHi]){
        var gs = nhom[S.ptHi];
        chipSoi = '<button class="hp-ptchip on" data-e="' + esc(S.ptHi) + '" onclick="HPLANOGRAM.setPtHi(this.getAttribute(\'data-e\'))">' + esc(gs.name) + ' <b>' + gs.n + '</b></button>';
      }
      htmlNhac = '<div class="hp-ptnhac">' +
        '<button class="hp-ptchip tog' + (S.ptOpen ? " mo" : "") + '" onclick="HPLANOGRAM.togglePtNhac()" title="' + (S.ptOpen ? "Thu gọn danh sách" : "Xổ danh sách " + (homNay ? "nhân viên cần nhắc" : "nhân viên đi làm mà không báo cáo hôm đó") + " — bấm tên để soi ô trên sơ đồ") + '"><span class="car">' + (S.ptOpen ? "▾" : "▸") + '</span>' + nhanNhac + ' <b>' + nvKeys.length + '</b> NV · <b>' + tongO + '</b> ô</button>' +
        (S.ptOpen ? chips : chipSoi) +
        (S.ptHi ? '<button class="hp-ptchip clear" onclick="HPLANOGRAM.setPtHi(\'\')">Bỏ soi ✕</button>' : "") + '</div>';
    }
  }

  if (slot) slot.innerHTML = htmlNhac;
  box.innerHTML =
    '<section class="hp-panel hp-fade">' +
    '<h2>Sơ đồ khu vực <span class="hp-chip">' + esc(nhanKhoang()) + '</span> ' + legend + '</h2>' +
    bannerAlert + (slot ? "" : htmlNhac) + htmlA1 + htmlA8 +
    /* Khối 'Bấm một ô để xem chi tiết…' ĐÃ BỎ (21/08/2026): chỉ dẫn thao tác. */ '' +
    '</section>';
  fitMaps();
}
/* Pop-up danh sách vị trí quá hạn (bấm banner cảnh báo) */
function openCanhBao(){
  var alert = tinhCanhBao();
  var locs = Object.keys(alert).filter(function(loc){ return !S.area || (areaOf(loc) && areaOf(loc).k === S.area); });
  locs.sort(function(a, b){ return alert[b] - alert[a] || (a < b ? -1 : 1); });
  var base = locs.map(function(loc){
    var rs = S.yc.rows.filter(function(r){ return khoaO(r.loc) === loc; }).sort(function(a, b){ return a.ngay < b.ngay ? 1 : -1; });
    var r = rs[0] || { id: "", loc: loc, area: (areaOf(loc) || {}).k, ngay: "", stId: 1, st: "New", email: "", at: "", pt: "", ptCode: "", anh: [] };
    return Object.assign({}, r, { _streak: alert[loc] });
  });
  showModal(base, "Quá " + NGUONG_CANHBAO + " ngày chưa báo cáo vệ sinh" + (S.area ? (" · " + areaMeta(S.area).short) : ""), null, "req");
}

/* ===== POP-UP CHI TIẾT VỊ TRÍ (bấm ô trên sơ đồ) — báo cáo của ngày + lịch sử 7 ngày ===== */
var VT = { loc: "", ngay: "", moAnh: {} };   // moAnh[request id] = đã bấm "+N" trải hết lưới ảnh
function bkCua(r, dd){ return r.bk === "da" ? "da" : (dd === isoToday() ? r.bk : "chua"); }
function openViTri(loc){
  if (!loc) return;
  VT.loc = loc; VT.ngay = ngayXem();
  canCC();   // pop-up cần chấm công hôm nay của phụ trách — nguồn bậc 3, nạp lúc mở (buildCC vẽ lại)
  canLS();   // + lịch sử báo cáo 60 ngày của ô (bậc 3 — chỉ pop-up này dùng, buildLS vẽ lại)
  canCCN();  // + chấm công THEO NGÀY 60 ngày (thẻ Phụ trách cần giờ vào/ra của đúng ngày đang chọn)
  canANH();  // + ảnh báo cáo (tab riêng từ 03/08 — buildANH tự vẽ lại pop-up khi về)
  renderVt();
  var m = $id("hpVtModal"); m.style.display = "flex";
  requestAnimationFrame(function(){ m.classList.add("show"); });
}
function closeVt(){ var m = $id("hpVtModal"); m.classList.remove("show"); setTimeout(function(){ m.style.display = "none"; $id("hpVtBody").innerHTML = ""; }, 240); }
function vtNgay(d){ VT.ngay = d; canAnhNgay(); renderVt(); }   // đổi ngày NGAY TRONG pop-up cũng phải kéo tầng ảnh ngày cũ
/* ===== CHẤM CÔNG THEO ĐÚNG NGÀY ĐANG CHỌN — cho thẻ "Phụ trách" (01/08/2026) ==================
 * Trả về cùng khuôn { c, lb, sub, subC } của ccTrangThai (+ sub2) để dùng lại y nguyên phần vẽ.
 * Tách hẳn 2 sự thật, vì hai cái này dẫn tới hai hành động khác nhau:
 *   dòng ĐẬM = HÔM ĐÓ CÓ ĐI LÀM KHÔNG, vào ca mấy giờ, chấm ra cuối lúc nào (xanh lá / xám xanh)
 *   dòng phụ = ô này hôm đó có được báo cáo không, ai báo cáo (ĐỎ khi đi làm mà không báo cáo —
 *              đúng luật màu của sơ đồ: đỏ chỉ dành cho "chưa vệ sinh")
 * "Đi làm mà không báo cáo" là việc đi truy người; "nghỉ" là việc bố trí người khác. */
function ccNgayVeThe(pc, d, r, lsAll){
  var homNay = d === isoToday();
  var nhan = (homNay ? "Hôm nay " : "Ngày ") + ngayVN(d);
  /* Ai đã báo cáo ô này TRONG NGÀY d: ưu tiên yêu cầu của chính ngày đó (có giờ + ảnh),
     rớt về lịch sử 60 ngày cho ngày nằm ngoài cửa sổ 7 ngày của VESINH-YEUCAU. */
  var lam = null;
  if (r && r.email) lam = { em: r.email, gio: String(r.at || "").slice(11, 16), ten: tenNm(r.email) || r.email };
  else (lsAll || []).forEach(function(v){ if (!lam && v.ngay === d && v.email) lam = { em: v.email, gio: v.gio, ten: v.name || tenNm(v.email) || v.email }; });
  var laMinh = !!(lam && String(lam.em).toLowerCase() === String(pc.em).toLowerCase());
  var subLam = !r && !lam ? "ngày này ô không có yêu cầu vệ sinh"
    : lam ? (laMinh ? "đã báo cáo vệ sinh ô này" + (lam.gio ? " lúc " + lam.gio : "")
                    : "ô này do " + lam.ten + " báo cáo" + (lam.gio ? " lúc " + lam.gio : ""))
          : "KHÔNG báo cáo vệ sinh ô này";
  var subLamC = (!r && !lam) ? "" : lam ? (laMinh ? "" : "#d97706") : "#dc2626";

  var cn = ccNgayCua(pc.em, pc.code, d);
  if (!cn){
    if (S.ccn.dang) return { c: "#6b7280", lb: nhan + " · đang tra chấm công…", sub: "", dang: true };
    if (homNay) return ccTrangThai(pc.em, pc.code);   // chưa đọc được tab theo ngày → còn tab chấm công hôm nay
    return { c: "#6b7280", lb: nhan + " · chưa đọc được chấm công", sub: "cần tab " + TAB_CCN, dang: true };
  }
  if (cn.ngoaiTam) return { c: "#9ca3af", lb: nhan + " · chưa có dữ liệu chấm công",
    sub: "không có dòng chấm công nào của đội vệ sinh trong ngày này — ngoài " + LS_NGAY + " ngày đang lưu, hoặc cả đội nghỉ",
    sub2: subLam, sub2C: (lam && !laMinh) ? "#d97706" : "" };
  if (!cn.co) return { c: "#64748b", lb: nhan + (homNay ? " · CHƯA chấm công" : " · KHÔNG chấm công"),
    sub: (cn.ngoaiBang ? "không có trong bảng chấm công của bộ phận — " : "") +
      (homNay ? "chưa vào ca / nghỉ — nhắc không tới, cần bố trí người khác" : "nghỉ / không vào ca hôm đó — không phải lỗi không báo cáo"),
    /* KHÔNG tô đỏ dòng "không báo cáo" khi người ta nghỉ: đỏ ở đây nghĩa là "đáng đi truy người",
       mà hôm đó họ không đi làm thì lỗi thuộc về bố trí, không thuộc về họ. */
    sub2: subLam, sub2C: (lam && !laMinh) ? "#d97706" : "" };
  var gio = (cn.vao ? "vào " + cn.vao : "vào —") + " · " + (cn.ra ? "ra " + cn.ra : (homNay ? "chưa chấm ra" : "không chấm ra"));
  return { c: "#059669", lb: nhan + " · ĐI LÀM: " + gio, sub: subLam, subC: subLamC };
}
function renderVt(){
  var loc = VT.loc, d = VT.ngay, kO = khoaO(loc);
  /* gom theo KHOÁ Ô (kệ alias nhiều mã vẫn về đúng pop-up); 1 ngày nhiều mã → ưu tiên bản ĐÃ vệ sinh */
  var byNgay = {}; S.yc.rows.forEach(function(r){ if (khoaO(r.loc) !== kO) return;
    var cur = byNgay[r.ngay]; if (!cur || (cur.bk !== "da" && r.bk === "da")) byNgay[r.ngay] = r; });
  var r = byNgay[d] || null;
  var laBang = /-01-01-0[1-4]$/.test(loc) && MAP_A8.some(function(c){ return c.bc === loc; });
  var mA1 = loc.match(/^F0-A1-(\d{3})-(\d{2})-/);
  $id("hpVtTitle").textContent = (laBang ? "Băng chuyền · " : (mA1 ? "Kệ " + mA1[2] + " · dãy " + mA1[1] + " · " : "")) + loc;
  $id("hpVtSub").textContent = "Chi tiết báo cáo vệ sinh — bấm ô ngày bên dưới để xem ngày khác";
  /* Hyperlink DUY NHẤT của pop-up: "Yêu cầu #… ↗" ở góc phải trên (không còn nút Mở planogram riêng) */
  var pg = $id("hpVtPg");
  pg.href = r ? pgDetailUrl(r.id) : pgListUrlLoc(d, loc);
  pg.textContent = r ? ("Yêu cầu #" + r.id + " ↗") : "Tìm trên planogram ↗";

  /* Dải lịch sử 7 ngày (cũ → mới) — màu theo hệ trạng thái đầy đủ, mỗi ngày độc lập */
  var dates = ycDates().slice(0, 7).sort();
  var hist = dates.map(function(dd){
    var rr = byNgay[dd], stm = cellMeta(cellStateDay(rr, dd));
    var tt = ngayVN(dd) + " — " + (rr ? stm.lb : "không có yêu cầu");
    return '<span class="hp-vthist' + (dd === d ? " on" : "") + (rr && !stm.dashed ? cellCls(stm) : " trong") + '" style="' + (rr && !stm.dashed ? "background:" + stm.c : "") + '" title="' + esc(tt) + '" data-d="' + dd + '" onclick="HPLANOGRAM.vtNgay(this.getAttribute(\'data-d\'))">' +
      '<b>' + esc(thuVN(dd)) + '</b>' + esc(ngayVN(dd)) + '</span>';
  }).join("");
  /* Cảnh báo quá hạn cho vị trí này */
  var al = tinhCanhBao()[kO];

  /* Phụ trách gần nhất (45 ngày) từ tab PHU-TRACH — ô alias lấy bản CÓ NGƯỜI + mới nhất */
  var ptAll = null;
  S.all.forEach(function(x){ if (khoaO(x.loc) !== kO || !x.email) return;
    if (!ptAll || String(x.at || "") > String(ptAll.at || "")) ptAll = x; });

  var rows = [];
  if (al) rows.push(["Cảnh báo", '<span class="hp-badge" style="background:color-mix(in srgb,#dc2626 15%,transparent);color:#dc2626">⚠ Quá hạn ' + al + ' ngày chưa báo cáo</span>']);
  if (r){
    var m2 = cellMeta(cellStateDay(r, d));
    /* 1 badge nhóm; badge hệ thống CHỈ thêm khi mang nghĩa khác (Chờ duyệt/Đã duyệt/Từ chối) — tránh trùng lặp.
       Hyperlink duy nhất "Yêu cầu #… ↗" ở góc phải trên pop-up. */
    var themSt = (r.stId === 1 || /new/i.test(r.st)) ? "" : " " + stBadge(r);
    rows.push(["Trạng thái", '<span class="hp-badge" style="background:color-mix(in srgb,' + m2.c + ' 15%,transparent);color:' + cellInk(m2) + '">' + esc(m2.lb) + '</span>' + themSt]);
    rows.push(["Người báo cáo", r.email ? (esc(tenNm(r.email) || r.email) + (r.at ? ' <span class="hp-hint">lúc ' + esc(String(r.at).slice(11, 16) || r.at) + " " + ngayVN(r.ngay) + '</span>' : "")) : '<span class="hp-hint">— chưa có ai báo cáo trong ngày này</span>']);
    var ai = aiOf(r), aim = ai && aiMeta(ai.kl);
    rows.push(["AI xét duyệt", aim
      /* Cùng khuôn với ô lý do ở panel danh sách: câu kết luận + danh sách "ô nào lỗi gì" thu sẵn. */
      ? '<span class="hp-badge" style="background:color-mix(in srgb,' + aim.c + ' 15%,transparent);color:' + aim.c + '">' + esc(aim.lb.replace("AI: ", "")) + (ai.diem ? " · " + ai.diem : "") + '</span> <span class="hp-hint">tin cậy ' + ai.tincay + '%</span>' + aiLyDoKhoi(ai.lydo, ai.anhloi)
      : '<span class="hp-hint">chưa chấm' + (r.stId === 3 ? " — sẽ chấm ở lượt kế tiếp" : "") + '</span>']);
    /* ẢNH: mặc định chỉ bày ANH_XEM_TRUOC ô — mỗi ô là ẢNH GỐC ~520KB (CDN không có bản nhỏ), bày
       cả 24 ô là 18,6MB/lượt mở. Muốn xem cả bộ thì bấm "+N": lúc đó mới trải hết lưới và ảnh vẫn
       vào theo tầm nhìn. Người chỉ liếc qua không phải trả tiền băng thông cho 20 ảnh không xem. */
    var moHet = !!VT.moAnh[String(r.id)], soBay = moHet ? r.anh.length : Math.min(ANH_XEM_TRUOC, r.anh.length);
    var thumbs = r.anh.length
      ? '<div class="hp-vtthumbs">' + r.anh.slice(0, soBay).map(function(u, i){
          return imgAnh(u, ' data-rid="' + esc(r.id) + '" data-idx="' + i + '" onclick="event.stopPropagation();HPLANOGRAM.openAnh(this.getAttribute(\'data-rid\'),+this.getAttribute(\'data-idx\'))"', i < ANH_TAI_NGAY);
        }).join("") +
        (soBay < r.anh.length
          ? '<button class="hp-vtmore" data-rid="' + esc(r.id) + '" onclick="event.stopPropagation();HPLANOGRAM.moAnhHet(this.getAttribute(\'data-rid\'))" title="Trải hết lưới ảnh (mỗi ảnh ~0,5MB)">+' + (r.anh.length - soBay) + '</button>'
          : '') + '</div>'
      : '<span class="hp-hint">' + (!r.email ? "chưa có ảnh (chưa báo cáo)"
          /* Ba tình huống KHÁC HẲN nhau, trước đây gộp làm một câu "chỉ lưu 7 ngày" nên báo sai
             cho cả ngày nằm TRONG cửa sổ (user bắt được 14/8 khi hôm nay 18/8): */
          : (S.anh.dang || S.anhcu.dang) ? "đang tải ảnh báo cáo…"
          : (S.anh.ngay[d] || S.anhcu.ok) ? "yêu cầu này không kèm ảnh báo cáo"
          : "ảnh chỉ lưu trên dashboard 7 ngày gần nhất — bấm ↗ xem trên planogram") + '</span>';
    rows.push(["Ảnh báo cáo (" + r.anh.length + ")", thumbs]);
  } else {
    rows.push(["Trạng thái", '<span class="hp-hint">Ngày ' + ngayVN(d) + ' vị trí này KHÔNG có yêu cầu vệ sinh trên planogram.</span>']);
  }
  /* ===== HAI THẺ SONG SONG (31/07/2026) — TRÁI "Phụ trách" (ai chịu trách nhiệm + hôm nay có
     đi làm không) · PHẢI "Báo cáo gần nhất" (tham khảo: thực tế ai đã làm, cách đây bao lâu).
     Trước đây hai mục này là 2 hàng nhãn/giá trị xếp dọc y như "Trạng thái"/"Ảnh" nên đọc ra
     như 2 dữ kiện rời rạc ngang cấp; đặt cạnh nhau thì so sánh được ngay:
     người được giao ↔ người thực sự làm, và biết nên đi nhắc ai. ===== */
  var pc = pcCua(loc);
  var tuGS = !!(pc && pc.em && /g-sheet/i.test(pc.nguon));   // phân công THẬT từ g-sheet, không phải suy diễn
  var cardPt;
  if (pc && pc.em){
    var mauNg = tuGS ? "#059669" : "#d97706";
    var ten = pc.ten || pc.em;
    /* CHẤM CÔNG CỦA ĐÚNG NGÀY ĐANG CHỌN (01/08/2026 — yêu cầu user).
       Trước đây chỗ này luôn là chấm công HÔM NAY (tab CHAMCONG-VESINH chỉ có hôm nay), nên bấm
       xem lại ngày 29/07 vẫn đọc ra "Hôm nay KHÔNG chấm công" — sai câu hỏi: khi soi một ngày cũ,
       điều cần biết là HÔM ĐÓ người phụ trách có đi làm mà không báo cáo hay không.
       Nguồn VESINH-CHAMCONG-NGAY (60 ngày); tab đó chưa về/chưa có thì mới rớt về chấm công hôm nay. */
    var cc = ccNgayVeThe(pc, d, r, lsCua(loc));
    var gcVe = String(pc.gc || "").replace(/^\s*g-sheet chưa phân công vị trí này\s*(·\s*)?/i, "");
    cardPt =
      '<div class="hp-vtcard pt">' +
      '<div class="hd">Phụ trách <span class="hp-badge" style="background:color-mix(in srgb,' + mauNg + ' 14%,transparent);color:' + mauNg + '">' +
        esc(tuGS ? "Bảng phân công" : "Suy từ báo cáo gần nhất") + '</span></div>' +
      '<div class="who"><span class="av" style="background:' + nmColor(ten) + '">' + esc(chuDau(ten)) + '</span>' +
        '<div><b>' + esc(ten) + '</b><small>' + (pc.code ? esc(pc.code) + " · " : "") + esc(pc.em) + '</small></div></div>' +
      '<div class="cc"><span class="hp-dot" style="background:' + cc.c + '"></span>' +
        '<div><b style="color:' + cc.c + '">' + esc(cc.lb) + '</b>' +
        (cc.sub ? '<small' + (cc.subC ? ' style="color:' + cc.subC + ';font-weight:650"' : "") + '>' + esc(cc.sub) + '</small>' : "") +
        /* sub2 = tình hình BÁO CÁO của ô trong ngày đó, chỉ dùng khi dòng phụ đã bị chiếm bởi lý do
           nghỉ/ngoài tầm — vẫn cần biết ô có ai làm thay hay bỏ trống hẳn. */
        (cc.sub2 ? '<small' + (cc.sub2C ? ' style="color:' + cc.sub2C + ';font-weight:650"' : "") + '>' + esc(cc.sub2) + '</small>' : "") + '</div></div>' +
      (tuGS ? "" : '<div class="ln mut">g-sheet chưa phân công vị trí này' + (pc.bc ? " — bằng chứng " + esc(ngayVN(pc.bc)) : "") + '</div>') +
      /* Ghi chú của dòng BÙ trong bảng phân công vốn mở đầu đúng bằng câu "g-sheet chưa phân công
         vị trí này" (sync-phancong ghi vậy) → in tiếp cả ghi chú là lặp nguyên câu vừa đọc. Cắt vế trùng. */
      (gcVe ? '<div class="ln mut">' + esc(gcVe) + '</div>' : "") +
      '</div>';
  } else {
    cardPt = '<div class="hp-vtcard pt"><div class="hd">Phụ trách</div><div class="ln mut">' +
      (S.pc.dang ? "đang tải bảng phân công…"
        : "không có trong bảng phân công" + (S.pc.ok ? "" : " (chưa đọc được tab " + esc(TAB_PC) + ")")) + '</div></div>';
  }

  /* ===== BẰNG CHỨNG "AI ĐÃ THỰC SỰ LÀM" — chỉ nhận nguồn LÀ BÁO CÁO THẬT (01/08/2026) =====
     Thứ tự: (1) lịch sử 60 ngày VESINH-LICHSU — có cả GIỜ, sống lâu nhất; (2) tab PHU-TRACH (lượt
     gần nhất 45 ngày); (3) chính yêu cầu của ngày đang xem.
     TUYỆT ĐỐI KHÔNG lấy các cột "Phụ trách / PT Name / PT lần cuối" của VESINH-YEUCAU: từ 30/07
     chúng được sync ghi theo BẢNG PHÂN CÔNG, không phải người đã làm. Lấy chúng làm "báo cáo gần
     nhất" chính là lỗi user gặp ở ô F0-A1-513-10 (chưa ai báo cáo lần nào trong 45 ngày): thẻ tham
     khảo in lại đúng người phụ trách, ngày thì "không rõ", rồi tự kết luận "✓ đúng người trong bảng
     phân công" — tức là so bảng phân công với chính nó và trình bày như bằng chứng. */
  var lsAll = lsCua(loc), lsMoi = lsAll[0] || null;
  var bcTen = "", bcEm = "", bcCode = "", bcNgay = "", bcGio = "", bcNguon = "";
  if (lsMoi){
    bcEm = lsMoi.email; bcTen = lsMoi.name || tenNm(lsMoi.email); bcCode = lsMoi.code;
    bcNgay = lsMoi.ngay; bcGio = lsMoi.gio; bcNguon = "lịch sử " + LS_NGAY + " ngày";
  } else if (ptAll){
    bcEm = ptAll.email; bcTen = ptAll.name || tenNm(ptAll.email); bcCode = ptAll.code;
    bcNgay = String(ptAll.at || "").slice(0, 10); bcGio = String(ptAll.at || "").slice(11, 16); bcNguon = "lượt gần nhất 45 ngày";
  } else if (r && r.email){
    bcEm = r.email; bcTen = tenNm(r.email); bcCode = "";
    bcNgay = String(r.at || "").slice(0, 10) || r.ngay; bcGio = String(r.at || "").slice(11, 16); bcNguon = "yêu cầu ngày " + ngayVN(d);
  }
  var ptTuoiVt = bcNgay ? tuoiNgay(bcNgay) : null;
  /* Cùng người hay khác người phụ trách? Đây là điều duy nhất khiến cột "tham khảo" này đáng đọc:
     lệch nhau = phân công trên giấy chưa khớp thực tế → cần chỉnh bảng phân công hoặc nhắc đúng người.
     CHỈ đối chiếu khi phân công lấy từ g-sheet: nếu phân công vốn đã SUY TỪ báo cáo gần nhất thì hai
     bên là cùng một nguồn, in "đúng người" chỉ là so nó với chính nó — vô nghĩa mà lại nghe như bằng chứng. */
  var soDuoc = tuGS && !!bcEm;
  var khacNguoi = soDuoc && String(bcEm).toLowerCase() !== String(pc.em).toLowerCase();
  var cardBc = '<div class="hp-vtcard ref"><div class="hd">Báo cáo gần nhất <span class="hp-hint" style="font-size:10.5px;text-transform:none;letter-spacing:0;font-weight:500">tham khảo</span></div>';
  if (bcTen || bcEm){
    var tenBc = bcTen || bcEm;
    cardBc += '<div class="who"><span class="av" style="background:' + nmColor(tenBc) + '">' + esc(chuDau(tenBc)) + '</span>' +
      '<div><b>' + esc(tenBc) + '</b><small>' + (bcCode ? esc(bcCode) + (bcEm ? " · " : "") : "") + esc(bcEm) + '</small></div></div>' +
      '<div class="ln"><b>' + esc(thuVN(bcNgay)) + " " + esc(ngayVN(bcNgay)) + '</b>' +
        (bcGio ? ' lúc <b>' + esc(bcGio) + '</b>' : "") +
        (ptTuoiVt != null ? ' <span class="hp-hint">· ' + (ptTuoiVt > 0 ? ptTuoiVt + " ngày trước" : "hôm nay") + '</span>' : "") +
        (bcNguon ? ' <span class="hp-hint">(' + esc(bcNguon) + ')</span>' : "") + '</div>' +
      (!soDuoc ? "" : khacNguoi ? '<div class="ln" style="color:#d97706">⚠ khác người trong bảng phân công</div>'
        : '<div class="ln" style="color:#059669">✓ đúng người trong bảng phân công</div>') +
      (ptTuoiVt != null && ptTuoiVt > NGUONG_PT_CU ? '<div class="ln mut">quá ' + NGUONG_PT_CU + ' ngày — bằng chứng cũ, chưa chắc còn phụ trách</div>' : "");
  } else {
    cardBc += '<div class="ln mut">' + (S.ls.dang ? "đang đọc lịch sử " + LS_NGAY + " ngày…"
      : !S.ls.ok ? "chưa đọc được tab " + esc(TAB_LS) + " — 45 ngày quét cũng không có lượt nào"
      : "chưa ai báo cáo vị trí này trong " + LS_NGAY + " ngày") + '</div>';
  }
  cardBc += '</div>';

  $id("hpVtBody").innerHTML =
    '<div class="hp-vthistrow">' + hist + '</div>' +
    rows.map(function(x){ return '<div class="hp-vtrow"><label>' + x[0] + '</label><div>' + x[1] + '</div></div>'; }).join("") +
    '<div class="hp-vtduo">' + cardPt + cardBc + '</div>';
  lazyQuet();
}

/* ===== MODAL DRILL-DOWN — combo chain-filter (2 chế độ: loc = vị trí phụ trách · req = yêu cầu hôm nay) ===== */
var FDEF_LOC = [
  { k: "area",   lb: "Khu vực",             vals: function(r){ return [areaMeta(r.area).short]; } },
  { k: "status", lb: "Trạng thái",          vals: function(r){ return [r.done ? ST.done.lb : ST.pending.lb]; } },
  { k: "name",   lb: "Nhân viên phụ trách", vals: function(r){ return r.name ? [r.name] : []; } }
];
var FDEF_REQ = [
  { k: "area", lb: "Khu vực",   vals: function(r){ return [areaMeta(r.area).short]; } },
  { k: "bk",   lb: "Trạng thái", vals: function(r){ return [ycMeta(bkNgay(r)).lb]; } },
  { k: "ai",   lb: "AI xét duyệt", vals: function(r){ var a = aiOf(r); var m = a && aiMeta(a.kl); return m ? [m.lb] : []; } },
  { k: "pt",   lb: "Phụ trách (dự kiến)", vals: function(r){ var n = ptTen(r); return n ? [n] : []; } }
];
var FDEF_MISS = [
  { k: "area", lb: "Khu vực",         vals: function(r){ return [areaMeta(r.area).short]; } },
  { k: "kind", lb: "Tình trạng lịch", vals: function(r){ return [missMeta(r.kind).lb]; } }
];
function fdefs(){ return MODAL.mode === "req" ? FDEF_REQ : MODAL.mode === "miss" ? FDEF_MISS : FDEF_LOC; }
function fdefOf(k){ var F = fdefs(); for (var i = 0; i < F.length; i++) if (F[i].k === k) return F[i]; return null; }
function openAll(){ showModal(rowsInScope(), "Tất cả vị trí" + (S.area ? (" · " + areaMeta(S.area).short) : ""), null, "loc"); }
function openArea(k){ var a = areaMeta(k); showModal(S.all.filter(function(r){ return r.area === k; }), a.lb + " · " + a.short, { k: "area", raw: a.short }, "loc"); }
function openStatus(s){ var m = ST[s]; if (!m) return; showModal(rowsInScope().filter(function(r){ return s === "done" ? r.done : !r.done; }), m.lb + (S.area ? (" · " + areaMeta(S.area).short) : ""), { k: "status", raw: m.lb }, "loc"); }
function openName(n){ showModal(S.all.filter(function(r){ return r.name === n; }), "Vị trí phụ trách bởi: " + n, { k: "name", raw: n }, "loc"); }
function openYc(bk){
  var m = bk ? ycMeta(bk) : null;
  showModal(ycInScope(), (m ? m.lb : "Tất cả yêu cầu vệ sinh") + " · " + thuVN(ngayXem()) + " " + ngayVN(ngayXem()) + (S.area ? (" · " + areaMeta(S.area).short) : ""),
    m ? { k: "bk", raw: m.lb } : null, "req");
}
function openYcAi(k){
  var m = aiMeta(k); if (!m) return;
  showModal(ycInScope(), m.lb + " · " + thuVN(ngayXem()) + " " + ngayVN(ngayXem()) + (S.area ? (" · " + areaMeta(S.area).short) : ""), { k: "ai", raw: m.lb }, "req");
}
/* Pop-up "vị trí KHÔNG có yêu cầu báo cáo vệ sinh" (bấm dải cảnh báo ở panel Vệ sinh) */
function openThieu(){
  var dp = doPhu();
  showModal(dp.thieu, "Không có yêu cầu báo cáo vệ sinh · " + nhanKhoang() + (S.area ? (" · " + areaMeta(S.area).short) : ""), null, "miss");
}
function showModal(base, title, preset, mode){
  MODAL.base = base || []; MODAL.preset = preset || null; MODAL.mode = mode || "loc";
  if (MODAL.mode === "req"){ canANH(); ganAnh(MODAL.base); }   // cột Ảnh của bảng yêu cầu (tab bậc 3)
  $id("hpMtitle").textContent = title;
  $id("hpMsub").textContent = nf(MODAL.base.length) + (MODAL.mode === "req" ? " yêu cầu" : " vị trí") + " — combo lọc sinh động, gõ để lọc, đếm số dòng";
  $id("hpMHead").innerHTML = THEADS[MODAL.mode] || THEAD_LOC;
  var pg = $id("hpMPg");
  if (MODAL.mode === "loc") pg.style.display = "none";
  else { pg.style.display = ""; pg.href = pgListUrl(khoang()[0], S.area, "", khoang()[1]); }
  buildFilters();
  $id("hpMSum").textContent = "";
  $id("hpMBody").innerHTML = '<tr><td colspan="' + (NCOL[MODAL.mode] || 6) + '" class="empty">Đang hiển thị…</td></tr>';
  var m = $id("hpModal"); m.style.display = "flex";
  requestAnimationFrame(function(){ m.classList.add("show"); setTimeout(mRender, 60); });
}
function closeModal(){
  var m = $id("hpModal"); m.classList.remove("show");
  setTimeout(function(){ m.style.display = "none"; $id("hpMFilters").innerHTML = ""; $id("hpMBody").innerHTML = ""; }, 240);
}
function buildFilters(){
  var rows = MODAL.base, html = "";
  fdefs().forEach(function(d){
    var uniq = new Set();
    rows.forEach(function(r){ d.vals(r).forEach(function(v){ if (v) uniq.add(v); }); });
    if (uniq.size > 1){
      html += '<div class="fld"><label>' + esc(d.lb) + '</label><div class="hp-combo" data-fk="' + d.k + '" data-lb="' + esc(d.lb) + '">' +
        '<input data-fk="' + d.k + '" autocomplete="off" placeholder="Tất cả…" oninput="HPLANOGRAM.comboInput(this)" onfocus="HPLANOGRAM.comboMenu(this.parentNode)">' +
        '<div class="hp-combo-menu"></div></div></div>';
    }
  });
  html += '<div class="fld q"><label>Tìm nhanh</label><input id="hpMQ" autocomplete="off" placeholder="Vị trí / email / mã / tên…" oninput="HPLANOGRAM.quick()"></div>';
  $id("hpMFilters").innerHTML = html;
  if (MODAL.preset){
    var p = MODAL.preset, inp = $id("hpMFilters").querySelector('.hp-combo[data-fk="' + p.k + '"] input');
    if (inp){ inp.value = p.raw; inp.setAttribute("data-exact", "1"); }
  }
}
function qval(){ return (($id("hpMQ") || {}).value || "").trim().toLowerCase(); }
function fstate(){
  return Array.prototype.slice.call(document.querySelectorAll("#hpMFilters .hp-combo input")).map(function(inp){
    var v = inp.value.trim();
    return { k: inp.getAttribute("data-fk"), raw: v, v: v.toLowerCase(), exact: !!inp.getAttribute("data-exact") };
  });
}
function quickText(r){
  if (MODAL.mode === "req") return r.loc + " " + r.email + " " + r.pt + " " + ptTen(r) + " " + r.ptCode + " " + r.st;
  if (MODAL.mode === "miss") return r.loc + " " + areaMeta(r.area).short + " " + missMeta(r.kind).lb + " " + r.name + " " + r.email;
  return r.loc + " " + r.email + " " + r.code + " " + r.name;
}
function rowsWith(excludeK, state, q){
  return MODAL.base.filter(function(r){
    for (var i = 0; i < state.length; i++){ var f = state[i];
      if (f.k === excludeK || !f.v) continue;
      var d = fdefOf(f.k); if (!d) continue;
      var vs = d.vals(r).map(String);
      if (f.exact){ if (vs.indexOf(f.raw) < 0) return false; }
      else if (!vs.some(function(v){ return v.toLowerCase().indexOf(f.v) >= 0; })) return false;
    }
    if (q && (quickText(r).toLowerCase().indexOf(q) < 0)) return false;
    return true;
  });
}
function comboMenu(combo){
  var k = combo.getAttribute("data-fk"), lb = combo.getAttribute("data-lb");
  var inp = combo.querySelector("input"), menu = combo.querySelector(".hp-combo-menu");
  var uniq = new Set(), cnt = {};
  rowsWith(k, fstate(), qval()).forEach(function(r){ fdefOf(k).vals(r).forEach(function(v){ if (!v) return; uniq.add(v); cnt[v] = (cnt[v] || 0) + 1; }); });
  var typed = inp.getAttribute("data-exact") ? "" : inp.value.trim().toLowerCase();
  var items = Array.from(uniq).filter(function(v){ return !typed || v.toLowerCase().indexOf(typed) >= 0; });
  items.sort(function(a, b){ return a < b ? -1 : a > b ? 1 : 0; });
  var html = '<div class="hp-combo-item all" data-v=""><span class="nm">Tất cả ' + esc(lb) + '</span><span class="c">' + uniq.size + ' mục</span></div>';
  html += items.map(function(v){ return '<div class="hp-combo-item" data-v="' + esc(v) + '"><span class="nm">' + esc(v) + '</span><span class="c">' + nf(cnt[v]) + '</span></div>'; }).join("");
  if (!items.length) html += '<div class="hp-combo-empty">Không có mục phù hợp</div>';
  menu.innerHTML = html;
  closeCombos(combo);
  menu.classList.add("show");
}
function comboInput(inp){ inp.removeAttribute("data-exact"); comboMenu(inp.parentNode); quick(); }
function closeCombos(except){
  document.querySelectorAll("#hpMFilters .hp-combo-menu.show").forEach(function(m){ if (!except || m.parentNode !== except) m.classList.remove("show"); });
}
function quick(){ clearTimeout(_deb); _deb = setTimeout(applyF, 120); }
function applyF(){ var b = $id("hpMBody"); if (b) b.classList.add("is-filtering"); clearTimeout(_debT); _debT = setTimeout(function(){ mRender(); if (b) b.classList.remove("is-filtering"); }, 150); }
function mRender(){
  var state = fstate(), q = qval();
  var rows = rowsWith(null, state, q);
  rows = rows.slice().sort(function(a, b){
    if (MODAL.mode === "miss" && a.kind !== b.kind) return a.kind === "chua" ? -1 : 1;   // nặng nhất lên đầu
    return a.loc < b.loc ? -1 : a.loc > b.loc ? 1 : 0;
  });
  var out = [], sum;
  if (MODAL.mode === "miss"){
    var cM = { chua: 0, dung: 0 }, nD = ycDates().length;   // tab yêu cầu chỉ lưu nD ngày gần nhất
    for (var im = 0; im < rows.length; im++){ var rm = rows[im];
      cM[rm.kind]++;
      if (out.length < CAP){
        var am = areaMeta(rm.area), mm = missMeta(rm.kind);
        out.push('<tr>' +
          '<td class="mb-hd">' + esc(rm.loc) + (rm.suy ? '<small>mã suy theo sơ đồ — chưa từng thấy trong dữ liệu</small>' : '') + '</td>' +
          '<td data-lb="Khu vực"><span class="hp-dot" style="background:' + am.c + '"></span> ' + esc(am.short) + '</td>' +
          '<td class="mb-tag"><span class="badge" title="' + esc(mm.sub) + '" style="background:color-mix(in srgb,' + mm.c + ' 15%,transparent);color:' + mm.c + '">' + esc(mm.lb) + '</span></td>' +
          '<td data-lb="Yêu cầu gần nhất">' + (rm.ycCuoi ? esc(ngayVN(rm.ycCuoi))
            : (rm.kind === "dung"
                ? '<span class="mut" title="Tab yêu cầu chỉ lưu ' + nD + ' ngày gần nhất — lần phát cuối đã trôi khỏi cửa sổ này">ngoài ' + nD + ' ngày lưu</span>'
                : '<span class="mut">chưa từng có</span>')) + '</td>' +
          '<td class="nm" data-lb="Vệ sinh gần nhất">' + (rm.vsCuoi ? (esc(ngayVN(rm.vsCuoi)) + '<small>' + esc(rm.name || rm.email || "") + '</small>') : '<span class="mut">chưa ai từng vệ sinh</span>') + '</td>' +
          '<td class="mb-act"><a class="hp-ext" target="_blank" rel="noopener" href="' + esc(pgLocUrl(rm.loc)) + '" title="Mở planogram lọc sẵn vị trí này (45 ngày) để soát lại lịch">Kiểm tra ↗</a></td></tr>');
      }
    }
    sum = nf(rows.length) + " / " + nf(MODAL.base.length) + " vị trí · Chưa khai báo lịch: " + nf(cM.chua) + " · Đã dừng phát yêu cầu: " + nf(cM.dung);
    if (rows.length > CAP) out.push('<tr><td colspan="6" class="empty">Hiển thị ' + nf(CAP) + ' / ' + nf(rows.length) + ' dòng — dùng bộ lọc để thu hẹp.</td></tr>');
    if (!out.length) out.push('<tr><td colspan="6" class="empty">Không có dòng phù hợp</td></tr>');
  } else if (MODAL.mode === "req"){
    var cnt = { da: 0, nhac: 0, khong: 0, chua: 0 };
    for (var i = 0; i < rows.length; i++){ var r = rows[i];
      cnt[bkNgay(r)]++;
      if (out.length < CAP){
        var a = areaMeta(r.area);
        var thuc = r.email ? ('<span title="' + esc(r.email) + '">' + esc(tenNm(r.email) || r.email) + '</span>') : '<span class="mut">—</span>';
        var ptTxt = r.pt
          ? ('<span title="' + esc(r.pt) + '">' + esc(ptTen(r)) + '</span><small>' + (r.ptDiLam ? ("đi làm" + (r.ptCi ? " · vào " + esc(r.ptCi) : "")) : "nghỉ / không chấm công") + '</small>')
          : '<span class="mut">chưa có người nhận</span>';
        var thumbs = r.anh.length
          ? ('<span class="hp-thumbs">' +
              imgAnh(r.anh[0], ' data-rid="' + esc(r.id) + '" onclick="event.stopPropagation();HPLANOGRAM.openAnh(this.getAttribute(\'data-rid\'),0)" title="Xem ' + r.anh.length + ' ảnh báo cáo"', false) +
              (r.anh.length > 1 ? '<button class="more" data-rid="' + esc(r.id) + '" onclick="event.stopPropagation();HPLANOGRAM.openAnh(this.getAttribute(\'data-rid\'),0)">+' + (r.anh.length - 1) + '</button>' : '') +
            '</span>')
          : '<span class="mut">—</span>';
        var ai = aiOf(r), aim = ai && aiMeta(ai.kl);
        var aiCell = aim
          ? '<span class="badge" title="' + esc((ai.lydo || "") + (ai.anhloi ? " — " + ai.anhloi : "") + (ai.tincay ? " (tin cậy " + ai.tincay + "%)" : "")) + '" style="background:color-mix(in srgb,' + aim.c + ' 15%,transparent);color:' + aim.c + '">' + esc(aim.lb.replace("AI: ", "")) + (ai.diem ? " · " + ai.diem : "") + '</span>'
          : '<span class="mut">—</span>';
        var luc = r.at ? esc((la1Ngay() ? "" : ngayVN(r.ngay) + " ") + (String(r.at).slice(11, 16) || r.at))
          : (la1Ngay() ? '<span class="mut">—</span>' : '<span class="mut">' + ngayVN(r.ngay) + '</span>');
        out.push('<tr>' +
          '<td class="mb-hd"><span class="hp-dot" style="background:' + a.c + '"></span> ' + esc(r.loc) + '</td>' +
          '<td class="mb-tag">' + stBadge(r) + '</td>' +
          '<td' + (aim ? ' data-lb="AI"' : ' class="mb-0"') + '>' + aiCell + '</td>' +
          '<td class="nm' + (r.email ? "" : " mb-0") + '" data-lb="Người thực hiện">' + thuc + '</td>' +
          '<td' + (r.at || !la1Ngay() ? ' data-lb="Lúc"' : ' class="mb-0"') + '>' + luc + '</td>' +
          '<td class="nm" data-lb="Phụ trách">' + ptTxt + '</td>' +
          '<td' + (r.anh.length ? ' data-lb="Ảnh"' : ' class="mb-0"') + '>' + thumbs + '</td>' +
          '<td class="mb-act"><a class="hp-ext" target="_blank" rel="noopener" href="' + esc(pgDetailUrl(r.id)) + '" title="Mở yêu cầu #' + esc(r.id) + ' trên planogram">Mở ↗</a></td></tr>');
      }
    }
    sum = nf(rows.length) + " / " + nf(MODAL.base.length) + " yêu cầu · Đã vệ sinh: " + nf(cnt.da) +
      (laHomNay() ? " · Chưa (có đi làm): " + nf(cnt.nhac) + " · Không có ca: " + nf(cnt.khong) : " · Chưa vệ sinh: " + nf(cnt.chua));
    if (rows.length > CAP) out.push('<tr><td colspan="8" class="empty">Hiển thị ' + nf(CAP) + ' / ' + nf(rows.length) + ' dòng — dùng bộ lọc để thu hẹp.</td></tr>');
    if (!out.length) out.push('<tr><td colspan="8" class="empty">Không có dòng phù hợp</td></tr>');
  } else {
    var nDone = 0;
    for (var j = 0; j < rows.length; j++){ var r2 = rows[j];
      if (r2.done) nDone++;
      if (out.length < CAP){
        var a2 = areaMeta(r2.area);
        var badge = r2.done
          ? '<span class="badge" style="background:color-mix(in srgb,' + ST.done.c + ' 16%,transparent);color:' + ST.done.c + '">' + ST.done.lb + '</span>'
          : '<span class="badge" style="background:color-mix(in srgb,' + ST.pending.c + ' 22%,transparent);color:var(--muted,#6b7280)">' + ST.pending.lb + '</span>';
        out.push('<tr>' +
          '<td class="mb-hd">' + esc(r2.loc) + '</td>' +
          '<td' + (r2.email ? ' data-lb="Email"' : ' class="mb-0"') + '>' + (r2.email ? esc(r2.email) : '<span class="mut">—</span>') + '</td>' +
          '<td' + (r2.code ? ' data-lb="Mã"' : ' class="mb-0"') + '>' + (r2.code ? esc(r2.code) : '<span class="mut">—</span>') + '</td>' +
          '<td class="nm' + (r2.name ? "" : " mb-0") + '" data-lb="Tên">' + (r2.name ? esc(r2.name) : '<span class="mut">—</span>') + '</td>' +
          '<td data-lb="Khu vực"><span class="hp-dot" style="background:' + a2.c + '"></span> ' + esc(a2.short) + '</td>' +
          '<td class="mb-tag">' + badge + '</td></tr>');
      }
    }
    sum = nf(rows.length) + " / " + nf(MODAL.base.length) + " vị trí · Đã có người: " + nf(nDone) + " · Chưa báo cáo: " + nf(rows.length - nDone);
    if (rows.length > CAP) out.push('<tr><td colspan="6" class="empty">Hiển thị ' + nf(CAP) + ' / ' + nf(rows.length) + ' dòng — dùng bộ lọc để thu hẹp.</td></tr>');
    if (!out.length) out.push('<tr><td colspan="6" class="empty">Không có dòng phù hợp</td></tr>');
  }
  $id("hpMBody").innerHTML = out.join("");
  lazyQuet();
  var nAct = state.filter(function(f){ return f.v; }).length + (q ? 1 : 0);
  $id("hpMSum").textContent = sum + (nAct ? (" · " + nAct + " bộ lọc đang áp dụng") : "");
}
/* Ảnh báo cáo → LIGHTBOX CAROUSEL của host (openLB) */
function moAnhHet(id){ VT.moAnh[String(id)] = 1; renderVt(); }

function openAnh(id, i){
  var r = null;
  for (var j = 0; j < S.yc.rows.length; j++) if (String(S.yc.rows[j].id) === String(id)){ r = S.yc.rows[j]; break; }
  if (!r || !r.anh.length) return;
  var list = r.anh.map(function(u){ return { type: "img", url: u }; });
  if (typeof window.openLB === "function") window.openLB(list, i || 0);
  else window.open(r.anh[i || 0], "_blank", "noopener");
}

/* ===== POP-UP TRA CỨU THEO NHÂN VIÊN (nhật ký theo ngày) =======================================
 * Nguồn: VESINH-LICHSU (gom lượt báo cáo theo NGÀY × NGƯỜI × KHU) — trước 01/08/2026 đọc tab
 * VESINH-NHATKY riêng, nhưng nó chính là bảng gom này (đối chiếu 272/272 dòng khớp y nguyên) nên
 * đọc thêm chỉ tốn 1 request GAS + 34KB. Đổi nguồn còn LỢI: phủ 60 ngày thay vì 45, và LICHSU đã
 * được nạp trước nên pop-up mở ra là có dữ liệu ngay. Memo theo số lượt để không gom lại mỗi lần vẽ. */
var _nkRows = null;
function nkRows(){
  if (_nkRows) return _nkRows;
  var g = {};
  (S.ls.ev || []).forEach(function(v){
    if (!v.email) return;
    var kv = /^F0-A8/i.test(v.loc) ? "A8" : "A1";
    var k = v.ngay + "|" + v.email.toLowerCase() + "|" + kv;
    var o = g[k] || (g[k] = { ngay: v.ngay, email: v.email, code: v.code, name: v.name || tenNm(v.email), area: kv, locs: [] });
    if (!o.code && v.code) o.code = v.code;
    if (!o.name && v.name) o.name = v.name;
    if (o.locs.indexOf(v.loc) < 0) o.locs.push(v.loc);
  });
  _nkRows = Object.keys(g).map(function(k){ g[k].locs.sort(); return g[k]; });
  return _nkRows;
}
function nkStaff(){
  var by = {};
  nkRows().forEach(function(r){
    var k = r.email.toLowerCase();
    var o = by[k] || (by[k] = { email: r.email, code: r.code, name: r.name || tenNm(r.email) || r.email, nLoc: 0, days: {}, last: "" });
    o.nLoc += r.locs.length; o.days[r.ngay] = 1;
    if (r.ngay > o.last) o.last = r.ngay;
    if (!o.name && r.name) o.name = r.name;
  });
  return Object.keys(by).map(function(k){ var o = by[k]; o.nDay = Object.keys(o.days).length; return o; })
    .sort(function(a, b){ return b.last < a.last ? -1 : b.last > a.last ? 1 : (b.nLoc - a.nLoc); });
}
function openNk(email){
  NK.email = String(email || "").toLowerCase(); NK.q = "";
  var inp = $id("hpNkQ"); if (inp) inp.value = "";
  canLS();   // bậc 3: nhật ký lấy từ lịch sử 60 ngày (thường đã nạp trước xong)
  if (S.ls.ok){
    var list = nkStaff();
    if (!NK.email && list.length) NK.email = list[0].email.toLowerCase();
  }
  renderNkList(); renderNkRight();
  var m = $id("hpNkModal"); m.style.display = "flex";
  requestAnimationFrame(function(){ m.classList.add("show"); });
}
function closeNk(){
  var m = $id("hpNkModal"); m.classList.remove("show");
  setTimeout(function(){ m.style.display = "none"; }, 240);
}
function nkSearch(v){ NK.q = String(v || "").trim().toLowerCase(); clearTimeout(_nkDeb); _nkDeb = setTimeout(renderNkList, 130); }
function nkPick(email){ NK.email = String(email || "").toLowerCase(); renderNkList(); renderNkRight(); }
function renderNkList(){
  var el = $id("hpNkList"); if (!el) return;
  if (!S.ls.ok && S.ls.dang){ el.innerHTML = '<div class="hp-nk-empty"><div class="hp-spin" style="width:22px;height:22px;border-width:2px;margin-bottom:10px"></div>Đang tải nhật ký ' + LS_NGAY + ' ngày…</div>'; return; }
  var list = nkStaff().filter(function(o){
    return !NK.q || (o.name + " " + o.code + " " + o.email).toLowerCase().indexOf(NK.q) >= 0;
  });
  el.innerHTML = list.length ? list.map(function(o){
    var act = o.email.toLowerCase() === NK.email;
    return '<div class="hp-nk-item' + (act ? " active" : "") + '" data-em="' + esc(o.email) + '" onclick="HPLANOGRAM.nkPick(this.getAttribute(\'data-em\'))">' +
      '<span class="nm"><span class="hp-dot" style="background:' + nmColor(o.name) + ';margin-right:6px"></span>' + esc(o.name) + '<small>' + esc(o.code || o.email) + '</small></span>' +
      '<span class="c">' + nf(o.nLoc) + ' vị trí<br>' + nf(o.nDay) + ' ngày</span></div>';
  }).join("") : '<div class="hp-nk-empty">Không tìm thấy nhân viên.</div>';
}
function renderNkRight(){
  var el = $id("hpNkRight"); if (!el) return;
  if (!S.ls.ok && S.ls.dang){ el.innerHTML = '<div class="hp-nk-empty">Đang tải nhật ký vệ sinh ' + LS_NGAY + ' ngày…</div>'; return; }
  var rows = nkRows().filter(function(r){ return r.email.toLowerCase() === NK.email; });
  if (!rows.length){ el.innerHTML = '<div class="hp-nk-empty">Chọn 1 nhân viên bên trái để xem nhật ký vệ sinh theo ngày.</div>'; return; }
  var o = { name: rows[0].name || tenNm(rows[0].email) || rows[0].email, code: rows[0].code, email: rows[0].email };
  /* gom theo ngày (giảm dần) → từng khu vực */
  var byDay = {};
  rows.forEach(function(r){
    var d = byDay[r.ngay] || (byDay[r.ngay] = {});
    var arr = d[r.area] || (d[r.area] = []);
    arr.push.apply(arr, r.locs);
  });
  var days = Object.keys(byDay).sort().reverse();
  var homNay = isoToday();
  var nLoc = 0; rows.forEach(function(r){ nLoc += r.locs.length; });
  var html = '<div class="hd">' + esc(o.name) + (o.code ? ' <span class="hp-hint">' + esc(o.code) + '</span>' : '') + '</div>' +
    '<div class="sub">' + esc(o.email) + ' · ' + nf(nLoc) + ' lượt vị trí / ' + nf(days.length) + ' ngày (' + LS_NGAY + ' ngày gần nhất). Quầy kệ F0-A1 thường giữ theo tuần · không gian F0-A8 đổi theo ngày.</div>';
  html += days.map(function(d){
    var khu = byDay[d];
    return '<div class="hp-nk-day"><div class="d">' + thuVN(d) + ' ' + ngayVN(d) + (d === homNay ? ' <span class="today">Hôm nay</span>' : '') + '</div>' +
      AREAS.filter(function(a){ return khu[a.k] && khu[a.k].length; }).map(function(a){
        return '<div class="hp-nk-khu"><span class="hp-dot kdot" title="' + esc(a.short) + '" style="background:' + a.c + '"></span><span>' +
          khu[a.k].sort().map(function(L){
            return '<a class="hp-nk-loc" target="_blank" rel="noopener" title="Mở planogram vị trí ' + esc(L) + ' ngày ' + ngayVN(d) + '" href="' + esc(pgListUrlLoc(d, L)) + '">' + esc(L) + '</a>';
          }).join("") + '</span></div>';
      }).join("") + '</div>';
  }).join("");
  el.innerHTML = html;
}
function pgListUrlLoc(isoNgay, locDesc){
  var m = String(isoNgay || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  var d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
  var f = d.getTime(), t = f + 86399999;
  return PG_BASE + "/list?company_ids=1001&warehouse_ids=863&keyword_type=sku_or_barcode&page=1&size=100&from_date=" + f + "&to_date=" + t + "&location_description=" + encodeURIComponent(locDesc);
}

/* ===== INIT (host gọi mỗi lần mở tab — idempotent) ===== */
var _booted = false;
function init(pane){
  PANE = pane;
  if (!_booted){
    _booted = true;
    var style = document.createElement("style"); style.id = "hp-css"; style.textContent = CSS;
    document.head.appendChild(style);
    var wrap = document.createElement("div"); wrap.innerHTML = MODAL_HTML;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    $id("hpModal").addEventListener("click", function(e){ if (e.target === this) closeModal(); });
    $id("hpNkModal").addEventListener("click", function(e){ if (e.target === this) closeNk(); });
    /* ESC đóng pop-up (đồng bộ hành vi với modal native của host); nhường lightbox host xử lý trước */
    document.addEventListener("keydown", function(e){
      if (e.key !== "Escape") return;
      var lb = $id("lightbox"); if (lb && lb.classList.contains("show")) return;
      if ($id("hpVtModal") && $id("hpVtModal").classList.contains("show")) closeVt();
      else if ($id("hpNkModal") && $id("hpNkModal").classList.contains("show")) closeNk();
      else if ($id("hpModal") && $id("hpModal").classList.contains("show")) closeModal();
    });
    $id("hpVtModal").addEventListener("click", function(e){ if (e.target === this) closeVt(); });
    $id("hpMFilters").addEventListener("click", function(e){
      var it = e.target.closest(".hp-combo-item"); if (!it) return;
      var inp = it.closest(".hp-combo").querySelector("input");
      inp.value = it.getAttribute("data-v") || "";
      if (inp.value) inp.setAttribute("data-exact", "1"); else inp.removeAttribute("data-exact");
      closeCombos(); applyF();
    });
    document.addEventListener("click", function(e){
      if (!e.target.closest("#hpMFilters .hp-combo")) closeCombos();
      if (!e.target.closest("#hpWhBar .hp-combo")){ var nm = $id("hpNgayMenu"); if (nm) nm.classList.remove("show"); }
    });
    /* sơ đồ phóng theo bề rộng cột trái — tính lại hệ số khi đổi cỡ cửa sổ */
    window.addEventListener("resize", function(){ clearTimeout(_fitT); _fitT = setTimeout(fitMaps, 120); });
    /* font Inter (display=swap) về SAU lượt vẽ đầu làm chữ đổi metrics → đo lại 1 lần cho chắc
       (đã có giữ-lì hệ số nên lệch nhỏ không gây nhảy); load = logo/ảnh xong (đổi mốc chặn cao) */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ fitMaps(); });
    window.addEventListener("load", function(){ fitMaps(); });
    pane.innerHTML = KHUNG;
    loadData();
    return;
  }
  if (!pane.querySelector("#hpToday")){ animBat(); pane.innerHTML = KHUNG; render(); }
  else fitMaps();   // quay lại tab sau khi đổi cỡ cửa sổ ở tab khác — chỉnh lại hệ số phóng
  if (Date.now() - S.lastAt > STALE_MS) loadData();
}

window.HPLANOGRAM = {
  init: init, reload: loadData, setArea: setArea, setNgay: setNgay, chonNgay: chonNgay, moNgayMenu: moNgayMenu, setListMode: setListMode,
  openAll: openAll, openArea: openArea, openStatus: openStatus, openName: openName, openYc: openYc, openYcAi: openYcAi, closeModal: closeModal,
  comboInput: comboInput, comboMenu: comboMenu, quick: quick, openAnh: openAnh,
  openNk: openNk, closeNk: closeNk, nkPick: nkPick, nkSearch: nkSearch,
  openViTri: openViTri, moAnhHet: moAnhHet, closeVt: closeVt, vtNgay: vtNgay, openCanhBao: openCanhBao, openThieu: openThieu, setPtHi: setPtHi, togglePtNhac: togglePtNhac,
  ccSetStatus: ccSetStatus, ccSearch: ccSearch, aiSetKl: aiSetKl, aiSearch: aiSearch, moMap: moMap
};
})();
