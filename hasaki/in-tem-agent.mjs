/**
 * in-tem-agent.mjs — IN TEM SKU RA MÁY IN TEM CỦA KHO, KHÔNG CẦN AI THAO TÁC Ở MÁY IN.
 * ============================================================================================
 *  Kịch bản (chốt 20/08/2026): trên dashboard chọn SKU → số lượng → mẫu tem → bấm **Xác nhận in**
 *  → máy in nhả tem ngay. Không mở BarTender, không hộp thoại in, không ai ngồi trước máy in.
 *
 *  VÌ SAO PHẢI CÓ FILE NÀY: máy in TSC PE200 cắm USB vào máy khác, mà trình duyệt không có API nào
 *  nói được với máy in (đã đo 20/08: web thuần không liệt kê nổi máy in; `http://127.0.0.1` bị
 *  Private Network Access chặn; Android/iOS không hiểu máy in share kiểu Windows). Nên phải có một
 *  tiến trình chạy nền — chính là file này. Nó chạy trên máy trạm (đã chứng minh in raw được qua
 *  máy in share), nên máy cắm máy in không cần cài gì thêm.
 *
 *  BỐN QUYẾT ĐỊNH KỸ THUẬT, tất cả rút ra từ tem in thử thật ngày 20/08/2026:
 *  ① **TSPL raw, không in qua driver.** Lệnh TSPL mang theo luôn khổ giấy (`SIZE`) nên không phụ
 *     thuộc khổ trong driver — mà driver của queue đó đang để 104 × 152 mm, lệch hoàn toàn.
 *  ② **Một trang = MỘT HÀNG GIẤY = 2 con tem.** Giấy là decal 2 tem/hàng; máy in chỉ dò khe NGANG
 *     giữa các hàng nên coi cả hàng là một nhãn. Lần in đầu khai khổ một con tem → dữ liệu tràn qua
 *     khe sang tem phải. Khe ngang thật **3mm**; khai 2mm thì lệch dần rồi in đè hàng dưới.
 *  ③ **Cả con tem là MỘT ảnh, dựng từ `PR_TEM.svgTem` của dashboard.** Nhờ vậy tem in ra giống bản
 *     xem trước trong pop-up **100%** — trước đây pop-up dựng bằng HTML/CSS còn máy in nhận TSPL, hai
 *     đường dựng khác nhau thì không cách nào giống nhau. Mã vạch cũng nằm trong ảnh đó, module được
 *     ghim về số nguyên dot để không mất độ nét.
 *  ④ **Siêu mẫu ×3 rồi mới threshold.** Đầu in 203 dpi + ảnh 1 bit: nét mảnh hơn một điểm in là mất
 *     hẳn (tem in thử có dòng chân đọc không nổi). Dựng lớn gấp 3 → thu nhỏ lanczos → threshold.
 *
 *  CÁCH DÙNG
 *    node in-tem-agent.mjs --thu "422430797x2"                # dựng .tspl + ảnh xem trước, KHÔNG in
 *    node in-tem-agent.mjs --in  "422430797x2,422322192"
 *    node in-tem-agent.mjs --dich-vu                          # chạy nền, quét hàng đợi (cần GAS)
 *    tuỳ chọn: --mau t40x60 · --may "<tên máy in>" · --gap 3 · --dam 10 · --lech 2
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import "dotenv/config";                 // đọc hasaki/.env — nơi giữ APPSCRIPT_URL + APPSCRIPT_KEY

const DIR = path.dirname(fileURLToPath(import.meta.url));
const F_HTML = path.join(DIR, "..", "factory", "index.html");
const TMP = path.join(os.tmpdir(), "audit-factory-in-tem");
fs.mkdirSync(TMP, { recursive: true });
const NL = String.fromCharCode(13) + String.fromCharCode(10);   // CRLF của lệnh TSPL

/* ───────── 1. LẤY LÕI TEM TỪ CHÍNH DASHBOARD ─────────
   Cắt khối `PR-TEM` trong factory/index.html — cùng bản mã với bản chạy trên trang, nên khổ tem,
   bố cục, mã vạch và cách chia hàng không thể lệch giữa "xem trước" và "tem ra khỏi máy in". */
