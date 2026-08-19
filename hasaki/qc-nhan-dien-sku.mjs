/**
 * qc-nhan-dien-sku.mjs — KIỂM THỬ lõi đối soát của tab "Nhận diện SKU".
 *
 *  Cách làm: CẮT khối giữa 2 mốc `NDS-ENGINE` trong factory/index.html rồi chạy trong Node.
 *  Nhờ vậy test chạy ĐÚNG đoạn mã đang phục vụ người dùng — không có bản sao nào để lệch nhau.
 *
 *  Dữ liệu: danh mục SKU_MASTER thật.
 *    · mặc định đọc `.sku-master-dry.json` (chạy `node sync-sku-master.mjs --dry` để tạo)
 *    · `--gviz` thì tải thẳng tab SKU_MASTER đã publish (kiểm luôn đường đọc của dashboard)
 *
 *  node qc-nhan-dien-sku.mjs [--gviz] [--chi-tiet]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const F_HTML = path.join(DIR, "..", "factory", "index.html");
const SHEET_ID = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const CHI_TIET = process.argv.includes("--chi-tiet");

/* ---------- 1. Nạp lõi từ chính file dashboard ---------- */
const html = fs.readFileSync(F_HTML, "utf8");
const i1 = html.indexOf("/*<NDS-ENGINE>*/"), i2 = html.indexOf("/*</NDS-ENGINE>*/");
if (i1 < 0 || i2 < 0) { console.error("✗ Không thấy mốc NDS-ENGINE trong factory/index.html"); process.exit(2); }
const nguon = html.slice(i1, i2);
const E = new Function(nguon + "\n return NDS_ENGINE;")();
console.log("✓ Nạp lõi đối soát từ factory/index.html (" + (nguon.length / 1024).toFixed(1) + " KB mã)");

/* ---------- 2. Nạp danh mục ---------- */
async function tuGviz() {
  const u = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json&sheet=SKU_MASTER&headers=1";
  const t = await (await fetch(u)).text();
  const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
  const cols = j.table.cols.map((c) => String(c.label || c.id || "").toUpperCase());
  if (cols[0] !== "SKU" || cols[1] !== "PRODUCTNAME") throw new Error("Tab SKU_MASTER sai hợp đồng cột: " + cols.join("|"));
  return j.table.rows.map((r) => {
    const v = (k) => (r.c[k] && r.c[k].v != null ? r.c[k].v : "");
    return { sku: String(v(0)).replace(/\.0$/, ""), pn: String(v(1)),
      type: String(v(2)).toUpperCase() === "COMBO" ? "COMBO" : "NORMAL",
      status: String(v(3)).toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      qty: Number(v(4)) || 0, unit: String(v(5) || "") };
  });
}
function tuFile() {
  const f = path.join(DIR, ".sku-master-dry.json");
  if (!fs.existsSync(f)) throw new Error("Chưa có " + f + " — chạy `node sync-sku-master.mjs --dry` trước, hoặc thêm --gviz.");
  return JSON.parse(fs.readFileSync(f, "utf8")).rows.map((r) => ({ sku: String(r[0]), pn: r[1], type: r[2], status: r[3], qty: Number(r[4]) || 0, unit: r[5] || "" }));
}
const ds = process.argv.includes("--gviz") ? await tuGviz() : tuFile();
console.log("✓ Danh mục: " + ds.length + " SKU (" + ds.filter((r) => r.status === "ACTIVE").length + " ACTIVE)" +
  (process.argv.includes("--gviz") ? " — đọc qua gviz như dashboard" : " — đọc từ bản nháp sync"));

const t0 = performance.now();
const cm = E.dungChiMuc(ds);
const tDung = performance.now() - t0;
console.log("✓ Dựng chỉ mục: " + Math.round(tDung) + "ms · " + cm.tuVung.length + " từ vựng\n");

let dat = 0, truot = 0, soCa = 0;
const kiem = (ten, ok, ghi) => { soCa++; ok ? dat++ : truot++; console.log((ok ? "  ✓ " : "  ✗ ") + ten + (ghi ? "  — " + ghi : "")); };

