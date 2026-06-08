require("dotenv").config();

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { v2: cloudinary } = require("cloudinary");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

const app = express();

function startupEmailDiagnostics() {
  const pass = process.env.SMTP_PASS || "";
  console.log("[WhaleX SMTP startup check]", {
    adminEmail: process.env.ADMIN_EMAIL || "",
    host: process.env.SMTP_HOST || "",
    port: process.env.SMTP_PORT || "587",
    secure: process.env.SMTP_SECURE || "false",
    user: process.env.SMTP_USER || "",
    passSet: pass ? true : false,
    passLength: pass ? pass.replace(/\s+/g, "").length : 0,
    from: process.env.EMAIL_FROM || ""
  });
}


const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "WhaleX@123";
const MONGO_URI = process.env.MONGO_URI || "";
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const PAID_ACCESS_DAYS = Number(process.env.PAID_ACCESS_DAYS || 30);
const TRIAL_ACCESS_DAYS = Number(process.env.TRIAL_ACCESS_DAYS || 3);

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");

if (!MONGO_URI) {
  console.warn("WARNING: MONGO_URI is missing. Add it in .env or hosting environment variables.");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || ""
});

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
// V47/V49 no-cache middleware: avoid stale JS/CSS/HTML after every new version.
// V49 no-cache
app.use((req, res, next) => {
  if (
    req.path.endsWith(".html") ||
    req.path.startsWith("/assets/") ||
    req.path.startsWith("/api/public")
  ) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});
app.use(express.static(PUBLIC_DIR, {
  etag: false,
  lastModified: false,
  maxAge: 0
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") return cb(null, true);
    cb(new Error("Only image or PDF uploads are allowed."));
  }
});

const adminTokens = new Set();
const userTokens = new Map();

function today() { return new Date().toISOString().slice(0, 10); }
function nowIso() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`; }

const TICKET_STATUSES = ["open", "done", "rejected"];

function normalizeTicketStatus(value) {
  const v = String(value || "open").toLowerCase();
  return TICKET_STATUSES.includes(v) ? v : "open";
}
function compareDateOnly(a, b) {
  if (!a || !b) return 0;
  const da = new Date(`${a}T00:00:00Z`);
  const db = new Date(`${b}T00:00:00Z`);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 0;
  if (da < db) return -1;
  if (da > db) return 1;
  return 0;
}
function accessDurationDays(accessType) {
  return String(accessType || "").toLowerCase() === "trial" ? TRIAL_ACCESS_DAYS : PAID_ACCESS_DAYS;
}
function defaultEndDate(startDate, accessType) {
  return addDaysDateOnly(startDate, accessDurationDays(accessType));
}
function formatAccessType(accessType) {
  return String(accessType || "").toLowerCase() === "trial" ? "3-Day Trial" : "Paid Access";
}
function safeDate(value) {
  return String(value || "").trim().slice(0, 10);
}

function addDaysDateOnly(dateOnly, days) {
  const base = dateOnly ? new Date(`${dateOnly}T00:00:00Z`) : new Date();
  if (Number.isNaN(base.getTime())) return "";
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}
function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}
function isTrialPlan(plan = "") {
  return String(plan).toLowerCase().includes("trial");
}
function monthKeyFromDate(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthRange(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));
  return { start, end };
}
function isInMonth(iso, monthKey) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const { start, end } = monthRange(monthKey);
  return d >= start && d <= end;
}
function isFeedbackDue(ticket) {
  if (!ticket || ticket.accessType !== "trial") return false;
  if (ticket.trialFeedbackStatus === "submitted") return false;
  if (!ticket.trialFeedbackDueDate) return false;
  return todayDateOnly() >= ticket.trialFeedbackDueDate;
}
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password || ""), salt, 100000, 64, "sha512").toString("hex");
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  const check = hashPassword(password, salt).hash;
  return crypto.timingSafeEqual(Buffer.from(check, "hex"), Buffer.from(hash, "hex"));
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}
function buildPasswordResetLink(email, token) {
  const params = new URLSearchParams({ email, token });
  return `${BASE_URL}/reset-password.html?${params.toString()}`;
}
function validNewPassword(password) {
  return String(password || "").trim().length >= 6;
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token || !adminTokens.has(token)) return res.status(401).json({ error: "Admin login required." });
  next();
}
function userAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  const userId = userTokens.get(token);
  if (!token || !userId) return res.status(401).json({ error: "User login required." });
  req.userId = userId;
  next();
}

function safeUploadSubdir(folder = "general") {
  return String(folder || "general")
    .replace(/^whalex\/?/i, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .split("/")
    .filter(Boolean)
    .join("/") || "general";
}

function safeUploadBaseName(name = "upload") {
  const ext = path.extname(name || "");
  const base = path.basename(name || "upload", ext)
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "upload";
  return { base, ext: ext || "" };
}

async function saveUploadLocally(file, folder = "whalex/general") {
  if (!file) return "";

  const subdir = safeUploadSubdir(folder);
  const dir = path.join(UPLOADS_DIR, subdir);
  await fs.promises.mkdir(dir, { recursive: true });

  const parsed = safeUploadBaseName(file.originalname || "upload");
  const extFromMime = file.mimetype === "application/pdf" ? ".pdf" :
    file.mimetype === "image/png" ? ".png" :
    file.mimetype === "image/jpeg" ? ".jpg" :
    file.mimetype === "image/webp" ? ".webp" :
    file.mimetype === "image/gif" ? ".gif" : "";
  const ext = parsed.ext || extFromMime || ".bin";
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${parsed.base}${ext}`;
  const filePath = path.join(dir, filename);

  await fs.promises.writeFile(filePath, file.buffer);

  const publicUrl = `/uploads/${subdir}/${filename}`;
  console.log("[Upload saved locally]", {
    original: file.originalname,
    mimetype: file.mimetype,
    publicUrl
  });

  return publicUrl;
}

async function uploadToCloudinary(file, folder = "whalex") {
  if (!file) return "";

  const cloudinaryReady = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  if (cloudinaryReady) {
    try {
      const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      const result = await cloudinary.uploader.upload(dataUri, {
        folder,
        resource_type: "auto"
      });
      return result.secure_url;
    } catch (err) {
      console.warn("[Cloudinary upload failed, falling back to local upload]", err.message);
    }
  } else {
    console.warn("[Cloudinary not configured, using local upload storage]");
  }

  return saveUploadLocally(file, folder);
}

function isLocalUploadUrl(url = "") {
  return String(url || "").startsWith("/uploads/");
}

function localUploadPathFromUrl(url = "") {
  const clean = decodeURIComponent(String(url || "").split("?")[0]).replace(/^\/+/, "");
  const normalized = path.normalize(clean);
  if (!normalized.startsWith("uploads" + path.sep) && normalized !== "uploads") {
    throw new Error("Invalid local upload path.");
  }

  const filePath = path.join(PUBLIC_DIR, normalized);
  if (!filePath.startsWith(UPLOADS_DIR)) {
    throw new Error("Invalid upload path.");
  }

  return filePath;
}

function evidenceFileName(prefix, url = "") {
  const clean = String(url || "").split("?")[0];
  const ext = path.extname(clean) || ".bin";
  return `${prefix}${ext}`;
}

async function sendEvidenceDownload(res, url, fallbackName = "evidence") {
  if (!url) return res.status(404).json({ error: "No evidence file found." });

  if (isLocalUploadUrl(url)) {
    const filePath = localUploadPathFromUrl(url);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Evidence file is missing from local storage." });
    }
    return res.download(filePath, evidenceFileName(fallbackName, url));
  }

  const remote = await fetch(url);
  if (!remote.ok) {
    return res.status(404).json({ error: "Unable to download remote evidence file." });
  }

  const arrayBuffer = await remote.arrayBuffer();
  const contentType = remote.headers.get("content-type") || "application/octet-stream";
  const buffer = Buffer.from(arrayBuffer);

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${evidenceFileName(fallbackName, url)}"`);
  return res.send(buffer);
}

// Mongo models
const SettingSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const ProductSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: String,
  tag: String,
  description: String,
  features: [String]
}, { timestamps: true });

const ReviewSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: String,
  role: String,
  rating: Number,
  text: String,
  status: { type: String, default: "pending" },
  createdAt: String
}, { timestamps: true });

const ProfitSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: String,
  title: String,
  caption: String,
  image: String,
  date: String,
  status: { type: String, default: "pending" },
  createdAt: String
}, { timestamps: true });

const VideoSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  title: String,
  youtubeId: String,
  description: String,
  status: { type: String, default: "approved" },
  createdAt: String
}, { timestamps: true });

const UserAccountSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: String,
  email: { type: String, unique: true },
  phone: String,
  telegramId: String,
  telegramNumericId: String,
  tradingViewUsername: String,
  passwordSalt: String,
  passwordHash: String,
  createdAt: String,
  updatedAt: String,
  accessGrantedNotifiedAt: String,
  passwordResetTokenHash: String,
  passwordResetExpiresAt: String
}, { timestamps: true });

const AccessTicketSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  userId: String,
  name: String,
  email: String,
  phone: String,
  telegramId: String,
  telegramNumericId: String,
  tradingViewUsername: String,
  plan: String,
  accessType: String,
  paymentId: String,
  paymentProof: String,
  paymentStatus: String,
  accessStatus: String,
  status: String,
  accessStartDate: String,
  accessEndDate: String,
  onboardedAt: String,
  trialFeedbackDueDate: String,
  trialFeedbackStatus: String,
  trialFeedbackRating: String,
  trialFeedbackText: String,
  trialFeedbackAttachment: String,
  trialFeedbackSubmittedAt: String,
  userNote: String,
  adminNote: String,
  createdAt: String,
  updatedAt: String,
  expiryReminder2DaySentAt: String,
  tradingViewAccessStatus: String,
  tradingViewAccessUpdatedAt: String,
  telegramAccessStatus: String,
  telegramInviteLink: String,
  telegramInviteLinks: [mongoose.Schema.Types.Mixed],
  telegramDestinationStatuses: [mongoose.Schema.Types.Mixed],
  telegramInviteGeneratedAt: String,
  telegramAccessUpdatedAt: String,
  activityLog: [mongoose.Schema.Types.Mixed]
}, { timestamps: true });

const SupportTicketSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: String,
  email: String,
  phone: String,
  tradingViewUsername: String,
  category: String,
  priority: String,
  subject: String,
  message: String,
  attachment: String,
  status: String,
  adminReply: String,
  createdAt: String,
  updatedAt: String
}, { timestamps: true });

const MonthlyReportSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  month: String,
  generatedAt: String,
  totalOnboarded: Number,
  rows: [mongoose.Schema.Types.Mixed]
}, { timestamps: true });



const AccessRequestAuditSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  ticketId: String,
  userId: String,
  name: String,
  email: String,
  phone: String,
  telegramId: String,
  telegramNumericId: String,
  tradingViewUsername: String,
  plan: String,
  accessType: String,
  paymentId: String,
  paymentProof: String,
  status: String,
  paymentStatus: String,
  accessStatus: String,
  userNote: String,
  source: String,
  createdAt: String
}, { timestamps: true });

const NotificationSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  audience: String, // user or admin
  userId: String,
  email: String,
  type: String,
  title: String,
  message: String,
  relatedId: String,
  readAt: String,
  emailStatus: String,
  emailError: String,
  createdAt: String
}, { timestamps: true });


const Setting = mongoose.model("Setting", SettingSchema);
const Product = mongoose.model("Product", ProductSchema);
const Review = mongoose.model("Review", ReviewSchema);
const Profit = mongoose.model("Profit", ProfitSchema);
const Video = mongoose.model("Video", VideoSchema);
const UserAccount = mongoose.model("UserAccount", UserAccountSchema);
const AccessTicket = mongoose.model("AccessTicket", AccessTicketSchema);
const SupportTicket = mongoose.model("SupportTicket", SupportTicketSchema);
const MonthlyReport = mongoose.model("MonthlyReport", MonthlyReportSchema);
const Notification = mongoose.model("Notification", NotificationSchema);
const AccessRequestAudit = mongoose.model("AccessRequestAudit", AccessRequestAuditSchema);

// V49: runtime cache guarantees /api/public returns the exact latest admin-saved indicator details immediately.
let latestProductsCache = null;

const DEFAULTS = {
  "settings": {
    "brandName": "WhaleX",
    "supportEmail": "YOUR_SUPPORT_EMAIL_HERE",
    "telegramLink": "YOUR_TELEGRAM_LINK_HERE",
    "razorpayLink": "YOUR_RAZORPAY_PAYMENT_LINK_HERE",
    "upiId": "YOUR_UPI_ID_HERE",
    "upiPayeeName": "WhaleX",
    "notificationEmailEnabled": "true",
    "notificationWhatsappEnabled": "false",
    "notificationTelegramEnabled": "false",
    "whatsappProvider": "",
    "whatsappAdminPhone": "",
    "whatsappApiToken": "",
    "telegramBotToken": "",
    "telegramGroupChatId": "",
    "telegramDestinations": "",
    "telegramInviteExpireHours": "24",
    "heroTitle": "WhaleX \u2014 premium structure for serious traders.",
    "heroSubtitle": "A black-and-gold TradingView indicator suite built around structure, OrderFlow zones, and risk-first execution planning.",
    "marketLine": "Built for BTC, Gold, Forex, and index traders who want cleaner execution logic."
  },
  "pricing": {
    "planName": "WhaleX V1 Access",
    "oldPrice": "\u20b915,000",
    "currentPrice": "\u20b910,000",
    "discountText": "Launch discount: Save \u20b95,000",
    "monthlyEnabled": "true",
    "monthlyLabel": "Monthly Access",
    "monthlyDays": "30",
    "quarterlyEnabled": "false",
    "quarterlyLabel": "Quarterly Access",
    "quarterlyDays": "90",
    "quarterlyPrice": "",
    "halfYearlyEnabled": "false",
    "halfYearlyLabel": "Half Yearly Access",
    "halfYearlyDays": "180",
    "halfYearlyPrice": "",
    "yearlyEnabled": "false",
    "yearlyLabel": "Yearly Access",
    "yearlyDays": "365",
    "yearlyPrice": "",
    "trialEnabled": "true",
    "trialLabel": "3-Day Trial Access",
    "trialDays": "3"
  },
  "slides": [
    {
      "kicker": "WhaleX Suite",
      "title": "Structure first. Signal second.",
      "text": "Read the market with cleaner structure, zones, and risk visibility instead of chasing every candle.",
      "cta": "Explore Indicators",
      "link": "products.html"
    },
    {
      "kicker": "OrderFlow",
      "title": "Zones, POC, retest, reclaim.",
      "text": "Bring orderflow-style decision support into TradingView with a clean black-and-gold interface.",
      "cta": "See OrderFlow",
      "link": "products.html#orderflow"
    },
    {
      "kicker": "Risk Manager",
      "title": "Trade size before trade entry.",
      "text": "Plan risk, stop distance, and lot sizing before execution \u2014 discipline starts before the signal.",
      "cta": "View Pricing",
      "link": "pricing.html"
    }
  ],
  "products": [
    {
      "id": "whalex",
      "name": "WhaleX",
      "tag": "Core Structure Engine",
      "description": "WhaleX is the main structure indicator. It is designed to help traders understand market direction, clean structure shifts, and trade context without adding unnecessary chart noise.",
      "features": [
        "Core market-structure reading",
        "Clean signal-support workflow",
        "Designed for TradingView invite-only access",
        "Useful for BTC, Gold, Forex, and index traders",
        "Premium black-and-gold visual experience"
      ]
    },
    {
      "id": "orderflow",
      "name": "WhaleX OrderFlow",
      "tag": "Zones, POC, Retest/Reclaim",
      "description": "WhaleX OrderFlow focuses on zone-based decision support. It helps traders read top/bottom zones, POC context, volume-confirmed areas, retest behavior, and reclaim logic.",
      "features": [
        "Top and bottom zone framework",
        "POC and zone context",
        "Volume-confirmed decision support",
        "Retest/reclaim style analysis",
        "Built for structured intraday orderflow reading"
      ]
    },
    {
      "id": "risk-manager",
      "name": "WhaleX Risk Manager",
      "tag": "Risk + Lot Planning",
      "description": "WhaleX Risk Manager helps users plan trade risk before entering the market. It focuses on account balance, risk percentage, stop-loss distance, and position sizing discipline.",
      "features": [
        "Risk-percentage based planning",
        "Lot-size and stop-distance support",
        "Start-date and end-date access tracking in tickets",
        "Beginner-friendly risk discipline",
        "Designed to reduce emotional position sizing"
      ]
    }
  ],
  "reviews": [
    {
      "id": "rev-1",
      "name": "Early WhaleX User",
      "role": "BTC / Gold Trader",
      "rating": 5,
      "text": "The chart feels more structured. WhaleX helped me stop taking random entries.",
      "status": "approved",
      "createdAt": "2026-05-29"
    },
    {
      "id": "rev-2",
      "name": "Community Trader",
      "role": "Intraday Trader",
      "rating": 5,
      "text": "Risk Manager is simple and useful before entering a trade. Good for discipline.",
      "status": "approved",
      "createdAt": "2026-05-29"
    }
  ],
  "profits": [
    {
      "id": "profit-1",
      "name": "Sample User",
      "title": "Sample Profit Screenshot",
      "caption": "Replace this with real approved user proof.",
      "image": "/assets/profit-placeholder.svg",
      "date": "2026-05-29",
      "status": "approved",
      "createdAt": "2026-05-29"
    }
  ],
  "videos": [
    {
      "id": "vid-1",
      "title": "WhaleX Setup Guide",
      "youtubeId": "",
      "description": "Add your YouTube video ID from the admin panel.",
      "status": "approved",
      "createdAt": "2026-05-29"
    }
  ]
};


