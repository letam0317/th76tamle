/* google-script-SkuVision.gs — tách từ google-script.gs ngày 20/10/2026 (đánh giá: 1 tệp 3.7k dòng / 81 lệnh khó soát).
 * Mục: nhận diện SKU: sku_vision (Gemini) + sku_ocr (Drive OCR).
 * Cùng một dự án Apps Script → dùng chung hằng/hàm ở google-script.gs (SECRET, keyBodyOK_, phanHoiJson…). KHÔNG đặt bí mật ở tệp này.
 * deploy-gas.mjs chép sang .clasp-deploy/SkuVision.js — nhớ chạy qc-gas-gac.mjs (bảng lệnh–gác). */
/* ==============================================================================================
 *  NHẬN DIỆN SKU — CỔNG VISION LLM (action = sku_vision) · 18/08/2026
 * ----------------------------------------------------------------------------------------------
 *  Dashboard Audit Factory (trang GitHub Pages CÔNG KHAI) gửi ảnh tem NCC lên đây, Apps Script
 *  gọi Gemini rồi trả về TỪ KHOÁ đã gắn vai. Vì sao phải qua đây:
 *    · Khoá AI nằm trong Script Properties → KHÔNG lộ trong mã trang công khai.
 *    · Có chỗ để gác cổng: email @hasaki.vn + hạn mức ngày + nhịp chống bấm liên tục.
 *    · Không phải dựng thêm hạ tầng nào (Apps Script đã là backend ghi Sheet của dự án).
 *
 *  CÀI KHOÁ 1 LẦN (không commit khoá vào git): mở Apps Script → chạy hàm `datKhoaGemini()` sau khi
 *  dán khoá vào biến trong hàm, hoặc Project Settings → Script properties → thêm GEMINI_API_KEY.
 *  Khoá miễn phí lấy ở aistudio.google.com/apikey (cùng khoá mà sync-vesinh-ai.mjs đang dùng).
 *
 *  KHÔNG lưu ảnh, KHÔNG ghi ảnh vào Sheet/Drive. Chỉ ghi 1 dòng đếm lượt (không có ảnh) để biết
 *  hạn mức đã dùng bao nhiêu.
 * ============================================================================================== */
/* Khoá Gemini. Ưu tiên Script Properties (đặt bằng datKhoaGemini() — không nằm trong mã nguồn);
   SV_KHOA_CUNG là đường dự phòng để bản deploy chạy được ngay sau clasp push. Bản git-safe LUÔN để
   trống chuỗi này; khoá thật chỉ sống trong .clasp-deploy/sa.js (đã gitignore, cùng chỗ với SECRET/PIN). */
/* var SV_KHOA_CUNG — 20/10 chuyển sang google-script.gs (mọi hằng bí mật ở tệp chính để deploy-gas chèn từ .env) */
var SV_TRAN_NGAY = 400;        // tổng lượt đọc tem/ngày (bậc miễn phí Gemini ~ dư sức cho kho)
var SV_TRAN_NGUOI = 120;       // lượt/ngày cho mỗi email
var SV_TRAN_ANH_B64 = 2600000; // ~1,9 MB base64 (client đã thu nhỏ còn ~200-400 KB)
/* TTL cờ "đang đọc" theo email: 60 s → 8 s (29/08/2026). Soi trang thật 3 tem liên tiếp: tem 2 gặp lượt AI
   TREO phía Google (model lite miễn phí quá tải trả 503 sau 25–100 s, UrlFetchApp không đặt được timeout) ⇒
   cờ giữ nguyên ⇒ tem 3 (nonce khác) bị "Đang đọc ảnh trước" ⇒ rớt xuống OCR ~10 s và ra SAI SKU (thẻ mẫu
   → cuộn vải 422423807). Một lượt AI lành về trong ≤6 s, lượt đua cùng nonce vẫn được cho đi, nên cờ chỉ
   cần sống 8 s để chặn "bấm 2 lần vì tưởng treo"; quá 8 s mà chưa xong = lượt trước đã treo, KHÔNG được lấy
   nó làm lý do chặn tem kế tiếp. */
var SV_DANG_TTL = 8000;
/* Mỗi model có quota miễn phí RIÊNG theo ngày → hết model trước thì tự tụt model sau.
   THỨ TỰ ĐỔI 19/08/2026 (chiều) — trước đó là "chuẩn trước, nhẹ sau", ĐO THẬT thì sai cả hai mặt:
     · `gemini-3.5-flash` (đứng đầu danh sách cũ) đang trả **429** ⇒ MỌI lượt đọc tem đều tốn một
       round-trip vô ích trước khi tụt model, và nếu cả chuỗi 429 thì thủ kho thấy "không có kết quả".
     · `gemini-2.5-flash-lite` trong chuỗi cũ trả **404** (tên model không còn dùng được) ⇒ thêm một
       round-trip vô ích nữa.
     · Đo thời gian đọc CÙNG một tem khó (nghiêng + mờ): `gemini-flash-lite-latest` **1,9-2,0 s**,
       `gemini-3.5-flash-lite` 1,6-3,0 s, `gemini-3.1-flash-lite` 2,2-4,3 s — và cả ba đều bóc ĐÚNG
       mã 8209948 + 18.0 CM + màu 366. Tức bản "lite" vừa nhanh hơn 2× vừa không kém ở việc này
       (việc của nó chỉ là ĐỌC CHỮ, không phải suy luận).
   ⇒ lite trước (nhanh + quota rộng), model to để sau làm dự phòng khi lite hết quota.
   `gemini-flash-lite-latest` là bút danh trỏ tới bản lite mới nhất nên không bị chết tên như 2.5. */