/* ---------- 2b. ĐƠN VỊ TÍNH — bóc từ đoạn cuối PRODUCTNAME ---------- */
/* Bẫy: đoạn cuối hay dính QUY CÁCH cuộn ("cuộn 5000m, mm"). Đọc nhầm "5000m" thành đơn vị "m" là
   hỏng luôn luật "ưu tiên đơn vị nhỏ nhất" — SKU tính theo mm sẽ tụt hạng sau SKU tính theo cuộn. */
console.log("── Đơn vị tính (đoạn cuối tên hàng) ──");
[["mm", "mm", 0.001], ["mét", "met", 1], ["MÉT", "met", 1], ["cm", "cm", 0.01], ["yard", "yard", 0.9144],
 ["gam", "gam", 0.001], ["gram", "gram", 0.001], ["kg", "kg", 1], ["mg", "mg", 0.000001],
 ["pcs", "pcs", 1], ["cuộn", "cuon", 100], ["cuộn 5000m", "cuon", 100],
 ["cuộn 5000m, mm", "mm", 0.001], ["(cuộn 5000m) mm", "mm", 0.001], ["m cuộn", "m", 1],
 ["g (none vat)", "g", 0.001], ["none", "", 1], ["size one size", "", 1],
].forEach(([doan, ma, q]) => {
  const d = E.donVi("Tên hàng/thuộc tính/" + doan);
  kiem('donVi("…/' + doan + '")', d.ma === ma && d.q === q, "ma=" + JSON.stringify(d.ma) + " q=" + d.q +
    (d.ma === ma && d.q === q ? "" : " (mong " + JSON.stringify(ma) + "/" + q + ")"));
});
kiem("khoaHang() bỏ đúng đoạn đơn vị (mm và mét cùng một khoá)",
  E.khoaHang("Keo bonding/3914_Bemis/Clear/mm") === E.khoaHang("Keo bonding/3914_Bemis/Clear/mét"),
  E.khoaHang("Keo bonding/3914_Bemis/Clear/mm"));
kiem("khoaHang() KHÔNG gộp hai mặt hàng khác nhau",
  E.khoaHang("Keo bonding/3914_Bemis/Clear/mm") !== E.khoaHang("Keo bonding/3415_Bemis/Clear/mm"));
/* Danh mục thật: phải có nhóm nhiều đơn vị, không thì mấy ca dưới chỉ đang chạy trên giấy */
const nhomDv = new Map();
ds.forEach((r) => { const k = E.khoaHang(r.pn); (nhomDv.get(k) || nhomDv.set(k, []).get(k)).push(E.donVi(r.pn).ma); });
const soNhomNhieuDv = [...nhomDv.values()].filter((v) => new Set(v).size > 1).length;
kiem("Danh mục thật CÓ mặt hàng nhiều đơn vị (nếu không, luật này vô nghĩa)", soNhomNhieuDv >= 100,
  soNhomNhieuDv + "/" + nhomDv.size + " nhóm tên có ≥2 đơn vị");
console.log("");

/* ---------- 2c. SỔ TAY TEM — chữ ký + ghim (đường KHÔNG cần AI) ---------- */
console.log("── Sổ tay tem (chữ ký + ghim) ──");
const ck = (o) => E.chuKy(E.tuAI(o));
const ck1 = ck({ item_codes: ["F9-5284"], specs: ["Tex 27"], colors: ["345"], brands: [] });
kiem("chuKy() KHÔNG đổi khi thứ tự từ khoá đổi (nếu đổi thì sổ tay trượt oan mỗi lượt)",
  ck1 !== "" && ck1 === ck({ colors: ["345"], specs: ["Tex 27"], item_codes: ["F9-5284"], brands: [] }), ck1);
kiem("chuKy() ĐỔI khi tem khác màu (không được nhớ nhầm sang biến thể khác)",
  ck1 !== ck({ item_codes: ["F9-5284"], specs: ["Tex 27"], colors: ["074"], brands: [] }));
kiem("chuKy() BỎ vai loại/NCC (quá chung, để vào là hai tem khác nhau ra cùng chữ ký)",
  ck({ item_codes: ["F9-5284"], specs: ["Tex 27"], colors: [], brands: ["Irisa", "polyester"] }) ===
  ck({ item_codes: ["F9-5284"], specs: ["Tex 27"], colors: [], brands: ["YKK", "chi may"] }));