const html = fs.readFileSync(F_HTML, "utf8");
const i1 = html.indexOf("/*<PR-TEM>*/"), i2 = html.indexOf("/*</PR-TEM>*/");
if (i1 < 0 || i2 < 0) { console.error("✗ Không thấy mốc PR-TEM trong factory/index.html"); process.exit(2); }
const T = new Function(html.slice(i1, i2) + "\n return PR_TEM;")();

const DOT = 8;                                  // 203 dpi = 8 dot/mm (TSC PE200)
const mm2dot = (mm) => Math.round(mm * DOT);
const SIEU = 3;                                 // siêu mẫu khi render (xem ghi chú ④)

/* ───────── 2. MỘT CON TEM → ẢNH 1 BIT ───────── */
async function anhTem(r, maMau) {
  const m = T.mau(maMau);
  const W = mm2dot(m.w), H = mm2dot(m.h);
  /* Gọi qua `ve()` của MẪU, không gọi `svgTem()` trực tiếp: mọi tuỳ chọn riêng của từng khổ tem
     (dịch trái 2mm, cỡ chữ, lề) nằm trong mẫu — gọi tắt là mất chúng. Bẫy này đã cắn thật: bản in
     20/08/2026 không được dịch trái vì agent gọi tắt, trong khi pop-up thì có. */
  const svg = r._dot
    ? T.svgTemDot({ nguoi: r.nguoi, luc: r.luc, soTem: r.soTem, soSku: r.soSku }, maMau)
    : T.mau(maMau).ve({ sku: r.sku, pn: r.pn, sl: r.sl, ngay: r.ngay });
  const raw = await sharp(Buffer.from(svg), { density: 72 * SIEU })
    .resize(W, H, { kernel: "lanczos3", fit: "fill" })
    .greyscale().threshold(170).raw().toBuffer({ resolveWithObject: true });
  return { raw, W, H, svg };
}
/** Ảnh xám → khối bit của lệnh BITMAP (1 = trắng, 0 = đen; mỗi byte 8 điểm ngang, MSB bên trái).
 *  `boQuaTrai` = số điểm cắt bỏ ở rìa trái, dùng khi phải dịch nội dung ra ngoài mép giấy. */
function bitmapTSPL(raw, boQuaTrai) {
  const { width, height } = raw.info, d = raw.data;
  const bo = Math.max(0, boQuaTrai | 0), w = Math.max(1, width - bo);
  const wByte = Math.ceil(w / 8), out = Buffer.alloc(wByte * height, 0xff);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < w; x++) {
      if (d[y * width + x + bo] < 128) out[y * wByte + (x >> 3)] &= ~(0x80 >> (x & 7));
    }
  }
  return { buf: out, wByte, height, rong: w };
}

/* ───────── 3. DỰNG LỆNH TSPL CHO MỘT HÀNG GIẤY ───────── */
async function tsplHang(hang, maMau) {
  const kt = T.khoTrang(maMau), m = kt.tem;
  const dau =
    "SIZE " + kt.w + " mm," + kt.h + " mm" + NL +
    /* ĐỦ ĐƠN VỊ cả hai tham số: viết "GAP 3 mm, 0" (thiếu đơn vị số thứ hai) thì có máy in bỏ cả
       dòng và giữ khe học từ lần trước — im lặng, rồi tem lệch dần. */
    "GAP " + GAP_MM + " mm,0 mm" + NL +
    "DIRECTION 1" + NL + "REFERENCE 0,0" + NL + "DENSITY " + DENSITY + NL + "SPEED 3" + NL + "CLS" + NL;
  const out = [Buffer.from(dau, "latin1")];
  for (let c = 0; c < kt.cot; c++) {
    const r = hang[c];
    if (!r) continue;                            // ô trống: chừa hẳn, không in gì
    /* DỊCH TRÁI đã làm NGAY TRONG SVG (xem `lechMm` của mẫu tem trong lõi PR_TEM), nên ở đây chỉ
       việc đặt ảnh vào đúng ô của nó. Bản trước dịch bằng cách CẮT ảnh — cách đó xoá luôn vùng
       trắng đầu mã vạch của con tem bên trái nên máy quét không đọc được (lỗi thật 20/08/2026). */
    const x = mm2dot(c * (m.w + kt.khe));
    const a = await anhTem(r, maMau);
    const bm = bitmapTSPL(a.raw, 0);
    out.push(Buffer.from("BITMAP " + x + ",0," + bm.wByte + "," + bm.height + ",0,", "latin1"));
    out.push(bm.buf);
    out.push(Buffer.from(NL, "latin1"));
  }
  out.push(Buffer.from("PRINT 1,1" + NL, "latin1"));
  return Buffer.concat(out);
}

