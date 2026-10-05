import fs from "node:fs";

(async () => {
  const url = "https://chat.hasaki.vn/static/js/main.2ee577ed.js";
  const res = await fetch(url);
  const text = await res.text();

  const searchTerms = ["/user/profile", "/user/search", "direct_manager", "direct_manager_id", "subleader", "supervisor", "position_id", "working_loc_id"];

  for (const term of searchTerms) {
    console.log(`=== SEARCH TERM: ${term} ===`);
    let idx = 0, count = 0;
    while ((idx = text.indexOf(term, idx)) !== -1 && count < 5) {
      console.log(`--- Match #${++count} @ ${idx} ---`);
      console.log(text.slice(Math.max(0, idx - 150), Math.min(text.length, idx + 250)));
      idx += term.length;
    }
  }
})();