kiem("chuKy() trả rỗng khi bằng chứng quá ít (không đáng nhớ)",
  ck({ item_codes: [], specs: [], colors: [], brands: ["Irisa"] }) === "",
  JSON.stringify(ck({ item_codes: [], specs: [], colors: [], brands: ["Irisa"] })));
{
  /* Ghim = SKU người đã xác nhận cho tem này. Lấy một SKU ACTIVE KHÔNG dính dáng gì tới từ khoá
     để chứng minh sổ tay thắng cả điểm số — đó chính là điều làm nó không cần AI. */
  const la = ds.find((r) => r.status === "ACTIVE" && !/ykk/i.test(r.pn));
  const nhan = E.tuAI({ item_codes: ["8846295"], specs: ["38cm"], colors: ["345"], brands: ["YKK"] });
  const top = E.timTop(nhan, cm, { soLuong: 3, chiActive: true, ghim: [la.sku] });
  kiem("ghim: SKU trong sổ tay lên #1, 100%, có cờ daHoc",
    top[0] && String(top[0].sku) === String(la.sku) && top[0].pct === 100 && top[0].daHoc === true,
    top.map((r) => r.sku + "/" + r.pct + (r.daHoc ? "/học" : "")).join(" · "));
  kiem("ghim: các gợi ý theo điểm vẫn còn ở dưới (không nuốt mất kết quả đối soát)",
    top.length === 3 && top.slice(1).some((r) => r.sku === "422322192"),
    top.map((r) => r.sku).join(","));
  kiem("ghim: SKU không có trong danh mục thì bỏ qua, không vỡ",
    E.timTop(nhan, cm, { soLuong: 3, ghim: ["999999999"] })[0].sku === "422322192");
}
console.log("");

/* ---------- 2d. LỌC THEO PHẦN TỬ CỦA TÊN HÀNG (không cần AI) ---------- */
/* PRODUCTNAME của WMS vốn là chuỗi phần tử ghép bằng "/": tem in mảnh nào thì gõ mảnh đó, máy tìm
   dòng CHỨA các mảnh ấy. Deterministic — hoặc chứa hoặc không, không có % nào để nghi ngờ. */
console.log("── Lọc theo phần tử tên hàng ──");
{
  /* Phải lấy bản ACTIVE: phạm vi mặc định lọc INACTIVE, chọn nhầm bản chết là test tự sai
     (đã cắn: 422430684 cùng màu V9B11 nhưng INACTIVE nên không bao giờ ra Top 3). */
  const vd = ds.find((r) => r.status === "ACTIVE" && /8916123_YKK/.test(r.pn) && /V9B11/i.test(r.pn));
  kiem("Danh mục có ca ví dụ (dây kéo 8916123_YKK màu V9B11)", !!vd, vd ? vd.sku + " · " + vd.pn.slice(0, 60) : "(không có)");
  if (vd) {
    const pt = E.tachPhanTu(vd.pn);
    kiem("tachPhanTu() cắt tên thành đúng các phần tử giữa dấu /",
      pt.length >= 5 && pt.some((x) => /8916123_YKK/.test(x)) && pt.some((x) => /V9B11/i.test(x)),
      pt.length + " phần tử: " + pt.slice(0, 3).join(" | "));
    const rong = E.tuAI({ item_codes: [], specs: [], colors: [], brands: [] });
    const mot = E.timTop(rong, cm, { soLuong: 3, chiActive: true, loc: ["8916123"] });
    kiem("Gõ 1 mảnh (8916123) → chỉ ra SKU có chứa mảnh đó",
      mot.length > 0 && mot.every((r) => /8916123/.test(r.pn)), mot.map((r) => r.sku).join(","));
    const hai = E.timTop(rong, cm, { soLuong: 3, chiActive: true, loc: ["8916123", "V9B11"] });
    kiem("Thêm mảnh màu (V9B11) → đúng SKU đó lên #1 với 100% (khớp đủ mảnh)",
      hai[0] && String(hai[0].sku) === String(vd.sku) && hai[0].pct === 100,
      hai.map((r) => r.sku + "/" + r.pct + "%").join(" · "));
    kiem("Mảnh khớp một phần thì điểm là ĐỘ PHỦ, không phải điểm đoán",
      hai.length > 1 && hai[1].pct > 0 && hai[1].pct < 100, (hai[1] || {}).pct + "%");
    const kdau = E.timTop(rong, cm, { soLuong: 3, chiActive: true, loc: ["8916123", "xam", "dam"] });
    kiem("Gõ tiếng Việt KHÔNG DẤU vẫn khớp (xam dam ↔ Xám đậm)",
      kdau[0] && String(kdau[0].sku) === String(vd.sku), kdau.map((r) => r.sku + "/" + r.pct).join(" · "));
  }
}
{
  /* Sự cố thật 19/08: sổ tay lỡ học sang bản COMBO thì nó chiếm hạng 1 với "100% · từ sổ tay",
     vượt qua cả luật "combo/đơn vị gộp không bao giờ đứng đầu". Luật kho phải thắng sổ tay. */
  const combo = ds.find((r) => r.type === "COMBO" && r.status === "ACTIVE" && /JC01262/i.test(r.pn));
  const nhan = E.tuAI({ item_codes: ["JC01262"], specs: ["17mm"], colors: ["#006", "matt silver"], brands: ["MORITO"] });
  const top = combo ? E.timTop(nhan, cm, { soLuong: 3, chiActive: true, ghim: [combo.sku] }) : [];
  kiem("Sổ tay học NHẦM sang COMBO thì COMBO vẫn KHÔNG được đứng đầu",
    !!combo && top.length > 0 && top[0].type !== "COMBO" && !top[0].gop,
    combo ? top.map((r) => r.sku + "/" + r.type + (r.daHoc ? "/học" : "")).join(" · ") : "(không có combo để thử)");
}
console.log("");

