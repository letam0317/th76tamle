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
  /* GIAI ĐOẠN 1-2 (chuanChuoiTem) — hai bẫy đã cắn NGAY LÚC VIẾT, cắt chữ thì im lặng mà hậu quả rộng:
       ① nhánh bắt "P/O NO" ăn luôn "Po" trong Polyester → "lyester" (mất rổ chất liệu của mọi tem)
       ② "COLOR:" bị cắt nửa thành "OR:"
     Và mẫu chữ ký nháy không được cắn vào giữa mã dài "HKM-DET.TT.10-163". */
  const donChu = [
    ["100% Polyester White", /polyester/i, true, "polyester phải còn nguyên"],
    ["ART: F9-5284 COLOR: Hong tro", /\bor\b/i, false, "cắt tiền tố phải cắt HẾT, không để lại 'OR'"],
    ["ART: F9-5284 COLOR: Hong tro", /f9-5284/i, true, "mã phải còn"],
    ["HKM-DET.TT.10-163 Triều Vĩ", /HKM-DET\.TT\.10-163/i, true, "mã dài còn nguyên"],
    ["QTY: 60 CONE NET: 12.5 KG DATE: 12/08/2026 INSPECTOR: NG.T.H", /inspector|12\/08|ng\.t\.h/i, false, "giấy tờ liên tiếp phải sạch hết"],
  ];
  const saiChu = donChu.filter(([t, re, phaiCo]) => re.test(E.chuanChuoiTem(t)) !== phaiCo);
  kiem("Dọn chữ giấy tờ (chuanChuoiTem) không cắt lẹm chữ thật",
    saiChu.length === 0,
    saiChu.length ? saiChu.map(([t, , , vs]) => vs + " → \"" + E.chuanChuoiTem(t) + "\"").join(" | ") : donChu.length + "/" + donChu.length + " ca dọn đúng");

  /* TRẦN ỨNG VIÊN: hạ 4.000 → 1.200 chỉ an toàn NHỜ ứng viên cân theo IDF. Hợp đồng: hai trần phải
     cho ra Top 3 GIỐNG HỆT trên bộ tem mô phỏng — không thì việc hạ trần là đang đánh đổi âm thầm. */
  {
    const hopLe = ds.filter((r) => r.status === "ACTIVE" && String(r.pn).split("/").length >= 5);
    const buoc = Math.max(1, Math.floor(hopLe.length / 120));
    let khac = 0, n = 0, d4 = 0, d12 = 0, b4 = 0, b12 = 0;
    for (let i = 0; n < 120 && i * buoc < hopLe.length; i++) {
      const r = hopLe[i * buoc]; n++;
      const dg = String(r.pn).split("/").map((x) => x.trim()).filter(Boolean);
      const chu = [dg[1] || "", dg[3] || "", dg[4] || ""].filter(Boolean).join("  ") +
        "\nP/O NO: 4500219877  LOT: 25/08-114  DATE: 12/08/2026";
      const nhan = E.tuVanBan(chu, cm), khoa = E.khoaHang(r.pn);
      const A = E.timTop(nhan, cm, { soLuong: 3, chiActive: true, tranUngVien: 4000 });
      const B = E.timTop(nhan, cm, { soLuong: 3, chiActive: true, tranUngVien: 1200 });
      const kA = A.map((x) => E.khoaHang(x.pn)), kB = B.map((x) => E.khoaHang(x.pn));
      if (kA[0] === khoa) d4++; if (kB[0] === khoa) d12++;
      if (kA.indexOf(khoa) >= 0) b4++; if (kB.indexOf(khoa) >= 0) b12++;
      if (A.map((x) => x.sku).join() !== B.map((x) => x.sku).join()) khac++;
    }
    /* Hợp đồng là ĐỘ CHÍNH XÁC không tụt, KHÔNG phải "danh sách giống từng chữ": khi nhiều dòng cùng
       điểm (ví dụ 5 dòng đều 95%) thì thứ tự trong nhóm đó vốn tuỳ ý, nên đòi giống hệt là đòi một
       thứ không có nghĩa. Đo 19/08: ca duy nhất lệch là một nhóm 95% và CẢ HAI trần đều sai như nhau. */
    kiem("Hạ trần ứng viên 4.000 → 1.200 KHÔNG làm tụt độ chính xác (nhờ xếp ứng viên theo IDF)",
      d12 >= d4 && b12 >= b4,
      "Top-1 " + d4 + "→" + d12 + "/" + n + " · Top-3 " + b4 + "→" + b12 + "/" + n + " · " + khac + " tem xáo thứ tự trong nhóm bằng điểm");
  }

  /* Người chấm IDF (4 giai đoạn) phải CHẠY ĐƯỢC và không phá luật nghiệp vụ nào — nó là đường dự
     phòng có công tắc, đo bằng `qc-cham-idf.mjs`. Ở đây chỉ khoá: bật lên không vỡ, tắt lại như cũ. */
  {
    const nhan = E.tuAI({ item_codes: ["JC01262"], specs: ["17mm"], colors: ["matt silver"], brands: ["MORITO"] }, cm);
    E.datCham("idf");
    const idf = E.timTop(nhan, cm, { soLuong: 3, chiActive: true });
    E.datCham("vai");
    const vai = E.timTop(nhan, cm, { soLuong: 3, chiActive: true });
    kiem("Công tắc datCham('idf') chạy được, vẫn giữ luật COMBO không đứng đầu, tắt lại về đúng bản cũ",
      idf.length > 0 && idf[0].type !== "COMBO" && !idf[0].gop && vai.length > 0 && E.kieuCham() === "vai",
      "idf #1 " + idf[0].sku + "/" + idf[0].pct + "% · vai #1 " + vai[0].sku + "/" + vai[0].pct + "%");
  }

  /* SỰ CỐ THẬT 19/08/2026 (chiều muộn): gõ `c2080` — mã CÓ trong danh mục, 3 SKU — nhưng **cả 3 đều
     bán theo "Cuộn 5000m"** ⇒ luật "hàng đóng gói không được đứng đầu" (lúc đó là luật TOÀN CỤC) đẩy
     chúng xuống hạng 29-31, nhường 28 dòng chỉ khớp mỗi chữ "lavender" (50%). Thủ kho thấy y như
     "gợi ý vẫn theo lần tra trước". Chữa: luật đóng gói chỉ so khi hai bên CÙNG mức "có mã". */
  const cuon = ds.filter((r) => /c2080/i.test(r.pn) && r.status === "ACTIVE");
  const nhanCuon = E.tuAI({ item_codes: ["c2080"], specs: [], colors: ["lavender"], brands: [] }, cm);
  const topCuon = E.timTop(nhanCuon, cm, { soLuong: 3, chiActive: true, loc: ["c2080", "lavender"] });
  kiem("Mã có thật mà MỌI SKU của nó đều là cuộn/combo → vẫn phải lên đầu (đóng gói không được đè định danh)",
    cuon.length >= 2 && cuon.every((r) => /cuộn/i.test(r.pn)) && topCuon.length > 0 &&
    topCuon.slice(0, 2).every((r) => /c2080/i.test(r.pn)) && topCuon[0].type !== "COMBO",
    topCuon.map((r) => r.sku + "/" + r.pct + "%" + (r.type === "COMBO" ? "(COMBO)" : "")).join(" · "));
  /* Mặt ngược: TRONG CÙNG một mặt hàng thì combo vẫn phải xuống sau bản đếm được (luật kho cũ vẫn
     nguyên) — hai dòng này cùng mang mã c2080 nên luật đóng gói được quyền nói.
     Từ 20/08/2026 KHÔNG khoá cứng "COMBO đứng ngay hạng 2" nữa: COMBO phải xuống sau MỌI dòng
     NORMAL cùng mức bằng chứng, nên nó có thể rơi xuống hạng 3+. */
  const viComboCuon = topCuon.findIndex((r) => r.type === "COMBO");
  kiem("… nhưng bản (Combo) vẫn xuống sau MỌI bản NORMAL cùng mang mã",
    topCuon.length >= 2 && topCuon[0].type === "NORMAL" &&
    (viComboCuon < 0 || topCuon.slice(0, viComboCuon).every((r) => r.type === "NORMAL")),
    topCuon.map((r) => r.sku + "/" + r.type).join(" · "));

  /* SỰ CỐ THẬT 20/08/2026: thủ kho báo "tem C2080 mà gợi ý ra SKU combo". Đọc lại luật thì thấy
     `(type==='COMBO' || gop)` bị gộp thành MỘT bậc ⇒ khi CẢ HAI dòng đều là "Cuộn 5000m" thì bậc đó
     im hẳn, thứ tự rơi xuống TỒN. Tồn thật của 422394068 ở kho 1178 là 154 (danh mục chỉ thấy 12 của
     kho 1177) ⇒ chỉ cần tồn đổi chiều là COMBO chiếm hạng 1. Ca này ép đúng tình huống đó. */
  {
    const cb = ds.find((r) => r.type === "COMBO" && r.status === "ACTIVE" && /c2080/i.test(r.pn));
    const nm = cb && ds.find((r) => r.type === "NORMAL" && r.status === "ACTIVE" &&
      r.pn.replace(/\s+/g, " ").trim() === cb.pn.replace(/^\(Combo\)\s*/i, "").replace(/\s+/g, " ").trim());
    if (cb && nm) {
      const dsX = ds.map((r) => (r.sku === cb.sku ? Object.assign({}, r, { qty: (Number(nm.qty) || 0) + 1000 }) : r));
      const cmX = E.dungChiMuc(dsX);
      const topX = E.timTop(E.tuAI({ item_codes: ["c2080"], specs: ["tex 27", "tkt 120"], colors: [], brands: ["COATS"] }, cmX),
        cmX, { soLuong: 3, chiActive: true });
      /* Đừng khoá theo SKU cụ thể: khi danh mục đã có bản `/mm` (sau `--bu-bien-the`) thì đại diện
         nhóm là bản /mm chứ không phải bản cuộn — cái phải khoá là "COMBO không được đứng đầu". */
      const viCombo = topX.findIndex((r) => r.sku === cb.sku);
      kiem("COMBO có TỒN NHIỀU HƠN bản NORMAL (cùng mã, cùng cuộn) → vẫn không được đứng đầu",
        topX.length > 0 && topX[0].type === "NORMAL" && viCombo !== 0 &&
        (viCombo < 0 || topX.slice(0, viCombo).every((r) => r.type === "NORMAL")),
        topX.map((r) => r.sku + "/" + r.type + "/tồn " + r.qty).join(" · "));
    } else kiem("COMBO có TỒN NHIỀU HƠN bản NORMAL → vẫn không được đứng đầu", true, "(danh mục không có cặp COMBO/NORMAL c2080 để thử)");
  }

  /* SỰ CỐ 20/08/2026, phần GỐC: bản đơn vị nhỏ của mặt hàng (422304419 `/mm`) chỉ sống ở kho BÁN
     THÀNH PHẨM nên không có trong danh mục ⇒ tab chỉ gợi ý được bản `/Cuộn 5000m`. Sau khi
     `--bu-bien-the` nhặt nó về, nó vào với TỒN 0 (tồn thật ở kho khác) ⇒ phải kiểm 2 việc: nó lên
     đại diện nhóm, VÀ nó không bị luật "ACTIVE trước" đẩy xuống dưới mấy dòng chỉ khớp chữ chung. */
  {
    const cuonNL = ds.find((r) => r.sku === "422266550");
    if (cuonNL) {
      const mm = { sku: "422304419", pn: cuonNL.pn.replace(/\/Cuộn 5000m$/i, "/mm"), type: "NORMAL", status: "INACTIVE", qty: 0, unit: "mm" };
      /* Danh mục đã có sẵn dòng này (sau `--bu-bien-the`) thì đừng nhân đôi — ca test phải cho cùng
         kết quả ở CẢ hai đường nạp danh mục (bản nháp sync cũ · gviz live). */
      const cmM = E.dungChiMuc(ds.some((r) => r.sku === mm.sku) ? ds : ds.concat([mm]));
      const nhanM = E.tuAI({ item_codes: ["c2080"], specs: ["tex 27", "tkt 120", "5000m"], colors: [], brands: ["COATS"] }, cmM);
      const topM = E.timTop(nhanM, cmM, { soLuong: 3, chiActive: true });
      const bt = (topM[0] || {}).bienThe || [];
      kiem("Cả nhóm chỉ còn bản CUỘN còn sống → bản /mm (tồn 0) lên đại diện, không bị tụt vì INACTIVE",
        topM.length > 0 && topM[0].sku === "422304419" && topM[0].pct >= 90 &&
        bt.some((x) => x.sku === "422266550"),
        topM.map((r) => r.sku + "/" + r.pct + "%/" + r.status).join(" · ") + " · biến thể: " + bt.map((x) => x.sku + "·" + x.donVi).join(", "));
      /* Mặt trái phải khoá — HAI ca ngược nhau, đúng đường biên của luật:
         (i) nhóm chết hoàn toàn mà CHỈ khớp chữ chung ⇒ vẫn không được gợi ý (ngoại lệ đơn vị nhỏ
             không được nới thành "cứ chết là cho hiện");
         (ii) nhóm chết hoàn toàn mà MANG ĐÚNG MÃ in trên tem ⇒ PHẢI hiện (luật "định danh thắng
             phạm vi" 20/08/2026, sinh ra từ ca thẻ mẫu SMPA01 tồn 0). */
      const chet = [
        { sku: "999000001", pn: "Vật tư thử QC/ZZQC-0001_QCTest/Polyester/None/None/None/None/cuộn", type: "NORMAL", status: "INACTIVE", qty: 0, unit: "cuộn" },
        { sku: "999000002", pn: "Vật tư thử QC/ZZQC-0001_QCTest/Polyester/None/None/None/None/mm", type: "NORMAL", status: "INACTIVE", qty: 0, unit: "mm" },
      ];
      const cmC = E.dungChiMuc(ds.concat(chet));
      const topChung = E.timTop(E.tuAI({ item_codes: [], specs: [], colors: [], brands: ["QCTest"] }, cmC), cmC, { soLuong: 3, chiActive: true });
      kiem("Nhóm CHẾT HOÀN TOÀN, chỉ khớp chữ chung → vẫn không được gợi ý",
        !topChung.some((r) => String(r.sku).indexOf("999000") === 0),
        topChung.length ? topChung.map((r) => r.sku + "/" + r.pct + "%").join(" · ") : "(không có gợi ý nào)");
      const topMa = E.timTop(E.tuAI({ item_codes: ["zzqc-0001"], specs: [], colors: [], brands: [] }, cmC), cmC, { soLuong: 3, chiActive: true });
      kiem("… nhưng MANG ĐÚNG MÃ tem thì tồn 0 vẫn phải hiện (định danh thắng phạm vi)",
        topMa.length > 0 && String(topMa[0].sku).indexOf("999000") === 0 && topMa[0].status === "INACTIVE",
        topMa.map((r) => r.sku + "/" + r.pct + "%/" + r.status).join(" · "));
    } else kiem("Cả nhóm chỉ còn bản CUỘN → bản /mm lên đại diện", true, "(danh mục không có 422266550 để thử)");
  }

  /* SỰ CỐ THẬT 20/08/2026 (chiều) — tem chỉ Lenio F0-1588: tab gợi ý 3 dòng "Chỉ Lenio MẪU" thay vì
     dòng đúng 422487060. Gốc KHÔNG phải kho mẫu mà là MỘT MẢNH BỊ XẾP SAI RỔ: tem in "5000 M"
     (chiều dài cuộn) ⇒ mảnh "5000" rơi vào rổ MÀU ⇒ so với mã màu THẬT của dòng đúng
     ("19-3911", "PD00695MIM") ⇒ XUNG ĐỘT MÃ MÀU GIẢ, trừ 18% ⇒ 88% tụt còn 59%. Mấy dòng "mẫu" ghi
     THIẾU mã màu nên KHÔNG có gì để lệch, thoát án và leo lên hạng 1 — đúng mặt trái đã ghi ở mục 5b
     (ca Morito): dòng ghi ĐỦ bị phạt, dòng ghi THIẾU được thưởng.
     Chữa: số TRẦN từ 4 chữ số trở lên (>= 1000) không phải mã màu (mã màu thật là "345", "074",
     "19-3911", "V8S41", "PD00695MIM"), lọc ở CẢ hai phía tem và danh mục bằng cùng một hàm. */
  {
    const CHU_LENIO = "THESEUS Lenio Made in Vietnam 100D/2 5000 M Tkt120 Tex 24 MA H26/33367 F0-1588";
    const nhanL = E.tuVanBan(CHU_LENIO, cm);
    const topL = E.timTop(nhanL, cm, { soLuong: 3, chiActive: true });
    const dungRoi = ds.find((r) => r.sku === "422487060");
    const lech = topL[0] && (topL[0].xungDot || []).indexOf("mamau") >= 0;
    kiem("Tem in \"5000 M\" → 5000 KHÔNG bị coi là mã màu, dòng ghi ĐỦ mã màu không bị phạt oan",
      !!dungRoi && topL.length > 0 && topL[0].sku === "422487060" && !lech,
      topL.map((r) => r.sku + "/" + r.pct + "%" + ((r.xungDot || []).length ? "[" + r.xungDot.join(",") + "]" : "")).join(" · "));
    /* Mặt ngược phải giữ: mã màu THẬT (2-3 chữ số, có gạch, hoặc chữ-số) vẫn phải sinh xung đột —
       đây là thứ tách được 102 biến thể dây kéo cùng mã 8846295, đừng nới. */
    const nhanMau = E.tuAI({ item_codes: ["8846295"], specs: ["38cm"], colors: ["345"], brands: ["YKK"] }, cm);
    const topMau = E.timTop(nhanMau, cm, { soLuong: 3, chiActive: true });
    const coLech = topMau.some((r) => (r.xungDot || []).indexOf("mamau") >= 0) ||
      (topMau[0] && String(topMau[0].pn).indexOf("345") >= 0);
    kiem("… nhưng mã màu THẬT (345) vẫn phân biệt được biến thể (không nới luật)",
      topMau.length > 0 && coLech,
      topMau.map((r) => r.sku + "/" + r.pct + "%").join(" · ") + " · #1: " + String((topMau[0] || {}).pn || "").slice(0, 62));
  }

  /* SỰ CỐ THẬT 20/08/2026 (thẻ mẫu CMTS07) — HAI lỗi tách rời, tem này trúng cả hai:
     ① TỈ LỆ CHẤT LIỆU bị nhận là MÃ HÀNG: "60%Cotton"/"40%Poly" cũng "chữ lẫn số" nên vào rổ MÃ
        (nặng 45%) ⇒ mọi dòng chứa "60% Cotton" đều được đánh dấu CÓ MÃ ⇒ luật cứng "CÓ MÃ" mất sạch
        sức phân biệt: một "Áo Mẫu FT/CMPO0015" 44% (ACTIVE) leo lên hạng 1, đè 16 dòng mang ĐÚNG mã
        CMTS07 (61%, tồn 0).
     ② MÀU VIỆT ↔ ANH không nối: thẻ ghi "Màu sắc: ĐEN", tên hàng WMS ghi "…/Black/Size XL" ⇒ rổ màu
        hai bên không có chữ nào chung ⇒ "Coconut Milk" và "Black" cùng 61%, máy không biết cái nào
        là đen. Nối một chiều Anh→Việt lúc dựng chỉ mục. */
  {
    const CHU_MAU = "THE THONG TIN MAU LOAI MAU: Mau doi Ma san pham: CMTS07 Ten san pham: HENLEY-T-SHIRT_MAN_REGULAR_PIQUE " +
      "Size: XL Nguyen phu lieu: Dung X Thay the Thanh phan vai: BH-P006-PIQUE 60%Cotton + 40%Poly - 275gsm Mau sac: DEN";
    const nhanM = E.tuVanBan(CHU_MAU, cm);
    /* `tuVanBan` LỌC mảnh theo danh mục, nên "cmts07" chỉ có mặt khi danh mục có kho mẫu (đường
       --gviz). Phần khoá được ở MỌI đường nạp là: không mảnh `%` nào lọt vào rổ MÃ. */
    kiem("Tỉ lệ chất liệu (60%Cotton · 40%Poly) KHÔNG được vào rổ MÃ",
      !nhanM.code.some((t) => /%/.test(t)),
      "code = " + JSON.stringify(nhanM.code));
    const coCmts = ds.some((r) => /cmts07/i.test(r.pn));
    if (coCmts) {
      kiem("… và mã sản phẩm CMTS07 vẫn được nhận là MÃ", nhanM.code.indexOf("cmts07") >= 0,
        "code = " + JSON.stringify(nhanM.code));
      const topM = E.timTop(nhanM, cm, { soLuong: 3, chiActive: true });
      kiem("Thẻ mẫu CMTS07 → Top 3 phải TOÀN dòng mang CMTS07 (không còn dòng lạ chen lên)",
        topM.length > 0 && topM.every((r) => /cmts07/i.test(r.pn)),
        topM.map((r) => r.sku + "/" + r.pct + "%").join(" · "));
      kiem("… và màu ĐEN của thẻ khớp được dòng ghi \"Black\" (nối màu Anh→Việt)",
        topM.length > 0 && /\/Black\//i.test(topM[0].pn),
        "#1 = " + topM[0].sku + " · " + String(topM[0].pn).slice(0, 66));
    } else kiem("Thẻ mẫu CMTS07 → Top 3 toàn dòng mang CMTS07", true, "(danh mục này chưa có kho mẫu)");
    /* ⚠ Nối màu phải MỘT CHIỀU: NCC "Trang Nhã" bỏ dấu thành `trang`, trùng chữ "trắng" — nối hai
       chiều là mọi dòng của NCC đó tự nhận màu `white` (bộ đối chứng 30 lượt bắt được: biến thể Navy
       đè biến thể White đúng). Ca này khoá lại chiều đó. */
    const nhaTrang = ds.filter((r) => /Trang Nhã/i.test(r.pn) && !/white|trắng/i.test(r.pn)).slice(0, 40);
    const bleed = nhaTrang.filter((r) => (r._b.color || []).indexOf("white") >= 0);
    kiem("Nối màu KHÔNG chảy ngược: dòng của NCC \"Trang Nhã\" không tự nhận màu white",
      nhaTrang.length > 0 && bleed.length === 0,
      "kiểm " + nhaTrang.length + " dòng · số dòng bị gán oan white: " + bleed.length);
  }

  /* SỰ CỐ THẬT 21/08/2026 (ảnh thẻ mẫu CWHO0006 do user gửi) — "gợi ý SKU sai hoàn toàn".
     Thẻ "THẺ THÔNG TIN MẪU" in đủ 10 trường; trường "Thành phần vải" chép gần như NGUYÊN VĂN
     PRODUCTNAME của một SKU VẢI có thật. Đọc cả thẻ như một túi chữ thì SKU vải THẮNG:
       cũ:  #1 422423807 Vải Single Mesh/S130413 UZM Sheico/…/152cm/Xanh Tro-Dusky Green/mm   93%
            #4 422495218 Mẫu thông chuyền/CWHO0006/…/Xanh Tro-Dusky Green/Size S             87%
     Hai nguyên nhân tách rời, thẻ này trúng cả hai:
       ① vai MÃ chấm theo mã khớp TỐT NHẤT ⇒ dòng vải chỉ khớp mã VẢI (s130413) ăn điểm y như dòng
          đúng khớp CẢ mã vải lẫn mã áo (cwho0006). Mã sau nhãn "Mã sản phẩm" mới là ĐỊNH DANH.
       ② vai THÔNG SỐ: dòng vải còn ăn thêm "152cm" (KHỔ VẢI, thuộc nguyên liệu chứ không thuộc cái
          áo) ⇒ dòng ĐÚNG bị phạt vì KHÔNG có khổ vải. Còn "Size: S" trên thẻ thì bị đánh rơi cả hai
          phía ("size" trong TU_BO, "S" 1 ký tự) nên không bù lại được. */
  {
    const CHU_HOODIE = [
      "THẺ THÔNG TIN MẪU",
      "LOẠI MẪU: Mẫu thông chuyền",
      "Mã sản phẩm: CWHO0006",
      "Tên sản phẩm: Women_Hoodie_Full-zip_Anti-UV_Regular",
      "Size: S",
      "Nguyên phụ liệu: Đúng X Thay thế",
      "Thành phần vải: Vải Single Mesh/S130413 UZM Sheico/88% Re-Polyester, 12%Spandex/170 Gsm, 152cm",
      "Màu sắc: Xanh Tro-Dusky Green",
      "Phụ liệu: Đầy đủ",
      "NV may mẫu:",
      "Ngày thực hiện:",
    ].join("\n");
    const nhanH = E.tuVanBan(CHU_HOODIE, cm);
    /* Khoá được ở MỌI đường nạp danh mục: nhãn trường không được sinh ra bằng chứng giả. */
    kiem("Nhãn \"Màu sắc:\" KHÔNG được biến thành màu BẠC (sac → bac)",
      nhanH.color.indexOf("bac") < 0,
      "color = " + JSON.stringify(nhanH.color));
    kiem("Chữ NHÃN của thẻ (loại mẫu · mã sản phẩm · ngày thực hiện) không vào rổ nào",
      !["loai", "san", "pham", "sac", "thuc", "hien"].some((t) => nhanH.brand.indexOf(t) >= 0),
      "brand = " + JSON.stringify(nhanH.brand.slice(0, 12)) + "…");
    kiem("\"Size: S\" được ghép thành mảnh cỡ szs ở rổ THÔNG SỐ (trước đây rơi mất)",
      nhanH.spec.indexOf("szs") >= 0,
      "spec = " + JSON.stringify(nhanH.spec));
    kiem("… và tên hàng WMS \"…/Size S\" cũng ghép ra szs (hai phía dùng CÙNG một hàm)",
      (E.bocTen("Mẫu thông chuyền/CWHO0006/170gsm/Regular/Xanh Tro-Dusky Green/Size S").spec || []).indexOf("szs") >= 0,
      "spec của tên hàng = " + JSON.stringify(E.bocTen("…/Regular/Xanh Tro-Dusky Green/Size S").spec));
    /* Cỡ S · XL · XS phải là BA mảnh khác nhau, không được khớp mờ với nhau — nếu không thì 5 biến
       thể cỡ của cùng một mã lại cào bằng như trước. */
    kiem("Cỡ szs / szxl / szxs không khớp mờ lẫn nhau",
      E.khopTot("szs", ["szxl"]) < 0.75 && E.khopTot("szs", ["szxs"]) < 0.75 && E.khopTot("szxl", ["szxxl"]) < 0.75,
      "szs~szxl=" + E.khopTot("szs", ["szxl"]).toFixed(2) + " · szs~szxs=" + E.khopTot("szs", ["szxs"]).toFixed(2) +
      " · szxl~szxxl=" + E.khopTot("szxl", ["szxxl"]).toFixed(2));
    /* ⚠ BẪY ĐÃ CẮN NGAY LÚC VIẾT: mẫu cỡ dùng \\b thì dấu gạch/chấm cũng là biên, nên một mã NCC
       kiểu "SZL-123" bị cắt thành "szl" + "123" — mất sạch bằng chứng định danh mà không một dấu
       hiệu nào. Biên phải là KHOẢNG TRẮNG (RE_GHEP_CO luôn nhả mảnh có khoảng trắng hai đầu). */
    kiem("Mã NCC chứa \"sz\" (SZL-123 · F9-SZM.44) KHÔNG bị mẫu cỡ cắt đôi",
      (E.bocTen("SZL-123 Coats").code || []).indexOf("szl-123") >= 0 &&
      (E.bocTen("F9-SZM.44").code || []).indexOf("f9-szm.44") >= 0,
      "SZL-123 → " + JSON.stringify(E.bocTen("SZL-123 Coats").code) +
      " · F9-SZM.44 → " + JSON.stringify(E.bocTen("F9-SZM.44").code));
    /* ⚠ MẶT NGƯỢC PHẢI GIỮ: tem NCC KHÔNG có nhãn "Size" (in "20-52mm-XS") vẫn phải khớp được với
       dòng ghi "Size XS" — mảnh cỡ TRẦN được giữ lại bên cạnh mảnh szxs, không bị thay thế. */
    kiem("Tem không có nhãn Size vẫn giữ mảnh cỡ TRẦN (xs) để khớp dòng \"Size XS\"",
      (E.bocTen("Nhãn care 20-52mm-XS").all || []).indexOf("xs") >= 0 &&
      (E.bocTen("Nhãn dệt/None/Size XS/pcs").all || []).indexOf("xs") >= 0,
      "tem = " + JSON.stringify(E.bocTen("Nhãn care 20-52mm-XS").all) +
      " · tên hàng = " + JSON.stringify(E.bocTen("Nhãn dệt/None/Size XS/pcs").all));

    const coHoodie = ds.some((r) => r.sku === "422495218");
    if (coHoodie) {
      kiem("Nhãn \"Mã sản phẩm:\" cho ra MÃ CHỦ cwho0006 (mã vải s130413 thì không)",
        (nhanH.maChu || []).length === 1 && nhanH.maChu[0] === "cwho0006",
        "maChu = " + JSON.stringify(nhanH.maChu || []));
      const topH = E.timTop(nhanH, cm, { soLuong: 3, chiActive: true });
      kiem("Thẻ mẫu CWHO0006 → #1 phải là ÁO MẪU đúng màu/cỡ (422495218), không phải cuộn vải",
        topH.length > 0 && topH[0].sku === "422495218",
        topH.map((r) => r.sku + "/" + r.pct + "%").join(" · ") + " · #1: " + String((topH[0] || {}).pn || "").slice(0, 70));
      kiem("… và Top 3 KHÔNG còn dòng nào là vải Single Mesh (422423807)",
        topH.every((r) => r.sku !== "422423807"),
        "Top 3 = " + topH.map((r) => r.sku).join(" · "));
      /* Dòng vải vẫn được chấm (nó có mặt trên thẻ thật), chỉ mất quyền nói "tôi là món hàng này". */
      const vai = E.diemMot(nhanH, ds.find((r) => r.sku === "422423807")._b, cm);
      const ao = E.diemMot(nhanH, ds.find((r) => r.sku === "422495218")._b, cm);
      kiem("… điểm phải nói đúng chuyện: áo mẫu (có mã chủ) cao hơn cuộn vải (không có)",
        ao.diem > vai.diem && ao.coMa && !vai.coMa,
        "áo " + Math.round(ao.diem * 100) + "% (coMa=" + ao.coMa + ") · vải " + Math.round(vai.diem * 100) + "% (coMa=" + vai.coMa + ")");
    } else kiem("Thẻ mẫu CWHO0006 → #1 là áo mẫu 422495218", true, "(danh mục này chưa có kho mẫu)");

    /* AN TOÀN: mã chủ chỉ được công nhận khi DANH MỤC LÀM CHỨNG. Thẻ ghi mã chưa có trong danh mục
       thì maChu phải RỖNG và lõi chấm y như trước — không được im lặng loại sạch mọi ứng viên. */
    const nhanLa = E.tuVanBan("THẺ THÔNG TIN MẪU\nMã sản phẩm: ZZQQ9999\nMàu sắc: Đen", cm);
    kiem("Mã chủ KHÔNG có trong danh mục → maChu rỗng (không loại oan mọi ứng viên)",
      (nhanLa.maChu || []).length === 0,
      "maChu = " + JSON.stringify(nhanLa.maChu || []));
    /* Tem NCC thường (không phải biểu mẫu) phải đi y đường cũ: không nhãn, không mã chủ. */
    const nhanNcc = E.tuVanBan("THESEUS IRISA Tkt120 Tex 27 60/3 F9-5284 Hồng tro 5000m", cm);
    kiem("Tem NCC thường (không có nhãn trường) → maChu rỗng, đi đúng đường cũ",
      (nhanNcc.maChu || []).length === 0 && nhanNcc.code.indexOf("f9-5284") >= 0,
      "maChu = " + JSON.stringify(nhanNcc.maChu || []) + " · code = " + JSON.stringify(nhanNcc.code));
  }

  /* SỰ CỐ THẬT 20/08/2026 (chiều muộn) — tem cuộn chỉ COATS astra, nhãn màu in "Col C3185":
     OCR trả về DÍNH LIỀN ("ColC3185") hoặc đọc lệch chữ ("COIC3185", l→I) ⇒ token `colc3185` không
     có trong chỉ mục ⇒ luật cứng "CÓ MÃ" không bắn ⇒ tab đưa 3 cuộn chỉ astra khác màu ở 32% kèm
     banner "Chưa khớp được MÃ HÀNG nào". `coTuGanGiong` chỉ GIỮ token chứ không SỬA nó.
     Chữa: `suaMaTheoDanhMuc` — DANH MỤC LÀM CHỨNG, không đoán bừa. */
  {
    const goc = ds.find((r) => /C3185/i.test(r.pn) && r.type === "NORMAL");
    const DUOI = "COATS astra Made in Vietnam Staple Spun Polyester 5000m Tex 27 Tkt 120 8754 VPDG 427993349 ";
    if (goc) {
      [["dính liền", "ColC3185"], ["dấu chấm", "Col.C3185"], ["OCR l→I", "COIC3185"], ["đúng chuẩn", "Col C3185"]]
        .forEach(([ten, ma]) => {
          const nh = E.tuVanBan(DUOI + ma, cm);
          const tp = E.timTop(nh, cm, { soLuong: 1, chiActive: true });
          kiem("Tem \"" + ma + "\" (" + ten + ") → sửa về mã có thật rồi ra đúng SKU",
            nh.code.indexOf("c3185") >= 0 && !!tp.coMaKhop && tp.length > 0 && tp[0].sku === goc.sku,
            "code=" + JSON.stringify(nh.code) + " · #1=" + ((tp[0] || {}).sku || "-") + "/" + ((tp[0] || {}).pct || 0) + "%");
        });
      /* KHÓA MẶT TRÁI: lệch 1 ký tự mà có ≥2 ứng viên thì TUYỆT ĐỐI không tự đổi (thà không khớp còn
         hơn khớp sai hàng) — danh mục có cả c3185 và c3184. */
      const nhLech = E.tuVanBan(DUOI + "Col C3186", cm);
      kiem("… nhưng lệch 1 ký tự mà có ≥2 ứng viên (c3185 · c3184) thì KHÔNG tự đổi",
        nhLech.code.indexOf("c3185") < 0 && nhLech.code.indexOf("c3184") < 0,
        "code=" + JSON.stringify(nhLech.code) + " · ứng viên: " + JSON.stringify(E.maGanGiong("c3186", cm, 4)));
      kiem("… và lúc đó phải MỜI CHỌN mã có thật gần nhất (\"Ý bạn là…\")",
        E.maGanGiong("c3186", cm, 4).indexOf("c3185") >= 0,
        JSON.stringify(E.maGanGiong("c3186", cm, 4)));
    } else kiem("Tem ColC3185 → sửa về mã có thật", true, "(danh mục không có C3185 để thử)");
    /* Không bao giờ TỰ NGHĨ RA mã: mảnh không giống mã nào trong danh mục thì trả rỗng. */
    kiem("maGanGiong KHÔNG tự nghĩ ra mã (mảnh lạ → rỗng)",
      E.maGanGiong("zzq99887", cm, 4).length === 0 && E.maGanGiong("c3185", cm, 4).length === 0,
      "mảnh lạ: [] · mã đã có nguyên văn: [] (không cần mời chọn)");
  }

  /* GÕ MẢNH CHUNG: "polyester" một mình thì hàng trăm dòng cùng phủ 1/1 = 100%. Nhóm cùng độ phủ
     phải xếp tiếp bằng ĐIỂM KHỚP TEM, không phải bằng đơn vị/tồn (thủ kho báo 19/08: thấy
     "100,100,100%" rồi chọn nhầm). Ca này: cùng mảnh chung + từ khoá tem của dây kéo 8846295 màu
     345 thì dòng đúng phải lên #1 dù cả nhóm đều 100% độ phủ. */
  const nhanChung = E.tuAI({ item_codes: ["8846295"], specs: ["38cm"], colors: ["345"], brands: ["YKK"] }, cm);
  const topLoc = E.timTop(nhanChung, cm, { soLuong: 3, chiActive: true, loc: ["polyester"] });
  kiem("Gõ mảnh CHUNG (polyester) → cùng độ phủ thì xếp tiếp bằng điểm khớp tem",
    topLoc.length > 0 && String(topLoc[0].pn).indexOf("8846295") >= 0 && topLoc[0].pct === 100,
    topLoc.map((r) => r.sku + "/" + r.pct + "%").join(" · ") + " · #1: " + String((topLoc[0] || {}).pn || "").slice(0, 58));

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
  /* Kiểm HỆ QUẢ, không kiểm cơ chế: mảnh giấy tờ không được có mặt trong BẤT KỲ vai nào. Nó bị loại
     ở đâu thì tuỳ — từ 19/08/2026 số lô/ngày/chữ ký nháy bị `chuanChuoiTem` cắt ngay ở mức chuỗi
     (nên KHÔNG còn xuất hiện trong `bo` nữa), còn số PO thì rơi ở bước lọc theo danh mục. Bản đầu
     của ca này kiểm `bo` chứa đủ 4 mảnh ⇒ đỏ oan khi bước dọn tốt lên. */
  const moiVai = ["code", "spec", "color", "brand"].reduce((a, v) => a.concat(nv[v] || []), []);
  const conLot = ["4500219877", "25-08-114", "12-08-2026", "inspector", "ng.t.h"].filter((t) => moiVai.indexOf(t) >= 0);
  kiem("Mảnh giấy tờ (số PO · số lô · ngày · chữ ký nháy) KHÔNG vào vai nào",
    conLot.length === 0,
    conLot.length ? "còn lọt: " + conLot.join(",") : "sạch — " + (nv.bo || []).length + " mảnh bị lọc theo danh mục, phần còn lại đã cắt ở mức chuỗi");

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
