/**
 * qc-so-tac-gia.mjs — đo sổ tác giả KHÔNG gọi mạng thật (luật QC không ghi dữ liệu thật):
 *  thay fetch gốc bằng hàm giả TRƯỚC khi nạp so-tac-gia.mjs, ghi sổ ra thư mục tạm, rồi soi từng dòng.
 *  Chạy: node qc-so-tac-gia.mjs
 */
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "qc-so-tac-gia-")); process.env.HSK_SO_TAC_GIA_DIR = TMP;
const goi = [];
globalThis.fetch = async (u, o) => { goi.push(String(u)); const p = new URL(String(u)).pathname;
  const j = /create-task-workflow/.test(p) ? { status: 1, data: { id: 99990001 } } : /comment$/.test(p) ? { status: 1, data: { id: 5551 } }
    : /task-input\/99990003/.test(p) ? { status: 1, data: { id: 99990003, name: "[5S] F0-A1-503-10-01-02 - Tên cũ", status: 0 } } : { status: 1 };
  return new Response(JSON.stringify(j), { status: 200, headers: { "content-type": "application/json" } }); };
const { docSo } = await import("./so-tac-gia.mjs");
const V = "https://wshr.hasaki.vn/api";
const fd = new FormData(); fd.set("name", "[5S] F0-A1 thử"); fd.append("data[configs][IMA00][]", new Blob([Buffer.from("anh-gia")], { type: "image/png" }), "bang-chung.png");
const r1 = await fetch(V + "/hr/projects/create-task-workflow", { method: "POST", body: fd });
const c = new FormData(); c.set("obj_id", "99990001"); c.set("comment", "Máy nhắc QLTT"); await fetch(V + "/v2/task/comment", { method: "POST", body: c });
await fetch(V + "/hr/projects/task-input/99990002", { headers: {} });
await fetch(V + "/hr/projects/re-create-step/777", { method: "POST", body: JSON.stringify({ workflow_step_id: "-1" }), headers: { "content-type": "application/json" } });
await fetch("https://example.com/x", { method: "POST", body: "a" });
await fetch(V + "/v2/task/comment/5551", { method: "DELETE" });
/* 13/10: đọc phiếu rồi sửa trường → sổ ghi trường + TRƯỚC (từ lượt đọc) + SAU (giá trị gửi) */
const rDoc = await fetch(V + "/hr/projects/task-input/99990003", { headers: {} });
const docDuoc = (await rDoc.json()).data.name;
await fetch(V + "/hr/projects/mass-update-field-task-input", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: 99990003, field: "name", value: "[5S] A1-503-10 - Tên mới" }) });
const ds = docSo(1).reverse(), loi = [];
const kt = (dk, ten) => { if (!dk) loi.push(ten); };
kt((await r1.json()).data.id === 99990001, "script vẫn đọc được phản hồi (clone không nuốt body)");
kt(ds.length === 5, "đúng 5 dòng (GET + host lạ không ghi) — có " + ds.length);
kt(docDuoc === "[5S] F0-A1-503-10-01-02 - Tên cũ", "script vẫn đọc được phản hồi lượt ĐỌC phiếu (sổ chỉ đọc bản sao)");
kt(ds[4]?.hd === "Cập nhật trường phiếu" && ds[4].phieu === "99990003" && ds[4].truong === "name" && ds[4].truoc === "[5S] F0-A1-503-10-01-02 - Tên cũ" && ds[4].sau === "[5S] A1-503-10 - Tên mới", "sửa trường: trường + TRƯỚC + SAU");
kt(ds[0]?.hd === "Tạo phiếu" && ds[0].phieu === "99990001" && ds[0].tep?.[0]?.ten === "bang-chung.png" && ds[0].tep[0].sha.length === 12, "tạo phiếu: id + ảnh + mã băm");
kt(ds[1]?.hd === "Bình luận" && ds[1].phieu === "99990001" && ds[1].noiDung === "Máy nhắc QLTT" && ds[1].idMoi === "5551", "bình luận: phiếu + nội dung + id bình luận");
kt(ds[2]?.hd === "Dừng phiếu" && ds[2].phieu === "99990002" && ds[2].doan === true, "dừng phiếu: đoán phiếu từ lượt đọc trước");
kt(ds[3]?.hd === "Xoá bình luận", "xoá bình luận");
kt(ds.every((d) => d.bo === "qc-so-tac-gia.mjs" && d.may && d.cach), "có tên bộ, máy, cách chạy");
kt(goi.length === 8, "mọi lượt gọi vẫn tới fetch gốc (không thêm lượt nào) — " + goi.length);
if (loi.length) console.log(JSON.stringify(ds, null, 1).slice(0, 2500));
fs.rmSync(TMP, { recursive: true, force: true });
console.log(loi.length ? "✗ " + loi.length + " lỗi:\n  " + loi.join("\n  ") : "✓ 10/10 đạt"); process.exit(loi.length ? 1 : 0);