/* ---------- 2e. ĐỌC CHỮ THÔ → VAI, LẤY BẰNG CHỨNG TỪ DANH MỤC (tuVanBan · 19/08/2026) ----------
 * Đường này là lối vào của OCR Google (action sku_ocr) và của raw_text mà AI trả về. Nó thay việc
 * "tin vai do AI gán" bằng: xếp vai theo hình dạng rồi LỌC mảnh theo chính danh mục.
 * Bốn ca dưới khoá lại đúng 4 lỗi đã đo được 19/08/2026 — mỗi ca là một sự cố thật, không phải giả định. */
{
  /* Chữ y như OCR đọc trên tem chỉ Irisa, CÓ kèm mấy dòng giấy tờ (địa chỉ · số PO · ngày · cân) */
  const CHU_TEM = [
    "THESEUS IRISA", "Tkt120 Tex 27", "60/3", "F9-5284", "Hồng tro",
    "PHONG VIET CO.,LTD - 5000m",
    "ADD: LOT 24, TAN THOI HIEP IP, DIST 12, HCMC",
    "P/O NO: 4500219877   LOT: 25/08-114",
    "QTY: 60 CONE   NET WEIGHT: 12.5 KG   GROSS: 13.8 KG",
    "DATE: 12/08/2026   INSPECTOR: NG.T.H",
  ].join("\n");
  const nv = E.tuVanBan(CHU_TEM, cm);
  const topNv = E.timTop(nv, cm, { soLuong: 3, chiActive: true });
  kiem("Chữ thô (OCR) có kèm giấy tờ → vẫn ra đúng SKU F9-5284",
    topNv.length > 0 && topNv[0].sku === "422377978" && !!topNv.coMaKhop,
    topNv.map((r) => r.sku + "/" + r.pct + "%").join(" · "));
  /* Chính mấy mảnh này là thứ làm loãng điểm và bắt lệch OAN nếu không lọc: "LOT 25/08-114" đủ để
     engine kết luận "lệch tỉ lệ sợi" với mọi SKU ghi 27-60-3 rồi trừ 18% của chính dòng đúng. */
  const boHet = ["4500219877", "25-08-114", "12-08-2026", "inspector"].filter((t) => (nv.bo || []).indexOf(t) < 0);
  kiem("Mảnh giấy tờ (số PO · số lô · ngày · INSPECTOR) bị bỏ vì danh mục không hề có",
    boHet.length === 0, boHet.length ? "còn lọt: " + boHet.join(",") : "đã bỏ " + (nv.bo || []).length + " mảnh");

  /* MÃ DÀI GHÉP NHIỀU ĐOẠN: mẫu thông số từng cắn mất khúc giữa ("10-163") làm mất sạch bằng chứng */
  const dongHkm = ds.find((r) => /HKM-DET\.TT\.10-163/i.test(r.pn) && r.status === "ACTIVE");
  const nvHkm = E.tuVanBan("Triều Vĩ HKM-DET.TT.10-163\n55% polyester*45% su latex - Trắng - 10mm", cm);
  const topHkm = E.timTop(nvHkm, cm, { soLuong: 3, chiActive: true });
  kiem("Mã dài nhiều đoạn (HKM-DET.TT.10-163) không bị mẫu thông số cắn mất khúc giữa",
    !!dongHkm && nvHkm.code.indexOf("hkm-det.tt.10-163") >= 0 && topHkm.length > 0 && /HKM-DET\.TT\.10-163/i.test(topHkm[0].pn),
    "vai mã: " + JSON.stringify(nvHkm.code) + " · #1 " + ((topHkm[0] || {}).sku || "(rỗng)") + "/" + ((topHkm[0] || {}).pct || 0) + "%");

  /* Mặt ngược của cùng cơ chế: "Text 27-60-3-Tkt 120" là THÔNG SỐ, không được thành mã — nếu thành
     mã thì rổ thông số của đúng SKU đó rỗng và một SKU chỉ may khác chiếm hạng 1 (đo thật 19/08). */
  const bSpec = E.bocTen("Chỉ Irisa/F9-5284_Phong Việt/Polyester/None/Hồng tro/None/Text 27-60-3-Tkt 120/mm");
  kiem("Chi số ghi liền (Text 27-60-3-Tkt 120) vẫn là THÔNG SỐ, không bị nhận là mã dài",
    bSpec.spec.indexOf("tex27") >= 0 && bSpec.spec.indexOf("tkt120") >= 0 && bSpec.spec.indexOf("60-3") >= 0 &&
    bSpec.code.join(",").indexOf("tkt") < 0,
    "spec: " + JSON.stringify(bSpec.spec) + " · code: " + JSON.stringify(bSpec.code));

  /* CỠ dán liền số đo cũng KHÔNG phải mã: tem nhãn care in "20-52mm-XS", nếu nhận cả cụm là mã thì
     mất luôn dấu hiệu tách XS/S/M/L — cả 4 cỡ cùng điểm và đúng cỡ XS rơi khỏi Top 3 (bắt được
     19/08/2026 khi đối chứng lõi cũ/mới trên 30 lượt OCR, đây là ca DUY NHẤT xấu hơn bản cũ). */
  const nvXs = E.tuVanBan("SUPPLIER\n93% USA cotton, 7% Spandex\n100% Polyester White\n20-52mm-XS\nQTY: 184 CONE", cm);
  const topXs = E.timTop(nvXs, cm, { soLuong: 3, chiActive: true });
  kiem("Cỡ dán liền số đo (20-52mm-XS) không bị nhận là mã → vẫn tách được XS khỏi S/M/L",
    nvXs.code.join(",").indexOf("2052mm") < 0 && topXs.length > 0 && /20\*52mm-XS/.test(topXs[0].pn),
    "vai mã: " + JSON.stringify(nvXs.code) + " · #1 " + ((topXs[0] || {}).sku || "(rỗng)") + " " + String((topXs[0] || {}).pn || "").slice(-16));

  /* SỐ ĐO cũng không được vào rổ MÃ: tem in "5000m" mà cả danh mục có hàng nghìn tên chứa "5000m"
     ⇒ nhúm mã vượt trần 120 dòng ⇒ luật cứng "CÓ MÃ" bị bỏ, giao diện báo oan "chưa khớp mã". */
  const b5000 = E.bocTen("PHONG VIET CO.,LTD - 5000m - F9-5284");
  kiem("Số đo (5000m) về rổ THÔNG SỐ, không chiếm chỗ trong rổ MÃ",
    b5000.code.indexOf("5000m") < 0 && b5000.spec.indexOf("5000m") >= 0 && b5000.code.indexOf("f9-5284") >= 0,
    "code: " + JSON.stringify(b5000.code) + " · spec: " + JSON.stringify(b5000.spec));

  /* AI GÁN VAI SAI (đo thật 19/08: cùng một tem, lượt thì trả F9-5284 ở item_codes ra 97%, lượt thì
     trả ở colors ra 73% + SKU sai). Bằng chứng của danh mục phải thắng vai do AI gán. */
  const aiLech = { item_codes: [], specs: ["Tkt120", "Tex 27", "60/3"], colors: ["F9-5284", "Hồng tro"], brands: ["THESEUS", "IRISA"] };
  const nCo = E.tuAI(aiLech, cm), nKhong = E.tuAI(aiLech);
  const topCo = E.timTop(nCo, cm, { soLuong: 3, chiActive: true });
  kiem("AI xếp mã vào rổ MÀU → danh mục vẫn kéo được về vai MÃ (napBangChung)",
    nCo.code.indexOf("f9-5284") >= 0 && nKhong.code.indexOf("f9-5284") < 0 &&
    topCo.length > 0 && topCo[0].sku === "422377978" && !!topCo.coMaKhop,
    "có chỉ mục: " + JSON.stringify(nCo.code) + " · #1 " + ((topCo[0] || {}).sku || "(rỗng)") + "/" + ((topCo[0] || {}).pct || 0) + "%");

  /* "CHỨA TRONG NHAU" phải xét cỡ: số PO 10 chữ số từng ăn 0,88 điểm vai MÃ vì có một mã màu 4 số
     nằm lọt trong nó, và chữ "inspector" khớp "spec" y như vậy. */
  kiem("Số dài không được 'khớp' mã ngắn nằm lọt trong nó (2198 ⊂ 4500219872)",
    E.khopTot("4500219872", ["2198"]) === 0 && E.khopTot("inspector", ["spec"]) === 0,
    "PO→mã màu: " + E.khopTot("4500219872", ["2198"]) + " · inspector→spec: " + E.khopTot("inspector", ["spec"]));
}
console.log("");

