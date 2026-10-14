// dieu-phoi.mjs — BO LUAT DIEU PHOI VIEC cho N PC (1..nhieu may).
// =====================================================================================
// Nguyen tac (user 12/10/2026):
//   - It may  -> 1 may GANH NHIEU viec (vi may uu tien cao hon da chet -> no la may song cao nhat cho nhieu viec).
//   - Nhieu may -> BAM NHO: viec trai deu theo SUC tung may (chiaViec, 14/10) — khong de 1 may om het.
//   - Theo SUC KHOE: viec NANG ma may dinh chay dang YEU (RAM trong < nguong) -> nhuong may ke; khong may nao
//     khoe thi viec nang HOAN (khong chay tick nay). Viec NHE khong gac suc khoe.
//   - Moi viec chi 1 may chay (deterministic theo thu tu uu tien) -> khong tang luot goi upstream, khong ghi doi.
//
// Quyet dinh HOAN TOAN CUC BO + deterministic tu "bang nhip tim" (board) nen KHONG can khoa atomic tren GAS:
//   moi may doc cung board -> tinh ra cung "ai chay viec X" -> chi may do chay.
//
// board = [{ may, ramTrongPct, yeu, luc(ISO) }, ...]  (lay tu GAS qua nhip-pc.mjs; may nay luon co trong board)
// cfg   = dieu-phoi.json: { hetHanPhut, viec: [{ ten, nang, uuTien:[ "<ten may>"... ] }] }
//
// API:
//   maySong(board, now, hetHanPhut)         -> Map<may, hb>  (nhip con tuoi)
//   chiaViec(board, now, cfg)                -> { tenViec: tenMay|null } CHIA DEU theo suc (14/10)
//   mayChay(viec, board, now, cfg)           -> ten may se chay viec nay (hoac null neu hoan)
//   viecCuaToi(thisMay, board, cfg, now)     -> [ten viec] may nay nen chay ngay bay gio
//   nenChay(thisMay, tenViec, board, cfg)    -> true/false cho 1 viec (dung o dau moi co)

export function maySong(board, now = Date.now(), hetHanPhut = 8) {
  const m = new Map();
  for (const hb of board || []) {
    const t = Date.parse(hb.luc || 0);
    if (hb.may && t && now - t <= hetHanPhut * 60000) m.set(hb.may, hb);
  }
  return m;
}

// May se chay viec. HAI che do:
//  (a) viec.uuTien co -> theo thu tu khai tay (ghim), lay may song dau tien (viec nang: bo may yeu).
//  (b) KHONG uuTien (mac dinh) -> CHIA DEU THEO SUC (14/10 user «chia việc theo sức khoẻ chứ sao lại từ trái sang phải»):
//      truoc day chon may DIEM cao nhat cho MOI viec -> may manh nhat om het 13 viec, may khac ngoi cho. Nay:
//      - SUC CHUA may = diem suc manh (may YEU thi chi tinh 1/2) — dung diem (co dinh) + co yeu (co tre 30/40%) nen
//        bang giao viec KHONG nhay qua lai moi nhip theo RAM.
//      - TAI viec: nang = 3 phan, nhe = 1 phan. Xep viec: nang truoc, it may du dieu kien truoc, roi theo ten.
//      - Lan luot tung viec giao cho may du dieu kien ma SAU KHI NHAN co (tai / suc chua) NHO NHAT
//        (hoa -> diem cao hon -> ten may nho hon). Viec nang chi vao may KHOE; moi may du khoa deu yeu -> may nhieu RAM nhat.
//      cfg.mayViecNang = ["HOST"...]: viec nang uu tien may nay (con song + du khoa + khoe) — may khac thi chia deu.
//      Moi PC doc cung bang nhip -> tinh ra CUNG bang giao viec -> khong can trao doi; khoa PCLEASE van chan chay trung.
// 13/10: user bam «Dung» tren sub-tab May tram -> GAS gan dung/dungViec vao dong nhip cua may do -> may do khong duoc chon,
//   viec tu roi sang may ke (cung luat chia). «Tiep tuc» = go co -> may quay lai hang cho.
export const biDung = (hb, tenViec) => !!(hb && (hb.dung || (hb.dungViec || []).includes(tenViec)));
export const TAI_NANG = 3, TAI_NHE = 1;

