// suc-khoe.mjs — Do SUC KHOE may de dieu phoi viec (RAM trong %, tai CPU, so loi gan day).
// Dung chung: dieu-phoi.mjs (quyet dinh co nhan viec), nhip-pc.mjs (gui len GAS lam "mat trung tam").
//   import { sucKhoe } from "./suc-khoe.mjs";  const sk = await sucKhoe();
//   node suc-khoe.mjs            # in JSON suc khoe may nay
// Nguong mac dinh (doi duoc qua .env): RAM_TRONG_TOI_THIEU=30  -> RAM trong < 30% thi "yeu" (hoan viec nang).
import os from "node:os";

const PCT = (a, b) => Math.round((a / b) * 1000) / 10;

// Tai CPU trung binh qua 1 khoang ngan (so tick idle 2 lan cach nhau MS)
function cpuTick() {
  let idle = 0, tong = 0;
  for (const c of os.cpus()) { for (const k in c.times) tong += c.times[k]; idle += c.times.idle; }
  return { idle, tong };
}
async function taiCpu(ms = 300) {
  const a = cpuTick(); await new Promise((r) => setTimeout(r, ms)); const b = cpuTick();
  const dIdle = b.idle - a.idle, dTong = b.tong - a.tong || 1;
  return Math.round((1 - dIdle / dTong) * 1000) / 10;   // % ban
}

// Tranh RUNG o ranh gioi: vao "yeu" khi RAM < nguong (30%); chi THOAT yeu khi RAM >= nguongRa (40%).
// Luu trang thai truoc o file -> khong nhay qua lai moi nhip khi RAM lo lung quanh 30%.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const STATE = path.join(path.dirname(fileURLToPath(import.meta.url)), ".suc-khoe-yeu");
function yeuCoTre(ram, nguong, nguongRa) {
  let truoc = false; try { truoc = fs.readFileSync(STATE, "utf8").trim() === "1"; } catch { /* */ }
  const yeu = truoc ? (ram < nguongRa) : (ram < nguong);   // dang yeu thi phai len >=40 moi thoat; dang khoe thi <30 moi vao
  try { fs.writeFileSync(STATE, yeu ? "1" : "0"); } catch { /* */ }
  return yeu;
}

// DIEM SUC MANH (de dieu phoi TU XEP HANG, user khong phai danh gia): nhan * GHz * 10 + RAM(GB).
// Cang cao cang manh -> uu tien nhan viec nang. Deterministic (moi may tu do, dong deu khap noi).
export function diemManh() {
  const cpus = os.cpus() || [];
  const nhan = cpus.length || 1;
  const ghz = (cpus[0]?.speed || 1000) / 1000;            // MHz -> GHz
  const ramGB = os.totalmem() / 1073741824;
  return Math.round(nhan * ghz * 10 + ramGB);
}

// Dia trong (GB) cua o chua thu muc nay — viec nang tai clip; dia sap day thi khoan nhan (tranh sap).
function diaTrongGB() {
  try {
    const st = fs.statfsSync(path.dirname(fileURLToPath(import.meta.url)));
    return Math.round((st.bavail * st.bsize) / 1073741824 * 10) / 10;
  } catch { return null; }   // Node cu / khong ho tro -> bo qua kiem dia
}

// 14/10 user «ổ C ít quá, cần liệt kê thêm ổ mà máy trạm có»: mọi ổ đĩa C..Z đang gắn → [{o:"C", trong, tong}] (GB, 1 số lẻ)
function oDia() {
  const ds = [];
  for (const o of "CDEFGHIJKLMNOPQRSTUVWXYZ") {
    try { const st = fs.statfsSync(o + ":\\"); const tong = (st.blocks * st.bsize) / 1073741824;
      if (tong >= 1) ds.push({ o, trong: Math.round((st.bavail * st.bsize) / 1073741824 * 10) / 10, tong: Math.round(tong * 10) / 10 }); } catch { /* không có ổ này */ }
  }
  return ds;
}

export async function sucKhoe() {
  const tong = os.totalmem(), trong = os.freemem();
  const ramTrong = PCT(trong, tong);                     // % RAM con trong
  const nguong = Number(process.env.RAM_TRONG_TOI_THIEU || 30);
  const nguongRa = Number(process.env.RAM_TRONG_THOAT || 40);
  const diaToiThieu = Number(process.env.DIA_TRONG_TOI_THIEU_GB || 3);
  const dia = diaTrongGB();
  const cpu = await taiCpu();
  const diaYeu = dia != null && dia < diaToiThieu;       // dia < 3 GB -> coi nhu yeu (khong nhan viec nang)
  const yeu = yeuCoTre(ramTrong, nguong, nguongRa) || diaYeu;  // < 30% RAM hoac dia thap -> yeu
  return {
    diaTrongGB: dia,
    oDia: oDia(),
    may: os.hostname(),
    ramTrongPct: ramTrong,
    ramTrongGB: Math.round(trong / 1073741824 * 10) / 10,
    ramTongGB: Math.round(tong / 1073741824 * 10) / 10,
    cpuPct: cpu,
    nhan: os.cpus().length,
    diem: diemManh(),                                     // suc manh -> dieu phoi tu xep hang
    tai1: Math.round((os.loadavg()[0] || 0) * 100) / 100,  // Windows luon 0 — chi tham khao
    nguongRam: nguong,
    yeu,                                                  // true = khoan chay viec nang
    luc: new Date().toISOString(),
  };
}

// Co nen nhan them 1 viec NANG khong (RAM con tren nguong + them do dem viec dang chay neu truyen)
export function duSucNhanNang(sk, dangChay = 0, tranViecNang = Number(process.env.TRAN_VIEC_NANG || 2)) {
  if (sk.yeu) return false;
  if (dangChay >= tranViecNang) return false;
  return true;
}

if (import.meta.url === `file://${(process.argv[1] || "").split("\\").join("/")}` || process.argv[1]?.endsWith("suc-khoe.mjs")) {
  sucKhoe().then((s) => console.log(JSON.stringify(s, null, 1)));
}