/* ---------- 3. Ca kiểm thử ---------- */
/** Mô phỏng ĐÚNG cái Vision LLM trả về (5 nhóm của schema sku_vision) rồi xếp vai bằng
 *  CHÍNH hàm NDS_ENGINE.tuAI mà dashboard dùng — không có bản sao nào để lệch. */
function nhanTuAI(o) { return E.tuAI(o); }

const CA = [
  { ten: "Tem TRÒN lõi cuộn chỉ (THESEUS IRISA · Tkt120 · Tex 27 · 60/3 · F9-5284)",
    ai: { item_codes: ["F9-5284"], specs: ["Tkt 120", "Tex 27", "60/3"], colors: ["Hồng tro"], brands: ["THESEUS IRISA", "Irisa"] },
    mong: "422377978" },
  { ten: "Tem BẢNG túi nút (Item JC01262 · #006 matt silver · Des 27L shank button · 17mm)",
    ai: { item_codes: ["JC01262"], specs: ["17mm", "27L"], colors: ["#006", "matt silver"], brands: ["MORITO", "shank button"] },
    mong: "422440680", chapNhan: ["422440680", "422440681"] },
  { ten: "Tem DÀI dây kéo YKK (8846295 · CMOR-36 · 38.0 CM · Màu 345)",
    ai: { item_codes: ["8846295", "CMOR-36"], specs: ["38.0 CM", "#3"], colors: ["345"], brands: ["YKK"] },
    mong: "422322192" },
  { ten: "OCR SAI NHẸ: 'Text 27' (thay Tex), 'F9 5284' (mất gạch), 'Tkt12O' (O thay 0)",
    ai: { item_codes: ["F9 5284"], specs: ["Text 27", "60-3", "Tkt12O"], colors: ["Hong tro"], brands: ["Irisa"] },
    mong: "422377978" },
  { ten: "Tem đã dán mã kho: đọc thẳng SKU nội bộ 422440680",
    ai: { item_codes: ["422440680"], specs: [], colors: [], brands: [] },
    mong: "422440680", pctToiThieu: 100 },
  { ten: "Dây kéo cùng mã nhưng MÀU khác (074) — phải ra đúng biến thể navy 38cm",
    ai: { item_codes: ["8846295"], specs: ["38cm"], colors: ["074", "Navy Blue"], brands: ["YKK"] },
    mong: "422322204" },
  { ten: "Tem MỜ chỉ đọc được thương hiệu + màu (không có mã) — không được ra 100%",
    ai: { item_codes: [], specs: [], colors: ["Hồng tro"], brands: ["Irisa"] },
    pctToiDa: 85 },
  { ten: "Từ khoá RÁC (tem rách, đọc sai hoàn toàn)",
    ai: { item_codes: ["ZZQ99999"], specs: ["999cm"], colors: ["zzz"], brands: ["khongcothuonghieunay"] },
    khongCoKetQua: true },
  /* SỰ CỐ THẬT 19/08/2026: tem in F9-5374 (mã CÓ trong danh mục, 12 SKU) nhưng AI không đọc ra mã.
     Lõi chấm bằng chữ chung "Chỉ · Filtex · Phong Việt · Polyester" rồi trả về 422378537 mang mã
     F6-7829 — cùng dạng tên, khác hẳn mã, và tự tin 68%. Hai ca dưới khoá cả hai mặt của bài học. */
  { ten: "MÃ F9-5374 đọc được → Top 3 phải TOÀN SKU mang mã đó (luật cứng CÓ MÃ)",
    ai: { item_codes: ["F9-5374"], specs: [], colors: [], brands: ["Chi", "Filtex", "Phong Viet", "Polyester"] },
    moiThePhaiCoMa: "5374" },
  { ten: "KHÔNG đọc được mã → phải tự biết là chưa khớp mã (để giao diện cảnh báo)",
    ai: { item_codes: [], specs: ["Tex 24", "100D"], colors: [], brands: ["Chi", "Filtex", "Phong Viet", "Polyester"] },
    khongCoMaKhop: true },
  /* ĐƠN VỊ NHỎ NHẤT — keo Bemis có cả SKU tính theo mét lẫn SKU tính theo mm cho CÙNG mặt hàng.
     Kiểm kê đếm bằng mm nên thẻ #1 phải là bản mm, còn bản mét phải nằm trong "cùng mặt hàng,
     khác đơn vị" (không được giấu: có khi bản mét mới là bản đang thật sự có tồn). */
  { ten: "ĐVT: keo bonding Bemis 3914 Clear — phải ra bản mm, kèm biến thể mét",
    ai: { item_codes: ["3914"], specs: [], colors: ["Clear"], brands: ["Bemis", "Keo bonding"] },
    dvMong: "mm", bienTheCoDv: "met" },
  { ten: "ĐVT: keo dựng TX300HA White — mm phải thắng yard",
    ai: { item_codes: ["TX300HA"], specs: [], colors: ["White"], brands: ["5S Weaving", "Keo dung"] },
    dvMong: "mm", bienTheCoDv: "yard" },
];

