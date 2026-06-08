let token = localStorage.getItem("whalex_admin_token") || "";
let data = null;
const $ = (id) => document.getElementById(id);
function authHeaders(extra = {}) { return { ...extra, Authorization: `Bearer ${token}` }; }
function msg(el, text, isError=false) { el.innerHTML = `<div class="notice ${isError ? "error" : ""}">${text}</div>`; }
function showApp() { $("loginBox").style.display = token ? "none" : "block"; $("adminApp").style.display = token ? "block" : "none"; }
async function api(path, options={}) {
  const res = await fetch(path, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}
$("loginBtn").addEventListener("click", async () => {
  try {
    const res = await api("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: $("adminPassword").value }) });
    token = res.token; localStorage.setItem("whalex_admin_token", token); showApp(); await loadAdmin();
  } catch (e) { msg($("loginMsg"), e.message, true); }
});
$("logoutBtn")?.addEventListener("click", () => { localStorage.removeItem("whalex_admin_token"); token = ""; showApp(); });
$("refreshBtn")?.addEventListener("click", loadAdmin);

function input(name, value, label, type="text") { return `<label>${label}<input name="${name}" value="${String(value || "").replaceAll('"', "&quot;")}" type="${type}"></label>`; }
function textarea(name, value, label) { return `<label style="grid-column:1/-1">${label}<textarea name="${name}">${value || ""}</textarea></label>`; }
function statusBadge(s) { return `<span class="status ${s}">${s}</span>`; }

async function loadAdmin() {
  if (!token) return showApp();
  try {
    data = await api("/api/admin/data", { headers: authHeaders() });
    renderSettings(); renderPricing(); renderProducts(); renderReviews(); renderProfits(); renderVideos(); renderPayments(); showApp();
  } catch (e) { localStorage.removeItem("whalex_admin_token"); token = ""; showApp(); msg($("loginMsg"), "Please login again.", true); }
}

function renderSettings() {
  const s = data.settings;
  $("settingsForm").innerHTML = [
    input("brandName", s.brandName, "Brand Name"),
    input("supportEmail", s.supportEmail, "Support Email"),
    input("telegramLink", s.telegramLink, "Telegram Link"),
    input("razorpayLink", s.razorpayLink, "Razorpay Payment Link"),
    input("upiId", s.upiId, "UPI ID"),
    textarea("heroTitle", s.heroTitle, "Hero Title"),
    textarea("heroSubtitle", s.heroSubtitle, "Hero Subtitle"),
    textarea("marketLine", s.marketLine || "", "Market Line"),
    `<button class="btn primary" type="submit">Save Settings</button>`
  ].join("");
}
$("settingsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/api/admin/settings", { method: "PUT", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
  await loadAdmin(); alert("Settings saved.");
});

function renderPricing() {
  const p = data.pricing;
  $("pricingForm").innerHTML = [input("planName", p.planName, "Plan Name"), input("oldPrice", p.oldPrice, "Old Price"), input("currentPrice", p.currentPrice, "Current Price"), input("discountText", p.discountText, "Discount Text"), `<button class="btn primary" type="submit">Save Pricing</button>`].join("");
}
$("pricingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/api/admin/pricing", { method: "PUT", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
  await loadAdmin(); alert("Pricing saved.");
});

function renderProducts() {
  $("productsAdmin").innerHTML = data.products.map((p) => `
    <form class="list-item product-form" data-id="${p.id}">
      <div class="form-grid">${input("name", p.name, "Product Name")}${input("tag", p.tag, "Tag")}${textarea("description", p.description, "Description")}${textarea("features", (p.features || []).join("\n"), "Features, one per line")}</div>
      <div class="list-actions"><button class="btn primary" type="submit">Save ${p.name}</button></div>
    </form>`).join("");
  document.querySelectorAll(".product-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(form));
      body.features = body.features.split("\n").map((x) => x.trim()).filter(Boolean);
      await api(`/api/admin/products/${form.dataset.id}`, { method: "PUT", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(body) });
      await loadAdmin(); alert("Product saved.");
    });
  });
}

