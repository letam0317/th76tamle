/**
 * login-hasaki.js — Mở Edge để đăng nhập work.hasaki.vn 1 lần (lưu phiên).
 * Chạy khi bộ đẩy báo "phiên đăng nhập đã hết hạn".
 * Sau khi đăng nhập xong và thấy bảng workflow hiện ra, đóng cửa sổ là được.
 */
import puppeteer from "puppeteer";
const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PROFILE_DIR = process.env.EDGE_PROFILE_DIR || "C:/Users/lechitam/New folder/.wms-session/edge-profile";

const browser = await puppeteer.launch({
  headless: false, defaultViewport: null, executablePath: EDGE_PATH, userDataDir: PROFILE_DIR,
  args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
});
const page = (await browser.pages())[0] || (await browser.newPage());
await page.goto("https://work.hasaki.vn/tasks-workflow?wfid=591", { waitUntil: "domcontentloaded" }).catch(() => {});
console.log("👉 Đăng nhập (email + mật khẩu + OTP). Khi thấy bảng workflow hiện ra là xong.");
console.log("   Phiên sẽ được ghi nhớ. Đóng cửa sổ trình duyệt khi hoàn tất.");
// Giữ chạy đến khi người dùng đóng trình duyệt
await new Promise((resolve) => browser.on("disconnected", resolve));
console.log("Đã lưu phiên. Bạn có thể chạy lại bộ đẩy.");
process.exit(0);