/* CHUỖI MODEL — XẾP THEO SỐ ĐO, và ĐO LẠI 21/08/2026 bằng `do-toc-do-tem.mjs` (cùng một ảnh tem):
     gemini-flash-lite-latest  1,2s · nghĩ 0 token      ← đọc chữ chỉ cần bản lite
     gemini-3.5-flash-lite     1,2s · nghĩ 0 token
     gemini-3.1-flash-lite     4,0s · nghĩ 0 token
     gemini-3.5-flash          7,7s · nghĩ 1.965 token   → 3,1s khi ép thinkingLevel='low'
     gemini-3.6-flash          6,4s · nghĩ 822 token     → 19,9s (!) ở lượt đo thứ hai, ĐÃ BỎ
     gemini-flash-latest      24,5s · nghĩ 261 token     → 503 quá tải, ĐÃ BỎ
     gemini-2.5-flash / gemini-2.0-flash → 404, TÊN ĐÃ CHẾT, ĐÃ BỎ
   Ba điều rút ra:
     ① bản `flash` thường NGHĨ trước khi trả nên chậm gấp 3-20 lần, mà việc ở đây chỉ là ĐỌC CHỮ;
     ② ĐUÔI 17,9s/28,5s ghi trong 5b.5 KHÔNG phải "jitter bí ẩn của Google" như đã đoán — nó là
        CHÍNH CHUỖI NÀY: hai model đầu 429 thì lượt đọc rơi xuống `gemini-flash-latest` 24,5 giây.
        Sửa chuỗi model rẻ hơn mọi mẹo phía client;
     ③ để tên chết trong chuỗi là mỗi lượt tụt bậc tốn thêm một round-trip vô ích.
   Chuỗi chốt: 3 bản `lite` (1,2-4,0s) + 1 bản flash ép nghĩ thấp làm chốt cuối. Hết cả 4 thì
   dashboard tự tụt xuống OCR miễn phí — thà đi lối đó còn hơn bắt người ta chờ 20-24 giây.
   Với model KHÔNG phải `lite` thì gửi kèm thinkingConfig.thinkingLevel='low' (API nhận; còn
   thinkingBudget:0 bị trả 400 INVALID_ARGUMENT — đã thử). */
var SV_MODELS = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash'];

var SV_PROMPT =
  'Bạn đang đọc ảnh MỘT TEM NHÃN của nhà cung cấp trong kho nguyên liệu may (chỉ may, nút/khuy, dây kéo, nhãn dệt, vải, dây thun).\n' +
  'Tem có hàng trăm quy cách khác nhau và KHÔNG theo khuôn nào: tem tròn dán lõi cuộn chỉ, tem bảng chữ nhật dán túi nút, tem dài dán cuộn dây kéo, tem in nhiệt, tem viết tay.\n' +
  'Ảnh có thể cong, nhăn, bọc nylon loá sáng, dính bụi, chụp nghiêng hoặc ngược.\n' +
  '\n' +
  'NHIỆM VỤ: trích xuất MỌI ký hiệu nhận dạng ĐỌC ĐƯỢC, phân theo 5 nhóm dưới đây. Tuyệt đối:\n' +
  '- KHÔNG suy diễn, KHÔNG bù thông tin không có trên tem, KHÔNG dịch, KHÔNG sửa chính tả của nhà cung cấp.\n' +
  '- Chữ nào không chắc thì vẫn ghi nguyên như thấy (bên dùng có công cụ khớp gần đúng).\n' +
  '- Mỗi phần tử là MỘT cụm ngắn, không phải cả câu.\n' +
  '\n' +
  'item_codes: mã hàng / mã model / mã nhà cung cấp / mã vạch dạng chữ-số (ví dụ JC01262, F9-5284, 8846295, CMOR-36, SAB-255LK3557-2, 422440680).\n' +
  'specs    : thông số kỹ thuật và kích thước (ví dụ Tex 27, 60/3, Tkt 120, 17mm, 38.0 CM, 20*58mm, 24L, #3, 170gsm).\n' +
  'colors   : mã màu và tên màu (ví dụ 345, #006, V8S41, TN050, 19-4117 TCX, Matt Silver, Hồng tro, Gunmetal).\n' +
  'brands   : thương hiệu / nhà cung cấp / tên loại hàng in trên tem (ví dụ YKK, MORITO, THESEUS IRISA, AVERY DENNISON, Phong Việt, zipper, button, thread).\n' +
  'others   : ký hiệu còn lại có thể hữu ích (số lô, số cuộn, ngày, số PO…).\n' +
  'raw_text : toàn bộ chữ đọc được, giữ thứ tự dòng, mỗi dòng cách nhau bằng " | ".\n' +
  'quality  : "ro" nếu chữ rõ; "mo" nếu mờ/loá/nghiêng phải đoán; "khong_doc_duoc" nếu hầu như không đọc được gì.';

/* ═════ CHỈ CHỮ THÔ (21/08/2026) — vì sao bỏ 5 mảng vai khỏi câu trả lời của model ═════
   Đo `do-toc-do-tem.mjs --model` (4 ảnh: 2 tem IN + 2 thẻ VIẾT TAY, mỗi biến thể 3 lượt):
     · khuôn CŨ (5 mảng vai + raw_text) : 166–414 token ra, p50 1,8s
     · khuôn NÀY (chỉ raw_text)         :  54–137 token ra, p50 1,2s
   Độ chính xác KHÔNG giảm: Top-1 của lõi vẫn ĐÚNG ở cả 4 ảnh, mã trên tem đọc ra y như cũ. Đúng
   như 5b.2 đã đo (đường C "AI chữ thô → tuVanBan" lập được mã 83% vs 75% của đường tin-vai-AI):
   việc XẾP VAI để lõi làm bằng bằng chứng của danh mục thì tốt hơn để model đoán, mà model đoán vai
   lại là phần token đắt nhất. `quality` cũng bỏ luôn — 5b.22 đã đo là vô dụng (ảnh mờ loá vẫn tự
   nhận "ro").  Đặt SV_CHI_CHU = false là quay về khuôn cũ, không phải sửa chỗ nào khác. */
