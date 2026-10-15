/* 15/10 user: «các tệp t yc xuất nên tạo 1 tệp ở desktop và bỏ vào đó để t xem mà k cần phải đi tìm».
 * MỌI tệp xuất cho người dùng (PDF, Excel, ảnh…) ghi vào thư mục «Tệp xuất» trên Desktop.
 * Desktop máy này nằm trong OneDrive → hỏi Windows đường dẫn thật, không đoán. */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

export function thuMucXuat() {
  let desk = "";
  try { desk = execFileSync("powershell", ["-NoProfile", "-Command", "[Environment]::GetFolderPath('Desktop')"], { encoding: "utf8" }).trim(); } catch (e) { }
  if (!desk || !fs.existsSync(desk)) desk = [path.join(os.homedir(), "OneDrive", "Desktop"), path.join(os.homedir(), "Desktop")].find((p) => fs.existsSync(p)) || os.homedir();
  const dir = path.join(desk, "Tệp xuất");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
