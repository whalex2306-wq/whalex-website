#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
require("dotenv").config();

const required = [
  "MONGO_URI",
  "ADMIN_EMAIL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "EMAIL_FROM",
  "APP_URL",
  "JWT_SECRET"
];

const optionalButRecommended = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "PAID_ACCESS_DAYS",
  "TRIAL_ACCESS_DAYS"
];

const missing = required.filter((key) => !String(process.env[key] || "").trim());
const recommendedMissing = optionalButRecommended.filter((key) => !String(process.env[key] || "").trim());

console.log("=== WhaleX Production Deployment Check ===");
console.log("Folder:", process.cwd());
console.log("Node:", process.version);

if (!fs.existsSync(path.join(process.cwd(), ".env"))) {
  console.log("❌ .env file missing in this folder.");
  console.log("Copy it from your last working version before starting.");
  process.exitCode = 1;
} else {
  console.log("✅ .env file found.");
}

if (missing.length) {
  console.log("❌ Missing required env values:");
  for (const key of missing) console.log(" -", key);
  process.exitCode = 1;
} else {
  console.log("✅ Required env values present.");
}

if (recommendedMissing.length) {
  console.log("⚠️ Recommended env values not found:");
  for (const key of recommendedMissing) console.log(" -", key);
} else {
  console.log("✅ Recommended env values present.");
}

console.log("");
console.log("Safe env summary:");
console.log("ADMIN_EMAIL:", process.env.ADMIN_EMAIL || "-");
console.log("SMTP_HOST:", process.env.SMTP_HOST || "-");
console.log("SMTP_PORT:", process.env.SMTP_PORT || "-");
console.log("SMTP_USER:", process.env.SMTP_USER || "-");
console.log("SMTP_PASS_SET:", process.env.SMTP_PASS ? "YES" : "NO");
console.log("EMAIL_FROM:", process.env.EMAIL_FROM || "-");
console.log("APP_URL:", process.env.APP_URL || "-");
console.log("JWT_SECRET_SET:", process.env.JWT_SECRET ? "YES" : "NO");
console.log("MONGO_URI_SET:", process.env.MONGO_URI ? "YES" : "NO");

if (!process.exitCode) {
  console.log("");
  console.log("✅ Deployment check passed.");
  console.log("Next: npm start");
}