for (const ca of CA) {
  const nhan = nhanTuAI(ca.ai);
  const t1 = performance.now();
  const top = E.timTop(nhan, cm, { soLuong: 3, chiActive: true });
  const ms = Math.round(performance.now() - t1);
  const dong = top.map((r, i) => "      #" + (i + 1) + " " + r.sku + "  " + String(r.pct).padStart(3) + "%  " +
    (r.xungDot.length ? "[lệch " + r.xungDot.join(",") + "] " : "") + r.pn.slice(0, 92)).join("\n");

  let ok = true, vi = [];
  if (ca.khongCoKetQua) {
    if (top.length && top[0].pct >= 50) { ok = false; vi.push("phải KHÔNG có gợi ý đáng tin, nhưng #1 = " + top[0].pct + "%"); }
  } else {
    const chapNhan = ca.chapNhan || (ca.mong ? [ca.mong] : null);
    if (chapNhan && (!top.length || chapNhan.indexOf(String(top[0].sku)) < 0)) {
      ok = false; vi.push("#1 phải là " + chapNhan.join(" hoặc ") + ", đang là " + (top[0] ? top[0].sku : "(rỗng)"));
    }
    if (ca.mong && top.length && top[0].sku !== ca.mong && (top[1] || {}).sku !== ca.mong && (top[2] || {}).sku !== ca.mong)
      { ok = false; vi.push(ca.mong + " không có trong Top 3"); }
    if (ca.pctToiThieu != null && (!top.length || top[0].pct < ca.pctToiThieu)) { ok = false; vi.push("điểm #1 phải ≥ " + ca.pctToiThieu + "%, đang " + (top[0] ? top[0].pct : 0) + "%"); }
    if (ca.pctToiDa != null && top.length && top[0].pct > ca.pctToiDa) { ok = false; vi.push("điểm #1 phải ≤ " + ca.pctToiDa + "% (thiếu mã thì không được tự tin), đang " + top[0].pct + "%"); }
    if (ca.moiThePhaiCoMa){
      const thieu = top.filter((r) => String(r.pn).indexOf(ca.moiThePhaiCoMa) < 0);
      if (!top.length || thieu.length) { ok = false; vi.push("mọi gợi ý phải mang mã " + ca.moiThePhaiCoMa + ", đang lọt: " + (thieu.map((r) => r.sku).join(",") || "(rỗng)")); }
      if (!top.coMaKhop) { ok = false; vi.push("phải báo là CÓ khớp mã (top.coMaKhop=true)"); }
    }
    if (ca.khongCoMaKhop && top.coMaKhop) { ok = false; vi.push("không có mã nào khớp mà lại báo coMaKhop=true — giao diện sẽ không cảnh báo"); }
    if (ca.dvMong && (!top.length || top[0].dv !== ca.dvMong)) { ok = false; vi.push("ĐVT của #1 phải là " + ca.dvMong + ", đang " + (top[0] ? JSON.stringify(top[0].donVi) : "(rỗng)")); }
    if (ca.bienTheCoDv && (!top.length || !(top[0].bienThe || []).some((x) => x.dv === ca.bienTheCoDv)))
      { ok = false; vi.push("thẻ #1 phải liệt kê biến thể đơn vị " + ca.bienTheCoDv + ", đang có: " + ((top[0] || {}).bienThe || []).map((x) => x.donVi).join(",")); }
  }
  /* Bất biến chung mọi ca: đã gom biến thể thì đại diện KHÔNG được là đơn vị lớn hơn một biến thể
     nào đó (trừ khi tem in thẳng SKU nội bộ, lúc đó phải giữ đúng SKU người ta dán). */
  const tatCaScope = E.timTop(nhan, cm, { soLuong: 3, chiActive: false });
  for (const r of tatCaScope) {
    if (r.laSku) continue;
    const nhoHon = (r.bienThe || []).filter((x) => x.q < r.q);
    if (nhoHon.length) { ok = false; vi.push("phạm vi Tất cả: " + r.sku + " (" + r.donVi + ") bị biến thể đơn vị NHỎ HƠN qua mặt: " + nhoHon.map((x) => x.sku + "/" + x.donVi).join(",")); }
  }
  console.log((ok ? "  ✓ " : "  ✗ ") + ca.ten + "  (" + ms + "ms)");
  if (!ok || CHI_TIET) {
    console.log("      từ khoá: " + JSON.stringify(nhan));
    console.log(dong || "      (không có gợi ý nào)");
  }
  vi.forEach((v) => console.log("      → " + v));
  soCa++; ok ? dat++ : truot++;
}

/* ---------- 4. Tốc độ ---------- */
const nhanNang = nhanTuAI({ item_codes: ["8846295"], specs: ["38cm", "#3"], colors: ["345"], brands: ["YKK", "day keo"] });
let tong = 0;
for (let i = 0; i < 20; i++) { const a = performance.now(); E.timTop(nhanNang, cm, { soLuong: 3 }); tong += performance.now() - a; }
console.log("\n⏱ Đối soát trung bình " + (tong / 20).toFixed(1) + "ms/lượt (20 lượt, từ khoá phổ thông nhất) · dựng chỉ mục " + Math.round(tDung) + "ms");
console.log((truot ? "✗ " : "✓ ") + dat + "/" + soCa + " ca đạt" + (truot ? " — " + truot + " ca TRƯỢT" : ""));
process.exit(truot ? 1 : 0);