$("addReviewForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/api/admin/reviews", { method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
  e.target.reset(); await loadAdmin();
});
function renderReviews() {
  $("reviewsAdmin").innerHTML = data.reviews.map((r) => `<div class="list-item"><h3>${r.name} ${statusBadge(r.status)}</h3><p>${r.role} · Rating ${r.rating}</p><p>${r.text}</p><div class="list-actions"><button class="btn secondary" onclick="updateReview('${r.id}','approved')">Approve</button><button class="btn secondary" onclick="updateReview('${r.id}','pending')">Mark Pending</button><button class="btn danger" onclick="deleteReview('${r.id}')">Delete</button></div></div>`).join("");
}
async function updateReview(id, status) { await api(`/api/admin/reviews/${id}`, { method: "PATCH", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ status }) }); await loadAdmin(); }
async function deleteReview(id) { if (!confirm("Delete review?")) return; await api(`/api/admin/reviews/${id}`, { method: "DELETE", headers: authHeaders() }); await loadAdmin(); }

$("addProfitForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/api/admin/profits", { method: "POST", headers: authHeaders(), body: new FormData(e.target) });
  e.target.reset(); await loadAdmin();
});
function renderProfits() {
  $("profitsAdmin").innerHTML = data.profits.map((p) => `<div class="list-item"><h3>${p.title} ${statusBadge(p.status)}</h3><p>${p.name} · ${p.date || ""}</p><p>${p.caption || ""}</p><img src="${p.image}" style="max-width:260px;border-radius:14px;border:1px solid var(--line)"><div class="list-actions"><button class="btn secondary" onclick="updateProfit('${p.id}','approved')">Approve</button><button class="btn secondary" onclick="updateProfit('${p.id}','pending')">Mark Pending</button><button class="btn danger" onclick="deleteProfit('${p.id}')">Delete</button></div></div>`).join("");
}
async function updateProfit(id, status) { await api(`/api/admin/profits/${id}`, { method: "PATCH", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ status }) }); await loadAdmin(); }
async function deleteProfit(id) { if (!confirm("Delete profit item?")) return; await api(`/api/admin/profits/${id}`, { method: "DELETE", headers: authHeaders() }); await loadAdmin(); }

$("addVideoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/api/admin/videos", { method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
  e.target.reset(); await loadAdmin();
});
function renderVideos() {
  $("videosAdmin").innerHTML = data.videos.map((v) => `<div class="list-item"><h3>${v.title} ${statusBadge(v.status)}</h3><p>YouTube ID: ${v.youtubeId || "Not added"}</p><p>${v.description || ""}</p><div class="list-actions"><button class="btn secondary" onclick="updateVideo('${v.id}','approved')">Approve</button><button class="btn secondary" onclick="updateVideo('${v.id}','pending')">Mark Pending</button><button class="btn danger" onclick="deleteVideo('${v.id}')">Delete</button></div></div>`).join("");
}
async function updateVideo(id, status) { await api(`/api/admin/videos/${id}`, { method: "PATCH", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ status }) }); await loadAdmin(); }
async function deleteVideo(id) { if (!confirm("Delete video?")) return; await api(`/api/admin/videos/${id}`, { method: "DELETE", headers: authHeaders() }); await loadAdmin(); }

function renderPayments() {
  $("paymentsAdmin").innerHTML = data.paymentProofs.length ? data.paymentProofs.map((p) => `<div class="list-item"><h3>${p.name || "No name"} ${statusBadge(p.status)}</h3><p>Email: ${p.email || "-"} · Phone: ${p.phone || "-"}</p><p>TradingView: <strong>${p.tradingViewUsername || "-"}</strong></p><p>Payment ID: ${p.paymentId || "-"}</p><p>${p.note || ""}</p>${p.screenshot ? `<img src="${p.screenshot}" style="max-width:260px;border-radius:14px;border:1px solid var(--line)">` : ""}</div>`).join("") : `<div class="list-item"><p>No payment proofs yet.</p></div>`;
}
loadAdmin();