function containsBackendTestText(value) {
  return /backend\s+test/i.test(String(value || ""));
}

function defaultProductById(productId) {
  return (DEFAULTS.products || []).find((p) => String(p.id) === String(productId)) || null;
}

function productHasBackendTestData(product = {}) {
  const text = [
    product.name,
    product.tag,
    product.description,
    ...(Array.isArray(product.features) ? product.features : [product.features])
  ].join(" ");
  return containsBackendTestText(text);
}

async function sanitizeBackendTestProducts(reason = "startup") {
  const products = await Product.find({}).lean();
  let changed = 0;

  for (const product of products) {
    if (!productHasBackendTestData(product)) continue;

    const fallback = defaultProductById(product.id);
    if (!fallback) continue;

    await Product.updateOne(
      { id: product.id },
      {
        $set: {
          name: fallback.name,
          tag: fallback.tag,
          description: fallback.description,
          features: fallback.features
        }
      }
    );

    changed += 1;
    console.log("[WhaleX content cleanup] Removed backend-test product data", {
      reason,
      id: product.id,
      oldName: product.name,
      restoredName: fallback.name
    });
  }

  if (changed) {
    latestProductsCache = null;
    const productsAfterCleanup = await loadProductsFromDb();
    await saveProductsSnapshot(productsAfterCleanup);
  }

  return changed;
}

async function seedDefaults() {
  const settingsExists = await Setting.findOne({ key: "settings" });
  if (!settingsExists) await Setting.create({ key: "settings", value: DEFAULTS.settings });

  const pricingExists = await Setting.findOne({ key: "pricing" });
  if (!pricingExists) await Setting.create({ key: "pricing", value: DEFAULTS.pricing });

  const slidesExists = await Setting.findOne({ key: "slides" });
  if (!slidesExists) await Setting.create({ key: "slides", value: DEFAULTS.slides || [] });

  const productCount = await Product.countDocuments();
  if (productCount === 0 && Array.isArray(DEFAULTS.products)) {
    await Product.insertMany(DEFAULTS.products);
  }

  await sanitizeBackendTestProducts("seed-defaults");

  const reviewCount = await Review.countDocuments();
  if (reviewCount === 0 && Array.isArray(DEFAULTS.reviews)) {
    await Review.insertMany(DEFAULTS.reviews);
  }

  const profitCount = await Profit.countDocuments();
  if (profitCount === 0 && Array.isArray(DEFAULTS.profits)) {
    await Profit.insertMany(DEFAULTS.profits);
  }

  const videoCount = await Video.countDocuments();
  if (videoCount === 0 && Array.isArray(DEFAULTS.videos)) {
    await Video.insertMany(DEFAULTS.videos);
  }
}

async function getSetting(key, fallback) {
  const doc = await Setting.findOne({ key });
  return doc ? doc.value : fallback;
}
async function setSetting(key, value) {
  await Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
  return value;
}
function publicUser(user) {
  return {
    id: user.id,
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    telegramId: user.telegramId || "",
    telegramNumericId: user.telegramNumericId || "",
    tradingViewUsername: user.tradingViewUsername || "",
    createdAt: user.createdAt || "",
    updatedAt: user.updatedAt || ""
  };
}

function normalizeAccessPlan(plan) {
  const value = String(plan || "").toLowerCase();
  if (value.includes("trial")) return "trial";
  return "paid";
}
function activeAccessTicketQuery({ userId, email }) {
  return {
    status: "open",
    $or: [
      { userId },
      { email: String(email || "").toLowerCase() }
    ]
  };
}

function safeTicket(t) {
  return {
    id: t.id,
    userId: t.userId || "",
    name: t.name,
    email: t.email,
    phone: t.phone || "",
    tradingViewUsername: t.tradingViewUsername,
    telegramId: t.telegramId || "",
    telegramNumericId: t.telegramNumericId || "",
    plan: t.plan,
    accessType: t.accessType || "paid",
    paymentId: t.paymentId || "",
    paymentProof: t.paymentProof || "",
    paymentStatus: t.paymentStatus,
    accessStatus: t.accessStatus,
    status: t.status,
    accessStartDate: t.accessStartDate || "",
    accessEndDate: t.accessEndDate || "",
    onboardedAt: t.onboardedAt || "",
    trialFeedbackDueDate: t.trialFeedbackDueDate || "",
    trialFeedbackStatus: t.trialFeedbackStatus || "not_required",
    trialFeedbackRating: t.trialFeedbackRating || "",
    trialFeedbackText: t.trialFeedbackText || "",
    trialFeedbackAttachment: t.trialFeedbackAttachment || "",
    trialFeedbackSubmittedAt: t.trialFeedbackSubmittedAt || "",
    feedbackDueNow: isFeedbackDue(t),
    userNote: t.userNote || "",
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    adminNote: t.adminNote || "",
    accessGrantedNotifiedAt: t.accessGrantedNotifiedAt || "",
    expiryReminder2DaySentAt: t.expiryReminder2DaySentAt || "",
    tradingViewAccessStatus: t.tradingViewAccessStatus || "pending",
    tradingViewAccessUpdatedAt: t.tradingViewAccessUpdatedAt || "",
    telegramAccessStatus: t.telegramAccessStatus || "pending",
    telegramInviteLink: t.telegramInviteLink || "",
    telegramInviteLinks: Array.isArray(t.telegramInviteLinks) ? t.telegramInviteLinks : [],
    telegramDestinationStatuses: Array.isArray(t.telegramDestinationStatuses) ? t.telegramDestinationStatuses : [],
    telegramInviteGeneratedAt: t.telegramInviteGeneratedAt || "",
    telegramAccessUpdatedAt: t.telegramAccessUpdatedAt || "",
    activityLog: Array.isArray(t.activityLog) ? t.activityLog : []
  };
}
function safeSupport(t) {
  return {
    id: t.id,
    name: t.name,
    email: t.email,
    phone: t.phone || "",
    tradingViewUsername: t.tradingViewUsername || "",
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    message: t.message || "",
    attachment: t.attachment || "",
    status: t.status,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    adminReply: t.adminReply || ""
  };
}

const appConfig = { paidAccessDays: PAID_ACCESS_DAYS, trialAccessDays: TRIAL_ACCESS_DAYS };


function cleanProductForClient(product = {}) {
  const raw = typeof product.toObject === "function" ? product.toObject() : product;
  return {
    id: String(raw.id || "").trim(),
    name: String(raw.name || "").trim(),
    tag: String(raw.tag || "").trim(),
    description: String(raw.description || "").trim(),
    features: Array.isArray(raw.features)
      ? raw.features.map((x) => String(x).trim()).filter(Boolean)
      : String(raw.features || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : "",
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : ""
  };
}

function cleanProductList(products = []) {
  return products.map(cleanProductForClient).filter((p) => p.id);
}

async function loadProductsFromDb() {
  const products = await Product.find({}).sort({ _id: 1 }).lean();
  const clean = cleanProductList(products);
  if (clean.length) return clean;

  if (Array.isArray(DEFAULTS.products) && DEFAULTS.products.length) {
    await Product.insertMany(DEFAULTS.products);
    const seeded = await Product.find({}).sort({ _id: 1 }).lean();
    return cleanProductList(seeded);
  }

  return [];
}

async function getCanonicalProducts() {
  if (Array.isArray(latestProductsCache) && latestProductsCache.length) {
    return latestProductsCache;
  }

  latestProductsCache = await loadProductsFromDb();
  return latestProductsCache;
}

async function refreshProductsCacheFromDb() {
  latestProductsCache = await loadProductsFromDb();
  return latestProductsCache;
}

async function saveProductsSnapshot(products) {
  const clean = cleanProductList(products);
  await setSetting("products_snapshot", {
    updatedAt: nowIso(),
    products: clean
  });
  return clean;
}

function productSignature(products = []) {
  return cleanProductList(products).map((p) => [
    p.id,
    p.name,
    p.tag,
    p.description,
    (p.features || []).join("|"),
    p.updatedAt || ""
  ].join("~")).join("||");
}

async function buildPublicData() {
  await sanitizeBackendTestProducts("public-data");
  const [settings, pricing, slides, products, reviews, profits, videos] = await Promise.all([
    getSetting("settings", DEFAULTS.settings),
    getSetting("pricing", DEFAULTS.pricing),
    getSetting("slides", DEFAULTS.slides || []),
    getCanonicalProducts(),
    Review.find({ status: "approved" }).sort({ _id: -1 }).lean(),
    Profit.find({ status: "approved" }).sort({ _id: -1 }).lean(),
    Video.find({ status: "approved" }).sort({ _id: -1 }).lean()
  ]);

  return {
    settings,
    pricing: normalizedPricing(pricing),
    payment: {
      upiId: settings.upiId || settings.upi || settings.paymentUpiId || "",
      upiPayeeName: settings.upiPayeeName || settings.payeeName || settings.brandName || "WhaleX",
      razorpayLink: settings.razorpayLink || "",
      qrUrl: "/api/payment/upi-qr.svg"
    },
    slides,
    products,
    reviews,
    profits,
    videos,
    config: appConfig,
    publicVersion: {
      products: productSignature(products),
      generatedAt: nowIso()
    }
  };
}

async function buildAdminData() {
  const [
    settings,
    pricing,
    slides,
    products,
    reviews,
    profits,
    videos,
    userAccounts,
    accessInbox,
    accessTickets,
    supportTickets,
    monthlyReports,
    notifications
  ] = await Promise.all([
    getSetting("settings", DEFAULTS.settings),
    getSetting("pricing", DEFAULTS.pricing),
    getSetting("slides", DEFAULTS.slides || []),
    getCanonicalProducts(),
    Review.find({}).sort({ _id: -1 }).lean(),
    Profit.find({}).sort({ _id: -1 }).lean(),
    Video.find({}).sort({ _id: -1 }).lean(),
    UserAccount.find({}).sort({ _id: -1 }).lean(),
    buildAccessInbox(),
    AccessTicket.find({}).sort({ _id: -1 }).lean(),
    SupportTicket.find({}).sort({ _id: -1 }).lean(),
    MonthlyReport.find({}).sort({ _id: -1 }).lean(),
    Notification.find({ audience: "admin" }).sort({ _id: -1 }).limit(100).lean()
  ]);

  return {
    settings,
    pricing: normalizedPricing(pricing),
    slides,
    products,
    reviews,
    profits,
    videos,
    userAccounts,
    accessInbox,
    accessTickets: accessTickets.map(safeTicket),
    supportTickets: supportTickets.map(safeSupport),
    monthlyReports,
    notifications: notifications.map(safeNotification),
    adminUnreadNotifications: notifications.filter((n) => !n.readAt).length,
    config: appConfig,
    counts: {
      users: userAccounts.length,
      accessTickets: accessTickets.length,
      accessInbox: accessInbox.length,
      supportTickets: supportTickets.length,
      notifications: notifications.length
    }
  };
}

async function buildMonthlyReport(monthKey = monthKeyFromDate()) {
  const tickets = await AccessTicket.find({ accessStatus: "granted" }).lean();
  const onboarded = tickets.filter((t) => isInMonth(t.onboardedAt || t.updatedAt || t.createdAt, monthKey));
  const rows = onboarded.map((t) => ({
    ticketId: t.id,
    name: t.name || "",
    email: t.email || "",
    phone: t.phone || "",
    telegramId: t.telegramId || "",
    tradingViewUsername: t.tradingViewUsername || "",
    plan: t.plan || "",
    accessType: t.accessType || "paid",
    paymentStatus: t.paymentStatus || "",
    accessStatus: t.accessStatus || "",
    ticketStatus: t.status || "",
    accessStartDate: t.accessStartDate || "",
    accessEndDate: t.accessEndDate || "",
    onboardedAt: t.onboardedAt || "",
    createdAt: t.createdAt || "",
    trialFeedbackStatus: t.trialFeedbackStatus || "",
    trialFeedbackRating: t.trialFeedbackRating || "",
    trialFeedbackText: t.trialFeedbackText || "",
    adminNote: t.adminNote || "",
    accessGrantedNotifiedAt: t.accessGrantedNotifiedAt || "",
    expiryReminder2DaySentAt: t.expiryReminder2DaySentAt || ""
  }));
  return {
    id: `report-${monthKey}`,
    month: monthKey,
    generatedAt: nowIso(),
    totalOnboarded: rows.length,
    rows
  };
}
function reportToCsv(report) {
  const headers = [
    "Ticket ID","Name","Email","Phone","Telegram ID","TradingView Username","Plan","Access Type",
    "Payment Status","Access Status","Ticket Status","Start Date","End Date","Onboarded At","Created At",
    "Trial Feedback Status","Trial Feedback Rating","Trial Feedback","Admin Note"
  ];
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of report.rows) {
    lines.push([
      r.ticketId, r.name, r.email, r.phone, r.telegramId, r.tradingViewUsername, r.plan, r.accessType,
      r.paymentStatus, r.accessStatus, r.ticketStatus, r.accessStartDate, r.accessEndDate, r.onboardedAt, r.createdAt,
      r.trialFeedbackStatus, r.trialFeedbackRating, r.trialFeedbackText, r.adminNote
    ].map(csvEscape).join(","));
  }
  return lines.join("\n");
}
async function saveMonthlyReport(monthKey = monthKeyFromDate()) {
  const report = await buildMonthlyReport(monthKey);
  await MonthlyReport.findOneAndUpdate({ id: report.id }, report, { upsert: true, new: true });
  return report;
}
function startMonthlyReportScheduler() {
  let lastRunKey = "";
  setInterval(async () => {
    const now = new Date();
    const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
    if (now.getUTCDate() !== 1 || lastRunKey === todayKey) return;
    const previousMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const previousMonthKey = monthKeyFromDate(previousMonthDate);
    try {
      await saveMonthlyReport(previousMonthKey);
      lastRunKey = todayKey;
      console.log(`Monthly onboarding report generated for ${previousMonthKey}`);
    } catch (err) {
      console.error("Monthly report generation failed:", err);
    }
  }, 60 * 60 * 1000);
}


