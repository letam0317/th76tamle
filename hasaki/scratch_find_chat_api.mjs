import fs from "node:fs";

(async () => {
  const url = "https://chat.hasaki.vn/static/js/main.2ee577ed.js";
  const res = await fetch(url);
  const text = await res.text();

  // Find all endpoints in main.2ee577ed.js
  const apiMatches = text.match(/`\$\{[^}]+\}\/[a-zA-Z0-9_\-\/]+`/g) || [];
  console.log("Template string APIs:", [...new Set(apiMatches)]);

  // Search for "Quản lý trực tiếp" or "direct_manager" component code
  let idx = 0;
  while ((idx = text.indexOf("Quản lý trực tiếp", idx)) !== -1) {
    console.log("--- MATCH 'Quản lý trực tiếp' @", idx, "---");
    console.log(text.slice(Math.max(0, idx - 300), Math.min(text.length, idx + 300)));
    idx += "Quản lý trực tiếp".length;
  }
})();
