#!/usr/bin/env node

/*
  WhaleX backend data-flow test runner.

  Usage:
    BASE_URL=http://localhost:3000 ADMIN_PASSWORD='your_admin_password' npm run test:backend-flow

  What it verifies:
    - health/db connected
    - admin login
    - admin indicator update -> public products sync
    - user register
    - access request with payment proof upload
    - admin live inbox sees request
    - admin can download proof
    - duplicate request is blocked
    - admin grants access
    - user sees granted access
    - user notification unread count + mark all read clears
    - admin notification unread count + mark all read clears
*/

const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS || "WhaleX@123";

const state = {
  adminToken: "",
  userToken: "",
  testEmail: `backendtest+${Date.now()}@whalex.local`,
  testPass: "Test@123456",
  ticketId: "",
  failures: [],
  originalProducts: []
};

function logSection(title) {
  console.log(`\n=== ${title} ===`);
}

function pass(name, detail = "") {
  console.log(`✅ ${name}${detail ? " — " + detail : ""}`);
}

function fail(name, err) {
  const message = err?.message || String(err);
  state.failures.push({ name, message });
  console.error(`❌ ${name} — ${message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function requestJson(method, endpoint, options = {}) {
  const headers = { ...(options.headers || {}) };

  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body !== "string" && !Buffer.isBuffer(body)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body
  });

  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (_) {
    json = { raw: text };
  }

  if (!res.ok && !options.allowError) {
    throw new Error(`${method} ${endpoint} failed ${res.status}: ${json.error || json.message || text}`);
  }

  return { res, json, text };
}

async function runStep(name, fn) {
  try {
    const detail = await fn();
    pass(name, detail);
  } catch (err) {
    fail(name, err);
  }
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

function makeProofBlob() {
  // 1x1 png
  const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lw9U9QAAAABJRU5ErkJggg==";
  return new Blob([Buffer.from(b64, "base64")], { type: "image/png" });
}

function addDaysYmd(start, days) {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}


async function restoreOriginalProducts() {
  if (!state.adminToken || !Array.isArray(state.originalProducts) || !state.originalProducts.length) return;

  for (const product of state.originalProducts) {
    if (!product?.id) continue;

    try {
      await requestJson("PUT", `/api/admin/products/${encodeURIComponent(product.id)}`, {
        headers: auth(state.adminToken),
        body: {
          name: product.name,
          tag: product.tag,
          description: product.description,
          features: Array.isArray(product.features) ? product.features.join("\n") : product.features
        },
        allowError: true
      });
      console.log(`↩️  Restored product: ${product.id}`);
    } catch (err) {
      console.warn(`Could not restore product ${product.id}:`, err.message);
    }
  }
}

async function main() {
  console.log("WhaleX backend flow test");
  console.log("BASE_URL:", BASE_URL);
  console.log("TEST_EMAIL:", state.testEmail);

  logSection("Health + Admin");

  await runStep("Health check", async () => {
    const { json } = await requestJson("GET", "/api/health");
    assert(json.ok === true, "health ok should be true");
    if (json.db) assert(String(json.db).toLowerCase().includes("connected"), `db should be connected, got ${json.db}`);
    return json.db ? `db=${json.db}` : "ok";
  });

  await runStep("Admin login", async () => {
    const { json } = await requestJson("POST", "/api/admin/login", {
      body: { password: ADMIN_PASSWORD }
    });
    assert(json.token, "admin token missing");
    state.adminToken = json.token;
    return "token received";
  });

  await runStep("Notification diagnostics endpoint works", async () => {
    const { json } = await requestJson("GET", "/api/admin/notification-diagnostics", {
      headers: auth(state.adminToken)
    });
    assert(json.smtp, "smtp diagnostics missing");
    assert("configured" in json.smtp, "smtp configured flag missing");
    return `smtpConfigured=${json.smtp.configured}, adminEmail=${json.adminEmail || "missing"}`;
  });

  logSection("Admin Indicator -> Public API");

  await runStep("Public products load", async () => {
    const { json } = await requestJson("GET", "/api/public/products");
    assert(Array.isArray(json.products), "products must be array");
    assert(json.products.length > 0, "products array is empty");
    state.originalProducts = json.products.map((p) => ({ ...p }));
    return `${json.products.length} products`;
  });

  await runStep("Admin indicator update syncs to public products", async () => {
    const testName = `WhaleX Backend Test ${Date.now()}`;
    const payload = {
      name: testName,
      tag: "BACKEND FLOW TEST",
      description: "This text is updated from backend API test.",
      features: "Backend sync working\nAdmin to user portal working\nPublic API updated"
    };

    const { json } = await requestJson("PUT", "/api/admin/products/whalex", {
      headers: auth(state.adminToken),
      body: payload
    });

    assert(json.ok === true, "admin product update ok missing");
    if ("synced" in json) assert(json.synced === true, "admin response synced should be true");

    const publicRes = await requestJson("GET", "/api/public/products");
    const product = (publicRes.json.products || []).find((p) => p.id === "whalex");
    assert(product, "whalex product missing from public products");
    assert(product.name === testName, `public product name mismatch: ${product.name}`);
    assert(product.description === payload.description, "public product description mismatch");

    await restoreOriginalProducts();

    const restoredPublic = await requestJson("GET", "/api/public/products");
    assert(!JSON.stringify(restoredPublic.json).includes("Backend Test"), "Backend Test text cleaned after restore");

    return `public product updated to "${testName}" and restored`;
  });

  logSection("User Registration + Access Request");

  await runStep("Register test user", async () => {
    const { json } = await requestJson("POST", "/api/user/register", {
      body: {
        name: "Backend Test User",
        email: state.testEmail,
        phone: "9999999999",
        telegramId: "@backendtest",
        tradingViewUsername: "@backendtest",
        password: state.testPass
      }
    });
    assert(json.token, "user token missing");
    state.userToken = json.token;
    return "user token received";
  });


  await runStep("Monthly access without Payment ID / UTR is blocked", async () => {
    const form = new FormData();
    form.append("name", "Backend Test User");
    form.append("email", state.testEmail);
    form.append("phone", "9999999999");
    form.append("telegramId", "@backendtest");
    form.append("tradingViewUsername", "@backendtest");
    form.append("plan", "WhaleX V1 Access");
    form.append("note", "Backend missing UTR validation test");
    form.append("paymentProof", makeProofBlob(), "whalex-proof-no-utr.png");

    const { res, json } = await requestJson("POST", "/api/user/access-ticket", {
      headers: auth(state.userToken),
      body: form,
      allowError: true
    });

    assert(res.status === 400, `expected 400 missing UTR block, got ${res.status}: ${json.error || json.message || ""}`);
    assert(String(json.error || "").includes("Payment ID / UTR"), "missing UTR error message should mention Payment ID / UTR");
    return "400 missing Payment ID / UTR blocked";
  });


  await runStep("Monthly access without Payment Proof is blocked", async () => {
    const form = new FormData();
    form.append("name", "Backend Test User");
    form.append("email", state.testEmail);
    form.append("phone", "9999999999");
    form.append("telegramId", "@backendtest");
    form.append("tradingViewUsername", "@backendtest");
    form.append("plan", "WhaleX V1 Access");
    form.append("paymentId", "UTR-BACKEND-NO-PROOF-001");
    form.append("note", "Backend missing payment proof validation test");

    const { res, json } = await requestJson("POST", "/api/user/access-ticket", {
      headers: auth(state.userToken),
      body: form,
      allowError: true
    });

    assert(res.status === 400, `expected 400 missing payment proof block, got ${res.status}: ${json.error || json.message || ""}`);
    assert(String(json.error || "").toLowerCase().includes("payment proof"), "missing proof error message should mention Payment Proof");
    return "400 missing Payment Proof blocked";
  });

  await runStep("Create access request with payment proof", async () => {
    const form = new FormData();
    form.append("name", "Backend Test User");
    form.append("email", state.testEmail);
    form.append("phone", "9999999999");
    form.append("telegramId", "@backendtest");
    form.append("tradingViewUsername", "@backendtest");
    form.append("plan", "WhaleX V1 Access");
    form.append("paymentId", "UTR-BACKEND-TEST-001");
    form.append("note", "Backend data flow test");
    form.append("paymentProof", makeProofBlob(), "whalex-proof.png");

    const { json } = await requestJson("POST", "/api/user/access-ticket", {
      headers: auth(state.userToken),
      body: form
    });

    assert(json.ok === true, "access ticket ok missing");
    assert(json.ticket?.id, "ticket id missing");
    state.ticketId = json.ticket.id;
    assert(json.ticket.paymentProof, "paymentProof URL/path missing in ticket response");
    return `ticket=${state.ticketId}, proof=${json.ticket.paymentProof}`;
  });

  await runStep("User receives request submitted notification", async () => {
    const { json } = await requestJson("GET", "/api/user/notifications", {
      headers: auth(state.userToken)
    });

    const found = (json.notifications || []).find((n) =>
      String(n.relatedId) === String(state.ticketId) &&
      String(n.type || "").toLowerCase().includes("access_submitted")
    );

    assert(found, "access_submitted notification not found for user");
    assert(Number(json.unreadCount || 0) >= 1, `user unreadCount should be >= 1 after submit, got ${json.unreadCount}`);
    return `user unreadCount=${json.unreadCount}`;
  });

  await runStep("Admin live sees new access request + notification", async () => {
    const { json } = await requestJson("GET", "/api/admin/live", {
      headers: auth(state.adminToken)
    });

    const found = (json.accessInbox || []).find((t) => t.id === state.ticketId);
    assert(found, `ticket ${state.ticketId} not found in admin accessInbox`);
    assert(found.paymentProof, "admin live ticket paymentProof missing");

    const unread = Number(json.unreadCount || 0);
    assert(unread >= 1, `admin unreadCount should be >= 1, got ${unread}`);

    return `admin unreadCount=${unread}`;
  });

  await runStep("Admin can download payment proof", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/access-tickets/${encodeURIComponent(state.ticketId)}/payment-proof/download`, {
      headers: auth(state.adminToken)
    });

    assert(res.ok, `download failed ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    assert(buf.length > 0, "downloaded file is empty");

    const outPath = path.join(process.cwd(), `backend-test-proof-${state.ticketId}.bin`);
    fs.writeFileSync(outPath, buf);

    return `downloaded ${buf.length} bytes`;
  });

  await runStep("Duplicate access request is blocked", async () => {
    const form = new FormData();
    form.append("name", "Backend Test User");
    form.append("email", state.testEmail);
    form.append("phone", "9999999999");
    form.append("telegramId", "@backendtest");
    form.append("tradingViewUsername", "@backendtest");
    form.append("plan", "WhaleX V1 Access");
    form.append("paymentId", "UTR-BACKEND-TEST-002");
    form.append("paymentProof", makeProofBlob(), "whalex-proof-2.png");

    const { res, json } = await requestJson("POST", "/api/user/access-ticket", {
      headers: auth(state.userToken),
      body: form,
      allowError: true
    });

    assert(res.status === 409, `expected 409 duplicate block, got ${res.status}: ${json.error || json.message || ""}`);
    return "409 duplicate blocked";
  });

  logSection("Access Grant + User Visibility");

  await runStep("Admin grants access", async () => {
    const start = new Date().toISOString().slice(0, 10);
    const { json } = await requestJson("PATCH", `/api/admin/access-tickets/${encodeURIComponent(state.ticketId)}`, {
      headers: auth(state.adminToken),
      body: {
        status: "done",
        accessStartDate: start,
        adminNote: "Backend test granted"
      }
    });

    const ticket = json.ticket || json;
    assert(ticket.status === "done", `status should be done, got ${ticket.status}`);
    assert(ticket.accessStatus === "granted", `accessStatus should be granted, got ${ticket.accessStatus}`);
    assert(ticket.paymentStatus === "verified", `paymentStatus should be verified, got ${ticket.paymentStatus}`);
    assert(ticket.accessStartDate === start, "accessStartDate mismatch");
    assert(ticket.accessEndDate === addDaysYmd(start, 30), `paid end date should be ${addDaysYmd(start, 30)}, got ${ticket.accessEndDate}`);

    return `${ticket.accessStartDate} to ${ticket.accessEndDate}`;
  });

  await runStep("User sees granted access ticket", async () => {
    const { json } = await requestJson("GET", "/api/user/my-access-tickets", {
      headers: auth(state.userToken)
    });

    const tickets = json.tickets || json.accessTickets || [];
    const ticket = tickets.find((t) => t.id === state.ticketId);
    assert(ticket, `ticket ${state.ticketId} not found in user's access tickets`);
    assert(ticket.status === "done", "user ticket status should be done");
    assert(ticket.accessStatus === "granted", "user ticket accessStatus should be granted");
    assert(ticket.paymentProof, "user ticket paymentProof should still be visible");

    return "granted access visible to user";
  });

  logSection("Notification Bell Backend Counts");

  await runStep("User notification unread count > 0", async () => {
    const { json } = await requestJson("GET", "/api/user/notifications", {
      headers: auth(state.userToken)
    });

    assert(Array.isArray(json.notifications), "user notifications must be array");
    const unread = Number(json.unreadCount || 0);
    assert(unread >= 1, `user unreadCount should be >= 1, got ${unread}`);

    return `user unreadCount=${unread}`;
  });

  await runStep("User mark all read clears unread count", async () => {
    const { json } = await requestJson("PATCH", "/api/user/notifications/read-all", {
      headers: auth(state.userToken)
    });

    assert(Number(json.unreadCount || 0) === 0, `user unreadCount should be 0, got ${json.unreadCount}`);
    assert((json.notifications || []).every((n) => !n.unread && n.readAt), "all returned user notifications should be read");
    return "user unreadCount=0 and returned notifications read";
  });

  await runStep("Admin notification unread count endpoint works", async () => {
    const { json } = await requestJson("GET", "/api/admin/notifications", {
      headers: auth(state.adminToken)
    });

    assert(Array.isArray(json.notifications), "admin notifications must be array");
    assert("unreadCount" in json, "admin unreadCount missing");

    return `admin unreadCount=${json.unreadCount}`;
  });

  await runStep("Admin mark all read clears unread count", async () => {
    const { json } = await requestJson("PATCH", "/api/admin/notifications/read-all", {
      headers: auth(state.adminToken)
    });

    assert(Number(json.unreadCount || 0) === 0, `admin unreadCount should be 0, got ${json.unreadCount}`);
    assert((json.notifications || []).every((n) => !n.unread && n.readAt), "all returned admin notifications should be read");
    return "admin unreadCount=0 and returned notifications read";
  });



  logSection("Access Rejection Notification");

  await runStep("Access rejection creates user notification", async () => {
    const rejectEmail = `rejecttest+${Date.now()}@whalex.local`;
    const rejectPass = "Test@123456";

    const register = await requestJson("POST", "/api/user/register", {
      body: {
        name: "Backend Reject Test User",
        email: rejectEmail,
        phone: "9999999998",
        telegramId: "@rejecttest",
        tradingViewUsername: `@rejecttest${Date.now()}`,
        password: rejectPass
      }
    });

    const rejectUserToken = register.json.token;
    assert(rejectUserToken, "reject user token missing");

    const form = new FormData();
    form.append("name", "Backend Reject Test User");
    form.append("email", rejectEmail);
    form.append("phone", "9999999998");
    form.append("telegramId", "@rejecttest");
    form.append("tradingViewUsername", `@rejecttest${Date.now()}`);
    form.append("plan", "WhaleX V1 Access");
    form.append("paymentId", "UTR-BACKEND-REJECT-001");
    form.append("note", "Backend rejection notification test");
    form.append("paymentProof", makeProofBlob(), "reject-proof.png");

    const create = await requestJson("POST", "/api/user/access-ticket", {
      headers: auth(rejectUserToken),
      body: form
    });

    const rejectTicketId = create.json.ticket?.id;
    assert(rejectTicketId, "reject ticket id missing");

    await requestJson("PATCH", `/api/admin/access-tickets/${encodeURIComponent(rejectTicketId)}`, {
      headers: auth(state.adminToken),
      body: {
        status: "rejected",
        adminNote: "Backend test rejection"
      }
    });

    const notes = await requestJson("GET", "/api/user/notifications", {
      headers: auth(rejectUserToken)
    });

    const found = (notes.json.notifications || []).find((n) =>
      String(n.relatedId) === String(rejectTicketId) &&
      String(n.type || "").toLowerCase().includes("rejected")
    );

    assert(found, "access_rejected notification not found for rejected user");
    assert(Number(notes.json.unreadCount || 0) >= 1, `reject user unreadCount should be >= 1, got ${notes.json.unreadCount}`);

    return `rejection notification created for ${rejectTicketId}`;
  });

  await restoreOriginalProducts();

  logSection("Summary");

  if (state.failures.length) {
    console.error(`\nFAILED: ${state.failures.length} step(s) failed.`);
    state.failures.forEach((f, i) => console.error(`${i + 1}. ${f.name}: ${f.message}`));
    process.exit(1);
  }

  console.log("\nALL BACKEND FLOW TESTS PASSED ✅");
  console.log("Ticket ID:", state.ticketId);
  console.log("Test user:", state.testEmail);
}

main().catch(async (err) => {
  fail("Unexpected runner error", err);
  try {
    await restoreOriginalProducts();
  } catch (_) {}
  console.error("\nBackend flow test crashed.");
  process.exit(1);
});