function isPlaceholderEmail(value = "") {
  const text = String(value || "").trim().toLowerCase();
  return !text || text.includes("your_") || text.includes("example.com") || text.includes("placeholder");
}

function extractEmailAddress(value = "") {
  const text = String(value || "").trim();
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}



function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function appBaseUrl() {
  return String(process.env.APP_URL || process.env.PUBLIC_BASE_URL || process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
}

function absoluteUrl(path = "/") {
  const cleanPath = String(path || "/").startsWith("/") ? String(path || "/") : `/${path}`;
  return `${appBaseUrl()}${cleanPath}`;
}

function plainRows(rows = []) {
  return rows.filter((row) => row && row.label).map((row) => `${row.label}: ${row.value || "-"}`).join("\n");
}

function htmlEscapeValue(value = "") {
  return escapeHtml(String(value || ""));
}

function emailHtmlTemplate({ title, intro, ctaText, ctaUrl, rows = [], footer = "" }) {
  const rowHtml = rows
    .filter((row) => row && row.label)
    .map((row) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eadfbd;color:#6b5d32;font-weight:700;width:170px;">${htmlEscapeValue(row.label)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eadfbd;color:#111827;">${htmlEscapeValue(row.value || "-")}</td>
      </tr>
    `)
    .join("");

  const cta = ctaUrl ? `
    <p style="margin:24px 0;">
      <a href="${htmlEscapeValue(ctaUrl)}" style="background:#d4a12f;color:#111827;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:10px;display:inline-block;">
        ${htmlEscapeValue(ctaText || "Open WhaleX")}
      </a>
    </p>
    <p style="font-size:12px;color:#6b7280;margin-top:4px;">If the button does not work, copy this link:<br>${htmlEscapeValue(ctaUrl)}</p>
  ` : "";

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#0b0a05;padding:28px;">
    <div style="max-width:720px;margin:0 auto;background:#fffaf0;border:1px solid #d4a12f;border-radius:16px;overflow:hidden;">
      <div style="background:#11100a;color:#f5d56a;padding:20px 24px;font-size:22px;font-weight:900;letter-spacing:.04em;">WhaleX</div>
      <div style="padding:24px;color:#111827;">
        <h2 style="margin:0 0 12px;font-size:24px;color:#111827;">${htmlEscapeValue(title)}</h2>
        <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 18px;">${htmlEscapeValue(intro || "")}</p>
        ${rowHtml ? `<table style="border-collapse:collapse;width:100%;background:#fff;border:1px solid #eadfbd;border-radius:10px;overflow:hidden;">${rowHtml}</table>` : ""}
        ${cta}
        <p style="font-size:13px;line-height:1.5;color:#6b7280;margin-top:20px;">${htmlEscapeValue(footer || "This email was sent by WhaleX. Please keep it for your records.")}</p>
      </div>
    </div>
  </div>`;
}

function safePdfTitle(title = "WhaleX Details") {
  return String(title || "WhaleX Details").replace(/[^\w\s.-]/g, "").slice(0, 80);
}

function makeDetailsPdfBuffer({ title = "WhaleX Details", rows = [], note = "" }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc
      .fontSize(22)
      .fillColor("#111111")
      .text("WhaleX", { align: "left" })
      .moveDown(0.2)
      .fontSize(16)
      .fillColor("#333333")
      .text(title)
      .moveDown(1);

    doc
      .fontSize(10)
      .fillColor("#666666")
      .text(`Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`)
      .moveDown(1);

    rows
      .filter((row) => row && row.label)
      .forEach((row) => {
        doc
          .fontSize(10)
          .fillColor("#8a6a12")
          .text(String(row.label))
          .fontSize(12)
          .fillColor("#111111")
          .text(String(row.value || "-"), { lineGap: 2 })
          .moveDown(0.6);
      });

    if (note) {
      doc
        .moveDown(0.5)
        .fontSize(10)
        .fillColor("#8a6a12")
        .text("Note")
        .fontSize(12)
        .fillColor("#111111")
        .text(String(note), { lineGap: 3 });
    }

    doc
      .moveDown(1.5)
      .fontSize(9)
      .fillColor("#777777")
      .text("This PDF was generated automatically by WhaleX.", { align: "center" });

    doc.end();
  });
}

function attachmentName(title = "WhaleX Details") {
  return `${safePdfTitle(title).replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.pdf`;
}

function accessTicketRows(ticket = {}) {
  return [
    { label: "Ticket ID", value: ticket.id },
    { label: "Name", value: ticket.name },
    { label: "Email", value: ticket.email },
    { label: "Phone", value: ticket.phone },
    { label: "Telegram ID", value: ticket.telegramId },
    { label: "Telegram Numeric User ID", value: ticket.telegramNumericId },
    { label: "TradingView ID", value: ticket.tradingViewUsername },
    { label: "Access Type", value: formatAccessType(ticket.accessType) },
    { label: "Plan", value: ticket.plan },
    { label: "Payment Status", value: ticket.paymentStatus },
    { label: "Payment ID / UTR", value: ticket.paymentId },
    { label: "Access Status", value: ticket.accessStatus },
    { label: "Trial Feedback Rating", value: ticket.trialFeedbackRating },
    { label: "Trial Feedback", value: ticket.trialFeedbackText },
    { label: "Trial Feedback Attachment", value: ticket.trialFeedbackAttachment },
    { label: "Ticket Status", value: ticket.status },
    { label: "Start Date", value: ticket.accessStartDate || ticket.startDate },
    { label: "End Date", value: ticket.accessEndDate || ticket.endDate },
    { label: "Created At", value: ticket.createdAt }
  ];
}

function supportTicketRows(ticket = {}) {
  return [
    { label: "Ticket ID", value: ticket.id },
    { label: "Name", value: ticket.name },
    { label: "Email", value: ticket.email },
    { label: "Phone", value: ticket.phone },
    { label: "TradingView ID", value: ticket.tradingViewUsername },
    { label: "Category", value: ticket.category },
    { label: "Priority", value: ticket.priority },
    { label: "Subject", value: ticket.subject },
    { label: "Status", value: ticket.status },
    { label: "Message", value: ticket.message },
    { label: "Admin Reply", value: ticket.adminReply },
    { label: "Created At", value: ticket.createdAt },
    { label: "Updated At", value: ticket.updatedAt }
  ];
}

async function makePdfAttachment({ title, rows, note }) {
  const content = await makeDetailsPdfBuffer({ title, rows, note });
  return {
    filename: attachmentName(title),
    content,
    contentType: "application/pdf"
  };
}

function smtpDiagnostics() {
  return {
    configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    host: process.env.SMTP_HOST || "",
    port: String(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false"),
    user: process.env.SMTP_USER || "",
    hasPassword: !!process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || ""
  };
}

function smtpConfigured() {
  const d = smtpDiagnostics();
  return !!(d.host && d.user && d.hasPassword);
}

function effectiveEmailFrom() {
  const from = String(process.env.EMAIL_FROM || "").trim();
  if (from && !isPlaceholderEmail(from)) return from;
  if (process.env.SMTP_USER) return `WhaleX <${process.env.SMTP_USER}>`;
  return "WhaleX <no-reply@whalex.local>";
}

function mailTransport() {
  if (!smtpConfigured()) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendEmail({ to, subject, text, html = "", attachments = [] }) {
  const recipient = extractEmailAddress(to);
  if (!recipient) return { status: "skipped", error: "Missing or invalid recipient" };

  const diag = smtpDiagnostics();
  const transporter = mailTransport();

  if (!transporter) {
    console.log("[Email skipped - SMTP not configured]", {
      to: recipient,
      subject,
      smtp: { host: diag.host, user: diag.user, hasPassword: diag.hasPassword }
    });
    return { status: "skipped", error: "SMTP not configured: check SMTP_HOST, SMTP_USER, SMTP_PASS" };
  }

  try {
    await transporter.sendMail({
      from: effectiveEmailFrom(),
      to: recipient,
      subject,
      text,
      html: html || undefined,
      attachments: Array.isArray(attachments) ? attachments : []
    });
    console.log("[Email sent]", { to: recipient, subject });
    return { status: "sent", error: "" };
  } catch (err) {
    console.error("[Email send failed]", {
      to: recipient,
      subject,
      error: err.message,
      smtp: { host: diag.host, user: diag.user, from: effectiveEmailFrom() }
    });
    return { status: "failed", error: err.message };
  }
}

async function createNotification({ audience, userId="", email="", type, title, message, relatedId="", emailHtml="", attachments=[] }) {
  // Always save in-app notification first. Email failure must never block the bell notification.
  const notification = await Notification.create({
    id: id("notify"),
    audience,
    userId,
    email: extractEmailAddress(email) || String(email || "").trim().toLowerCase(),
    type,
    title,
    message,
    relatedId,
    readAt: "",
    emailStatus: "pending",
    emailError: "",
    createdAt: nowIso()
  });

  const settings = await getSetting("settings", DEFAULTS.settings);
  const emailEnabled = normalizeBooleanText(settings.notificationEmailEnabled ?? "true", true);

  const mail = email && emailEnabled
    ? await sendEmail({ to: email, subject: title, text: message, html: emailHtml, attachments })
    : { status: "skipped", error: email ? "Email channel disabled" : "No recipient email" };

  notification.emailStatus = mail.status;
  notification.emailError = mail.error || "";
  await notification.save();

  console.log("[Notification created]", {
    id: notification.id,
    audience,
    type,
    relatedId,
    email: notification.email || "",
    emailStatus: notification.emailStatus,
    emailError: notification.emailError || ""
  });

  return notification;
}

async function effectiveAdminEmail() {
  const settings = await getSetting("settings", DEFAULTS.settings);

  const candidates = [
    ADMIN_EMAIL,
    settings.adminEmail,
    settings.supportEmail,
    extractEmailAddress(process.env.EMAIL_FROM || ""),
    process.env.SMTP_USER
  ];

  return candidates
    .map((x) => extractEmailAddress(x))
    .find((x) => x && !isPlaceholderEmail(x)) || "";
}


function ticketActivityEntry(action, message, actor = "system", meta = {}) {
  return {
    at: nowIso(),
    actor,
    action,
    message,
    meta
  };
}

function appendTicketActivity(ticket, action, message, actor = "system", meta = {}) {
  if (!ticket) return;
  const existing = Array.isArray(ticket.activityLog) ? ticket.activityLog : [];
  ticket.activityLog = [ticketActivityEntry(action, message, actor, meta), ...existing].slice(0, 80);
}

function accessDeliveryLabel(value = "") {
  const raw = String(value || "pending").toLowerCase();
  if (raw === "given") return "Given";
  if (raw === "removed") return "Removed";
  if (raw === "invite_generated") return "Invite Generated";
  if (raw === "joined") return "Joined";
  if (raw === "left") return "Left";
  return "Pending";
}

async function notifyAdminAccessActivity(ticket, title, message, action = "access_activity") {
  if (!ticket) return null;
  const adminAccessUrl = absoluteUrl("/whalex-admin.html#accessTickets");
  return notifyAdmin({
    type: action,
    title,
    message: `${message} Ticket: ${ticket.id}. User: ${ticket.name || "-"} (${ticket.email || "-"}). Open: ${adminAccessUrl}`,
    relatedId: ticket.id,
    emailHtml: emailHtmlTemplate({
      title,
      intro: message,
      ctaText: "Open Access Tickets",
      ctaUrl: adminAccessUrl,
      rows: accessTicketRows(ticket),
      footer: "This update was recorded in the WhaleX access activity log."
    })
  });
}

async function notifyUserAccessDeliveryUpdate(ticket, title, intro, action = "access_delivery_update") {
  if (!ticket) return null;
  const portalUrl = absoluteUrl("/user.html#access");
  return createNotification({
    audience: "user",
    userId: ticket.userId || "",
    email: ticket.email || "",
    type: action,
    title,
    message: `${intro} Open: ${portalUrl}`,
    relatedId: ticket.id,
    emailHtml: emailHtmlTemplate({
      title,
      intro,
      ctaText: "Open My Access",
      ctaUrl: portalUrl,
      rows: accessTicketRows(ticket),
      footer: "This update is also visible in your My Access dashboard."
    })
  });
}

function looksLikeTelegramBotToken(value = "") {
  return /^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(String(value || "").trim());
}

function maskTelegramBotToken(value = "") {
  const token = String(value || "").trim();
  if (!token) return "";
  const [left, right = ""] = token.split(":");
  return `${left}:***${right.slice(-4)}`;
}

function parseTelegramDestinations(settings = {}) {
  const raw = String(settings.telegramDestinations || "").trim();
  const fallbackChatId = String(settings.telegramGroupChatId || "").trim();
  const fallbackBotToken = String(settings.telegramBotToken || "").trim();

  let parsed = [];
  if (raw) {
    try {
      const json = JSON.parse(raw);
      if (Array.isArray(json)) {
        parsed = json.map((item, idx) => ({
          id: String(item.id || item.name || `telegram-${idx + 1}`).trim(),
          name: String(item.name || item.label || item.id || `Telegram ${idx + 1}`).trim(),
          chatId: String(item.chatId || item.chat_id || item.channel || "").trim(),
          botToken: String(item.botToken || item.bot_token || item.token || fallbackBotToken || "").trim(),
          enabled: normalizeBooleanText(item.enabled ?? "true", true)
        }));
      }
    } catch {
      parsed = raw.split(/\r?\n/)
        .map((line, idx) => {
          const clean = line.trim();
          if (!clean || clean.startsWith("#")) return null;

          const parts = clean.split("|").map((x) => x.trim());
          const name = parts[0] || `Telegram ${idx + 1}`;
          const chatId = parts[1] || "";

          // Supported:
          // Name | Chat ID | enabled
          // Name | Chat ID | Bot Token | enabled
          const third = parts[2] || "";
          const fourth = parts[3] || "";

          const hasPerDestinationToken = looksLikeTelegramBotToken(third);
          const botToken = hasPerDestinationToken ? third : fallbackBotToken;
          const enabledText = hasPerDestinationToken ? fourth : third;
          const enabled = enabledText ? normalizeBooleanText(enabledText, true) : true;

          return {
            id: `${name}-${chatId}`.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 48) || `telegram-${idx + 1}`,
            name,
            chatId,
            botToken,
            enabled
          };
        })
        .filter(Boolean);
    }
  }

  if (!parsed.length && fallbackChatId) {
    parsed = [{
      id: "primary-telegram",
      name: "Telegram Group",
      chatId: fallbackChatId,
      botToken: fallbackBotToken,
      enabled: true
    }];
  }

  const seen = new Set();
  return parsed
    .filter((d) => d && d.chatId && d.enabled)
    .map((d, idx) => {
      const key = `${String(d.chatId).toLowerCase()}|${String(d.botToken || fallbackBotToken).slice(0, 24)}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        id: d.id || `telegram-${idx + 1}`,
        name: d.name || `Telegram ${idx + 1}`,
        chatId: d.chatId,
        botToken: String(d.botToken || fallbackBotToken || "").trim(),
        botTokenMasked: maskTelegramBotToken(d.botToken || fallbackBotToken || ""),
        enabled: true
      };
    })
    .filter(Boolean);
}

async function getTelegramConfig() {
  const settings = await getSetting("settings", DEFAULTS.settings);
  const fallbackBotToken = String(settings.telegramBotToken || "").trim();
  const destinations = parseTelegramDestinations(settings);
  return {
    enabled: normalizeBooleanText(settings.notificationTelegramEnabled, false),
    botToken: fallbackBotToken,
    groupChatId: String(settings.telegramGroupChatId || "").trim(),
    destinations,
    expireHours: Math.max(1, Number(settings.telegramInviteExpireHours || 24) || 24)
  };
}

async function createTelegramInviteForDestination(ticket, cfg, destination, index = 0) {
  const botToken = String(destination.botToken || cfg.botToken || "").trim();
  if (!botToken) {
    throw new Error(`Telegram bot token is missing for ${destination.name}. Add token in destination line or global fallback token.`);
  }

  const expireDate = Math.floor((Date.now() + cfg.expireHours * 60 * 60 * 1000) / 1000);
  const url = `https://api.telegram.org/bot${botToken}/createChatInviteLink`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: destination.chatId,
      name: `WhaleX-${ticket.id}-${index + 1}`.slice(0, 32),
      expire_date: expireDate,
      member_limit: 1,
      creates_join_request: false
    })
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.ok || !json.result?.invite_link) {
    throw new Error(json.description || `Telegram invite failed for ${destination.name}.`);
  }

  return {
    id: destination.id,
    name: destination.name,
    chatId: destination.chatId,
    botTokenMasked: destination.botTokenMasked || maskTelegramBotToken(botToken),
    inviteLink: json.result.invite_link,
    status: "invite_generated",
    generatedAt: nowIso(),
    error: ""
  };
}