var SV_CHI_CHU = true;
var SV_PROMPT_CHU =
  'Bạn đang đọc ảnh MỘT TEM NHÃN hoặc THẺ THÔNG TIN của kho nguyên liệu may (chỉ may, nút/khuy, dây kéo, nhãn dệt, vải, dây thun).\n' +
  'Chữ trên đó có thể IN BẰNG MÁY hoặc VIẾT TAY. Ảnh có thể cong, nhăn, bọc nylon loá sáng, dính bụi, chụp nghiêng hoặc ngược.\n' +
  '\n' +
  'NHIỆM VỤ DUY NHẤT: chép lại TOÀN BỘ chữ đọc được. Tuyệt đối KHÔNG suy diễn, KHÔNG bù thông tin không có trên tem, KHÔNG dịch, KHÔNG sửa chính tả của nhà cung cấp.\n' +
  'GIỮ NGUYÊN cặp "nhãn: giá trị" của biểu mẫu (ví dụ "Mã sản phẩm: CWHO0006", "Màu sắc: Xanh Tro") — bên dùng cần biết mã nào đứng sau nhãn nào.\n' +
  'Giữ thứ tự dòng, mỗi dòng cách nhau bằng " | ". Chữ nào không chắc thì vẫn ghi nguyên như thấy (bên dùng có công cụ khớp gần đúng).';
var SV_SCHEMA_CHU = { type: 'OBJECT', required: ['raw_text'], properties: { raw_text: { type: 'STRING' } } };

var SV_SCHEMA = {
  type: 'OBJECT',
  required: ['item_codes', 'specs', 'colors', 'brands', 'others', 'raw_text', 'quality'],
  properties: {
    item_codes: { type: 'ARRAY', items: { type: 'STRING' } },
    specs: { type: 'ARRAY', items: { type: 'STRING' } },
    colors: { type: 'ARRAY', items: { type: 'STRING' } },
    brands: { type: 'ARRAY', items: { type: 'STRING' } },
    others: { type: 'ARRAY', items: { type: 'STRING' } },
    raw_text: { type: 'STRING' },
    quality: { type: 'STRING', enum: ['ro', 'mo', 'khong_doc_duoc'] }
  }
};

/** Cài khoá Gemini vào Script Properties — dán khoá vào rồi CHẠY HÀM NÀY 1 LẦN trong editor. */
function datKhoaGemini() {
  var khoa = '';   // ← dán khoá aistudio.google.com/apikey vào đây, chạy hàm, rồi XOÁ lại khỏi mã
  if (!khoa) throw new Error('Chưa dán khoá vào biến `khoa` trong hàm datKhoaGemini().');
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', khoa);
  Logger.log('Đã lưu GEMINI_API_KEY (' + khoa.length + ' ký tự). Hãy xoá khoá khỏi mã nguồn.');
}
/** Kiểm nhanh trong editor: khoá có chưa, model nào còn quota. */
function testSkuVision() {
  var p = PropertiesService.getScriptProperties();
  Logger.log('GEMINI_API_KEY: ' + (p.getProperty('GEMINI_API_KEY') ? 'đã có' : 'CHƯA CÓ'));
  Logger.log('Đã dùng hôm nay: ' + (p.getProperty('sv_n_' + svNgay_()) || 0) + '/' + SV_TRAN_NGAY);
}