function songConLai(viec, board, now, cfg) {
  const song = maySong(board, now, cfg.hetHanPhut || 8);
  for (const [m, hb] of song) if (biDung(hb, viec.ten) || congChet(hb, now)) song.delete(m);
  return song;
}
/* 14/10: QLIT gửi nhịp tim đều nhưng task việc KHÔNG HỀ gọi cổng gác (nhật ký cổng trống) → nhận 6 việc mà không làm. Cổng gác ghi giờ quyết
   định gần nhất (congLuc) → nhịp tim gửi. Máy CÓ báo congLuc mà trống/im quá 3 giờ = cổng gác chết → không giao việc. Máy bản cũ (không có
   khoá congLuc) giữ như cũ. Mọi task (kể cả việc không giao) đều gọi cổng gác theo lịch ⇒ máy khoẻ luôn có congLuc mới trong ≤ 15'. */
export const congChet = (hb, now = Date.now()) => !!hb && ("congLuc" in hb) && (!hb.congLuc || now - Date.parse(hb.congLuc) > 3 * 3600e3);
function chonGhim(viec, song) {
  for (const may of viec.uuTien) {
    const hb = song.get(may);
    if (!hb) continue;
    if (viec.nang && hb.yeu) continue;
    return may;
  }
  return null;
}
// May du dieu kien cho 1 viec (khong ghim): du khoa; viec nang -> may khoe, khong co may khoe thi may nhieu RAM nhat
function dungDuoc(viec, song) {
  const can = viec.envKeys || [];
  const duKhoa = [...song.values()].filter((hb) => can.every((k) => (hb.coKhoa || []).includes(k)));
  if (!viec.nang || !duKhoa.length) return duKhoa;
  const khoe = duKhoa.filter((hb) => !hb.yeu);
  if (khoe.length) return khoe;
  duKhoa.sort((a, b) => (b.ramTrongPct || 0) - (a.ramTrongPct || 0) || String(a.may).localeCompare(String(b.may)));
  return [duKhoa[0]];
}
const sucChua = (hb) => Math.max(1, Number(hb.diem) || 100) * (hb.yeu ? 0.5 : 1);

// Bang giao viec cho TOAN BO cfg.viec -> { tenViec: tenMay | null }. Deterministic.
export function chiaViec(board, now, cfg) {
  const giao = {}, tai = new Map();
  const ds = (cfg.viec || []).map((v) => ({ v, song: songConLai(v, board, now, cfg) }));
  for (const { v, song } of ds) if (v.uuTien && v.uuTien.length) {     // ghim tay giao truoc, cung tinh vao tai
    const m = chonGhim(v, song); giao[v.ten] = m;
    if (m) tai.set(m, (tai.get(m) || 0) + (v.nang ? TAI_NANG : TAI_NHE));
  }
  const conLai = ds.filter(({ v }) => !(v.uuTien && v.uuTien.length)).map((x) => ({ ...x, du: dungDuoc(x.v, x.song) }));
  conLai.sort((a, b) => (b.v.nang ? 1 : 0) - (a.v.nang ? 1 : 0) || a.du.length - b.du.length || String(a.v.ten).localeCompare(String(b.v.ten)));
  const nhaNang = cfg.mayViecNang || [];                              // 14/10 user «việc nặng nên đưa cho je75k38»: máy nhà của việc nặng
  for (const { v, du } of conLai) {
    const w = v.nang ? TAI_NANG : TAI_NHE;
    // còn sống + đủ khoá + khoẻ + không Dừng + BẢN MỚI (có chayLuc — bản cũ không chạy được cò xác minh qua kho) — không thì chia đều
    const nha = v.nang && nhaNang.find((m) => du.some((hb) => hb.may === m && !hb.yeu && ("chayLuc" in hb)));
    if (nha) { giao[v.ten] = nha; tai.set(nha, (tai.get(nha) || 0) + w); continue; }     // không thì chia đều như thường
    let tot = null, totTi = Infinity;
    for (const hb of du) {
      const ti = ((tai.get(hb.may) || 0) + w) / sucChua(hb);
      if (ti < totTi - 1e-9 || (Math.abs(ti - totTi) <= 1e-9 && ((hb.diem || 0) > (tot.diem || 0) || ((hb.diem || 0) === (tot.diem || 0) && String(hb.may).localeCompare(String(tot.may)) < 0)))) { tot = hb; totTi = ti; }
    }
    giao[v.ten] = tot ? tot.may : null;
    if (tot) tai.set(tot.may, (tai.get(tot.may) || 0) + w);
  }
  return giao;
}