/** Ảnh xem trước MỘT HÀNG GIẤY — ghép từ CHÍNH ảnh sẽ gửi máy in, không có chỗ nào để lệch. */
async function anhXemTruoc(hang, maMau, ra) {
  const kt = T.khoTrang(maMau), m = kt.tem;
  const W = mm2dot(kt.w), H = mm2dot(kt.h), lop = [];
  for (let c = 0; c < kt.cot; c++) {
    if (!hang[c]) continue;
    const a = await anhTem(hang[c], maMau);
    const png = await sharp(a.raw.data, {
      raw: { width: a.raw.info.width, height: a.raw.info.height, channels: 1 },
    }).png().toBuffer();
    lop.push({ input: png, top: 0, left: mm2dot(c * (m.w + kt.khe)) });
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: "#fff" } })
    .composite(lop).png().toFile(ra);
}

/* ───────── 4. GỬI RAW QUA SPOOLER (có TỰ CHỮA) ─────────
   Ba kiểu hỏng đã gặp thật ngày 20/08/2026, và cách agent tự xử thay vì bắt người vào bấm:
     · spooler bên máy in vừa khởi động lại  -> kết nối máy in phía máy trạm thành "mồ côi", mọi lệnh
       in trả về `LOI OpenPrinter 1722` / `ServerOffline`. Vá: NỐI LẠI queue rồi thử lại.
     · máy in vừa bật, spooler chưa kịp sẵn sàng -> thử lại sau vài giây là được.
     · máy in mất hẳn khỏi danh sách (ai đó xoá) -> tự `Add-Printer -ConnectionName`.
   Thử tối đa 3 lượt, giãn 3s → 6s; hết 3 lượt vẫn lỗi thì TRẢ VỀ nguyên văn mã lỗi để tầng trên
   (dashboard) nói thẳng cho người bấm, chứ không im lặng coi như đã in. */
const QUEUE_SHARE = "\\\\Desktop-je75k38\\TSC PE200(1)";
function psRun(cmd) {
  try { return execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
    { encoding: "utf8", windowsHide: true }).trim(); }
  catch (e) { return "LOI: " + String(e.message || e).slice(0, 200); }
}
function noiLaiQueue() {
  return psRun("try { Add-Printer -ConnectionName '" + QUEUE_SHARE + "' -ErrorAction Stop; 'da noi lai' } catch { $_.Exception.Message }");
}
function guiRawMotLuot(buf, mayIn) {
  const f = path.join(TMP, "tem-" + Date.now() + ".tspl");
  fs.writeFileSync(f, buf);
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(DIR, "_IN-RAW.ps1"), "-File", f];
  if (mayIn) args.push("-Printer", mayIn);
  let kq;
  try { kq = execFileSync("powershell", args, { encoding: "utf8", windowsHide: true }).trim(); }
  catch (e) { kq = "LOI goi _IN-RAW.ps1: " + String(e.message || e).slice(0, 160); }
  try { fs.unlinkSync(f); } catch {}
  return kq;
}
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
async function guiRaw(buf, mayIn) {
  let kq = guiRawMotLuot(buf, mayIn);
  for (let lan = 1; lan <= 2 && /^LOI/i.test(kq); lan++) {
    /* 1722 = RPC server unavailable (spooler bên kia vừa restart / chưa sẵn sàng) — nối lại rồi thử tiếp */
    const chua = noiLaiQueue();
    console.log("     ⟳ máy in không nhận (" + kq.slice(0, 60) + ") — nối lại queue: " + chua.slice(0, 60));
    await nghi(lan * 3000);
    kq = guiRawMotLuot(buf, mayIn);
  }
  return kq;
}

