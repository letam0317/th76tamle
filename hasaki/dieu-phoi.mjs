// dieu-phoi.mjs — BO LUAT DIEU PHOI VIEC cho N PC (1..nhieu may).
// =====================================================================================
// Nguyen tac (user 12/10/2026):
//   - It may  -> 1 may GANH NHIEU viec (vi may uu tien cao hon da chet -> no la may song cao nhat cho nhieu viec).
//   - Nhieu may -> BAM NHO: moi viec ve may uu tien cao nhat dang song -> viec trai deu.
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
//  (b) KHONG uuTien (mac dinh) -> TU XEP HANG: may song + DU KHOA (coKhoa chua du envKeys) + (viec nang thi khong yeu),
//      chon may DIEM cao nhat (manh nhat); hoa diem -> ten may nho hon. => user khong phai danh gia may nao manh.
export function mayChay(viec, board, now, cfg) {
  const song = maySong(board, now, cfg.hetHanPhut || 8);
  if (viec.uuTien && viec.uuTien.length) {
    for (const may of viec.uuTien) {
      const hb = song.get(may);
      if (!hb) continue;
      if (viec.nang && hb.yeu) continue;
      return may;
    }
    return null;
  }
  // Tu xep hang theo nang luc
  const can = viec.envKeys || [];
  const duKhoa = [...song.values()].filter((hb) => can.every((k) => (hb.coKhoa || []).includes(k)));  // du khoa nang luc
  if (!duKhoa.length) return null;
  if (!viec.nang) {                                                 // viec nhe: khong gac suc khoe -> manh nhat
    duKhoa.sort((a, b) => (b.diem || 0) - (a.diem || 0) || String(a.may).localeCompare(String(b.may)));
    return duKhoa[0].may;
  }
  const khoe = duKhoa.filter((hb) => !hb.yeu);                      // viec nang: uu tien may KHONG yeu, manh nhat
  if (khoe.length) {
    khoe.sort((a, b) => (b.diem || 0) - (a.diem || 0) || String(a.may).localeCompare(String(b.may)));
    return khoe[0].may;
  }
  // MOI may du khoa deu YEU -> KHONG treo vinh vien: chay tren may con NHIEU RAM nhat (it tai nhat)
  duKhoa.sort((a, b) => (b.ramTrongPct || 0) - (a.ramTrongPct || 0) || String(a.may).localeCompare(String(b.may)));
  return duKhoa[0].may;
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

  console.log(`\n${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
}
if (process.argv.includes("--test")) test();
