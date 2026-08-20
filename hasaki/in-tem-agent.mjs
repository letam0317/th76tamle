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
import { execFileSync, spawn } from "node:child_process";
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

/* ───────── 3. DỰNG LỆNH TSPL ─────────
   MỘT LỆNH IN = MỘT LUỒNG TSPL LIỀN MẠCH: khai khổ MỘT LẦN ở đầu, rồi mỗi hàng giấy chỉ còn
   `CLS` + `BITMAP` + `PRINT`.
   Vì sao phải tách như vậy (user báo 20/08/2026: in 6 tem thì máy nhả 2 con, kéo decal trống về, mới
   nhả 2 con tiếp — mất thời gian): bản trước mỗi hàng giấy là một trang TSPL ĐẦY ĐỦ, mang theo cả
   `SIZE` và `GAP`. Hai lệnh đó bắt máy in **đo lại giấy** nên nó phải đẩy tem qua đầu in rồi rút về
   trước mỗi cặp tem. Khai một lần thì máy giữ nguyên phép đo và in một hơi.
   `SET TEAR OFF` bỏ luôn cú đẩy tem ra thanh xé rồi kéo về sau MỖI nhãn — chính là đoạn "rút decal"
   nhìn thấy được. Đánh đổi: con tem cuối đứng lại trước thanh xé, bóc bằng tay (decal die-cut vẫn
   bóc bình thường). */