/* ───────── 5. HÀNG ĐỢI IN (chế độ --dich-vu) ─────────
   Cả hai đầu chỉ gọi RA NGOÀI nên không cần mở cổng, không cần cùng mạng: dashboard ghi lệnh vào tab
   `IN-TEM-CHO` qua GAS, agent này quét lấy rồi in, xong thì báo lại trạng thái.
   Ba điều đã tính trước, vì cả ba đều từng xảy ra thật:
     · GAS trả HTML thay vì JSON (sự cố 12/08/2026) -> đọc thô rồi thử lại, không để văng.
     · máy in chết giữa đợt -> `guiRaw` tự nối lại queue 3 lượt; hết lượt thì báo `loi` kèm nguyên văn
       để dashboard nói cho người bấm, KHÔNG im lặng coi như đã in.
     · nhiều người cùng gửi -> GAS trả cờ `nhieuNguoi`, lúc đó mỗi đợt được in kèm một tem thông báo
       (ai gửi · lúc nào · bao nhiêu tem) để không ai nhặt lẫn tem của người khác.
*/
const GAS_URL = process.env.APPSCRIPT_URL || "";
const GAS_KEY = process.env.APPSCRIPT_KEY || "";

async function goiGas(body) {
  let cuoi = "";
  for (let i = 0; i < 2; i++) {
    if (i) await nghi(900);
    try {
      const r = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body),
      });
      const t = (await r.text()).trim();
      if (t.startsWith("{") || t.startsWith("[")) return JSON.parse(t);
      cuoi = /^<!DOCTYPE|^<html/i.test(t) ? "Apps Script trả về HTML" : "phản hồi lạ: " + t.slice(0, 60);
    } catch (e) { cuoi = String(e.message || e); }
  }
  throw new Error(cuoi || "không gọi được Apps Script");
}

async function inMotLenh(lenh) {
  const conTem = [];
  const nay = T.ngayTem();
  for (const o of lenh.dong || []) {
    let tt = napDanhMuc()?.get(String(o.sku));
    if (!tt) tt = await traGviz(o.sku);
    const r = { sku: String(o.sku), pn: tt ? tt.pn : "(không thấy trong danh mục)", sl: o.slHang || "", ngay: nay };
    for (let i = 0; i < Math.max(1, Number(o.sl) || 1); i++) conTem.push(r);
  }
  if (!conTem.length) return { loi: "lệnh rỗng" };
  /* Tem thông báo đợt: chỉ khi hàng đợi đang có nhiều người — in một mình thì không tốn thêm tem. */
  if (lenh.nhieuNguoi) {
    conTem.unshift({ _dot: true, nguoi: lenh.nguoi || "—",
      luc: new Date().toLocaleTimeString("vi-VN").slice(0, 5) + " " + nay,
      soTem: conTem.length, soSku: (lenh.dong || []).length });
  }
  const mau = (lenh.dong && lenh.dong[0] && lenh.dong[0].mau) || T.MAU_MAC_DINH;
  const hang = T.chiaHang(conTem, mau);
  const loi = [];
  for (let i = 0; i < hang.length; i++) {
    const kq = await guiRaw(await tsplHang(hang[i], mau), MAY_IN);
    console.log("    hàng " + (i + 1) + "/" + hang.length + ": " + kq);
    if (/^LOI/i.test(kq)) loi.push("hàng " + (i + 1) + ": " + kq);
  }
  return { soTem: conTem.length, soHang: hang.length, loi: loi.join(" | ") };
}