async function createTelegramInvites(ticket) {
  const cfg = await getTelegramConfig();
  if (!cfg.enabled) throw new Error("Telegram channel is disabled in Admin Settings.");
  if (!cfg.destinations.length) throw new Error("No enabled Telegram destinations found. Add Telegram Destinations in Admin Settings.");

  const missingTokenDestinations = cfg.destinations.filter((destination) => !destination.botToken && !cfg.botToken);
  if (missingTokenDestinations.length) {
    throw new Error(`Bot token missing for: ${missingTokenDestinations.map((d) => d.name).join(", ")}.`);
  }

  const results = [];
  for (const [index, destination] of cfg.destinations.entries()) {
    try {
      results.push(await createTelegramInviteForDestination(ticket, cfg, destination, index));
    } catch (error) {
      results.push({
        id: destination.id,
        name: destination.name,
        chatId: destination.chatId,
        botTokenMasked: destination.botTokenMasked || "",
        inviteLink: "",
        status: "error",
        generatedAt: nowIso(),
        error: error.message || "Invite generation failed"
      });
    }
  }

  if (!results.some((item) => item.inviteLink)) {
    const errors = results.map((item) => `${item.name}: ${item.error || "failed"}`).join("; ");
    throw new Error(errors || "Telegram invite generation failed for all destinations.");
  }

  return results;
}

function telegramLinksMessage(links = []) {
  const valid = (links || []).filter((item) => item.inviteLink);
  if (!valid.length) return "";
  return valid.map((item) => `${item.name}: ${item.inviteLink}`).join("\n");
}

async function applyTelegramInvitesToTicket(ticket, { actor = "admin", notifyUser = true, notifyAdminUser = true, action = "telegram_invites_generated" } = {}) {
  if (!ticket) return { generated: false, skipped: true, reason: "No ticket" };

  const existingLinks = Array.isArray(ticket.telegramInviteLinks) ? ticket.telegramInviteLinks : [];
  const hasExistingValidInvite = existingLinks.some((item) => item && item.inviteLink);
  if (hasExistingValidInvite) {
    ticket.telegramAccessStatus = ticket.telegramAccessStatus || "invite_generated";
    return { generated: false, skipped: true, existing: true, inviteLinks: existingLinks, message: "Telegram invite links already exist." };
  }

  const cfg = await getTelegramConfig();
  if (!cfg.enabled) {
    return { generated: false, skipped: true, reason: "Telegram channel disabled." };
  }

  const inviteLinks = await createTelegramInvites(ticket);
  const primaryLink = inviteLinks.find((item) => item.inviteLink)?.inviteLink || "";

  ticket.telegramInviteLink = primaryLink;
  ticket.telegramInviteLinks = inviteLinks;
  ticket.telegramDestinationStatuses = inviteLinks.map((item) => ({
    id: item.id,
    name: item.name,
    chatId: item.chatId,
    status: item.status,
    updatedAt: nowIso(),
    error: item.error || ""
  }));
  ticket.telegramAccessStatus = inviteLinks.some((item) => item.inviteLink) ? "invite_generated" : "pending";
  ticket.telegramInviteGeneratedAt = nowIso();
  ticket.telegramAccessUpdatedAt = nowIso();
  ticket.updatedAt = nowIso();

  const linkMessage = telegramLinksMessage(inviteLinks);
  const successCount = inviteLinks.filter((item) => item.inviteLink).length;
  const failCount = inviteLinks.length - successCount;

  appendTicketActivity(
    ticket,
    action,
    `Telegram invite links generated for ${successCount} destination${successCount === 1 ? "" : "s"}${failCount ? `, ${failCount} failed` : ""}.`,
    actor,
    { inviteLinks }
  );

  if (notifyUser && successCount) {
    await notifyUserAccessDeliveryUpdate(
      ticket,
      "WhaleX Telegram group invites",
      `Your WhaleX Telegram access links are ready:\n${linkMessage}`,
      action
    );
  }

  if (notifyAdminUser && successCount) {
    await notifyAdminAccessActivity(
      ticket,
      "WhaleX Telegram invites generated",
      `Telegram invite links were generated for ${successCount} destination${successCount === 1 ? "" : "s"}${failCount ? `, ${failCount} failed` : ""}.`,
      action
    );
  }

  return { generated: true, inviteLinks, successCount, failCount, message: `Telegram invite links generated for ${successCount} destination${successCount === 1 ? "" : "s"}.` };
}

async function autoGenerateTelegramInvitesOnApproval(ticket) {
  try {
    const result = await applyTelegramInvitesToTicket(ticket, {
      actor: "system",
      notifyUser: false,
      notifyAdminUser: false,
      action: "telegram_invites_auto_generated_on_approval"
    });

    if (result.generated) {
      appendTicketActivity(ticket, "telegram_invites_attached_to_approval", "Telegram invite links were auto-generated during approval and attached to access details.", "system");
    }

    return result;
  } catch (error) {
    appendTicketActivity(
      ticket,
      "telegram_auto_invite_failed",
      `Telegram invite auto-generation failed during approval: ${error.message}`,
      "system",
      { error: error.message }
    );
    return { generated: false, error: error.message };
  }
}


async function notifyUserAccessSubmitted(ticket) {
  if (!ticket) return null;
  const title = "WhaleX access request submitted";
  const portalUrl = absoluteUrl("/user.html#access");
  const rows = accessTicketRows(ticket);
  const intro = ticket.accessType === "trial"
    ? "Your trial access request has been submitted successfully. You can track the status from My Access."
    : "Your paid access request has been submitted successfully. WhaleX will verify payment and update your access status.";
  const message = `${intro} Open: ${portalUrl}\n\n${plainRows(rows)}`;
  const attachment = await makePdfAttachment({
    title: "WhaleX Access Request Details",
    rows,
    note: ticket.accessType === "trial"
      ? "Trial access request submitted. WhaleX will verify and activate if eligible."
      : "Paid access request submitted. Access will be provided after payment verification."
  });

  return createNotification({
    audience: "user",
    userId: ticket.userId || "",
    email: ticket.email || "",
    type: "access_submitted",
    title,
    message,
    relatedId: ticket.id,
    emailHtml: emailHtmlTemplate({
      title,
      intro,
      ctaText: "Track My Access",
      ctaUrl: portalUrl,
      rows,
      footer: "PDF copy of your access request is attached for your records."
    }),
    attachments: [attachment]
  });
}

async function notifyUserAccessGranted(ticket) {
  if (!ticket || ticket.accessGrantedNotifiedAt) return;
  const title = "WhaleX access activated";
  const portalUrl = absoluteUrl("/user.html#access");
  const rows = accessTicketRows(ticket);
  const intro = `Your WhaleX access is active from ${ticket.accessStartDate || ticket.startDate || "-"} to ${ticket.accessEndDate || ticket.endDate || "-"}.`;
  const message = `${intro} Open: ${portalUrl}\n\n${plainRows(rows)}`;
  const attachment = await makePdfAttachment({
    title: "WhaleX Access Activated Details",
    rows,
    note: "Your WhaleX access is now active."
  });

  await createNotification({
    audience: "user",
    userId: ticket.userId || "",
    email: ticket.email || "",
    type: "access_granted",
    title,
    message,
    relatedId: ticket.id,
    emailHtml: emailHtmlTemplate({
      title,
      intro,
      ctaText: "Open My Access",
      ctaUrl: portalUrl,
      rows,
      footer: "PDF copy of your activated access details is attached."
    }),
    attachments: [attachment]
  });
  ticket.accessGrantedNotifiedAt = nowIso();
}

async function notifyUserAccessRejected(ticket) {
  if (!ticket) return;
  const title = "WhaleX access not granted";
  const portalUrl = absoluteUrl("/user.html#access");
  const reason = String(ticket.adminNote || "").trim();
  const intro = reason
    ? `Your WhaleX access was not granted. Reason: ${reason}`
    : "Your WhaleX access was not granted. Please contact WhaleX support for more details.";
  const rows = accessTicketRows(ticket);
  const message = `${intro} Open: ${portalUrl}\n\n${plainRows(rows)}`;
  const attachment = await makePdfAttachment({
    title: "WhaleX Access Not Granted Details",
    rows,
    note: reason || "Please contact WhaleX support for clarification."
  });

  await createNotification({
    audience: "user",
    userId: ticket.userId || "",
    email: ticket.email || "",
    type: "access_rejected",
    // V95: user-facing rejection language must say "Access Not Granted".
    title,
    message,
    relatedId: ticket.id,
    emailHtml: emailHtmlTemplate({
      title,
      intro,
      ctaText: "Open My Access",
      ctaUrl: portalUrl,
      rows,
      footer: "PDF copy of your access not granted details is attached."
    }),
    attachments: [attachment]
  });
}

async function notifyAdmin({ type, title, message, relatedId="", emailHtml="", attachments=[] }) {
  const adminEmail = await effectiveAdminEmail();

  const notification = await createNotification({
    audience: "admin",
    email: adminEmail,
    type,
    title,
    message,
    relatedId,
    emailHtml,
    attachments
  });

  console.log("[Admin notification]", {
    type,
    relatedId,
    adminEmail: adminEmail || "MISSING",
    emailStatus: notification.emailStatus || "unknown",
    emailError: notification.emailError || "",
    title
  });

  return notification;
}

async function notifyUserSupportSubmitted(ticket) {
  if (!ticket) return null;
  const title = "WhaleX support ticket submitted";
  const portalUrl = absoluteUrl("/support.html");
  const rows = supportTicketRows(ticket);
  const intro = "Your support ticket has been created successfully.";
  const attachment = await makePdfAttachment({
    title: "WhaleX Support Ticket Details",
    rows,
    note: "Your support ticket has been submitted."
  });

  return createNotification({
    audience: "user",
    userId: "",
    email: ticket.email || "",
    type: "support_submitted",
    title,
    message: `${intro} Open: ${portalUrl}\n\n${plainRows(rows)}`,
    relatedId: ticket.id,
    emailHtml: emailHtmlTemplate({
      title,
      intro,
      ctaText: "Open Support",
      ctaUrl: portalUrl,
      rows,
      footer: "PDF copy of your support ticket is attached."
    }),
    attachments: [attachment]
  });
}

async function notifyUserSupportUpdated(ticket, previousStatus = "") {
  if (!ticket) return null;
  const title = "WhaleX support ticket updated";
  const portalUrl = absoluteUrl("/support.html");
  const statusText = ticket.status ? ` Status: ${ticket.status}.` : "";
  const replyText = ticket.adminReply ? ` Reply: ${ticket.adminReply}` : "";
  const intro = `Your support ticket has been updated.${statusText}${replyText}`;
  const rows = supportTicketRows(ticket);
  const attachment = await makePdfAttachment({
    title: "WhaleX Support Ticket Update",
    rows,
    note: ticket.adminReply || "Your support ticket has been updated."
  });

  return createNotification({
    audience: "user",
    userId: "",
    email: ticket.email || "",
    type: "support_updated",
    title,
    message: `${intro} Open: ${portalUrl}\n\n${plainRows(rows)}`,
    relatedId: ticket.id,
    emailHtml: emailHtmlTemplate({
      title,
      intro,
      ctaText: "Open Support",
      ctaUrl: portalUrl,
      rows,
      footer: "PDF copy of the support update is attached."
    }),
    attachments: [attachment]
  });
}

function isTrialAccessTicket(ticket = {}) {
  const combined = `${ticket.accessType || ""} ${ticket.plan || ""}`.toLowerCase();
  return combined.includes("trial");
}

function reminderCopyForTicket(ticket = {}) {
  const isTrial = isTrialAccessTicket(ticket);
  const endDate = ticket.accessEndDate || ticket.endDate || "-";

  if (isTrial) {
    return {
      type: "trial_expiry_reminder_2_days",
      title: "WhaleX trial ends in 2 days",
      intro: `Your 3-Day Trial Access ends on ${endDate}. To continue using WhaleX without interruption, please upgrade to monthly access before the trial expires.`,
      ctaText: "Open My Access",
      pdfTitle: "WhaleX Trial Expiry Reminder",
      note: "Trial access ends in 2 days. Upgrade to monthly access to continue using WhaleX."
    };
  }

  return {
    type: "monthly_expiry_reminder_2_days",
    title: "WhaleX monthly access expires in 2 days",
    intro: `Your WhaleX monthly access ends on ${endDate}. Please renew before expiry to avoid interruption to your WhaleX access.`,
    ctaText: "Renew / Open My Access",
    pdfTitle: "WhaleX Monthly Access Expiry Reminder",
    note: "Monthly access expires in 2 days. Renew before expiry to avoid interruption."
  };
}

async function notifyExpiryReminder(ticket) {
  if (!ticket || ticket.expiryReminder2DaySentAt) return;

  const portalUrl = absoluteUrl("/user.html#access");
  const rows = accessTicketRows(ticket);
  const copy = reminderCopyForTicket(ticket);
  const attachment = await makePdfAttachment({
    title: copy.pdfTitle,
    rows,
    note: copy.note
  });

  await createNotification({
    audience: "user",
    userId: ticket.userId || "",
    email: ticket.email || "",
    type: copy.type,
    title: copy.title,
    message: `${copy.intro} Open: ${portalUrl}\n\n${plainRows(rows)}`,
    relatedId: ticket.id,
    emailHtml: emailHtmlTemplate({
      title: copy.title,
      intro: copy.intro,
      ctaText: copy.ctaText,
      ctaUrl: portalUrl,
      rows,
      footer: "PDF copy of your 2-day reminder is attached."
    }),
    attachments: [attachment]
  });

  ticket.expiryReminder2DaySentAt = nowIso();
  await ticket.save();

  console.log("[2-day access reminder sent]", {
    ticketId: ticket.id,
    email: ticket.email,
    accessType: ticket.accessType,
    plan: ticket.plan,
    endDate: ticket.accessEndDate || ticket.endDate || "",
    type: copy.type
  });
}

async function runExpiryReminderSweep(reason = "scheduled") {
  const reminderDate = addDaysDateOnly(todayDateOnly(), 2);

  const tickets = await AccessTicket.find({
    status: "done",
    accessStatus: "granted",
    accessEndDate: reminderDate,
    $or: [
      { expiryReminder2DaySentAt: "" },
      { expiryReminder2DaySentAt: { $exists: false } }
    ]
  });

  console.log("[2-day access reminder sweep]", {
    reason,
    reminderDate,
    count: tickets.length
  });

  for (const ticket of tickets) {
    await notifyExpiryReminder(ticket);
  }

  return tickets.length;
}