export function mayChay(viec, board, now, cfg) {
  if ((cfg.viec || []).some((v) => v.ten === viec.ten)) return chiaViec(board, now, cfg)[viec.ten] ?? null;
  const song = songConLai(viec, board, now, cfg);                    // viec le ngoai cfg -> tinh rieng
  if (viec.uuTien && viec.uuTien.length) return chonGhim(viec, song);
  return chiaViec(board, now, { ...cfg, viec: [viec] })[viec.ten] ?? null;
}

export function nenChay(thisMay, tenViec, board, cfg, now = Date.now()) {
  const viec = (cfg.viec || []).find((v) => v.ten === tenViec);
  if (!viec) return false;
  return mayChay(viec, board, now, cfg) === thisMay;
}

export function viecCuaToi(thisMay, board, cfg, now = Date.now()) {
  return (cfg.viec || []).filter((v) => mayChay(v, board, now, cfg) === thisMay).map((v) => v.ten);
}

// --------- TU KIEM (node dieu-phoi.mjs --test) ---------
function test() {
  const cfg = {
    hetHanPhut: 8,
    viec: [
      { ten: "canh-bai-xe", nang: true,  uuTien: ["PC1", "PC2", "PC3"] },
      { ten: "tim-b1",      nang: true,  uuTien: ["PC1", "PC2", "PC3"] },
      { ten: "planogram",   nang: false, uuTien: ["PC2", "PC3", "PC1"] },
      { ten: "cham-cong",   nang: false, uuTien: ["PC3", "PC1", "PC2"] },
    ],
  };
  const now = Date.parse("2026-10-12T10:00:00Z");
  const tuoi = (p) => new Date(now - p * 60000).toISOString();
  const hb = (may, ram, yeu, phut = 1) => ({ may, ramTrongPct: ram, yeu, luc: tuoi(phut) });
  let pass = 0, fail = 0;
  const eq = (got, muon, ten) => { const ok = JSON.stringify(got) === JSON.stringify(muon); console.log((ok ? "OK  " : "FAIL") + " " + ten + (ok ? "" : `  got=${JSON.stringify(got)} muon=${JSON.stringify(muon)}`)); ok ? pass++ : fail++; };

  // 1) IT MAY: chi PC3 song, khoe -> PC3 ganh HET (ca viec uu tien PC1/PC2)
  let board = [hb("PC3", 60, false)];
  eq(viecCuaToi("PC3", board, cfg, now).sort(), ["canh-bai-xe", "cham-cong", "planogram", "tim-b1"], "it may: 1 may ganh het");

  // 2) NHIEU MAY khoe: viec trai deu theo uu tien
  board = [hb("PC1", 60, false), hb("PC2", 60, false), hb("PC3", 60, false)];
  eq(viecCuaToi("PC1", board, cfg, now).sort(), ["canh-bai-xe", "tim-b1"], "nhieu may: PC1 2 viec nang");
  eq(viecCuaToi("PC2", board, cfg, now).sort(), ["planogram"], "nhieu may: PC2 planogram");
  eq(viecCuaToi("PC3", board, cfg, now).sort(), ["cham-cong"], "nhieu may: PC3 cham-cong");

  // 3) SUC KHOE: PC1 YEU -> viec NANG nhuong PC2; viec NHE khong gac suc khoe (PC1 van khong co viec nhe nao top)
  board = [hb("PC1", 20, true), hb("PC2", 60, false), hb("PC3", 60, false)];
  eq(mayChay(cfg.viec[0], board, now, cfg), "PC2", "PC1 yeu -> canh-bai-xe sang PC2");
  eq(viecCuaToi("PC2", board, cfg, now).sort(), ["canh-bai-xe", "planogram", "tim-b1"], "PC2 ganh them viec nang cua PC1");

  // 4) TAT CA YEU -> viec nang HOAN; viec nhe van chay (may top song)
  board = [hb("PC1", 10, true), hb("PC2", 15, true), hb("PC3", 12, true)];
  eq(mayChay(cfg.viec[0], board, now, cfg), null, "tat ca yeu -> viec nang hoan");
  eq(mayChay(cfg.viec[2], board, now, cfg), "PC2", "viec nhe van chay du may yeu");

  // 5) GAN THAY: PC2 nhip cu (10') -> coi nhu chet, planogram xuong PC3
  board = [hb("PC1", 60, false), hb("PC2", 60, false, 10), hb("PC3", 60, false)];
  eq(mayChay(cfg.viec[2], board, now, cfg), "PC3", "PC2 nhip cu -> planogram sang PC3");

  // ===== TU XEP HANG (khong uuTien) =====
  const cfg2 = { hetHanPhut: 8, viec: [
    { ten: "nang", nang: true,  envKeys: ["TOPREVIEW_USER"] },     // viec nang can khoa top-review
    { ten: "nhe",  nang: false, envKeys: ["APPSCRIPT_KEY"] },
  ] };
  const hb2 = (may, diem, ram, yeu, khoa, phut = 1) => ({ may, diem, ramTrongPct: ram, yeu, coKhoa: khoa, luc: tuoi(phut) });
  // 6) manh nhat + du khoa + khoe -> nhan viec nang
  let b = [hb2("PCy", 300, 60, false, ["APPSCRIPT_KEY"]), hb2("PCx", 500, 60, false, ["APPSCRIPT_KEY", "TOPREVIEW_USER"]), hb2("PCz", 400, 60, false, ["APPSCRIPT_KEY", "TOPREVIEW_USER"])];
  eq(mayChay(cfg2.viec[0], b, now, cfg2), "PCx", "tu xep hang: manh nhat + du khoa chay viec nang");
  // 7) may manh nhat THIEU khoa top-review -> viec nang ve may manh ke co khoa
  b = [hb2("PCx", 500, 60, false, ["APPSCRIPT_KEY"]), hb2("PCz", 400, 60, false, ["APPSCRIPT_KEY", "TOPREVIEW_USER"])];
  eq(mayChay(cfg2.viec[0], b, now, cfg2), "PCz", "thieu khoa -> loai khoi viec can khoa do");
  // 8) may manh nhat YEU -> viec nang ve may ke; viec nhe may yeu van nhan (neu manh nhat)
  b = [hb2("PCx", 500, 20, true, ["APPSCRIPT_KEY", "TOPREVIEW_USER"]), hb2("PCz", 400, 60, false, ["APPSCRIPT_KEY", "TOPREVIEW_USER"])];
  eq(mayChay(cfg2.viec[0], b, now, cfg2), "PCz", "manh nhat yeu -> viec nang sang may ke");
  eq(mayChay(cfg2.viec[1], b, now, cfg2), "PCx", "viec nhe: manh nhat van nhan du yeu");
  // 9) it may: chi 1 may song -> no gom het (du khoa)
  b = [hb2("PCz", 400, 60, false, ["APPSCRIPT_KEY", "TOPREVIEW_USER"])];
  eq(mayChay(cfg2.viec[0], b, now, cfg2), "PCz", "it may: 1 may du khoa gom viec nang");
  // 10) MOI may du khoa deu YEU -> viec nang KHONG treo, chay may con nhieu RAM nhat
  b = [hb2("PCx", 500, 12, true, ["APPSCRIPT_KEY", "TOPREVIEW_USER"]), hb2("PCz", 400, 25, true, ["APPSCRIPT_KEY", "TOPREVIEW_USER"])];
  eq(mayChay(cfg2.viec[0], b, now, cfg2), "PCz", "moi may yeu -> viec nang chay may RAM nhieu nhat (PCz 25%>PCx 12%)");
  // 11) LENH DUNG tu sub-tab May tram: dung CA MAY -> moi viec sang may ke; dung RIENG 1 viec -> chi viec do roi
  b = [{ ...hb2("PCx", 500, 60, false, ["APPSCRIPT_KEY", "TOPREVIEW_USER"]), dung: true }, hb2("PCz", 400, 60, false, ["APPSCRIPT_KEY", "TOPREVIEW_USER"])];
  eq([mayChay(cfg2.viec[0], b, now, cfg2), mayChay(cfg2.viec[1], b, now, cfg2)], ["PCz", "PCz"], "dung ca may -> 2 viec sang PCz");
  b = [{ ...hb2("PCx", 500, 60, false, ["APPSCRIPT_KEY", "TOPREVIEW_USER"]), dungViec: ["nang"] }, hb2("PCz", 400, 60, false, ["APPSCRIPT_KEY", "TOPREVIEW_USER"])];
  eq([mayChay(cfg2.viec[0], b, now, cfg2), mayChay(cfg2.viec[1], b, now, cfg2)], ["PCz", "PCx"], "dung rieng viec nang -> chi viec nang sang PCz");
  b = [{ ...hb2("PCz", 400, 60, false, ["APPSCRIPT_KEY", "TOPREVIEW_USER"]), dung: true }];
  eq(mayChay(cfg2.viec[0], b, now, cfg2), null, "may duy nhat bi dung -> viec hoan (khong ai chay)");
  b = [{ ...hb("PC1", 60, false), dung: true }, hb("PC2", 60, false)];
  eq(mayChay(cfg.viec[0], b, now, cfg), "PC2", "ghim uuTien: PC1 bi dung -> PC2");

  // ===== 14/10 CHIA DEU THEO SUC (khong con «may manh nhat om het») =====
  const K = ["APPSCRIPT_KEY", "TOPREVIEW_USER"];
  const cfg3 = { hetHanPhut: 8, viec: [
    ...["n1", "n2", "n3", "n4", "n5", "n6", "n7"].map((t) => ({ ten: t, nang: true, envKeys: K })),
    ...["l1", "l2", "l3", "l4", "l5", "l6"].map((t) => ({ ten: t, nang: false, envKeys: ["APPSCRIPT_KEY"] })),
  ] };
  const dem = (bd) => { const g = chiaViec(bd, now, cfg3), d = {}; for (const m of Object.values(g)) d[m] = (d[m] || 0) + 1; return d; };
  b = [hb2("QLIT", 415, 60, false, K), hb2("LAP", 335, 60, false, K), hb2("JE", 296, 60, false, K)];
  const d = dem(b);
  eq(Object.keys(d).length, 3, "3 may khoe -> CA 3 may deu co viec (khong om het 1 may)");
  eq((d.QLIT || 0) >= (d.JE || 0), true, "may manh hon nhan >= may yeu hon");
  eq(Math.max(...Object.values(d)) <= 6, true, "khong may nao om qua 6/13 viec");
  b = [hb2("QLIT", 415, 20, true, K), hb2("LAP", 335, 60, false, K), hb2("JE", 296, 60, false, K)];
  let g = chiaViec(b, now, cfg3);
  eq(cfg3.viec.filter((v) => v.nang && g[v.ten] === "QLIT").length, 0, "may yeu khong nhan viec nang");
  b = [hb2("QLIT", 415, 60, false, ["APPSCRIPT_KEY"]), hb2("JE", 296, 60, false, K)];
  g = chiaViec(b, now, cfg3);
  eq(cfg3.viec.filter((v) => v.nang).every((v) => g[v.ten] === "JE"), true, "viec nang chi ve may co khoa");
  eq(cfg3.viec.filter((v) => !v.nang).every((v) => g[v.ten] === "QLIT"), true, "viec nhe ve may thieu khoa (dang ranh)");
  const b1 = [hb2("QLIT", 415, 55, false, K), hb2("JE", 296, 70, false, K)], b2 = [hb2("QLIT", 415, 48, false, K), hb2("JE", 296, 62, false, K)];
  eq(chiaViec(b1, now, cfg3), chiaViec(b2, now, cfg3), "RAM nhich (khong doi co yeu) -> bang giao on dinh");
  eq(chiaViec([...b1].reverse(), now, cfg3), chiaViec(b1, now, cfg3), "thu tu bang khac -> cung ket qua (moi PC tinh nhu nhau)");

  // 14/10 mayViecNang: viec nang ve JE (khoe); JE yeu/bi Dung -> chia deu; viec nhe don sang may khac
  const cfg4 = { ...cfg3, mayViecNang: ["JE"] };
  const moi = (hb) => ({ ...hb, chayLuc: {} });   // bản mới (có khoá chayLuc)
  g = chiaViec([hb2("QLIT", 415, 60, false, K), moi(hb2("JE", 296, 60, false, K))], now, cfg4);
  eq(cfg4.viec.filter((v) => v.nang).every((v) => g[v.ten] === "JE"), true, "mayViecNang: 7 viec nang ve JE");
  eq(cfg4.viec.filter((v) => !v.nang).every((v) => g[v.ten] === "QLIT"), true, "mayViecNang: viec nhe don sang QLIT");
  g = chiaViec([hb2("QLIT", 415, 60, false, K), hb2("JE", 296, 20, true, K)], now, cfg4);
  eq(cfg4.viec.filter((v) => v.nang).every((v) => g[v.ten] === "QLIT"), true, "JE yeu -> viec nang sang may khoe");
  g = chiaViec([hb2("QLIT", 415, 60, false, K), { ...hb2("JE", 296, 60, false, K), dung: true }], now, cfg4);
  eq(Object.values(g).every((m) => m === "QLIT"), true, "JE bi Dung -> QLIT lam het");
  // 14/10 JE BẢN CŨ (không chayLuc) → không ép việc nặng về JE, chia đều (máy mạnh nhận phần lớn)
  g = chiaViec([hb2("QLIT", 415, 60, false, K), hb2("JE", 296, 60, false, K)], now, cfg4);
  eq(cfg4.viec.filter((v) => v.nang && g[v.ten] === "QLIT").length > 0, true, "JE ban cu -> viec nang KHONG ep ve JE");
  // 14/10 CỔNG GÁC CHẾT: có khoá congLuc mà trống / im > 3 giờ → không giao; không có khoá (bản cũ) → giữ
  const chet = { ...hb2("QLIT", 415, 60, false, K), congLuc: null }, cu3h = { ...hb2("QLIT", 415, 60, false, K), congLuc: tuoi(200) };
  const song = { ...hb2("FOQ", 415, 60, false, K), congLuc: tuoi(10) };
  eq(Object.values(chiaViec([chet, song], now, cfg3)).every((m) => m === "FOQ"), true, "cong gac chet (congLuc trong) -> khong giao viec");
  eq(Object.values(chiaViec([cu3h, song], now, cfg3)).every((m) => m === "FOQ"), true, "cong gac im > 3 gio -> khong giao viec");
  eq(Object.values(chiaViec([hb2("QLIT", 415, 60, false, K), song], now, cfg3)).includes("QLIT"), true, "ban cu (khong congLuc) -> van giao nhu cu");

  console.log(`\n${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
}
if (process.argv.includes("--test")) test();