async function chayDichVu(nhip) {
  if (!GAS_URL || !GAS_KEY) {
    console.error("Cần đặt biến môi trường APPSCRIPT_URL và APPSCRIPT_KEY (xem hasaki/.env).");
    process.exit(3);
  }
  console.log("Agent in tem đang chạy · nhịp " + nhip + "s · máy in: " + (MAY_IN || "(tự tìm PE200)"));
  console.log("Ctrl+C để dừng.");
  let im = 0;
  for (;;) {
    try {
      const kq = await goiGas({ action: "pr_lay", key: GAS_KEY });
      const ds = (kq && kq.dsLenh) || [];
      if (!ds.length) {
        if (++im % 12 === 0) console.log("  (" + new Date().toLocaleTimeString("vi-VN") + ") hàng đợi trống");
      } else {
        im = 0;
        for (const lenh of ds) {
          console.log("→ lệnh " + lenh.id + " của " + (lenh.nguoi || "—") + ": " + lenh.soTem + " tem" +
            (lenh.nhieuNguoi ? " (hàng đợi có nhiều người → in kèm tem thông báo đợt)" : ""));
          let ra;
          try { ra = await inMotLenh(lenh); }
          catch (e) { ra = { loi: String(e.message || e).slice(0, 200) }; }
          try {
            await goiGas({ action: "pr_xong", key: GAS_KEY, id: lenh.id, loi: ra.loi || "",
              ghiChu: ra.loi ? "" : (ra.soTem + " tem / " + ra.soHang + " hàng giấy") });
          } catch (e) { console.error("  (không báo được trạng thái về GAS: " + (e.message || e) + ")"); }
          console.log(ra.loi ? "  ✗ " + ra.loi : "  ✓ đã in " + ra.soTem + " tem");
        }
      }
    } catch (e) {
      console.error("  lỗi vòng quét: " + String(e.message || e).slice(0, 160));
    }
    await nghi(nhip * 1000);
  }
}

/* ───────── 6. VÀO/RA DÒNG LỆNH ───────── */
const argv = process.argv.slice(2);
const layCo = (t, mac) => { const i = argv.indexOf(t); return i >= 0 && argv[i + 1] ? argv[i + 1] : mac; };
const MAU = layCo("--mau", T.MAU_MAC_DINH);
const MAY_IN = layCo("--may", "");
/* Khe NGANG giữa hai hàng tem — số đo thật nằm trong lõi PR_TEM (GIAY.kheNgang), không gõ lại. */
const GAP_MM = Number(layCo("--gap", String((T.GIAY && T.GIAY.kheNgang) || 3)));
const DENSITY = Number(layCo("--dam", "10"));    // 0..15 — 8 in ra nhạt trên giấy decal này
const LECH_MM = Number(layCo("--lech", "2"));    // dịch trái (mm) cho khớp khuôn tem vật lý
const NGUOI = layCo("--nguoi", "");               // ai gửi đợt in này -> in kèm tem thông báo đợt
const dsThu = argv.indexOf("--thu") >= 0 ? layCo("--thu", "") : "";
const dsIn = argv.indexOf("--in") >= 0 ? layCo("--in", "") : "";

/** "422322192x2,422440680" → [{sku, sl}] */
function bocDanhSach(s) {
  return String(s).split(",").map((x) => x.trim()).filter(Boolean).map((x) => {
    /* Bóc SỐ LƯỢNG trước: lớp ký tự của mã SKU cũng ăn cả chữ "x" và chữ số nên regex gộp sẽ ngoạm
       luôn "x2" vào mã (bẫy đã cắn: 3 tem thành 2). */
    /* Cú pháp: "SKU", "SKU x3" (3 con tem), "SKU@100" (số lượng in trên tem), "SKU x3 @100".
       Bóc SỐ TEM trước: lớp ký tự của mã SKU cũng ăn cả chữ "x" và chữ số nên regex gộp sẽ ngoạm
       luôn "x2" vào mã (bẫy đã cắn: 3 tem thành 2). */
    let slHang = "";
    const at = x.split("@");
    if (at.length > 1) { slHang = at.slice(1).join("@").trim(); x = at[0].trim(); }
    const m = x.match(/^(.+?)\s*[x*]\s*(\d+)$/i);
    if (m) return { sku: m[1].trim(), soTem: Math.max(1, Number(m[2])), sl: slHang };
    return /^[0-9A-Za-z._-]+$/.test(x) ? { sku: x, soTem: 1, sl: slHang } : null;
  }).filter(Boolean);
}
/** Tra tên hàng từ danh mục đã đồng bộ (.sku-master-dry.json) */
function napDanhMuc() {
  const f = path.join(DIR, ".sku-master-dry.json");
  if (!fs.existsSync(f)) return null;
  const rows = JSON.parse(fs.readFileSync(f, "utf8")).rows;
  const m = new Map();
  for (const r of rows) if (!m.has(String(r[0]))) m.set(String(r[0]), { pn: r[1], type: r[2], status: r[3] });
  return m;
}
/** Tra thẳng tab SKU_MASTER trên Sheet (gviz) khi SKU chưa có trong file đồng bộ.
 *  Hỏi cả hai kiểu số/chữ vì cột A đổi kiểu tuỳ lúc Sheet nạp — hỏi một kiểu thì có hôm trả rỗng
 *  mà không ai biết vì sao (tem in ra thiếu tên, im lặng). */