function startExpiryReminderScheduler() {
  // Run once shortly after startup so reminders do not wait up to 1 hour after restart.
  setTimeout(() => {
    runExpiryReminderSweep("startup").catch((err) => {
      console.error("Expiry reminder startup sweep failed:", err);
    });
  }, 10 * 1000);

  // Then keep checking hourly.
  setInterval(async () => {
    try {
      await runExpiryReminderSweep("hourly");
    } catch (err) {
      console.error("Expiry reminder scheduler failed:", err);
    }
  }, 60 * 60 * 1000);
}


function priceToAmount(value) {
  const text = String(value || "").replace(/,/g, "");
  const match = text.match(/(\d+(?:\.\d{1,2})?)/);
  return match ? match[1] : "";
}

function normalizeBooleanText(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return defaultValue;
  return ["true", "yes", "on", "1", "enabled"].includes(text);
}

function normalizedPricing(pricing = {}) {
  const p = { ...DEFAULTS.pricing, ...(pricing || {}) };

  const monthlyPlan = {
    id: "monthly",
    accessType: "paid",
    enabled: normalizeBooleanText(p.monthlyEnabled, true),
    label: p.monthlyLabel || "Monthly Access",
    planName: p.planName || "WhaleX V1 Access",
    days: Number(p.monthlyDays || process.env.PAID_ACCESS_DAYS || appConfig.paidAccessDays || 30),
    price: p.currentPrice || "",
    oldPrice: p.oldPrice || "",
    discountText: p.discountText || "",
    paymentRequired: true
  };

  const futurePlans = [
    {
      id: "quarterly",
      accessType: "paid",
      enabled: normalizeBooleanText(p.quarterlyEnabled, false),
      label: p.quarterlyLabel || "Quarterly Access",
      planName: p.quarterlyLabel || "Quarterly Access",
      days: Number(p.quarterlyDays || 90),
      price: p.quarterlyPrice || "",
      oldPrice: "",
      discountText: "",
      paymentRequired: true
    },
    {
      id: "half-yearly",
      accessType: "paid",
      enabled: normalizeBooleanText(p.halfYearlyEnabled, false),
      label: p.halfYearlyLabel || "Half Yearly Access",
      planName: p.halfYearlyLabel || "Half Yearly Access",
      days: Number(p.halfYearlyDays || 180),
      price: p.halfYearlyPrice || "",
      oldPrice: "",
      discountText: "",
      paymentRequired: true
    },
    {
      id: "yearly",
      accessType: "paid",
      enabled: normalizeBooleanText(p.yearlyEnabled, false),
      label: p.yearlyLabel || "Yearly Access",
      planName: p.yearlyLabel || "Yearly Access",
      days: Number(p.yearlyDays || 365),
      price: p.yearlyPrice || "",
      oldPrice: "",
      discountText: "",
      paymentRequired: true
    }
  ];

  const trialPlan = {
    id: "trial",
    accessType: "trial",
    enabled: normalizeBooleanText(p.trialEnabled, true),
    label: p.trialLabel || "3-Day Trial Access",
    planName: p.trialLabel || "3-Day Trial Access",
    days: Number(p.trialDays || process.env.TRIAL_ACCESS_DAYS || appConfig.trialAccessDays || 3),
    price: "Free",
    oldPrice: "",
    discountText: "Trial access requires admin approval.",
    paymentRequired: false
  };

  return {
    ...p,
    plans: [monthlyPlan, ...futurePlans, trialPlan],
    enabledPlans: [monthlyPlan, ...futurePlans, trialPlan].filter((x) => x.enabled)
  };
}

