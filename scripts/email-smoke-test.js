#!/usr/bin/env node

/*
  WhaleX direct SMTP smoke test.

  Usage:
    npm run test:email

  Optional:
    TEST_EMAIL=your_receiver@gmail.com npm run test:email

  This test bypasses UI and MongoDB. It only checks whether Gmail SMTP can send email.
*/

require("dotenv").config();

const nodemailer = require("nodemailer");

function mask(value = "") {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 4) return "****";
  return `${text.slice(0, 2)}****${text.slice(-2)}`;
}

function extractEmailAddress(value = "") {
  const text = String(value || "").trim();
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

function fail(message, details = "") {
  console.error(`❌ ${message}`);
  if (details) console.error(details);
  process.exit(1);
}

async function main() {
  const SMTP_HOST = process.env.SMTP_HOST || "";
  const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
  const SMTP_SECURE = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  const SMTP_USER = process.env.SMTP_USER || "";
  const SMTP_PASS = process.env.SMTP_PASS || "";
  const EMAIL_FROM = process.env.EMAIL_FROM || `WhaleX <${SMTP_USER}>`;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
  const TEST_EMAIL = process.env.TEST_EMAIL || ADMIN_EMAIL || SMTP_USER;

  console.log("=== WhaleX Email Smoke Test ===");
  console.log("SMTP_HOST:", SMTP_HOST || "MISSING");
  console.log("SMTP_PORT:", SMTP_PORT);
  console.log("SMTP_SECURE:", SMTP_SECURE);
  console.log("SMTP_USER:", SMTP_USER || "MISSING");
  console.log("SMTP_PASS_SET:", SMTP_PASS ? `YES (${SMTP_PASS.length} chars)` : "NO");
  console.log("EMAIL_FROM:", EMAIL_FROM || "MISSING");
  console.log("ADMIN_EMAIL:", ADMIN_EMAIL || "MISSING");
  console.log("TEST_EMAIL:", TEST_EMAIL || "MISSING");

  if (!SMTP_HOST) fail("SMTP_HOST missing in .env");
  if (!SMTP_USER) fail("SMTP_USER missing in .env");
  if (!SMTP_PASS) fail("SMTP_PASS missing in .env");
  if (SMTP_PASS.includes("PASTE_GOOGLE_APP_PASSWORD_HERE")) fail("SMTP_PASS still has placeholder text. Paste your real Google App Password.");
  if (SMTP_PASS.replace(/\s+/g, "").length !== 16) {
    console.warn("⚠️ Gmail App Password is usually 16 characters after removing spaces.");
    console.warn(`Current SMTP_PASS length without spaces: ${SMTP_PASS.replace(/\s+/g, "").length}`);
  }

  const to = extractEmailAddress(TEST_EMAIL);
  if (!to) fail("TEST_EMAIL / ADMIN_EMAIL is missing or invalid.");

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS.replace(/\s+/g, "")
    }
  });

  console.log("\nChecking SMTP connection...");
  try {
    await transporter.verify();
    console.log("✅ SMTP connection verified.");
  } catch (err) {
    console.error("❌ SMTP verify failed.");
    console.error("Code:", err.code || "-");
    console.error("Command:", err.command || "-");
    console.error("Response:", err.response || "-");
    console.error("Message:", err.message);

    console.error("\nMost common causes:");
    console.error("1. SMTP_PASS is not the Google App Password.");
    console.error("2. Google account 2-Step Verification is not enabled.");
    console.error("3. App Password was copied wrong.");
    console.error("4. SMTP_USER and EMAIL_FROM are different Gmail accounts.");
    process.exit(1);
  }

  console.log("\nSending test email...");
  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject: `WhaleX email test ${new Date().toISOString()}`,
      text: "This is a WhaleX SMTP test email. If you received this, email delivery is working."
    });

    console.log("✅ Email sent successfully.");
    console.log("Message ID:", info.messageId || "-");
    console.log("Accepted:", (info.accepted || []).join(", ") || "-");
    console.log("Rejected:", (info.rejected || []).join(", ") || "-");
    console.log("\nNow check Inbox, Promotions, Updates, and Spam.");
  } catch (err) {
    console.error("❌ Email send failed.");
    console.error("Code:", err.code || "-");
    console.error("Command:", err.command || "-");
    console.error("Response:", err.response || "-");
    console.error("Message:", err.message);
    process.exit(1);
  }
}

main();