async function traGviz(sku) {
  const ID = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
  const k = String(sku).replace(/[^0-9A-Za-z._-]/g, "");
  const q = "select A,B,C,D where A = " + k + " or A = '" + k + "' limit 1";
  const u = "https://docs.google.com/spreadsheets/d/" + ID +
    "/gviz/tq?tqx=out:json&sheet=SKU_MASTER&headers=1&tq=" + encodeURIComponent(q);
  try {
    const t = await (await fetch(u)).text();
    const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    const r = j.table && j.table.rows && j.table.rows[0];
    if (!r) return null;
    const o = (r.c || []).map((c) => (c && c.v != null ? c.v : ""));
    return { pn: String(o[1] || ""), type: String(o[2] || ""), status: String(o[3] || "") };
  } catch { return null; }
}

async function chay(ds, chiThu) {
  const dm = napDanhMuc();
  const nay = T.ngayTem();          // dd-mm-yy, cùng một hàm với dashboard
  const conTem = [];
  for (const o of ds) {
    let tt = dm && dm.get(o.sku);
    if (!tt) tt = await traGviz(o.sku);            // chưa có trong file đồng bộ -> tra Sheet một lượt
    const r = {
      sku: o.sku,
      pn: tt ? tt.pn : "(không thấy trong danh mục)",
      sl: o.sl || "",                 // SỐ LƯỢNG in trên tem (khác số con tem)
      ngay: nay,
    };
    for (let i = 0; i < (o.soTem || 1); i++) conTem.push(r);
  }
  if (!conTem.length) { console.error("Không có SKU nào để in."); process.exit(1); }
  /* TEM THÔNG BÁO ĐỢT IN: chỉ chèn khi biết đợt này của AI (--nguoi) — dùng khi máy in là chỗ dùng
     chung và hàng đợi có nhiều người. In một mình thì không tốn thêm tem. */
  if (NGUOI) {
    conTem.unshift({ _dot: true, nguoi: NGUOI, luc: new Date().toLocaleTimeString("vi-VN").slice(0, 5) + " " + nay,
      soTem: conTem.length, soSku: ds.length });
  }
  const hang = T.chiaHang(conTem, MAU), kt = T.khoTrang(MAU);
  console.log("Mẫu " + MAU + ": tem " + kt.tem.w + "×" + kt.tem.h + "mm · hàng " + kt.w + "×" + kt.h +
    "mm (" + kt.cot + " tem/hàng · khe dọc " + kt.khe + "mm · khe ngang GAP " + GAP_MM +
    "mm · dịch trái " + LECH_MM + "mm · đậm " + DENSITY + ")");
  console.log(conTem.length + " con tem → " + hang.length + " hàng giấy");
  for (let i = 0; i < hang.length; i++) {
    const buf = await tsplHang(hang[i], MAU);
    if (chiThu) {
      const f = path.join(TMP, "hang-" + (i + 1) + ".tspl");
      fs.writeFileSync(f, buf);
      const fa = path.join(TMP, "hang-" + (i + 1) + ".png");
      await anhXemTruoc(hang[i], MAU, fa);
      console.log("  hàng " + (i + 1) + ": " + buf.length + " byte → " + f);
      console.log("             ảnh xem trước: " + fa);
    } else {
      console.log("  hàng " + (i + 1) + ": " + buf.length + " byte → " + (await guiRaw(buf, MAY_IN)));
    }
  }
  if (chiThu) console.log("(--thu: chưa gửi gì tới máy in)");
}

if (dsThu) await chay(bocDanhSach(dsThu), true);
else if (dsIn) await chay(bocDanhSach(dsIn), false);
else if (argv.includes("--dich-vu")) await chayDichVu(Math.max(3, Number(layCo("--nhip", "6"))));
else {
  console.log('Dùng: node in-tem-agent.mjs --thu "422430797x2" | --in "422430797x2,422322192" | --dich-vu');
  console.log('      tuỳ chọn: --mau t40x60 --may "<tên máy in>" --gap 3 --dam 10 --lech 2');
}