function svNgay_() { return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd'); }
/* Dọn khoá đếm của những ngày đã qua — không dọn thì Script Properties phình dần theo ngày */
function svDonCu_(p) {
  try {
    var nay = svNgay_(), all = p.getProperties();
    for (var k in all) {
      if (k.indexOf('sv_n_') !== 0) continue;
      var d = k.slice(5, 13);
      if (/^\d{8}$/.test(d) && d < nay) p.deleteProperty(k);
    }
  } catch (e) { /* dọn dẹp best-effort, không được làm hỏng lượt đọc tem */ }
}

/**
 * action = sku_vision — body: { email, mime, anh(base64 KHÔNG có tiền tố data:), nonce }
 * Trả: { status:'success', tokens:{item_codes,specs,colors,brands,others}, text, quality, model, ms }
 */
function skuVision_(d) {
  var t0 = new Date().getTime();
  var mail = String((d && d.email) || '').trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@hasaki\.vn$/.test(mail)) return { status: 'error', message: 'Cần email đúng định dạng ten@hasaki.vn.' };
  var b64 = String((d && d.anh) || '');
  if (!b64) return { status: 'error', message: 'Thiếu ảnh tem.' };
  if (b64.length > SV_TRAN_ANH_B64) return { status: 'error', message: 'Ảnh quá lớn — chụp lại hoặc để dashboard thu nhỏ trước khi gửi.' };
  var mime = String((d && d.mime) || 'image/jpeg');
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) mime = 'image/jpeg';

  var p = PropertiesService.getScriptProperties();
  /* Đọc MỘT lượt getProperties() (ảnh chụp dùng chung với tbOK_ vừa chạy ở doPost) thay 5 lượt
     getProperty rời — xem propsMemo_. Cờ "đang đọc" vẫn đọc TƯƠI bên trong lock ở dưới (đó là chốt
     chống bấm chồng, phải đọc ngay trước khi ghi). */
  var all = propsMemo_();
  var khoa = all.GEMINI_API_KEY || SV_KHOA_CUNG;
  if (!khoa) return { status: 'error', message: 'Apps Script chưa có khoá AI — chạy hàm datKhoaGemini() một lần (xem NHAN-DIEN-SKU.md).' };

  /* Cờ "ĐANG ĐỌC" theo email — chặn 2 lượt gửi CHỒNG NHAU (bấm 2 lần vì tưởng máy treo).
     · Cờ nằm ở Script Properties, KHÔNG phải CacheService: đo thật 18/08/2026, bắn 2 lượt cùng lúc
       thì CẢ HAI đều chạy, vì mỗi lượt là một execution riêng và cache chưa kịp lan sang nhau.
     · Script lock chỉ giữ trong lúc "kiểm rồi đặt cờ" (vài ms) rồi thả NGAY — không giữ suốt 3-7
       giây gọi Gemini, vì như thế là bắt người khác chờ oan.
     · Trần 60 giây để tự mở lại nếu lượt trước chết giữa đường; xong là xoá cờ nên quét liên tục
       nhiều cuộn KHÔNG phải chờ.
     Từ đây trở xuống, MỌI đường thoát đều phải gọi svMoCo_ — bỏ quên là khoá email đó 60 giây. */
  var kDang = 'sv_dang_' + mail, bayGio = new Date().getTime(), duocDi = true, daMoCo = false;
  var nonce = String((d && d.nonce) || '').slice(0, 80);
  var lock = LockService.getScriptLock(), coLock = false;
  try {
    coLock = lock.tryLock(3000);
    /* CỜ NAY GHI CẢ NONCE (21/08/2026). Bản cũ khoá theo EMAIL trong 60 giây nên nó chặn cả hai thứ
       mình CẦN cho phép:
         · lượt THỬ LẠI của dashboard khi chặng 2 của Apps Script trả trang HTML (client giữ nguyên
           nonce đúng theo thiết kế nonce-cache) — execution đầu còn đang chạy ⇒ lượt thử lại bị
           "Đang đọc ảnh trước" oan, tức chính cơ chế chống-lỗi-chập-chờn bị chốt bóp cổ;
         · lượt ĐUA (`dua:1`) mà dashboard bắn ở giây thứ 6 khi Google im lặng — xem 5b.26.
       Cùng NONCE = cùng MỘT tấm tem ⇒ cho đi. Khác nonce trong 60 giây = bấm 2 lần / 2 tem chồng
       nhau ⇒ vẫn chặn y như cũ. */
    var cu = String(p.getProperty(kDang) || ''), cat = cu.indexOf('|');
    var moc = Number(cat < 0 ? cu : cu.slice(0, cat)) || 0, nonceCu = cat < 0 ? '' : cu.slice(cat + 1);
    var cungTem = !!(nonce && nonce === nonceCu);
    if (moc && (bayGio - moc) < SV_DANG_TTL && !cungTem) duocDi = false;
    /* Lượt ĐUA / thử lại (cùng tem) KHÔNG làm tươi mốc cờ (29/08/2026): đo 6 tem liên tiếp, đua ở giây 6 làm
       tươi mốc ⇒ cờ sống thêm 6 s ⇒ tem kế tiếp vẫn bị "Đang đọc ảnh trước" dù TTL đã hạ còn 8 s. */
    else if (!cungTem) p.setProperty(kDang, String(bayGio) + '|' + nonce);
  } catch (eL) { duocDi = true; }   // chốt hỏng thì cho đi: thà tốn 1 lượt hơn chặn oan người đang làm
  finally { if (coLock) { try { lock.releaseLock(); } catch (eR) { /* đã thả */ } } }
  if (!duocDi) return { status: 'error', message: 'Đang đọc ảnh trước — chờ xong rồi bấm tiếp.' };

  try {
    /* Hạn mức ngày (tổng + theo người) — đọc từ ảnh chụp, không thêm RPC */
    var ngay = svNgay_(), kAll = 'sv_n_' + ngay, kMe = 'sv_n_' + ngay + '_' + mail, kChet = 'sv_chet_' + ngay;
    var nAll = Number(all[kAll] || 0), nMe = Number(all[kMe] || 0);
    if (nAll >= SV_TRAN_NGAY) return { status: 'error', message: 'Hết hạn mức đọc tem hôm nay (' + SV_TRAN_NGAY + ' ảnh) — gõ từ khoá tay giúp, mai lại đọc được.' };
    if (nMe >= SV_TRAN_NGUOI) return { status: 'error', message: 'Email này đã dùng ' + nMe + ' lượt đọc tem hôm nay (trần ' + SV_TRAN_NGUOI + ').' };

    var chet = {}; try { chet = JSON.parse(all[kChet] || '{}') || {}; } catch (eC0) { chet = {}; }
    /* LƯỢT ĐUA (dashboard bắn ở giây 6, `dua:1`) ĐI MODEL KHÁC (29/08/2026). Đo A/B 12 lượt sáng 29/08: model
       lite bậc 1 khi quá tải trả 503 SAU 25–70 GIÂY (UrlFetchApp không đặt được timeout) rồi mới tụt bậc —
       lượt đua cùng nonce đi y đường đó thì chỉ là xếp hàng sau cùng một model đang nghẽn. Nay lượt đua bắt
       đầu từ bậc 2: hai lượt song song hỏi HAI model khác nhau, client lấy lượt về trước. Không tốn thêm
       lượt nào so với trước (đua vốn đã bắn). */
    var kq = svGoiGemini_(b64, mime, khoa, chet, d && d.dua ? 1 : 0);
    if (kq.status !== 'success') return kq;

    if (nAll === 0) svDonCu_(p);
    /* MỘT lượt setProperties thay cho 3–4 lượt rời (đếm tổng · đếm người · model chết · mở cờ): cờ
       "đang đọc" mở bằng cách ghi '' — bên đọc coi '' là không có cờ — khỏi tốn thêm deleteProperty.
       Đo 29/08/2026: mỗi RPC Properties 30–60 ms, cả gói này bớt ~6–7 RPC ≈ 0,3 s cho mỗi lượt đọc tem. */
    var ghi = {}; ghi[kAll] = String(nAll + 1); ghi[kMe] = String(nMe + 1); ghi[kDang] = '';
    if (kq.chetDoi) ghi[kChet] = JSON.stringify(kq.chet || chet);
    delete kq.chet; delete kq.chetDoi;
    p.setProperties(ghi);
    daMoCo = true;
    kq.ms = new Date().getTime() - t0;
    kq.conLai = SV_TRAN_NGAY - (nAll + 1);
    return kq;
  } finally { if (!daMoCo) svMoCo_(p, kDang); }
}

