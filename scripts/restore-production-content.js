#!/usr/bin/env node

/*
  Restores WhaleX public product/indicator content after test data changes.

  Usage:
    ADMIN_PASSWORD='WhaleXAdmin2026' npm run restore:content

  Optional:
    BASE_URL=http://localhost:3000 ADMIN_PASSWORD='...' npm run restore:content
*/

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS || "WhaleXAdmin2026";

const DEFAULT_PRODUCTS = [
  {
    id: "whalex",
    name: "WhaleX",
    tag: "BIG PLAYERS PATTERNS",
    description: "WhaleX is the main structure indicator. It is designed to help traders understand market direction, clean structure shifts, and trade context without adding unnecessary chart noise.",
    features: [
      "Core market-structure reading",
      "Clean identification of the BIG PLAYERS patterns",
      "Designed for TradingView invite-only access",
      "Useful for BTC, Gold, Forex, and index traders",
      "Premium black-and-gold visual experience"
    ].join("\n")
  },
  {
    id: "orderflow",
    name: "WhaleX OrderFlow",
    tag: "ZONES, POC, RETEST/RECLAIM",
    description: "WhaleX OrderFlow focuses on zone-based decision support. It helps traders read top/bottom zones, POC context, volume-confirmed areas, retest behavior, and reclaim logic.",
    features: [
      "Top and bottom zone framework",
      "POC and zone context",
      "Volume-confirmed decision support",
      "Retest/reclaim style analysis",
      "Built for structured intraday orderflow reading"
    ].join("\n")
  },
  {
    id: "risk-manager",
    name: "WhaleX Risk Manager",
    tag: "RISK + LOT PLANNING",
    description: "WhaleX Risk Manager helps users plan trade risk before entering the market. It focuses on account balance, risk percentage, stop-loss distance, and position sizing discipline.",
    features: [
      "Risk percentage planning",
      "Default lot-size guidance",
      "Stop-loss based position sizing",
      "Clean RR planning support",
      "Designed for disciplined execution"
    ].join("\n")
  }
];

async function requestJson(method, endpoint, options = {}) {
  const headers = { ...(options.headers || {}) };
  let body = options.body;

  if (body && typeof body !== "string" && !(body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, { method, headers, body });
  const text = await res.text();

  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`${method} ${endpoint} failed ${res.status}: ${json.error || json.message || text}`);
  }

  return json;
}

async function main() {
  console.log("Restoring WhaleX production content...");
  console.log("BASE_URL:", BASE_URL);

  const login = await requestJson("POST", "/api/admin/login", {
    body: { password: ADMIN_PASSWORD }
  });

  const token = login.token;
  if (!token) throw new Error("Admin token missing");

  for (const product of DEFAULT_PRODUCTS) {
    await requestJson("PUT", `/api/admin/products/${encodeURIComponent(product.id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      body: {
        name: product.name,
        tag: product.tag,
        description: product.description,
        features: product.features
      }
    });

    console.log(`✅ Restored ${product.name}`);
  }

  const publicProducts = await requestJson("GET", "/api/public/products");
  const bad = JSON.stringify(publicProducts).includes("Backend Test");

  if (bad) {
    throw new Error("Backend Test text still found in public products after restore.");
  }

  console.log("✅ Production content restored. No Backend Test text found.");
}

main().catch((err) => {
  console.error("❌ Restore failed:", err.message);
  process.exit(1);
});


// V72 restore checks public home-title product names through /api/public/products.