function tsplDau(maMau) {
  const kt = T.khoTrang(maMau);
  return "SIZE " + kt.w + " mm," + kt.h + " mm" + NL +
    /* ĐỦ ĐƠN VỊ cả hai tham số: viết "GAP 3 mm, 0" (thiếu đơn vị số thứ hai) thì có máy in bỏ cả
       dòng và giữ khe học từ lần trước — im lặng, rồi tem lệch dần. */
    "GAP " + GAP_MM + " mm,0 mm" + NL +
    "DIRECTION 1" + NL + "REFERENCE 0,0" + NL + "DENSITY " + DENSITY + NL + "SPEED 3" + NL +
    "SET TEAR OFF" + NL;
}
/** Thân MỘT hàng giấy (2 con tem) — không có SIZE/GAP nên không bắt máy in đo lại giấy. */
async function tsplThan(hang, maMau) {
  const kt = T.khoTrang(maMau), m = kt.tem;
  const out = [Buffer.from("CLS" + NL, "latin1")];
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
/** MỘT hàng giấy đứng riêng (dùng cho `--thu` / `--in` ở dòng lệnh): khai khổ + thân. */
async function tsplHang(hang, maMau) {
  return Buffer.concat([Buffer.from(tsplDau(maMau), "latin1"), await tsplThan(hang, maMau)]);
}
/** CẢ LỆNH: khai khổ một lần rồi nối các hàng giấy — đây là đường mà `--dich-vu` dùng. */
async function tsplJob(hangs, maMau) {
  const out = [Buffer.from(tsplDau(maMau), "latin1")];
  for (const h of hangs) out.push(await tsplThan(h, maMau));
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
/** Xoá job KẸT trong queue máy in tem (già hơn 2 phút). Một con tem in xong trong ~2 giây nên job
 *  già hơn 2 phút chắc chắn đã chết, không phải của ai đang đứng đợi.
 *  Vì sao cần: đo 20/08/2026 — một job "Spooling" size 0 nằm lại trong queue làm MỌI lượt gửi sau nó
 *  đội từ ~2s lên 22s, mà không có lỗi nào để đọc. Người bấm chỉ thấy "sao lâu". */
function donJobKet(mayIn) {
  const tim = mayIn ? "'" + mayIn.replace(/'/g, "''") + "'"
    : "(Get-Printer | Where-Object { $_.Name -match 'PE200' } | Select-Object -First 1).Name";
  return psRun("$n=0; try { $p=" + tim + "; if ($p) { Get-PrintJob -PrinterName $p -ErrorAction Stop | " +
    "Where-Object { $_.SubmittedTime -lt (Get-Date).AddMinutes(-2) } | " +
    "ForEach-Object { Remove-PrintJob -InputObject $_; $n++ } } } catch {}; \"$n job\"");
}
/* Tên máy in đã ghim. Nếu người chạy không truyền `--may`, `_IN-RAW.ps1` phải tự `Get-Printer` để dò
   máy có tên chứa PE200 — mất ~0,47s cho MỖI lượt in (đo 20/08/2026). Dò một lần lúc hâm nóng rồi
   ghim lại: những lượt sau khỏi trả cái giá đó. */
let mayGhim = "";
const mayDung = () => MAY_IN || mayGhim;
/** Bóc tên máy in từ dòng kết quả của `_IN-RAW.ps1` ("OK 23 | may in: <tên> | 23 byte"). */
function ghimMay(dong) {
  const m = String(dong || "").match(/may in:\s*(.+?)\s*\|/);
  if (m && m[1] && !mayGhim) { mayGhim = m[1]; return true; }
  return false;
}
async function guiRaw(buf, mayIn) {
  const t0 = Date.now();
  let kq = guiRawMotLuot(buf, mayIn);
  const lau = Date.now() - t0;
  /* Gửi ĐƯỢC mà chậm bất thường: gần như luôn là có job kẹt phía máy in. Dọn NGAY để đợt sau không
     bị lây — dọn sau khi tem của đợt này đã ra nên không làm chậm chính người vừa bấm. */
  if (lau > 8000 && !/^LOI/i.test(kq)) {
    console.log("     ⚠ gửi mất " + (lau / 1000).toFixed(1) + "s (bình thường ~2s) — dọn job kẹt: " + donJobKet(mayIn).slice(0, 40));
  }
  for (let lan = 1; lan <= 2 && /^LOI/i.test(kq); lan++) {
    /* 1722 = RPC server unavailable (spooler bên kia vừa restart / chưa sẵn sàng) — dọn job chết rồi
       nối lại queue, sau đó thử tiếp. */
    const bo = donJobKet(mayIn);
    const chua = noiLaiQueue();
    console.log("     ⟳ máy in không nhận (" + kq.slice(0, 60) + ") — bỏ " + bo.slice(0, 12) + ", nối lại queue: " + chua.slice(0, 50));
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

/** Một dòng tả rõ từng con tem sẽ ra giấy: "1) 422430797 · 12 | 2) 422430797 · 14 | …".
 *  Đây là thứ duy nhất đọc được bằng mắt để biết việc "nhiều bịch khác số lượng" có đúng hay không —
 *  số lượng nằm trong ảnh bitmap nên soi luồng TSPL không thấy được. */
function moTaConTem(conTem) {
  return conTem.map((r, i) => (i + 1) + ") " + (r._dot ? "[tem thông báo đợt]" : r.sku + " · " + (r.sl === "" ? "(không có số lượng)" : r.sl)))
    .join(" | ");
}

async function inMotLenh(lenh) {
  const t0 = Date.now();
  const dong = lenh.dong || [];
  /* TRA TÊN GỘP MỘT LƯỢT: tên gửi kèm lệnh trước, rồi danh mục trong máy, còn thiếu bao nhiêu thì
     hỏi Sheet MỘT câu. Bản cũ hỏi từng SKU nên một lệnh 5 SKU lạ đứng yên 3-5 giây trước khi máy
     in kêu. */
  const dm = napDanhMuc();
  const thieu = dong.filter((o) => !String(o.pn || "").trim())
    .map((o) => String(o.sku)).filter((k) => !(dm && dm.get(k)));
  const bu = thieu.length ? await traGvizNhieu(thieu) : new Map();
  const nay = T.ngayTem();
  /* Gắn tên vào từng dòng rồi để LÕI nở ra từng con tem. Nở bằng `T.moRong` chứ không tự đếm ở đây:
     dòng có thể khai NHIỀU số lượng ("12, 14, 16" = 3 bịch → 3 con tem cùng SKU khác số lượng), và
     dashboard đếm số tem bằng đúng hàm này — hai bên nở khác nhau là số trên màn hình khác số tem
     ra khỏi máy in. */
  const dongCoTen = dong.map((o) => {
    const k = String(o.sku);
    const tt = (dm && dm.get(k)) || bu.get(k);
    return { sku: k, pn: String(o.pn || "").trim() || (tt ? tt.pn : "") || "(không thấy trong danh mục)",
      slHang: o.slHang || "", sl: o.sl, mau: o.mau };
  });
  const conTem = T.moRong(dongCoTen).map((x) => ({ sku: x.sku, pn: x.pn, sl: x.slHang, ngay: nay }));
  if (!conTem.length) return { loi: "lệnh rỗng" };
  /* Tem thông báo đợt: chỉ khi hàng đợi đang có nhiều người — in một mình thì không tốn thêm tem. */
  if (lenh.nhieuNguoi) {
    conTem.unshift({ _dot: true, nguoi: lenh.nguoi || "—",
      luc: new Date().toLocaleTimeString("vi-VN").slice(0, 5) + " " + nay,
      soTem: conTem.length, soSku: dong.length });
  }
  const mau = (dong[0] && dong[0].mau) || T.MAU_MAC_DINH;
  const hang = T.chiaHang(conTem, mau);
  const tTra = Date.now();          // xong chặng TRA TÊN

  /* MỘT LỆNH = MỘT JOB SPOOLER, và trong job đó là MỘT luồng TSPL liền mạch (khai khổ một lần).
     Bản cũ gọi PowerShell cho TỪNG hàng giấy (190ms/lần chỉ để mở tiến trình) và khai khổ lại mỗi
     hàng (máy in đo lại giấy → nhả rồi rút decal giữa mỗi 2 con tem).
     Cắt khúc 40 hàng cho khỏi có job vài MB. */
  const loi = [];
  let byte = 0;
  const khuc = [];
  for (let k = 0; k < hang.length; k += 40) khuc.push(await tsplJob(hang.slice(k, k + 40), mau));
  const tDung = Date.now();         // xong chặng DỰNG ẢNH
  /* LỆNH ĐO: dừng ở đây. Đã đi qua đúng những chặng tốn thời gian (hàng đợi, tra tên, dựng ảnh) nên
     số đo vẫn thật, chỉ không tốn con tem nào. */
  if (lenh.thu) {
    for (const b of khuc) byte += b.length;
    console.log("    [ĐO] dựng xong " + hang.length + " hàng giấy (" + byte + " byte) — KHÔNG gửi máy in");
    /* LIỆT KÊ TỪNG CON TEM. Bản chạy khô mà không nói con tem nào mang số nào thì không kiểm được gì:
       ngày 20/08/2026 tôi đã in 4 con tem thật chỉ để phát hiện cả 4 mang cùng một chuỗi số. */
    console.log("    [ĐO] " + moTaConTem(conTem));
    return { soTem: conTem.length, soHang: hang.length, byte: byte, loi: "", thu: true,
      msTra: tTra - t0, msDung: tDung - tTra, msGui: 0, msTong: Date.now() - t0 };
  }
  for (const b of khuc) {
    byte += b.length;
    const kq = await guiRaw(b, mayDung());
    console.log("    gửi " + hang.length + " hàng giấy (" + b.length + " byte): " + kq);
    if (/^LOI/i.test(kq)) loi.push(kq);
  }
  return { soTem: conTem.length, soHang: hang.length, byte: byte, loi: loi.join(" | "),
    msTra: tTra - t0, msDung: tDung - tTra, msGui: Date.now() - tDung, msTong: Date.now() - t0 };
}

/* Nhịp quét tự động. Sau khi hàng đợi sống chuyển sang Script Properties, một lượt hỏi lúc rỗng chỉ
   còn ~1,1s (trần của Apps Script) và KHÔNG mở Sheet — nên hỏi mỗi giây trong giờ làm là hợp lý.
   Ngoài giờ giãn ra 12s: không ai in lúc nửa đêm, mà hạn mức Apps Script thì có thật. */
function nhipTuDong() {
  const g = new Date().getHours();
  return g >= 6 && g < 20 ? 1 : 12;
}

/* SỔ LOG: từ 20/08/2026 agent chạy ẨN qua Task Scheduler (task "Factory agent in tem") nên không còn
   cửa sổ nào để đọc. Không có log thì lúc tem không ra sẽ chẳng biết agent có chạy không, nhận được
   lệnh chưa, máy in trả lời gì — đúng cảnh đã mất thời gian hôm nay. Ghi kèm ra file, tự cắt bớt để
   không phình vô hạn. */
function moSoLog() {
  const f = path.join(DIR, ".in-tem-agent.log");
  try {
    if (fs.existsSync(f) && fs.statSync(f).size > 512 * 1024) {
      const t = fs.readFileSync(f, "utf8");
      fs.writeFileSync(f, t.slice(-200 * 1024));
    }
  } catch { /* log hỏng thì thôi, KHÔNG được làm chết đường in vì cái log */ }
  const goc = console.log.bind(console), gocLoi = console.error.bind(console);
  const ghi = (nhan, raGoc) => (...a) => {
    raGoc(...a);
    try { fs.appendFileSync(f, "[" + new Date().toLocaleString("vi-VN") + "]" + nhan + " " + a.join(" ") + "\n"); } catch {}
  };
  console.log = ghi("", goc);
  console.error = ghi(" LỖI", gocLoi);
  return f;
}

async function chayDichVu(nhip) {
  if (!GAS_URL || !GAS_KEY) {
    console.error("Cần đặt biến môi trường APPSCRIPT_URL và APPSCRIPT_KEY (xem hasaki/.env).");
    process.exit(3);
  }
  const soLog = moSoLog();
  console.log("── agent khởi động (pid " + process.pid + ") · sổ log: " + soLog);
  /* HÂM NÓNG kết nối máy in: lượt gửi ĐẦU TIÊN sau khi agent khởi động mất 7,9s trong khi lượt sau
     chỉ 2,3s (đo 20/08/2026) — chi phí mở kết nối tới spooler máy bên kia. Trả cái giá đó ngay bây
     giờ, lúc không ai đang đợi, thay vì để người bấm In đầu tiên của ngày phải trả.
     Lệnh chỉ có SIZE + CLS, KHÔNG có PRINT nên máy in không nhả con tem nào. */
  try {
    const t = Date.now();
    const kq = guiRawMotLuot(Buffer.from("SIZE 82 mm,60 mm" + NL + "CLS" + NL, "latin1"), MAY_IN);
    ghimMay(kq);
    console.log("   hâm nóng máy in: " + kq.slice(0, 60) + " (" + (Date.now() - t) + "ms)" +
      (mayGhim ? " · ghim tên máy in: " + mayGhim : ""));
  } catch (e) { console.log("   hâm nóng máy in không xong: " + String(e.message || e).slice(0, 80)); }
  console.log("Agent in tem đang chạy · nhịp " + (nhip ? nhip + "s" : "tự động (1s giờ làm / 12s ngoài giờ)") +
    " · máy in: " + (MAY_IN || "(tự tìm PE200)"));
  console.log("Ctrl+C để dừng.");
  /* TỰ NẠP LẠI KHI MÃ ĐỔI. Vì sao phải có: agent là tiến trình chạy nền cả ngày, nên sửa
     `in-tem-agent.mjs` hay lõi tem trong `factory/index.html` xong thì tiến trình đang chạy VẪN dùng
     mã cũ — mà không có dấu hiệu nào. Ngày 20/08/2026 việc này đã làm 4 con tem thật in sai (mỗi con
     phải mang một số lượng riêng, nhưng tiến trình cũ in cả 4 giống nhau), và người dùng là người
     phát hiện ra, không phải tôi.
     Chỉ nạp lại khi ĐANG RẢNH (không có lệnh nào trong tay) và tự sinh tiến trình mới trước khi thoát,
     nên không có khoảng trống nào mà lệnh in bị bỏ rơi. */
  const nguonCanhGiu = [fileURLToPath(import.meta.url), F_HTML];
  const dauMoc = () => nguonCanhGiu.map((f) => { try { return String(fs.statSync(f).mtimeMs); } catch { return "?"; } }).join("|");
  const mocDau = dauMoc();
  const napLai = () => {
    console.log("── mã đã đổi → nạp lại agent (tiến trình mới thay thế tiến trình này)");
    try {
      spawn(process.execPath, process.argv.slice(1), { detached: true, stdio: "ignore", cwd: DIR }).unref();
    } catch (e) { console.error("  không sinh được tiến trình mới: " + (e.message || e) + " — task 5 phút sẽ bật lại"); }
    process.exit(0);
  };
  let imTu = Date.now();
  for (;;) {
    let coViec = false;
    try {
      const kq = await goiGas({ action: "pr_lay", key: GAS_KEY });
      const ds = (kq && kq.dsLenh) || [];
      coViec = ds.length > 0;
      if (!coViec) {
        /* Báo còn sống mỗi 5 phút thôi: nhịp 1 giây mà in log mỗi lượt thì cửa sổ chạy thành vô dụng. */
        if (Date.now() - imTu > 300000) { console.log("  (" + new Date().toLocaleTimeString("vi-VN") + ") hàng đợi trống"); imTu = Date.now(); }
      } else {
        imTu = Date.now();
        for (const lenh of ds) {
          console.log("→ lệnh " + lenh.id + " của " + (lenh.nguoi || "—") + ": " + lenh.soTem + " tem" +
            (lenh.nhieuNguoi ? " (hàng đợi có nhiều người → in kèm tem thông báo đợt)" : ""));
          let ra;
          try { ra = await inMotLenh(lenh); }
          catch (e) { ra = { loi: String(e.message || e).slice(0, 200) }; }
          /* BÁO XONG MÀ KHÔNG ĐỨNG ĐỢI: `pr_xong` mất ~1,1s, trong khi đợt của người kế tiếp đang
             chờ được nhặt. Gửi rồi đi tiếp; lỗi báo trạng thái chỉ ghi log, tem thì đã ra rồi. */
          goiGas({ action: "pr_xong", key: GAS_KEY, id: lenh.id, loi: ra.loi || "",
            ghiChu: ra.loi ? "" : (ra.soTem + " tem / " + ra.soHang + " hàng giấy") })
            .catch((e) => console.error("  (không báo được trạng thái về GAS: " + (e.message || e) + ")"));
          console.log(ra.loi ? "  ✗ " + ra.loi
            : "  ✓ " + (ra.thu ? "[ĐO] đã dựng " : "đã in ") + ra.soTem + " tem trong " + (ra.msTong / 1000).toFixed(1) +
              "s (tra tên " + ra.msTra + "ms · dựng ảnh " + ra.msDung + "ms · gửi máy in " + ra.msGui + "ms)");
        }
      }
    } catch (e) {
      console.error("  lỗi vòng quét: " + String(e.message || e).slice(0, 160));
    }
    /* Vừa có việc thì quay lại hỏi NGAY: mấy người bấm In cùng lúc phải được nhặt liên tiếp, chứ
       không phải mỗi người cách nhau một nhịp nghỉ. */
    if (!coViec) {
      if (dauMoc() !== mocDau) napLai();          // rảnh + mã đã đổi -> đổi tiến trình
      await nghi((nhip || nhipTuDong()) * 1000);
    }
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
    /* Cú pháp: "SKU", "SKU x3" (3 con tem), "SKU@100" (số lượng in trên tem), "SKU x3 @100".
       Nhiều bịch khác số lượng: "SKU@12/14/16" → 3 con tem, mỗi con một số. Dùng dấu GẠCH CHÉO chứ
       không phải dấu phẩy, vì dấu phẩy ở dòng lệnh đã dùng để tách các SKU với nhau.
       Bóc SỐ TEM trước: lớp ký tự của mã SKU cũng ăn cả chữ "x" và chữ số nên regex gộp sẽ ngoạm
       luôn "x2" vào mã (bẫy đã cắn: 3 tem thành 2). */
    let slHang = "";
    const at = x.split("@");
    if (at.length > 1) { slHang = at.slice(1).join("@").trim(); x = at[0].trim(); }
    /* Nhiều số lượng thì SỐ TEM do danh sách quyết định — cùng luật với dashboard (lõi `temCuaDong`). */
    const nhieu = T.tachSl(slHang).length;
    const m = x.match(/^(.+?)\s*[x*]\s*(\d+)$/i);
    if (m) return { sku: m[1].trim(), soTem: nhieu > 1 ? nhieu : Math.max(1, Number(m[2])), sl: slHang };
    return /^[0-9A-Za-z._-]+$/.test(x) ? { sku: x, soTem: nhieu > 1 ? nhieu : 1, sl: slHang } : null;
  }).filter(Boolean);
}
/** Tra tên hàng từ danh mục đã đồng bộ (.sku-master-dry.json) */
let _dm = null, _dmLuc = 0;
function napDanhMuc() {
  /* GIỮ TRONG BỘ NHỚ 10 phút: agent chạy nền cả ngày, mà bản cũ đọc + parse lại cả 932KB cho TỪNG
     SKU của TỪNG lệnh. Mỗi lượt chỉ 7ms nên không ai thấy, nhưng là việc làm không để làm gì. */
  if (_dm && Date.now() - _dmLuc < 600000) return _dm;
  const f = path.join(DIR, ".sku-master-dry.json");
  if (!fs.existsSync(f)) return null;
  const rows = JSON.parse(fs.readFileSync(f, "utf8")).rows;
  const m = new Map();
  for (const r of rows) if (!m.has(String(r[0]))) m.set(String(r[0]), { pn: r[1], type: r[2], status: r[3] });
  _dm = m; _dmLuc = Date.now();
  return m;
}
/** Tra thẳng tab SKU_MASTER trên Sheet (gviz) khi SKU chưa có trong file đồng bộ.
 *  Hỏi cả hai kiểu số/chữ vì cột A đổi kiểu tuỳ lúc Sheet nạp — hỏi một kiểu thì có hôm trả rỗng
 *  mà không ai biết vì sao (tem in ra thiếu tên, im lặng). */
/** Tra NHIỀU SKU trong MỘT truy vấn gviz. Bản cũ hỏi từng cái, mỗi cái 0,5–1,1s: một lệnh 5 SKU lạ
 *  là mất 3-5 giây đứng yên trước khi máy in kêu. Một câu `where A = x or A = 'x' or ...` trả về hết. */
async function traGvizNhieu(dsSku) {
  const ra = new Map();
  const ds = dsSku.map((x) => String(x).replace(/[^0-9A-Za-z._-]/g, "")).filter(Boolean);
  if (!ds.length) return ra;
  const dk = ds.map((k) => "A = " + k + " or A = '" + k + "'").join(" or ");
  const q = "select A,B,C,D where " + dk + " limit " + ds.length;
  const u = "https://docs.google.com/spreadsheets/d/" + SHEET_SKU +
    "/gviz/tq?tqx=out:json&sheet=SKU_MASTER&headers=1&tq=" + encodeURIComponent(q);
  try {
    const t = await (await fetch(u)).text();
    const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    for (const r of (j.table && j.table.rows) || []) {
      const o = (r.c || []).map((c) => (c && c.v != null ? c.v : ""));
      const k = String(o[0] || "");
      if (k && !ra.has(k)) ra.set(k, { pn: String(o[1] || ""), type: String(o[2] || ""), status: String(o[3] || "") });
    }
  } catch { /* mất mạng thì trả về những gì có; tem vẫn in, tên ghi "(không thấy trong danh mục)" */ }
  return ra;
}

const SHEET_SKU = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
async function traGviz(sku) {
  const ID = SHEET_SKU;
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
  /* Nở bằng LÕI (`T.moRong`) — đúng hàm mà dashboard và `--dich-vu` dùng. Tự lặp ở đây là cách cũ,
     và nó không hiểu "12/14/16" là ba bịch khác số lượng. */
  const dongCoTen = [];
  for (const o of ds) {
    let tt = dm && dm.get(o.sku);
    if (!tt) tt = await traGviz(o.sku);            // chưa có trong file đồng bộ -> tra Sheet một lượt
    dongCoTen.push({ sku: o.sku, pn: tt ? tt.pn : "(không thấy trong danh mục)",
      slHang: o.sl || "", sl: o.soTem || 1, mau: MAU });
  }
  const conTem = T.moRong(dongCoTen).map((x) => ({ sku: x.sku, pn: x.pn, sl: x.slHang, ngay: nay }));
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
  console.log("  " + moTaConTem(conTem));
  /* Dựng CẢ LỆNH thành một luồng TSPL — y hệt đường mà `--dich-vu` gửi, để `--thu` là bản chạy khô
     trung thực chứ không phải một cách dựng khác. Ảnh xem trước vẫn tách theo từng hàng giấy cho dễ
     soi bố cục. */
  const job = await tsplJob(hang, MAU);
  const khaiKho = (job.toString("latin1").match(/SIZE /g) || []).length;
  console.log("  một luồng TSPL: " + job.length + " byte · khai khổ " + khaiKho + " lần" +
    " · SET TEAR " + (job.toString("latin1").indexOf("SET TEAR OFF") >= 0 ? "OFF" : "(không có)"));
  if (chiThu) {
    const f = path.join(TMP, "ca-lenh.tspl");
    fs.writeFileSync(f, job);
    console.log("  → " + f);
    for (let i = 0; i < hang.length; i++) {
      const fa = path.join(TMP, "hang-" + (i + 1) + ".png");
      await anhXemTruoc(hang[i], MAU, fa);
      console.log("             ảnh xem trước hàng " + (i + 1) + ": " + fa);
    }
    console.log("(--thu: chưa gửi gì tới máy in)");
  } else {
    console.log("  gửi máy in: " + (await guiRaw(job, mayDung())));
  }
}

if (dsThu) await chay(bocDanhSach(dsThu), true);
else if (dsIn) await chay(bocDanhSach(dsIn), false);
else if (argv.includes("--dich-vu")) await chayDichVu(Math.max(0, Number(layCo("--nhip", "0"))));
else {
  console.log('Dùng: node in-tem-agent.mjs --thu "422430797x2" | --in "422430797x2,422322192" | --dich-vu');
  console.log('      tuỳ chọn: --mau t40x60 --may "<tên máy in>" --gap 3 --dam 10 --lech 2');
}