/** Mở cờ "đang đọc" (gọi ở finally của mọi đường ra). Hỏng ở đây thì cờ tự hết sau 60 giây. */
function svMoCo_(p, kDang) {
  try { p.deleteProperty(kDang); } catch (e) { /* cờ tự hết sau 60s */ }
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════════
 *  ĐỌC CHỮ TRÊN TEM BẰNG OCR CỦA GOOGLE (action = sku_ocr) · 19/08/2026
 *  ---------------------------------------------------------------------------------------------
 *  Vì sao thêm đường này khi đã có Vision LLM: 19/08/2026 thủ kho báo "nhận diện toàn sai hoặc
 *  không có kết quả nào". Đo thật thì ra 2 nguyên nhân, và OCR chữa được cả hai:
 *    ① AI CHẾT LƯỢT — hết hạn mức mọi model (429) hoặc trả JSON sai khuôn (đo: 1/16 lượt) ⇒ thủ kho
 *      không có kết quả nào. OCR này KHÔNG dùng hạn mức Gemini: nó là chức năng chuyển ảnh → Google
 *      Docs của Drive (chính engine mà Google Dịch/Lens đang dùng), miễn phí theo tài khoản.
 *    ② AI GÁN VAI SAI — trả mã hàng vào ô "colors" nên lõi chấm mã 45% mất bằng chứng định danh.
 *      Đường này chỉ trả CHỮ THÔ, việc xếp vai để lõi trong trình duyệt làm (NDS_ENGINE.tuVanBan)
 *      và lấy bằng chứng từ chính danh mục SKU — không ai đoán hộ nữa.
 *
 *  CÁCH LÀM (không thêm hạ tầng, không xin IT — đúng luật của dự án):
 *    upload ảnh vào Drive kèm `ocrLanguage` và yêu cầu chuyển thành Google Docs → Drive tự OCR →
 *    export văn bản thuần → XOÁ file ngay. Dùng Drive REST v3 qua UrlFetchApp + ScriptApp
 *    .getOAuthToken(), KHÔNG cần bật Advanced Drive Service (scope `drive` đã có trong manifest).
 *
 *  ĐO THẬT 19/08/2026 (16 tem mô phỏng, nhãn cắt từ SKU thật):
 *    · đọc được 16/16 lượt (AI: 15/16) · 4,6–7,2 giây · KHÔNG tốn lượt AI nào
 *    · tem sạch/khó: ra đúng SKU y như AI. Tem RẤT KHÓ (chữ nhỏ + nhoè + nghiêng 13°): OCR đọc lệch
 *      vài ký tự ("Đen-580-AA" → "Ben-380-AA", "345" → "145") nên ra đúng MÃ mà lệch MÀU ⇒ vì vậy
 *      dashboard vẫn LEO THANG sang AI khi OCR không lập được mã, và cảnh báo khi các gợi ý chỉ
 *      khác nhau ở màu. OCR không thay AI; nó là tầng rẻ chạy trước và là lưới đỡ khi AI chết.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════ */
var SO_TRAN_NGAY = 2000;        // OCR không tốn hạn mức AI; trần chỉ để một máy hỏng không quét vô hạn
var SO_TRAN_NGUOI = 400;
var SO_TRAN_ANH_B64 = 2600000;  // ~1,9 MB base64 (client đã thu nhỏ còn ~200-500 KB)
var SO_DANG_TTL = 15000;        // cờ "đang đọc" OCR: một lượt OCR lành ~7,5 s (xem SV_DANG_TTL — 60 s cũ chặn oan tem kế tiếp)

/**
 * action = sku_ocr — body: { email, mime, anh(base64 KHÔNG có tiền tố data:), lang, nonce }
 * Trả: { status:'success', text, ms, nguon:'drive-ocr', conLai }
 */
function skuOcr_(d) {
  var t0 = new Date().getTime();
  var mail = String((d && d.email) || '').trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@hasaki\.vn$/.test(mail)) return { status: 'error', message: 'Cần email đúng định dạng ten@hasaki.vn.' };
  var b64 = String((d && d.anh) || '');
  /* CỬA CHẨN ĐOÁN: gọi không kèm ảnh + chuanDoan=1 thì trả về chặng/thời gian của lượt OCR gần
     nhất. Cần vì khi execution lâu, Apps Script trả trang HTML ở chặng 2 và client không nhận
     được con số nào để biết chậm ở đâu. */
  /* 29/08/2026: đọc từ ảnh chụp Properties (tbOK_ vừa nạp → 0 RPC thêm) + trả `coKhoaAI` để tab cảnh báo
     ngay lúc hâm nóng khi máy chủ KHÔNG có khoá Gemini (ca 24→29/08: deploy làm rơi khoá, 5 ngày không ai thấy
     vì tab vẫn "ra kết quả" bằng OCR). */
  if (!b64 && d && d.chuanDoan) { var pm = propsMemo_(); return { status: 'success', chanCuoi: String(pm.so_chan_cuoi || 'chưa có lượt nào'), tranNgay: SO_TRAN_NGAY, coKhoaAI: !!(pm.GEMINI_API_KEY || SV_KHOA_CUNG) }; }
  if (!b64) return { status: 'error', message: 'Thiếu ảnh tem.' };
  if (b64.length > SO_TRAN_ANH_B64) return { status: 'error', message: 'Ảnh quá lớn — để dashboard thu nhỏ trước khi gửi.' };
  var mime = String((d && d.mime) || 'image/jpeg');
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) mime = 'image/jpeg';
  var lang = String((d && d.lang) || 'vi').replace(/[^a-z\-]/gi, '').slice(0, 8) || 'vi';

  var p = PropertiesService.getScriptProperties();
  /* Cờ "đang đọc" theo email — y như sku_vision (xem ghi chú ở đó: phải nằm ở Script Properties,
     không phải CacheService, và MỌI đường thoát đều đi qua svMoCo_). */
  var kDang = 'so_dang_' + mail, bayGio = new Date().getTime(), duocDi = true;
  var nonceO = String((d && d.nonce) || '').slice(0, 80);
  var lock = LockService.getScriptLock(), coLock = false;
  try {
    coLock = lock.tryLock(3000);
    /* Cùng nonce = cùng tấm tem (lượt thử lại / lượt đua) thì CHO ĐI — xem ghi chú dài ở sku_vision. */
    var cuO = String(p.getProperty(kDang) || ''), catO = cuO.indexOf('|');
    var mocO = Number(catO < 0 ? cuO : cuO.slice(0, catO)) || 0, nonceCuO = catO < 0 ? '' : cuO.slice(catO + 1);
    if (mocO && (bayGio - mocO) < SO_DANG_TTL && !(nonceO && nonceO === nonceCuO)) duocDi = false;
    else p.setProperty(kDang, String(bayGio) + '|' + nonceO);
  } catch (eL) { duocDi = true; }
  finally { if (coLock) { try { lock.releaseLock(); } catch (eR) { /* đã thả */ } } }
  if (!duocDi) return { status: 'error', message: 'Đang đọc ảnh trước — chờ xong rồi bấm tiếp.' };

  try {
    var ngay = svNgay_(), kAll = 'so_n_' + ngay, kMe = 'so_n_' + ngay + '_' + mail;
    var nAll = Number(p.getProperty(kAll) || 0), nMe = Number(p.getProperty(kMe) || 0);
    if (nAll >= SO_TRAN_NGAY) return { status: 'error', message: 'Hết trần đọc chữ hôm nay (' + SO_TRAN_NGAY + ' ảnh).' };
    if (nMe >= SO_TRAN_NGUOI) return { status: 'error', message: 'Máy này đã dùng ' + nMe + ' lượt đọc chữ hôm nay (trần ' + SO_TRAN_NGUOI + ').' };

    var kq = soDriveOcr_(b64, mime, lang);
    if (kq.status !== 'success') return kq;

    if (nAll === 0) soDonCu_(p);
    p.setProperty(kAll, String(nAll + 1));
    p.setProperty(kMe, String(nMe + 1));
    kq.ms = new Date().getTime() - t0;
    kq.conLai = SO_TRAN_NGAY - (nAll + 1);
    return kq;
  } finally { svMoCo_(p, kDang); }
}

