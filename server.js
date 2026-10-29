const http = require("http");
const fs = require("fs");
const path = require("path");

// ===== MAKE IT YOURS: Horse Racing Theme =====
const APP_TITLE = "Gambling Addicts Hub";
const ITEM_NAME = "horse";
const OWNER = "Your Name"; 
// ============================================

// In-memory application state
const items = [{ id: 1, text: "Sample " + ITEM_NAME + ": Thunder Hooves (Odds: 4/1)" }];
const members = [{ name: "Sato-Andolini", tokens: 100 }];
const races = [{ id: 1, name: "LWMM0001 Breeders' Cup Classic G1 - Post 1 - 7:15 Rexcelsior" }];
const tokensLog = [];
const slipsLog = [];

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  const isAdmin = req.headers["x-admin-auth"] === "true" || req.url.includes("admin=true");

  if (req.method === "GET" && url === "/health") {
    return sendJson(res, 200, { status: "ok" });
  }

  if (req.method === "GET" && url === "/api/info") {
    return sendJson(res, 200, {
      title: APP_TITLE,
      itemName: ITEM_NAME,
      owner: OWNER,
      message: process.env.APP_MESSAGE || "Live Odds Open: Place Your Bets Responsibly!",
      isAdmin: isAdmin
    });
  }

  if (req.method === "GET" && url === "/api/about") {
    return sendJson(res, 200, {
      owner: OWNER,
      purpose: "A digital race card and betting tracker to view upcoming horse runners, check odds, and place mock bets.",
    });
  }

  if (url === "/api/items" && req.method === "GET") {
    return sendJson(res, 200, items);
  }

  // Admin action: Add token or manage members
  if (url === "/api/admin/tokens" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        tokensLog.push(data);
        sendJson(res, 201, { success: true, message: "Token assigned successfully", data });
      } catch (e) {
        sendJson(res, 400, { error: "Invalid payload" });
      }
    });
    return;
  }

  // Admin action: Record slip manually / Place bet
  if (url === "/api/slips" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        slipsLog.push(data);
        sendJson(res, 201, { success: true, message: "Slip recorded successfully", data });
      } catch (e) {
        sendJson(res, 400, { error: "Invalid payload" });
      }
    });
    return;
  }

  if (url === "/api/slips" && req.method === "GET") {
    return sendJson(res, 200, slipsLog);
  }

  if (req.method === "GET" && url === "/") {
    return fs.readFile(path.join(__dirname, "public", "index.html"), (err, html) => {
      if (err) return sendJson(res, 500, { error: "page missing" });
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    });
  }
  
  sendJson(res, 404, { error: "not found" });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => console.log("Running on port " + PORT));
}
module.exports = server;
