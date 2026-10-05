import fs from "node:fs";

(async () => {
  const url = "https://chat.hasaki.vn/static/js/main.2ee577ed.js";
  const res = await fetch(url);
  const text = await res.text();

  // Find all URLs / API endpoints in the file
  const urlMatches = text.match(/https?:\/\/[a-zA-Z0-9_\-\.\/]+/g) || [];
  console.log("All absolute URLs:", [...new Set(urlMatches)]);

  // Find string literals starting with /
  const pathMatches = text.match(/"\/[a-zA-Z0-9_\-\/]{2,80}"/g) || [];
  const filterPaths = [...new Set(pathMatches)].filter(p => !p.includes(".png") && !p.includes(".svg") && !p.includes("static"));
  console.log("Paths found:", filterPaths.slice(0, 50));

  // Find occurrence of direct_manager in context
  let idx = 0;
  while ((idx = text.indexOf("direct_manager", idx)) !== -1) {
    console.log("--- MATCH @", idx, "---");
    console.log(text.slice(Math.max(0, idx - 200), Math.min(text.length, idx + 200)));
    idx += "direct_manager".length;
  }
})();