/** Dọn khoá đếm của những ngày đã qua (giống svDonCu_, khoá riêng để 2 đường không đè nhau). */
function soDonCu_(p) {
  try {
    var nay = svNgay_(), all = p.getProperties();
    for (var k in all) {
      if (k.indexOf('so_n_') !== 0) continue;
      var ng = k.slice(5, 13);
      if (/^\d{8}$/.test(ng) && ng < nay) p.deleteProperty(k);
    }
  } catch (e) { /* dọn dẹp best-effort */ }
}

/**
 * Ảnh → CHỮ bằng OCR của Google Drive. 3 chặng: nạp-ảnh-kèm-chuyển-đổi → export text → xoá file.
 *
 * ⚠ NẠP ẢNH BẰNG "RESUMABLE", KHÔNG GHÉP MULTIPART BẰNG TAY (sửa 19/08/2026 sau khi đo).
 *   Bản đầu ghép thân multipart trong JS: `dau.concat(bytes).concat(cuoi)` rồi `newBlob(...).getBytes()`.
 *   Mỗi phần tử của mảng phải đi qua cầu JS↔Java hai lượt, nên một ảnh tem 300–500 KB thành mảng
 *   nửa triệu phần tử — đo thật: execution 35–40 GIÂY, và execution dài chính là thứ làm Google trả
 *   404 ở chặng lấy nội dung (đã ghi trong hồ sơ sự cố GAS 12/08/2026).
 *   Đường resumable chỉ gửi JSON ở lượt 1 rồi PUT NGUYÊN Blob ở lượt 2 — Blob là kiểu GAS xử lý
 *   thẳng bằng Java, không phải dựng mảng số nào.
 *
 * ⚠ File tạm PHẢI xoá ở mọi đường ra: nó nằm trong Drive của chủ GAS, để lại là rác lớn dần và
 *   đúng cái mà luật "không chia sẻ file sang email công ty" muốn tránh (file không còn thì không
 *   có gì để lỡ chia sẻ).
 */