function buildUpiPaymentUri(settings, pricing) {
  const upiId = String(settings.upiId || "").trim();
  if (!upiId || upiId === "YOUR_UPI_ID_HERE") return "";
  const payeeName = String(settings.upiPayeeName || settings.brandName || "WhaleX").trim();
  const normalized = normalizedPricing(pricing);
  const amount = priceToAmount(normalized.currentPrice || pricing.currentPrice || "");
  const params = new URLSearchParams();
  params.set("pa", upiId);
  params.set("pn", payeeName || "WhaleX");
  params.set("tn", `${pricing.planName || "WhaleX Access"} payment`);
  params.set("cu", "INR");
  if (amount) params.set("am", amount);
  return `upi://pay?${params.toString()}`;
}
function placeholderQrSvg(message = "Add UPI ID in Admin Settings") {
  const safe = String(message).replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260">
    <rect width="260" height="260" rx="20" fill="#15130d"/>
    <rect x="18" y="18" width="224" height="224" rx="14" fill="none" stroke="#d9a441" stroke-width="2" stroke-dasharray="8 8"/>
    <text x="130" y="120" text-anchor="middle" fill="#f7dd93" font-family="Arial" font-size="16" font-weight="700">UPI QR</text>
    <text x="130" y="148" text-anchor="middle" fill="#d8cfb4" font-family="Arial" font-size="12">${safe}</text>
  </svg>`;
}



async function planMetaFromPricing(planValue = "") {
  const pricing = normalizedPricing(await getSetting("pricing", DEFAULTS.pricing));
  const planText = String(planValue || "").trim().toLowerCase();

  const matched = pricing.enabledPlans.find((p) => {
    const candidates = [p.id, p.label, p.planName].map((x) => String(x || "").trim().toLowerCase());
    return candidates.includes(planText);
  });

  return matched || pricing.enabledPlans.find((p) => p.id === "monthly") || pricing.enabledPlans[0];
}

async function saveAccessRequestAudit(ticket, source = "user_access_request") {
  try {
    const existing = await AccessRequestAudit.findOne({ ticketId: ticket.id });
    if (existing) return existing;

    const audit = await AccessRequestAudit.create({
      id: id("accesslog"),
      ticketId: ticket.id,
      userId: ticket.userId || "",
      name: ticket.name || "",
      email: ticket.email || "",
      phone: ticket.phone || "",
      telegramId: ticket.telegramId || "",
      telegramNumericId: ticket.telegramNumericId || "",
      tradingViewUsername: ticket.tradingViewUsername || "",
      plan: ticket.plan || "",
      accessType: ticket.accessType || "",
      paymentId: ticket.paymentId || "",
      paymentProof: ticket.paymentProof || "",
      status: ticket.status || "open",
      paymentStatus: ticket.paymentStatus || "",
      accessStatus: ticket.accessStatus || "",
      userNote: ticket.userNote || "",
      source,
      createdAt: ticket.createdAt || nowIso()
    });

    console.log("[Admin access inbox saved]", {
      ticketId: ticket.id,
      email: ticket.email,
      accessType: ticket.accessType
    });

    return audit;
  } catch (err) {
    console.error("[Admin access inbox save failed]", err.message);
    return null;
  }
}

async function buildAccessInbox() {
  const [tickets, audits] = await Promise.all([
    AccessTicket.find({}).sort({ _id: -1 }).lean(),
    AccessRequestAudit.find({}).sort({ _id: -1 }).lean()
  ]);

  const ticketRows = tickets.map((t) => ({ ...safeTicket(t), inboxSource: "ticket", auditOnly: false }));
  const ticketIds = new Set(ticketRows.map((t) => t.id));

  const auditOnlyRows = audits
    .filter((a) => a.ticketId && !ticketIds.has(a.ticketId))
    .map((a) => ({
      id: a.ticketId,
      userId: a.userId || "",
      name: a.name || "",
      email: a.email || "",
      phone: a.phone || "",
      telegramId: a.telegramId || "",
      telegramNumericId: a.telegramNumericId || "",
      tradingViewUsername: a.tradingViewUsername || "",
      plan: a.plan || "",
      accessType: a.accessType || "paid",
      paymentId: a.paymentId || "",
      paymentProof: a.paymentProof || "",
      paymentStatus: a.paymentStatus || "",
      accessStatus: a.accessStatus || "",
      status: a.status || "open",
      accessStartDate: "",
      accessEndDate: "",
      onboardedAt: "",
      trialFeedbackDueDate: "",
      trialFeedbackStatus: "",
      trialFeedbackRating: "",
      trialFeedbackText: "",
      userNote: a.userNote || "",
      adminNote: "Audit-only record. Original ticket record was not found.",
      createdAt: a.createdAt || "",
      updatedAt: "",
      inboxSource: "audit",
      auditOnly: true
    }));

  return [...ticketRows, ...auditOnlyRows].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}


function safeNotification(n) {
  return {
    id: n.id,
    audience: n.audience || "",
    userId: n.userId || "",
    email: n.email || "",
    type: n.type || "",
    title: n.title || "",
    message: n.message || "",
    relatedId: n.relatedId || "",
    readAt: n.readAt || "",
    unread: !n.readAt,
    emailStatus: n.emailStatus || "",
    emailError: n.emailError || "",
    createdAt: n.createdAt || ""
  };
}
function unreadQuery(base = {}) {
  return {
    ...base,
    $or: [
      { readAt: "" },
      { readAt: { $exists: false } },
      { readAt: null },
      { readAt: "null" },
      { readAt: "undefined" }
    ]
  };
}
function userNotificationQuery(user) {
  const email = String(user.email || "").toLowerCase();
  return {
    audience: "user",
    $or: [
      { userId: user.id },
      { email }
    ]
  };
}
async function getAdminNotifications(limit = 80) {
  const items = await Notification.find({ audience: "admin" }).sort({ _id: -1 }).limit(limit).lean();
  const unreadCount = await Notification.countDocuments(unreadQuery({ audience: "admin" }));
  return { notifications: items.map(safeNotification), unreadCount };
}
async function getUserNotifications(user, limit = 60) {
  const base = userNotificationQuery(user);
  const items = await Notification.find(base).sort({ _id: -1 }).limit(limit).lean();
  const unreadCount = await Notification.countDocuments(unreadQuery(base));
  return { notifications: items.map(safeNotification), unreadCount };
}


async function markNotificationsInScopeRead(scopeQuery = {}) {
  const readAt = nowIso();
  const beforeUnread = await Notification.countDocuments(unreadQuery(scopeQuery));

  await Notification.updateMany(
    scopeQuery,
    { $set: { readAt } }
  );

  const afterUnread = await Notification.countDocuments(unreadQuery(scopeQuery));

  return { readAt, beforeUnread, afterUnread };
}

function publicProductsVersion(products = []) {
  return productSignature(products);
}

// Routes
app.get("/api/health", async (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };

  res.json({
    ok: dbState === 1,
    app: "WhaleX",
    version: "100.0.0",
    environment: process.env.NODE_ENV || "development",
    mongo: dbStatusMap[dbState] || "unknown",
    emailConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    appUrl: process.env.APP_URL || "http://localhost:3000",
    time: new Date().toISOString()
  });
});

app.get("/api/public/products", async (_req, res, next) => {
  try {
    await sanitizeBackendTestProducts("public-products-api");
    const products = await getCanonicalProducts();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.json({
      ok: true,
      products,
      publicVersion: {
        products: productSignature(products),
        generatedAt: nowIso()
      }
    });
  } catch (e) { next(e); }
});

app.get("/api/public", async (_req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.json(await buildPublicData());
  } catch (e) { next(e); }
});

app.get("/api/payment/upi-qr.svg", async (_req, res, next) => {
  try {
    const [settings, pricing] = await Promise.all([
      getSetting("settings", DEFAULTS.settings),
      getSetting("pricing", DEFAULTS.pricing)
    ]);

    const upiUri = buildUpiPaymentUri(settings, pricing);
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "no-store");

    if (!upiUri) {
      return res.send(placeholderQrSvg("Add UPI ID in Admin Settings"));
    }

    const svg = await QRCode.toString(upiUri, {
      type: "svg",
      width: 260,
      margin: 1,
      color: {
        dark: "#111111",
        light: "#ffffff"
      }
    });

    res.send(svg);
  } catch (e) { next(e); }
});

app.get("/api/payment/upi-uri", async (_req, res, next) => {
  try {
    const [settings, pricing] = await Promise.all([
      getSetting("settings", DEFAULTS.settings),
      getSetting("pricing", DEFAULTS.pricing)
    ]);
    res.json({ ok: true, upiUri: buildUpiPaymentUri(settings, pricing) });
  } catch (e) { next(e); }
});


app.get("/whalex-admin", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "whalex-admin.html")));
app.get("/admin.html", (_req, res) => res.status(404).send("Not found"));

app.post("/api/admin/login", (req, res) => {
  if ((req.body || {}).password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Wrong admin password." });
  const token = crypto.randomBytes(24).toString("hex");
  adminTokens.add(token);
  res.json({ token });
});
app.post("/api/admin/logout", auth, (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  adminTokens.delete(token);
  res.json({ ok: true });
});

app.post("/api/admin/test-notification", auth, async (_req, res, next) => {
  try {
    const notification = await notifyAdmin({
      type: "admin_test",
      title: "WhaleX admin notification test",
      message: "This is a test admin notification from WhaleX. If you received this, admin notifications are working.",
      relatedId: "admin-test"
    });
    res.json({
      ok: true,
      notification,
      message: notification.emailStatus === "sent"
        ? "Admin notification saved and email sent."
        : `Admin notification saved. Email status: ${notification.emailStatus}${notification.emailError ? " - " + notification.emailError : ""}`
    });
  } catch (e) { next(e); }
});





app.post("/api/admin/run-expiry-reminders", auth, async (req, res, next) => {
  try {
    const count = await runExpiryReminderSweep("manual-admin");
    res.json({ ok: true, message: `2-day reminder sweep completed. Reminders sent: ${count}`, count });
  } catch (e) { next(e); }
});

app.get("/api/admin/notification-diagnostics", auth, async (_req, res, next) => {
  try {
    const adminEmail = await effectiveAdminEmail();
    const [adminLatest, userLatest, counts] = await Promise.all([
      Notification.find({ audience: "admin" }).sort({ _id: -1 }).limit(10).lean(),
      Notification.find({ audience: "user" }).sort({ _id: -1 }).limit(10).lean(),
      Notification.aggregate([{ $group: { _id: "$audience", count: { $sum: 1 } } }])
    ]);

    res.json({
      ok: true,
      smtp: smtpDiagnostics(),
      effectiveEmailFrom: effectiveEmailFrom(),
      adminEmail,
      counts,
      adminLatest: adminLatest.map(safeNotification),
      userLatest: userLatest.map(safeNotification)
    });
  } catch (e) { next(e); }
});

app.post("/api/admin/test-email-notification", auth, async (req, res, next) => {
  try {
    const adminEmail = await effectiveAdminEmail();
    const userEmail = extractEmailAddress(req.body?.userEmail || req.body?.email || "");
    const testUrl = absoluteUrl("/whalex-admin.html");
    const testRows = [
      { label: "Purpose", value: "Admin email + notification test" },
      { label: "Admin Email", value: adminEmail },
      { label: "URL", value: testUrl },
      { label: "Created At", value: nowIso() }
    ];
    const testAttachment = await makePdfAttachment({
      title: "WhaleX Admin Email Test",
      rows: testRows,
      note: "If you received this PDF, attachments are working."
    });
    const adminNotification = await notifyAdmin({
      type: "admin_email_test",
      title: "WhaleX admin email + notification test",
      message: `This is a WhaleX admin notification/email delivery test. Open: ${testUrl}`,
      relatedId: "admin-email-test",
      emailHtml: emailHtmlTemplate({
        title: "WhaleX admin email + notification test",
        intro: "This test confirms email body, link, and PDF attachment delivery.",
        ctaText: "Open Admin Panel",
        ctaUrl: testUrl,
        rows: testRows,
        footer: "Test PDF attachment included."
      }),
      attachments: [testAttachment]
    });

    let userNotification = null;
    if (userEmail) {
      userNotification = await createNotification({
        audience: "user",
        email: userEmail,
        type: "user_email_test",
        title: "WhaleX user email + notification test",
        message: "This is a WhaleX user notification/email delivery test.",
        relatedId: "user-email-test"
      });
    }

    res.json({
      ok: true,
      smtp: smtpDiagnostics(),
      effectiveEmailFrom: effectiveEmailFrom(),
      adminEmail,
      adminNotification: safeNotification(adminNotification),
      userNotification: userNotification ? safeNotification(userNotification) : null
    });
  } catch (e) { next(e); }
});


app.get("/api/admin/access-inbox", auth, async (_req, res, next) => {
  try {
    const inbox = await buildAccessInbox();
    res.json({ ok: true, inbox, count: inbox.length });
  } catch (e) { next(e); }
});

app.get("/api/admin/access-tickets", auth, async (_req, res, next) => {
  try {
    const tickets = await AccessTicket.find({}).sort({ _id: -1 }).lean();
    const inbox = await buildAccessInbox();
    res.json({ ok: true, tickets: tickets.map(safeTicket), inbox, count: tickets.length, inboxCount: inbox.length });
  } catch (e) { next(e); }
});


app.get("/api/admin/debug-counts", auth, async (_req, res, next) => {
  try {
    const [accessTickets, users, supportTickets, notifications, accessAudit] = await Promise.all([
      AccessTicket.countDocuments({}),
      UserAccount.countDocuments({}),
      SupportTicket.countDocuments({}),
      Notification.countDocuments({}),
      AccessRequestAudit.countDocuments({})
    ]);
    res.json({ ok: true, accessTickets, accessAudit, users, supportTickets, notifications });
  } catch (e) { next(e); }
});


app.get("/api/admin/notifications", auth, async (_req, res, next) => {
  try {
    const result = await getAdminNotifications(100);
    res.json({ ok: true, ...result });
  } catch (e) { next(e); }
});

app.patch("/api/admin/notifications/read-all", auth, async (_req, res, next) => {
  try {
    const mark = await markNotificationsInScopeRead({ audience: "admin" });
    const result = await getAdminNotifications(100);
    res.json({
      ok: true,
      readAt: mark.readAt,
      beforeUnread: mark.beforeUnread,
      afterUnread: mark.afterUnread,
      notifications: result.notifications.map((n) => ({ ...n, readAt: n.readAt || mark.readAt, unread: false })),
      unreadCount: 0
    });
  } catch (e) { next(e); }
});

app.patch("/api/admin/notifications/:id/read", auth, async (req, res, next) => {
  try {
    const item = await Notification.findOneAndUpdate(
      { audience: "admin", id: req.params.id },
      { readAt: nowIso() },
      { new: true }
    ).lean();
    const result = await getAdminNotifications(100);
    res.json({ ok: true, notification: item ? safeNotification(item) : null, ...result });
  } catch (e) { next(e); }
});

app.get("/api/admin/live", auth, async (_req, res, next) => {
  try {
    const [accessInbox, supportTickets, notificationResult, accessTicketsCount, usersCount, supportTicketsCount] = await Promise.all([
      buildAccessInbox(),
      SupportTicket.find({}).sort({ _id: -1 }).lean(),
      getAdminNotifications(80),
      AccessTicket.countDocuments({}),
      UserAccount.countDocuments({}),
      SupportTicket.countDocuments({})
    ]);

    res.json({
      ok: true,
      accessInbox,
      supportTickets: supportTickets.map(safeSupport),
      notifications: notificationResult.notifications,
      unreadCount: notificationResult.unreadCount,
      counts: {
        users: usersCount,
        accessTickets: accessTicketsCount,
        accessInbox: accessInbox.length,
        supportTickets: supportTicketsCount,
        notifications: notificationResult.notifications.length
      },
      serverTime: nowIso()
    });
  } catch (e) { next(e); }
});

app.get("/api/admin/data", auth, async (_req, res, next) => { try { res.json(await buildAdminData()); } catch (e) { next(e); } });

app.put("/api/admin/settings", auth, async (req, res, next) => {
  try {
    const current = await getSetting("settings", DEFAULTS.settings);
    const settings = await setSetting("settings", { ...current, ...req.body });
    res.json({ ok: true, settings });
  } catch (e) { next(e); }
});
app.put("/api/admin/pricing", auth, async (req, res, next) => {
  try {
    const current = await getSetting("pricing", DEFAULTS.pricing);
    const pricing = await setSetting("pricing", { ...current, ...req.body });
    res.json({ ok: true, pricing });
  } catch (e) { next(e); }
});
app.put("/api/admin/products/:id", auth, async (req, res, next) => {
  try {
    const productId = String(req.params.id || "").trim();

    const features = Array.isArray(req.body.features)
      ? req.body.features.map((x) => String(x).trim()).filter(Boolean)
      : String(req.body.features || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

    const update = {
      name: String(req.body.name || "").trim(),
      tag: String(req.body.tag || "").trim(),
      description: String(req.body.description || "").trim(),
      features
    };

    if (!productId) return res.status(400).json({ error: "Missing indicator id." });
    if (!update.name) return res.status(400).json({ error: "Indicator name is required." });

    const product = await Product.findOneAndUpdate(
      { id: productId },
      { $set: update },
      { new: true, upsert: false }
    ).lean();

    if (!product) return res.status(404).json({ error: `Product not found: ${productId}` });

    const products = await refreshProductsCacheFromDb();
    await saveProductsSnapshot(products);

    const publicProduct = products.find((p) => p.id === productId);
    const synced =
      publicProduct &&
      publicProduct.name === update.name &&
      publicProduct.tag === update.tag &&
      publicProduct.description === update.description &&
      JSON.stringify(publicProduct.features || []) === JSON.stringify(update.features || []);

    const publicVersion = {
      products: productSignature(products),
      generatedAt: nowIso()
    };

    console.log("[Indicator details updated and synced]", {
      id: productId,
      name: update.name,
      synced,
      publicVersion: publicVersion.generatedAt
    });

    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      product: publicProduct || cleanProductForClient(product),
      products,
      synced,
      publicVersion,
      message: synced
        ? "Indicator details saved and synced to the user portal."
        : "Indicator details saved, but sync verification failed. Please refresh and check again."
    });
  } catch (e) { next(e); }
});

// User accounts
app.post("/api/user/register", async (req, res, next) => {
  try {
    req.body.telegramNumericId = String(req.body.telegramNumericId || "").replace(/\s+/g, "").trim();
    const required = { name: req.body.name, email: req.body.email, phone: req.body.phone, telegramId: req.body.telegramId, tradingViewUsername: req.body.tradingViewUsername, password: req.body.password };
    const missing = Object.entries(required).filter(([, value]) => !String(value || "").trim()).map(([key]) => key);
    if (missing.length) {
      const labelMap = {
        name: "Name",
        email: "Email ID",
        phone: "Phone Number",
        telegramId: "Telegram ID",
        tradingViewUsername: "TradingView ID",
        password: "Password"
      };
      return res.status(400).json({ error: `Missing required fields: ${missing.map((key) => labelMap[key] || key).join(", ")}` });
    }
    if (req.body.telegramNumericId && !/^\d+$/.test(req.body.telegramNumericId)) {
      return res.status(400).json({ error: "Telegram Numeric ID should contain numbers only. Example: 123456789" });
    }

    const email = String(req.body.email).trim().toLowerCase();
    const existing = await UserAccount.findOne({ email });
    if (existing) return res.status(400).json({ error: "An account already exists with this email. Please login." });

    const password = hashPassword(req.body.password);
    const user = await UserAccount.create({
      id: id("user"),
      name: req.body.name || "",
      email,
      phone: req.body.phone || "",
      telegramId: req.body.telegramId || "",
      telegramNumericId: String(req.body.telegramNumericId || "").trim(),
      tradingViewUsername: req.body.tradingViewUsername || "",
      passwordSalt: password.salt,
      passwordHash: password.hash,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      tradingViewAccessStatus: "pending",
      tradingViewAccessUpdatedAt: "",
      telegramAccessStatus: "pending",
      telegramInviteLink: "",
      telegramInviteLinks: [],
      telegramDestinationStatuses: [],
      telegramInviteGeneratedAt: "",
      telegramAccessUpdatedAt: "",
      activityLog: [ticketActivityEntry("created", "Access request submitted by user.", "user")]
    });

    const token = crypto.randomBytes(24).toString("hex");
    userTokens.set(token, user.id);
    res.json({ ok: true, token, user: publicUser(user), message: "Account created. Your details will be used to auto-fill access forms." });
  } catch (e) { next(e); }
});
app.post("/api/user/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await UserAccount.findOne({ email });
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) return res.status(401).json({ error: "Invalid email or password." });
    const token = crypto.randomBytes(24).toString("hex");
    userTokens.set(token, user.id);
    res.json({ ok: true, token, user: publicUser(user), message: "Logged in successfully." });
  } catch (e) { next(e); }
});

app.post("/api/user/forgot-password", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    // Always return a generic success message so we do not reveal registered emails.
    const genericMessage = "If this email is registered, a password reset link has been sent.";

    if (!email) {
      return res.json({ ok: true, message: genericMessage });
    }

    const user = await UserAccount.findOne({ email });
    if (!user) {
      return res.json({ ok: true, message: genericMessage });
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.passwordResetTokenHash = hashResetToken(token);
    user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    user.updatedAt = nowIso();
    await user.save();

    const resetLink = buildPasswordResetLink(email, token);
    const subject = "Reset your WhaleX password";
    const text = `Hello ${user.name || "Trader"},

We received a request to reset your WhaleX password.

Reset your password using this link:
${resetLink}

This link will expire in 30 minutes.

If you did not request this, you can ignore this email.

- WhaleX`;

    const mail = await sendEmail({ to: email, subject, text });

    if (mail.status !== "sent") {
      console.log("[Password reset link - email not sent]", {
        email,
        status: mail.status,
        error: mail.error || "",
        resetLink
      });
    } else {
      console.log("[Password reset email sent]", { email });
    }

    res.json({ ok: true, message: genericMessage });
  } catch (e) { next(e); }
});

app.post("/api/user/reset-password", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const token = String(req.body.token || "").trim();
    const password = String(req.body.password || "");

    if (!email || !token) {
      return res.status(400).json({ error: "Reset link is missing or invalid." });
    }

    if (!validNewPassword(password)) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const user = await UserAccount.findOne({ email });
    if (!user || !user.passwordResetTokenHash || !user.passwordResetExpiresAt) {
      return res.status(400).json({ error: "Reset link is invalid or expired." });
    }

    const expiresAt = new Date(user.passwordResetExpiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      user.passwordResetTokenHash = "";
      user.passwordResetExpiresAt = "";
      await user.save();
      return res.status(400).json({ error: "Reset link is expired. Please request a new one." });
    }

    const tokenHash = hashResetToken(token);
    const isValidToken = crypto.timingSafeEqual(
      Buffer.from(tokenHash, "hex"),
      Buffer.from(user.passwordResetTokenHash, "hex")
    );

    if (!isValidToken) {
      return res.status(400).json({ error: "Reset link is invalid or expired." });
    }

    const newPassword = hashPassword(password);
    user.passwordSalt = newPassword.salt;
    user.passwordHash = newPassword.hash;
    user.passwordResetTokenHash = "";
    user.passwordResetExpiresAt = "";
    user.updatedAt = nowIso();
    await user.save();

    await createNotification({
      audience: "user",
      userId: user.id,
      email: user.email,
      type: "password_reset",
      title: "WhaleX password changed",
      message: "Your WhaleX account password was changed successfully.",
      relatedId: user.id
    });

    console.log("[Password reset completed]", { email });

    res.json({ ok: true, message: "Password reset successfully. You can login now." });
  } catch (e) { next(e); }
});

app.post("/api/user/logout", userAuth, (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  userTokens.delete(token);
  res.json({ ok: true });
});

app.get("/api/user/notifications", userAuth, async (req, res, next) => {
  try {
    const user = await UserAccount.findOne({ id: req.userId });
    if (!user) return res.status(404).json({ error: "User account not found." });
    const result = await getUserNotifications(user, 60);
    res.json({ ok: true, ...result });
  } catch (e) { next(e); }
});

app.patch("/api/user/notifications/read-all", userAuth, async (req, res, next) => {
  try {
    const user = await UserAccount.findOne({ id: req.userId });
    if (!user) return res.status(404).json({ error: "User account not found." });
    const scopeQuery = userNotificationQuery(user);
    const mark = await markNotificationsInScopeRead(scopeQuery);
    const result = await getUserNotifications(user, 60);
    res.json({
      ok: true,
      readAt: mark.readAt,
      beforeUnread: mark.beforeUnread,
      afterUnread: mark.afterUnread,
      notifications: result.notifications.map((n) => ({ ...n, readAt: n.readAt || mark.readAt, unread: false })),
      unreadCount: 0
    });
  } catch (e) { next(e); }
});

app.patch("/api/user/notifications/:id/read", userAuth, async (req, res, next) => {
  try {
    const user = await UserAccount.findOne({ id: req.userId });
    if (!user) return res.status(404).json({ error: "User account not found." });
    const query = userNotificationQuery(user);
    const item = await Notification.findOneAndUpdate(
      { ...query, id: req.params.id },
      { readAt: nowIso() },
      { new: true }
    ).lean();
    const result = await getUserNotifications(user, 60);
    res.json({ ok: true, notification: item ? safeNotification(item) : null, ...result });
  } catch (e) { next(e); }
});

app.get("/api/user/profile", userAuth, async (req, res, next) => {
  try {
    const user = await UserAccount.findOne({ id: req.userId });
    if (!user) return res.status(404).json({ error: "User account not found." });
    res.json({ ok: true, user: publicUser(user) });
  } catch (e) { next(e); }
});
app.put("/api/user/profile", userAuth, async (req, res, next) => {
  try {
    const user = await UserAccount.findOne({ id: req.userId });
    if (!user) return res.status(404).json({ error: "User account not found." });
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email is required." });
    const existing = await UserAccount.findOne({ email, id: { $ne: req.userId } });
    if (existing) return res.status(400).json({ error: "This email is already used by another account." });

    user.name = req.body.name || "";
    user.email = email;
    user.phone = req.body.phone || "";
    user.telegramId = req.body.telegramId || "";
    user.tradingViewUsername = req.body.tradingViewUsername || "";
    user.updatedAt = nowIso();
    if (String(req.body.password || "").trim()) {
      const password = hashPassword(req.body.password);
      user.passwordSalt = password.salt;
      user.passwordHash = password.hash;
    }
    await user.save();
    res.json({ ok: true, user: publicUser(user), message: "Profile updated." });
  } catch (e) { next(e); }
});

// Access tickets
app.post("/api/user/access-ticket", upload.single("paymentProof"), async (req, res, next) => {
  try {
    const requestedPlan = req.body.plan || "WhaleX V1 Access";
    const planMeta = await planMetaFromPricing(requestedPlan);
    const plan = planMeta?.planName || planMeta?.label || requestedPlan;
    const accessType = planMeta?.accessType || (isTrialPlan(plan) ? "trial" : "paid");

    const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
    const userId = userTokens.get(token) || "";
    const loggedInUser = userId ? await UserAccount.findOne({ id: userId }) : null;

    const merged = {
      name: req.body.name || loggedInUser?.name || "",
      email: String(req.body.email || loggedInUser?.email || "").toLowerCase(),
      phone: req.body.phone || loggedInUser?.phone || "",
      telegramId: req.body.telegramId || loggedInUser?.telegramId || "",
      telegramNumericId: String(req.body.telegramNumericId || loggedInUser?.telegramNumericId || "").trim(),
      tradingViewUsername: req.body.tradingViewUsername || loggedInUser?.tradingViewUsername || ""
    };

    // V97: Telegram Numeric ID is optional now.
    // It is useful for future exact Telegram auto-removal/tracking, but should not block access request.
    merged.telegramNumericId = String(merged.telegramNumericId || "").replace(/\s+/g, "").trim();

    const requiredMerged = {
      name: merged.name,
      email: merged.email,
      phone: merged.phone,
      telegramId: merged.telegramId,
      tradingViewUsername: merged.tradingViewUsername
    };

    const missing = Object.entries(requiredMerged)
      .filter(([, value]) => !String(value || "").trim())
      .map(([key]) => key);

    if (missing.length) {
      const labelMap = {
        name: "Name",
        email: "Email ID",
        phone: "Phone Number",
        telegramId: "Telegram ID",
        tradingViewUsername: "TradingView ID"
      };
      return res.status(400).json({ error: `Missing required fields: ${missing.map((key) => labelMap[key] || key).join(", ")}` });
    }

    if (merged.telegramNumericId && !/^\d+$/.test(merged.telegramNumericId)) {
      return res.status(400).json({ error: "Telegram Numeric ID should contain numbers only. Example: 123456789" });
    }

    if (loggedInUser) {
      const userUpdateFields = {
        name: merged.name,
        email: merged.email,
        phone: merged.phone,
        telegramId: merged.telegramId,
        tradingViewUsername: merged.tradingViewUsername,
        updatedAt: nowIso()
      };
      if (merged.telegramNumericId) userUpdateFields.telegramNumericId = merged.telegramNumericId;

      await UserAccount.updateOne(
        { id: userId },
        { $set: userUpdateFields }
      );
    }

    const paymentId = String(req.body.paymentId || "").trim();

    if (accessType === "paid" && !paymentId) {
      return res.status(400).json({
        error: "Payment ID / UTR is mandatory for monthly access. Open your UPI/bank app transaction details and copy the UTR / UPI Ref No. / Transaction ID / Bank Reference No."
      });
    }

    const duplicateActiveTicket = await AccessTicket.findOne(activeAccessTicketQuery({
      userId,
      email: merged.email
    }));

    if (duplicateActiveTicket) {
      return res.status(409).json({
        error: "You have already raised a request. Please wait until it is Done or Rejected before raising another request.",
        ticket: safeTicket(duplicateActiveTicket)
      });
    }

    const paymentProof = req.file ? await uploadToCloudinary(req.file, "whalex/payment-proofs") : "";

    if (accessType === "paid" && !paymentProof) {
      return res.status(400).json({
        error: "Payment proof screenshot/PDF is mandatory for monthly access. Please upload the successful payment screenshot or PDF receipt from your UPI/bank/Razorpay payment."
      });
    }


    const ticket = await AccessTicket.create({
      id: id("access"),
      userId,
      ...merged,
      plan,
      accessType,
      paymentId,
      paymentProof,
      paymentStatus: accessType === "trial" ? "not_required" : "pending",
      accessStatus: "not_granted",
      status: "open",
      accessStartDate: "",
      accessEndDate: "",
      onboardedAt: "",
      trialFeedbackDueDate: "",
      trialFeedbackStatus: accessType === "trial" ? "pending" : "not_required",
      trialFeedbackRating: "",
      trialFeedbackText: "",
      trialFeedbackSubmittedAt: "",
      userNote: req.body.note || "",
      adminNote: "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      tradingViewAccessStatus: "pending",
      tradingViewAccessUpdatedAt: "",
      telegramAccessStatus: "pending",
      telegramInviteLink: "",
      telegramInviteLinks: [],
      telegramDestinationStatuses: [],
      telegramInviteGeneratedAt: "",
      telegramAccessUpdatedAt: "",
      activityLog: [ticketActivityEntry("created", "Access request submitted by user.", "user")]
    });

    console.log("[Access ticket created]", {
      id: ticket.id,
      email: ticket.email,
      accessType: ticket.accessType,
      status: ticket.status
    });

    await saveAccessRequestAudit(ticket);

    try {
      await notifyUserAccessSubmitted(ticket);
    } catch (notifyErr) {
      console.error("[User submitted notification failed but access ticket is saved]", notifyErr.message);
    }

    try {
      const adminAccessUrl = absoluteUrl("/whalex-admin.html#accessTickets");
      const adminRows = accessTicketRows(ticket);
      const adminAttachment = await makePdfAttachment({
        title: "New WhaleX Access Request",
        rows: adminRows,
        note: "Admin action required. Open the admin panel to verify payment and update the request."
      });
      await notifyAdmin({
        type: "new_access_request",
        title: "New WhaleX access request",
        message: `${ticket.name || "A user"} raised a ${formatAccessType(ticket.accessType)} request. Ticket: ${ticket.id}. Email: ${ticket.email || "-"}, TradingView: ${ticket.tradingViewUsername || "-"}. Open: ${adminAccessUrl}`,
        relatedId: ticket.id,
        emailHtml: emailHtmlTemplate({
          title: "New WhaleX access request",
          intro: "A new access request has been submitted. Please review payment proof and update the ticket status.",
          ctaText: "Open Admin Access Tickets",
          ctaUrl: adminAccessUrl,
          rows: adminRows,
          footer: "PDF copy of this access request is attached."
        }),
        attachments: [adminAttachment]
      });
    } catch (notifyErr) {
      console.error("[Admin notification failed but access ticket is saved]", notifyErr.message);
    }

    const responseMessage = accessType === "trial"
      ? "3-day trial request submitted successfully. Trial access will be provided within 48 hours after verification."
      : "Access request submitted successfully. Access will be provided within 48 hours after payment verification.";

    console.log("[Access ticket response sent]", {
      id: ticket.id,
      message: responseMessage
    });

    res.json({
      ok: true,
      ticket: safeTicket(ticket),
      message: responseMessage
    });
  } catch (e) { next(e); }
});


// Logged-in user's own access requests
app.get("/api/user/my-access-tickets", userAuth, async (req, res, next) => {
  try {
    const user = await UserAccount.findOne({ id: req.userId });
    if (!user) return res.status(404).json({ error: "User account not found." });

    const email = String(user.email || "").toLowerCase();
    const tickets = await AccessTicket.find({
      $or: [
        { userId: req.userId },
        { email }
      ]
    }).sort({ _id: -1 });

    res.json({ ok: true, tickets: tickets.map(safeTicket) });
  } catch (e) { next(e); }
});


// Logged-in user's single access request by ticket ID
app.get("/api/user/my-access-ticket/:id", userAuth, async (req, res, next) => {
  try {
    const user = await UserAccount.findOne({ id: req.userId });
    if (!user) return res.status(404).json({ error: "User account not found." });

    const email = String(user.email || "").toLowerCase();
    const ticket = await AccessTicket.findOne({
      id: req.params.id,
      $or: [
        { userId: req.userId },
        { email }
      ]
    });

    if (!ticket) return res.status(404).json({ error: "Access request not found." });

    res.json({ ok: true, ticket: safeTicket(ticket) });
  } catch (e) { next(e); }
});

app.get("/api/user/access-ticket", async (req, res, next) => {
  try {
    const ticketId = String(req.query.ticketId || "").trim();
    const email = String(req.query.email || "").trim().toLowerCase();
    const ticket = await AccessTicket.findOne({ id: ticketId, email });
    if (!ticket) return res.status(404).json({ error: "Access ticket not found. Check ticket ID and email." });
    res.json({ ok: true, ticket: safeTicket(ticket) });
  } catch (e) { next(e); }
});
app.patch("/api/admin/access-tickets/:id", auth, async (req, res, next) => {
  try {
    const ticket = await AccessTicket.findOne({ id: req.params.id });
    if (!ticket) return res.status(404).json({ error: "Access ticket not found." });

    const previousStatus = String(ticket.status || "open").toLowerCase();
    const status = normalizeTicketStatus(req.body.status || ticket.status || "open");
    const updates = {
      status,
      adminNote: req.body.adminNote || ""
    };

    // Admin should work with only 3 ticket statuses.
    if (status === "open") {
      updates.accessStatus = "not_granted";
      updates.paymentStatus = ticket.accessType === "trial" ? "not_required" : (ticket.paymentStatus || "pending");
      updates.accessStartDate = "";
      updates.accessEndDate = "";
      updates.trialFeedbackDueDate = "";
      updates.trialFeedbackStatus = ticket.accessType === "trial" ? "pending" : "not_required";
    }

    if (status === "done") {
      // V35: End date is always derived from the selected Start Date and access type.
      // Paid: Start Date + PAID_ACCESS_DAYS. Trial: Start Date + TRIAL_ACCESS_DAYS.
      const startDate = safeDate(req.body.accessStartDate) || todayDateOnly();
      const durationDays = accessDurationDays(ticket.accessType);

      if (!durationDays || durationDays <= 0) {
        return res.status(400).json({ error: "Access duration must be greater than 0 days." });
      }

      const endDate = defaultEndDate(startDate, ticket.accessType);

      if (compareDateOnly(startDate, endDate) >= 0) {
        return res.status(400).json({ error: "Access Start Date must be before Access End Date." });
      }

      updates.accessStatus = "granted";
      updates.paymentStatus = ticket.accessType === "trial" ? "not_required" : "verified";
      updates.accessStartDate = startDate;
      updates.accessEndDate = endDate;
      updates.onboardedAt = ticket.onboardedAt || nowIso();
      updates.trialFeedbackDueDate = ticket.accessType === "trial" ? endDate : "";
      updates.trialFeedbackStatus = ticket.accessType === "trial"
        ? (ticket.trialFeedbackStatus === "submitted" ? "submitted" : "pending")
        : "not_required";
    }

    if (status === "rejected") {
      updates.accessStatus = "rejected";
      updates.paymentStatus = ticket.accessType === "trial" ? "not_required" : "rejected";
      updates.accessStartDate = "";
      updates.accessEndDate = "";
      updates.trialFeedbackDueDate = "";
      updates.trialFeedbackStatus = ticket.accessType === "trial" ? "not_required" : "not_required";
    }

    const oldStatus = ticket.status;
    Object.assign(ticket, updates, { updatedAt: nowIso() });
    if (String(oldStatus || "") !== String(status || "")) {
      appendTicketActivity(ticket, "ticket_status_updated", `Ticket status changed from ${oldStatus || "-"} to ${status}.`, "admin", { oldStatus, newStatus: status });
    } else {
      appendTicketActivity(ticket, "ticket_updated", "Ticket details updated by admin.", "admin", { status });
    }

    let telegramAutoResult = null;
    if (status === "done" && previousStatus !== "done") {
      telegramAutoResult = await autoGenerateTelegramInvitesOnApproval(ticket);
      await notifyUserAccessGranted(ticket);
    }

    if (status === "rejected" && previousStatus !== "rejected") {
      await notifyUserAccessRejected(ticket);
    }

    await ticket.save();

    res.json({
      ok: true,
      ticket: safeTicket(ticket),
      message: status === "done"
        ? `Access dates updated automatically from the selected Start Date. ${formatAccessType(ticket.accessType)} is active from ${ticket.accessStartDate} to ${ticket.accessEndDate}.${telegramAutoResult?.generated ? " Telegram invite links were generated automatically." : telegramAutoResult?.error ? ` Telegram auto invite failed: ${telegramAutoResult.error}` : ""}`
        : "Ticket updated."
    });
  } catch (e) { next(e); }
});


app.post("/api/admin/access-tickets/:id/telegram-invite", auth, async (req, res, next) => {
  try {
    const ticket = await AccessTicket.findOne({ id: req.params.id });
    if (!ticket) return res.status(404).json({ error: "Access ticket not found." });

    const force = String(req.body?.force || "").toLowerCase() === "true";
    if (force) {
      ticket.telegramInviteLink = "";
      ticket.telegramInviteLinks = [];
      ticket.telegramDestinationStatuses = [];
      ticket.telegramAccessStatus = "pending";
    }

    const result = await applyTelegramInvitesToTicket(ticket, {
      actor: "admin",
      notifyUser: true,
      notifyAdminUser: true,
      action: force ? "telegram_invites_regenerated" : "telegram_invites_generated"
    });

    await ticket.save();

    res.json({
      ok: true,
      inviteLinks: result.inviteLinks || ticket.telegramInviteLinks || [],
      ticket: safeTicket(ticket),
      message: result.message || result.reason || "Telegram invite links are already available."
    });
  } catch (e) { next(e); }
});

app.patch("/api/admin/access-tickets/:id/telegram-destination-status", auth, async (req, res, next) => {
  try {
    const ticket = await AccessTicket.findOne({ id: req.params.id });
    if (!ticket) return res.status(404).json({ error: "Access ticket not found." });

    const allowed = ["pending", "invite_generated", "joined", "left", "removed"];
    const status = String(req.body.status || "").toLowerCase();
    const index = Number(req.body.index);
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid Telegram destination status." });
    if (!Number.isInteger(index) || index < 0) return res.status(400).json({ error: "Invalid Telegram destination index." });

    const links = Array.isArray(ticket.telegramInviteLinks) ? ticket.telegramInviteLinks : [];
    if (!links[index]) return res.status(404).json({ error: "Telegram destination not found on this ticket." });

    const oldStatus = links[index].status || "pending";
    links[index].status = status;
    links[index].updatedAt = nowIso();
    ticket.telegramInviteLinks = links;

    const statuses = Array.isArray(ticket.telegramDestinationStatuses) ? ticket.telegramDestinationStatuses : [];
    statuses[index] = {
      ...(statuses[index] || {}),
      id: links[index].id,
      name: links[index].name,
      chatId: links[index].chatId,
      status,
      updatedAt: nowIso(),
      error: links[index].error || ""
    };
    ticket.telegramDestinationStatuses = statuses;

    ticket.telegramAccessStatus = links.some((item) => item.status === "joined")
      ? "joined"
      : links.some((item) => item.status === "invite_generated")
        ? "invite_generated"
        : status;
    ticket.telegramAccessUpdatedAt = nowIso();
    ticket.updatedAt = nowIso();

    appendTicketActivity(
      ticket,
      "telegram_destination_status_updated",
      `${links[index].name || "Telegram destination"} changed from ${accessDeliveryLabel(oldStatus)} to ${accessDeliveryLabel(status)}.`,
      "admin",
      { index, oldStatus, newStatus: status, destination: links[index] }
    );
    await ticket.save();

    await notifyAdminAccessActivity(
      ticket,
      "WhaleX Telegram destination updated",
      `${links[index].name || "Telegram destination"} status changed to ${accessDeliveryLabel(status)}.`,
      "telegram_destination_status_updated"
    );

    if (["joined", "removed", "left"].includes(status)) {
      await notifyUserAccessDeliveryUpdate(
        ticket,
        "WhaleX Telegram group status updated",
        `${links[index].name || "Telegram group"} status is now: ${accessDeliveryLabel(status)}.`,
        "telegram_destination_status_updated"
      );
    }

    res.json({ ok: true, ticket: safeTicket(ticket), message: "Telegram destination status updated." });
  } catch (e) { next(e); }
});

app.patch("/api/admin/access-tickets/:id/telegram-status", auth, async (req, res, next) => {
  try {
    const ticket = await AccessTicket.findOne({ id: req.params.id });
    if (!ticket) return res.status(404).json({ error: "Access ticket not found." });

    const allowed = ["pending", "invite_generated", "joined", "left", "removed"];
    const status = String(req.body.status || "").toLowerCase();
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid Telegram status." });

    const oldStatus = ticket.telegramAccessStatus || "pending";
    ticket.telegramAccessStatus = status;
    ticket.telegramAccessUpdatedAt = nowIso();
    ticket.updatedAt = nowIso();

    appendTicketActivity(ticket, "telegram_status_updated", `Telegram status changed from ${accessDeliveryLabel(oldStatus)} to ${accessDeliveryLabel(status)}.`, "admin", { oldStatus, newStatus: status });
    await ticket.save();

    await notifyAdminAccessActivity(
      ticket,
      "WhaleX Telegram status updated",
      `Telegram group status changed to ${accessDeliveryLabel(status)}.`,
      "telegram_status_updated"
    );

    if (["joined", "removed", "left"].includes(status)) {
      await notifyUserAccessDeliveryUpdate(
        ticket,
        "WhaleX Telegram group status updated",
        `Your WhaleX Telegram group status is now: ${accessDeliveryLabel(status)}.`,
        "telegram_status_updated"
      );
    }

    res.json({ ok: true, ticket: safeTicket(ticket), message: "Telegram status updated." });
  } catch (e) { next(e); }
});

app.patch("/api/admin/access-tickets/:id/tradingview-status", auth, async (req, res, next) => {
  try {
    const ticket = await AccessTicket.findOne({ id: req.params.id });
    if (!ticket) return res.status(404).json({ error: "Access ticket not found." });

    const allowed = ["pending", "given", "removed"];
    const status = String(req.body.status || "").toLowerCase();
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid TradingView status." });

    const oldStatus = ticket.tradingViewAccessStatus || "pending";
    ticket.tradingViewAccessStatus = status;
    ticket.tradingViewAccessUpdatedAt = nowIso();
    ticket.updatedAt = nowIso();

    appendTicketActivity(ticket, "tradingview_status_updated", `TradingView access changed from ${accessDeliveryLabel(oldStatus)} to ${accessDeliveryLabel(status)}.`, "admin", { oldStatus, newStatus: status });
    await ticket.save();

    await notifyAdminAccessActivity(
      ticket,
      "WhaleX TradingView access updated",
      `TradingView access status changed to ${accessDeliveryLabel(status)}.`,
      "tradingview_status_updated"
    );

    await notifyUserAccessDeliveryUpdate(
      ticket,
      "WhaleX TradingView access updated",
      `Your WhaleX TradingView access status is now: ${accessDeliveryLabel(status)}.`,
      "tradingview_status_updated"
    );

    res.json({ ok: true, ticket: safeTicket(ticket), message: "TradingView status updated." });
  } catch (e) { next(e); }
});


app.get("/api/admin/access-tickets/:id/payment-proof/download", auth, async (req, res, next) => {
  try {
    const ticket = await AccessTicket.findOne({ id: req.params.id }).lean();
    if (!ticket) return res.status(404).json({ error: "Access ticket not found." });
    return sendEvidenceDownload(res, ticket.paymentProof || "", `payment-proof-${ticket.id}`);
  } catch (e) { next(e); }
});

app.get("/api/admin/support-tickets/:id/attachment/download", auth, async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findOne({ id: req.params.id }).lean();
    if (!ticket) return res.status(404).json({ error: "Support ticket not found." });
    return sendEvidenceDownload(res, ticket.attachment || "", `support-attachment-${ticket.id}`);
  } catch (e) { next(e); }
});

app.get("/api/admin/access-tickets/:id/trial-feedback-attachment/download", auth, async (req, res, next) => {
  try {
    const ticket = await AccessTicket.findOne({ id: req.params.id }).lean();
    if (!ticket) return res.status(404).json({ error: "Access ticket not found." });
    return sendEvidenceDownload(res, ticket.trialFeedbackAttachment || "", `trial-feedback-${ticket.id}`);
  } catch (e) { next(e); }
});

app.post("/api/user/trial-feedback", upload.single("attachment"), async (req, res, next) => {
  try {
    const ticketId = String(req.body.ticketId || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const ticket = await AccessTicket.findOne({ id: ticketId, email });
    if (!ticket) return res.status(404).json({ error: "Trial ticket not found. Check ticket ID and email." });
    if (ticket.accessType !== "trial") return res.status(400).json({ error: "Feedback is required only for trial access tickets." });
    if (!ticket.trialFeedbackDueDate) return res.status(400).json({ error: "Trial feedback due date is not set yet." });

    const attachment = req.file ? await uploadToCloudinary(req.file, "whalex/trial-feedback") : "";

    ticket.trialFeedbackRating = req.body.rating || "";
    ticket.trialFeedbackText = req.body.feedback || "";
    if (attachment) ticket.trialFeedbackAttachment = attachment;
    ticket.trialFeedbackStatus = "submitted";
    ticket.trialFeedbackSubmittedAt = nowIso();
    ticket.updatedAt = nowIso();

    appendTicketActivity(ticket, "trial_feedback_submitted", attachment ? "Trial feedback submitted with attachment." : "Trial feedback submitted.", "user", { hasAttachment: !!attachment });
    await ticket.save();

    try {
      const adminAccessUrl = absoluteUrl("/whalex-admin.html#accessTickets");
      await notifyAdmin({
        type: "trial_feedback_submitted",
        title: "WhaleX trial feedback submitted",
        message: `${ticket.name || "A user"} submitted trial feedback for ticket ${ticket.id}. Rating: ${ticket.trialFeedbackRating || "-"}. Open: ${adminAccessUrl}`,
        relatedId: ticket.id,
        emailHtml: emailHtmlTemplate({
          title: "WhaleX trial feedback submitted",
          intro: "A trial user has submitted feedback. Review the feedback and attachment in Access Tickets.",
          ctaText: "Open Access Tickets",
          ctaUrl: adminAccessUrl,
          rows: accessTicketRows(ticket),
          footer: "This feedback is recorded in the access ticket activity log."
        })
      });
    } catch (notifyErr) {
      console.error("[Trial feedback admin notification failed]", notifyErr.message);
    }

    res.json({ ok: true, ticket: safeTicket(ticket), message: attachment ? "Thank you. Your 3-day trial feedback and attachment have been submitted." : "Thank you. Your 3-day trial feedback has been submitted." });
  } catch (e) { next(e); }
});

// Support
app.post("/api/user/support-ticket", upload.single("attachment"), async (req, res, next) => {
  try {
    const attachment = req.file ? await uploadToCloudinary(req.file, "whalex/support") : "";
    const ticket = await SupportTicket.create({
      id: id("support"),
      name: req.body.name || "",
      email: req.body.email || "",
      phone: req.body.phone || "",
      tradingViewUsername: req.body.tradingViewUsername || "",
      category: req.body.category || "General Support",
      priority: req.body.priority || "normal",
      subject: req.body.subject || "",
      message: req.body.message || "",
      attachment,
      status: "open",
      adminReply: "",
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
    const adminSupportUrl = absoluteUrl("/whalex-admin.html#supportTickets");
    const supportRows = supportTicketRows(ticket);
    const supportAttachment = await makePdfAttachment({
      title: "New WhaleX Support Ticket",
      rows: supportRows,
      note: "Admin action required. Open Support Tickets in the admin panel."
    });
    await notifyAdmin({
      type: "new_support_ticket",
      title: "New WhaleX support ticket",
      message: `${ticket.name || "A user"} raised support ticket ${ticket.id}: ${ticket.subject || ""}. Open: ${adminSupportUrl}`,
      relatedId: ticket.id,
      emailHtml: emailHtmlTemplate({
        title: "New WhaleX support ticket",
        intro: "A new support ticket has been submitted.",
        ctaText: "Open Admin Support Tickets",
        ctaUrl: adminSupportUrl,
        rows: supportRows,
        footer: "PDF copy of this support ticket is attached."
      }),
      attachments: [supportAttachment]
    });
    await notifyUserSupportSubmitted(ticket);
    res.json({ ok: true, ticket: safeSupport(ticket), message: "Support ticket created. Save your ticket ID." });
  } catch (e) { next(e); }
});
app.get("/api/user/support-ticket", async (req, res, next) => {
  try {
    const ticketId = String(req.query.ticketId || "").trim();
    const email = String(req.query.email || "").trim().toLowerCase();
    const ticket = await SupportTicket.findOne({ id: ticketId, email });
    if (!ticket) return res.status(404).json({ error: "Support ticket not found. Check ticket ID and email." });
    res.json({ ok: true, ticket: safeSupport(ticket) });
  } catch (e) { next(e); }
});
app.patch("/api/admin/support-tickets/:id", auth, async (req, res, next) => {
  try {
    const previous = await SupportTicket.findOne({ id: req.params.id }).lean();
    const ticket = await SupportTicket.findOneAndUpdate({ id: req.params.id }, { ...req.body, updatedAt: nowIso() }, { new: true });
    if (!ticket) return res.status(404).json({ error: "Support ticket not found." });

    const statusChanged = String(previous?.status || "") !== String(ticket.status || "");
    const replyChanged = String(previous?.adminReply || "") !== String(ticket.adminReply || "");

    if (statusChanged || replyChanged) {
      await notifyUserSupportUpdated(ticket, previous?.status || "");
    }

    res.json({ ok: true, ticket });
  } catch (e) { next(e); }
});

// Reviews
app.post("/api/user/review", async (req, res, next) => {
  try {
    const review = await Review.create({
      id: id("rev"),
      name: req.body.name || "Anonymous",
      role: req.body.role || "Trader",
      rating: Number(req.body.rating || 5),
      text: req.body.text || "",
      status: "pending",
      createdAt: today()
    });
    await notifyAdmin({
      type: "new_review",
      title: "New WhaleX review submitted",
      message: `${review.name || "A user"} submitted a review for approval.`,
      relatedId: review.id
    });
    res.json({ ok: true, message: "Review submitted. It will appear publicly after WhaleX verification." });
  } catch (e) { next(e); }
});
app.post("/api/admin/reviews", auth, async (req, res, next) => {
  try {
    const review = await Review.create({
      id: id("rev"),
      name: req.body.name || "Anonymous",
      role: req.body.role || "Trader",
      rating: Number(req.body.rating || 5),
      text: req.body.text || "",
      status: req.body.status || "approved",
      createdAt: today()
    });
    res.json({ ok: true, review });
  } catch (e) { next(e); }
});
app.patch("/api/admin/reviews/:id", auth, async (req, res, next) => {
  try {
    const review = await Review.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!review) return res.status(404).json({ error: "Review not found." });
    res.json({ ok: true, review });
  } catch (e) { next(e); }
});
app.delete("/api/admin/reviews/:id", auth, async (req, res, next) => {
  try { await Review.deleteOne({ id: req.params.id }); res.json({ ok: true }); } catch (e) { next(e); }
});

// Profits
app.post("/api/user/profit", upload.single("image"), async (req, res, next) => {
  try {
    const image = req.file ? await uploadToCloudinary(req.file, "whalex/profits") : "";
    const profit = await Profit.create({
      id: id("profit"),
      name: req.body.name || "WhaleX User",
      title: req.body.title || "Profit Screenshot",
      caption: req.body.caption || "",
      image,
      date: req.body.date || today(),
      status: "pending",
      createdAt: today()
    });
    await notifyAdmin({
      type: "new_profit_submission",
      title: "New WhaleX profit screenshot submitted",
      message: `${profit.name || "A user"} submitted a profit screenshot for approval.`,
      relatedId: profit.id
    });
    res.json({ ok: true, message: "Profit screenshot submitted. It will appear publicly after WhaleX verification." });
  } catch (e) { next(e); }
});
app.post("/api/admin/profits", auth, upload.single("image"), async (req, res, next) => {
  try {
    const image = req.file ? await uploadToCloudinary(req.file, "whalex/profits") : "/assets/profit-placeholder.svg";
    const profit = await Profit.create({
      id: id("profit"),
      name: req.body.name || "WhaleX User",
      title: req.body.title || "Profit Screenshot",
      caption: req.body.caption || "",
      image,
      date: req.body.date || today(),
      status: req.body.status || "approved",
      createdAt: today()
    });
    res.json({ ok: true, profit });
  } catch (e) { next(e); }
});
app.patch("/api/admin/profits/:id", auth, async (req, res, next) => {
  try {
    const profit = await Profit.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!profit) return res.status(404).json({ error: "Profit item not found." });
    res.json({ ok: true, profit });
  } catch (e) { next(e); }
});
app.delete("/api/admin/profits/:id", auth, async (req, res, next) => {
  try { await Profit.deleteOne({ id: req.params.id }); res.json({ ok: true }); } catch (e) { next(e); }
});

// Videos
app.post("/api/admin/videos", auth, async (req, res, next) => {
  try {
    const video = await Video.create({
      id: id("vid"),
      title: req.body.title || "WhaleX Video",
      youtubeId: req.body.youtubeId || "",
      description: req.body.description || "",
      status: req.body.status || "approved",
      createdAt: today()
    });
    res.json({ ok: true, video });
  } catch (e) { next(e); }
});
app.patch("/api/admin/videos/:id", auth, async (req, res, next) => {
  try {
    const video = await Video.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!video) return res.status(404).json({ error: "Video not found." });
    res.json({ ok: true, video });
  } catch (e) { next(e); }
});
app.delete("/api/admin/videos/:id", auth, async (req, res, next) => {
  try { await Video.deleteOne({ id: req.params.id }); res.json({ ok: true }); } catch (e) { next(e); }
});

// Reports
app.get("/api/admin/monthly-report", auth, async (req, res, next) => {
  try {
    const month = String(req.query.month || monthKeyFromDate()).trim();
    const report = await buildMonthlyReport(month);
    res.json({ ok: true, report });
  } catch (e) { next(e); }
});
app.post("/api/admin/monthly-report/generate", auth, async (req, res, next) => {
  try {
    const month = String((req.body || {}).month || monthKeyFromDate()).trim();
    const report = await saveMonthlyReport(month);
    res.json({ ok: true, report, message: `Monthly onboarding report generated for ${month}.` });
  } catch (e) { next(e); }
});
app.get("/api/admin/monthly-report/download", auth, async (req, res, next) => {
  try {
    const month = String(req.query.month || monthKeyFromDate()).trim();
    const report = await buildMonthlyReport(month);
    const csv = reportToCsv(report);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="whalex-onboarding-report-${month}.csv"`);
    res.send(csv);
  } catch (e) { next(e); }
});
app.get("/api/admin/monthly-reports", auth, async (_req, res, next) => {
  try {
    const reports = await MonthlyReport.find({}).sort({ _id: -1 }).lean();
    res.json({ ok: true, reports });
  } catch (e) { next(e); }
});

