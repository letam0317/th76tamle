import fs from "node:fs";

(async () => {
  const url = "https://chat.hasaki.vn/static/js/main.2ee577ed.js";
  console.log("Fetching main.js from chat.hasaki.vn...");
  const res = await fetch(url);
  const text = await res.text();
  console.log("Length of main.js:", text.length);

  // Search for API endpoints
  const endpoints = text.match(/\/api\/v1\/[a-zA-Z0-9_\-\/]+/g) || [];
  const uniqueEndpoints = [...new Set(endpoints)];
  console.log("Found endpoints:", uniqueEndpoints);

  // Search for manager or direct manager strings / keys
  const managerMatches = text.match(/.{0,50}(manager|leader|supervisor|quản lý|trực tiếp).{0,50}/gi) || [];
  console.log("Sample manager matches in JS bundle:", managerMatches.slice(0, 15));

  // Search for user/profile endpoints
  const profileMatches = text.match(/.{0,50}(profile|user\/|staff\/|detail|info).{0,50}/gi) || [];
  const uniqueProfileStr = [...new Set(profileMatches.map(m => m.trim()))].filter(m => m.includes("api/"));
  console.log("API profile matches:", uniqueProfileStr.slice(0, 20));

})();