function soDriveOcr_(b64, mime, lang) {
  var token = ScriptApp.getOAuthToken(), H = { Authorization: 'Bearer ' + token };
  var anh;
  try { anh = Utilities.newBlob(Utilities.base64Decode(b64), mime, 'nds-tem'); }
  catch (e) { return { status: 'error', message: 'Ảnh gửi lên không đúng định dạng base64.' }; }

  var id = '', mUp = 0, mEx = 0, mMoc = new Date().getTime(), chan = 'mo-phien';
  try {
    /* Chặng 1a: mở phiên nạp (chỉ JSON, không có ảnh) — Drive trả URL phiên ở header Location */
    var r1 = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id&ocrLanguage=' + encodeURIComponent(lang), {
      method: 'post', contentType: 'application/json; charset=UTF-8', headers: H,
      payload: JSON.stringify({ name: 'nds-ocr-tam', mimeType: 'application/vnd.google-apps.document' }),
      muteHttpExceptions: true
    });
    if (r1.getResponseCode() !== 200) return { status: 'error', message: 'Drive không mở được phiên nạp ảnh (HTTP ' + r1.getResponseCode() + ').' };
    var hd = r1.getAllHeaders(), noi = hd.Location || hd.location || '';
    if (!noi) return { status: 'error', message: 'Drive không trả URL phiên nạp ảnh.' };

    /* Chặng 1b: đẩy nguyên Blob ảnh vào phiên — Drive OCR ngay khi chuyển sang Google Docs */
    chan = 'nap-anh';
    var r2 = UrlFetchApp.fetch(String(noi), { method: 'put', contentType: mime, headers: H, payload: anh, muteHttpExceptions: true });
    mUp = new Date().getTime() - mMoc;
    var c2 = r2.getResponseCode(), t2 = r2.getContentText();
    if (c2 !== 200 && c2 !== 201) return { status: 'error', message: 'Drive không nhận ảnh (HTTP ' + c2 + '): ' + String(t2).slice(0, 140) };
    id = String((JSON.parse(t2) || {}).id || '');
    if (!id) return { status: 'error', message: 'Drive không trả về id file OCR.' };

    /* Chặng 2: lấy chữ đã OCR ra dạng văn bản thuần */
    chan = 'lay-chu';
    var mocEx = new Date().getTime();
    var r3 = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id + '/export?mimeType=text/plain', { headers: H, muteHttpExceptions: true });
    mEx = new Date().getTime() - mocEx;
    if (r3.getResponseCode() !== 200) return { status: 'error', message: 'Không lấy được chữ đã OCR (HTTP ' + r3.getResponseCode() + ').' };
    var chu = String(r3.getContentText() || '');
    /* Drive đắp một dải "____" cho đường viền của tem và có BOM ở đầu — cắt đi kẻo lõi đối soát
       coi đó là từ khoá. */
    chu = chu.replace(/\uFEFF/g, '').replace(/[_]{3,}/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!chu) return { status: 'error', message: 'OCR không thấy chữ nào trên ảnh — chụp gần hơn, đủ sáng, giữ tem phẳng.' };
    return { status: 'success', nguon: 'drive-ocr', text: chu.slice(0, 4000), msUp: mUp, msExport: mEx };
  } catch (e3) {
    return { status: 'error', message: 'Lỗi khi OCR (' + chan + '): ' + e3.message };
  } finally {
    /* Ghi lại chặng + thời gian của lượt vừa rồi để CHẨN ĐOÁN được khi chặng 2 của Apps Script trả
       trang HTML (lúc đó client không nhận được số nào). Đọc bằng: action=sku_ocr + chuanDoan=1. */
    try {
      PropertiesService.getScriptProperties().setProperty('so_chan_cuoi',
        chan + ' · nạp ' + mUp + 'ms · lấy chữ ' + mEx + 'ms · tổng ' + (new Date().getTime() - mMoc) + 'ms · ' +
        Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'HH:mm:ss'));
    } catch (e6) { /* không ghi được cũng không sao */ }
    if (id) {
      try { UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id, { method: 'delete', headers: H, muteHttpExceptions: true }); }
      catch (e4) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e5) { /* đành để Drive dọn */ } }
    }
  }
}

/** Kiểm nhanh trong editor: khoá/hạn mức + chặng của lượt OCR gần nhất.
 *  KHÔNG tự tải ảnh từ site ngoài (mã production không nên gọi ra internet ngoài Google) — muốn đọc
 *  thử một tem thật thì chạy `node qc-sku-ocr-live.mjs`, nó tự dựng ảnh rồi gọi đúng cổng này. */
function testSkuOcr() {
  var p = PropertiesService.getScriptProperties();
  Logger.log('Đã dùng hôm nay: ' + (p.getProperty('so_n_' + svNgay_()) || 0) + '/' + SO_TRAN_NGAY);
  Logger.log('Lượt OCR gần nhất: ' + (p.getProperty('so_chan_cuoi') || 'chưa có lượt nào'));
}