// =====================================================
// V54 SAFE ROUTE REDIRECTS - WhaleX
// Clean URLs now redirect to the existing working .html pages.
// This avoids blank/broken pages caused by frontend scripts that
// depend on the original .html pathname.
// Keep this block BEFORE the Express error handler.
// =====================================================
function redirectToPage(target) {
  return (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.redirect(302, target);
  };
}

// Admin aliases
app.get("/admin", redirectToPage("/whalex-admin.html"));
app.get("/admin/", redirectToPage("/whalex-admin.html"));
app.get("/admin/login", redirectToPage("/whalex-admin.html"));
app.get("/admin/login/", redirectToPage("/whalex-admin.html"));
app.get("/whalex-admin", redirectToPage("/whalex-admin.html"));
app.get("/whalex-admin/", redirectToPage("/whalex-admin.html"));

// User login aliases
app.get("/login", redirectToPage("/login.html"));
app.get("/login/", redirectToPage("/login.html"));
app.get("/user/login", redirectToPage("/login.html"));
app.get("/user/login/", redirectToPage("/login.html"));

// User portal aliases
app.get("/user", redirectToPage("/user.html"));
app.get("/user/", redirectToPage("/user.html"));
app.get("/my-access", redirectToPage("/user.html"));
app.get("/my-access/", redirectToPage("/user.html"));
app.get("/dashboard", redirectToPage("/user.html"));
app.get("/dashboard/", redirectToPage("/user.html"));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Something went wrong." });
});

async function start() {
  if (!MONGO_URI) throw new Error("MONGO_URI is required.");
  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected.");
  await seedDefaults();
  startMonthlyReportScheduler();
startExpiryReminderScheduler();
  startupEmailDiagnostics();

app.listen(PORT, () => {
    console.log(`WhaleX website running at ${BASE_URL}`);
    console.log(`Private admin URL: ${BASE_URL}/admin`);
    console.log(`Legacy admin URL: ${BASE_URL}/whalex-admin.html`);
    console.log(`My Access: ${BASE_URL}/user`);
    console.log(`Default admin password: ${ADMIN_PASSWORD}`);
  });
}
start().catch((err) => {
  console.error("Failed to start WhaleX:", err);
  process.exit(1);
});