/** Gọi Gemini theo chuỗi model dự phòng; 429/503 = hết quota/quá tải → tụt model sau. */
function svGoiGemini_(b64, mime, khoa, chetCoSan, batDauTu) {
  var loiCuoi = '';
  /* NHỚ MODEL ĐÃ CHẾT TRONG NGÀY — model hết quota (429) hoặc chết tên (404) thì bỏ qua luôn đến
     hết ngày, khỏi tốn round-trip cho mọi lượt đọc tem sau đó (đo 19/08: model đầu danh sách 429 làm
     mỗi lượt đọc tem tốn thêm ~1 giây vô ích). Khoá theo NGÀY nên hôm sau quota mới lại được thử. */
  var pp = PropertiesService.getScriptProperties();
  var kChet = 'sv_chet_' + svNgay_();
  /* `chetCoSan` (29/08/2026): skuVision_ đã đọc bảng model chết trong ảnh chụp Properties → đưa vào
     đây để khỏi tốn thêm 1 RPC; lượt THÀNH CÔNG khi đó không tự ghi kChet mà trả `chet`/`chetDoi` cho
     skuVision_ gộp vào một lượt setProperties. Gọi không có tham số thứ 4 vẫn chạy y như cũ. */
  var chet = chetCoSan || {};
  if (!chetCoSan) { try { chet = JSON.parse(pp.getProperty(kChet) || '{}') || {}; } catch (eC) { chet = {}; } }
  var doiChet = false;
  /* `batDauTu` = bậc xuất phát (lượt đua = 1). Xoay vòng: hết chuỗi thì quay lại các bậc đã bỏ qua ở đầu,
     nên lượt đua vẫn có đủ mọi model dự phòng, chỉ khác THỨ TỰ. */
  var thuTu = [];
  for (var t0i = 0; t0i < SV_MODELS.length; t0i++) thuTu.push((t0i + (Number(batDauTu) || 0)) % SV_MODELS.length);
  for (var ti = 0; ti < thuTu.length; ti++) {
    var i = thuTu[ti];
    if (chet[SV_MODELS[i]]) continue;
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + SV_MODELS[i] + ':generateContent?key=' + encodeURIComponent(khoa);
    var payload = {
      contents: [{ role: 'user', parts: [{ text: SV_CHI_CHU ? SV_PROMPT_CHU : SV_PROMPT }, { inline_data: { mime_type: mime, data: b64 } }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SV_CHI_CHU ? SV_SCHEMA_CHU : SV_SCHEMA, maxOutputTokens: 2048, temperature: 0 }
    };
    /* Bản `flash` thường nghĩ 800–2.000 token trước khi trả (đo: 6,4s / 7,7s / 24,5s) — hạ mức nghĩ
       xuống thấp nhất mà API nhận. Bản `lite` vốn nghĩ 0 token nên không gửi gì thêm. */
    if (SV_MODELS[i].indexOf('lite') < 0) payload.generationConfig.thinkingConfig = { thinkingLevel: 'low' };
    var tModel = new Date().getTime();
    var r;
    try {
      r = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
    } catch (e) {
      loiCuoi = 'không gọi được Gemini: ' + e.message;
      continue;
    }
    var code = r.getResponseCode(), txt = r.getContentText();
    if (code === 429 || code === 404) {          // hết quota trong ngày, hoặc tên model đã chết
      chet[SV_MODELS[i]] = code; doiChet = true;
      loiCuoi = 'HTTP ' + code + ' ở ' + SV_MODELS[i]; continue;
    }
    if (code === 503) { loiCuoi = 'HTTP 503 (quá tải) ở ' + SV_MODELS[i]; continue; }   // tạm thời, KHÔNG ghi chết
    if (code !== 200) return { status: 'error', message: 'AI trả HTTP ' + code + ': ' + String(txt).slice(0, 200) };
    var j; try { j = JSON.parse(txt); } catch (e2) { return { status: 'error', message: 'AI trả dữ liệu không đọc được.' }; }
    var cand = (j.candidates || [])[0];
    if (!cand) return { status: 'error', message: 'AI không trả kết quả (có thể bị chặn nội dung).' };
    if (/SAFETY|PROHIBITED/i.test(String(cand.finishReason || ''))) return { status: 'error', message: 'AI từ chối đọc ảnh này.' };
    var chu = '';
    ((cand.content && cand.content.parts) || []).forEach(function (x) { chu += (x.text || ''); });
    var o; try { o = JSON.parse(chu); } catch (e3) { return { status: 'error', message: 'AI trả JSON sai khuôn.' }; }
    var lay = function (k) { return (o[k] || []).map(function (x) { return String(x).slice(0, 60); }).slice(0, 40); };
    if (doiChet && !chetCoSan) { try { pp.setProperty(kChet, JSON.stringify(chet)); } catch (eS) { /* nhớ được thì tốt, không thì thôi */ } }
    return {
      status: 'success', model: SV_MODELS[i], msModel: new Date().getTime() - tModel, bacModel: i + 1, chet: chet, chetDoi: doiChet,
      quality: String(o.quality || ''),
      text: String(o.raw_text || '').slice(0, 4000),
      /* Ở chế độ CHỈ CHỮ THÔ thì 5 mảng này rỗng — dashboard vẫn chạy đúng vì `ndsNhanKetQua` luôn
         tách raw_text bằng `tuVanBan` (bằng chứng của danh mục), mảng vai chỉ là phần cộng thêm. */
      tokens: { item_codes: lay('item_codes'), specs: lay('specs'), colors: lay('colors'), brands: lay('brands'), others: lay('others') }
    };
  }
  if (doiChet) { try { pp.setProperty(kChet, JSON.stringify(chet)); } catch (eS2) { /* best-effort */ } }
  return { status: 'error', message: 'Tất cả model AI miễn phí đều đang hết hạn mức (' + loiCuoi + ') — dashboard sẽ tự thử OCR của Google, hoặc gõ mã trên tem.' };
}

/* ---------- PC LOGIN AGENT (A8) ---------- */
function apiUpsertPcLogin(duLieu) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('A8-PC-DANGNHAP');
    if (!sheet) {
      sheet = ss.insertSheet('A8-PC-DANGNHAP');
      sheet.appendRow(['Hostname', 'IP', 'T�i kho?n WMS', 'T�n NV', 'User Windows', 'Th?i gian c?p nh?t']);
      sheet.setFrozenRows(1);
    }
    
    var hostname = String(duLieu.hostname || '').toUpperCase();
    var sub = String(duLieu.wmsSub || '');
    var ip = String(duLieu.ip || '');
    var winUser = String(duLieu.winUser || '');
    var timestamp = String(duLieu.timestamp || '');
    
    if (!hostname) return phanHoiJson({ status: 'error', message: 'Thieu hostname' });
    
    // 1. Tra danh ba tu sheet NHAN-SU de lay Ten NV
    var tenNv = sub;
    if (sub && PRIVATE_SHEET_ID) {
       try {
         var pss = SpreadsheetApp.openById(PRIVATE_SHEET_ID);
         var pSheet = pss.getSheetByName('NHAN-SU');
         if (pSheet) {
           var data = pSheet.getDataRange().getValues();
           var idxSub = data[0].indexOf('ID'); // hoac USER_ID
           var idxTen = data[0].indexOf('NAME'); // hoac STAFF_NAME
           if (idxSub > -1 && idxTen > -1) {
             for (var i = 1; i < data.length; i++) {
               if (String(data[i][idxSub]) === sub) {
                 tenNv = String(data[i][idxTen]);
                 break;
               }
             }
           }
         }
       } catch(e) {}
    }
    
    // 2. Tim xem hostname nay da co trong tab chua
    var data = sheet.getDataRange().getValues();
    var foundRow = -1;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0]).toUpperCase() === hostname) {
        foundRow = r + 1; // index 1-based cua Spreadsheet
        break;
      }
    }
    
    var rowData = [hostname, ip, sub, tenNv, winUser, timestamp];
    
    if (foundRow > -1) {
      // Ghi de dong hien tai
      sheet.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      // Them dong moi
      sheet.appendRow(rowData);
    }
    
    return phanHoiJson({ status: 'success' });
  } catch(e) {
    return phanHoiJson({ status: 'error', message: e.toString() });
  }
}
