let token = localStorage.getItem("whalex_admin_token") || "";
let data = null;
let adminLiveTimer = null;
let lastAdminLiveSignature = "";
let adminLastReadAllAt = 0;

const $ = (id) => document.getElementById(id);

function authHeaders(extra = {}) {
  return { ...extra, Authorization: `Bearer ${token}` };
}
function showApp() {
  if ($("loginBox")) $("loginBox").style.display = token ? "none" : "block";
  if ($("adminApp")) $("adminApp").style.display = token ? "block" : "none";
}
function showMsg(id, text, isError = false) {
  const el = typeof id === "string" ? $(id) : id;
  if (!el) return;
  el.innerHTML = text ? `<div class="notice ${isError ? "error" : ""}">${escapeHtml(text)}</div>` : "";
}
function successToast(key, override = {}) {
  if (window.showStandardSuccess) window.showStandardSuccess(key, override);
}
function errorToast(error, override = {}) {
  if (window.showStandardError) window.showStandardError(error, override);
}
async function api(path, options = {}) {
  const res = await fetch(path, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}
function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[m]));
}
function escapeAttr(v) {
  return escapeHtml(v);
}
function input(name, value, label, type = "text") {
  return `<label>${escapeHtml(label)}<input name="${escapeAttr(name)}" value="${escapeAttr(value || "")}" type="${type}"></label>`;
}
function textarea(name, value, label) {
  return `<label style="grid-column:1/-1">${escapeHtml(label)}<textarea name="${escapeAttr(name)}">${escapeHtml(value || "")}</textarea></label>`;
}
function statusBadge(s) {
  const v = String(s || "open").toLowerCase();
  const label = v === "done" ? "Done" : v === "rejected" ? "Rejected" : v.charAt(0).toUpperCase() + v.slice(1);
  return `<span class="status ${escapeAttr(v)}">${escapeHtml(label)}</span>`;
}
function approvalBadge(s) {
  const v = String(s || "pending").toLowerCase();
  return `<span class="status ${escapeAttr(v)}">${escapeHtml(v.charAt(0).toUpperCase() + v.slice(1))}</span>`;
}
function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysYmd(dateValue, days) {
  if (!dateValue) return "";
  const d = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}
function durationDaysForTicket(tOrType) {
  const type = typeof tOrType === "string" ? tOrType : String(tOrType?.accessType || "");
  const trialDays = Number(data?.config?.trialAccessDays || 3);
  const paidDays = Number(data?.config?.paidAccessDays || 30);
  return String(type).toLowerCase() === "trial" ? trialDays : paidDays;
}

function accessTypeDisplayLabel(t) {
  const raw = String(t?.accessType || t?.plan || "").toLowerCase();
  if (raw.includes("trial")) return "3-Day Trial Access";
  return t?.plan || "WhaleX V1 Access";
}

function paymentIdDisplay(t) {
  return String(t?.paymentId || t?.utr || t?.transactionId || "").trim() || "-";
}


function cleanAccessStatusLabel(t) {
  const requestStatus = String(t?.status || "").toLowerCase();
  const accessStatus = String(t?.accessStatus || "").toLowerCase();

  if (requestStatus === "rejected") return "Rejected";
  if (accessStatus === "granted") return "Granted";
  if (accessStatus === "expired") return "Expired";
  if (accessStatus === "blocked") return "Blocked";
  if (accessStatus === "not_granted" || requestStatus === "open") return "Verification Pending";

  return String(t?.accessStatus || "-").replaceAll("_", " ");
}

function cleanPaymentStatusLabel(value) {
  const raw = String(value || "-").toLowerCase();
  if (raw === "pending") return "Payment Pending";
  if (raw === "verified") return "Verified";
  if (raw === "rejected") return "Rejected";
  return String(value || "-").replaceAll("_", " ");
}

function isTrialTicket(t) {
  return String(t?.accessType || t?.plan || "").toLowerCase().includes("trial");
}

function durationText(t) {
  const days = durationDaysForTicket(t);
  return String(t?.accessType || "").toLowerCase() === "trial"
    ? `Trial: Start Date + ${days} days`
    : `Paid: Start Date + ${days} days`;
}
function syncAccessDates(id, accessType) {
  const startEl = document.getElementById(`start-${id}`);
  const endEl = document.getElementById(`end-${id}`);
  if (!startEl || !endEl) return;

  const days = durationDaysForTicket(accessType);
  endEl.value = startEl.value ? addDaysYmd(startEl.value, days) : "";
  endEl.readOnly = true;
  endEl.classList.add("readonly-date");

  const hint = document.getElementById(`date-hint-${id}`);
  if (hint) {
    hint.textContent = startEl.value && endEl.value
      ? `Auto End Date: ${endEl.value} (${days} days from Start Date)`
      : `Select Start Date. End Date will auto-fill as Start Date + ${days} days.`;
  }
}
function asFormData(form) {
  return Object.fromEntries(new FormData(form));
}


function isAdminNotificationUnread(notification) {
  if (!notification) return false;
  if (notification.unread === true) return true;
  return !notification.readAt;
}

function notificationBadgeHtml(unreadCount) {
  const unread = Number(unreadCount || 0);
  if (!unread) return "";

  return `<span class="notif-count is-unread-count" title="${unread} unread notifications">${unread > 99 ? "99+" : unread}</span>`;
}

function adminNotificationItems() {
  return data?.notifications || [];
}
function adminUnreadCount() {
  if (data && Number.isFinite(Number(data.adminUnreadNotifications))) {
    return Number(data.adminUnreadNotifications);
  }
  return adminNotificationItems().filter(isAdminNotificationUnread).length;
}

function getAdminNotificationTarget(notification) {
  const type = String(notification?.type || "").toLowerCase();

  if (
    type.includes("access") ||
    type.includes("payment") ||
    type.includes("trial")
  ) {
    return "#accessTickets";
  }

  if (type.includes("support")) {
    return "#supportTickets";
  }

  if (type.includes("review")) {
    return "#reviews";
  }

  if (type.includes("profit")) {
    return "#profits";
  }

  if (type.includes("video")) {
    return "#videos";
  }

  if (type.includes("monthly") || type.includes("report")) {
    return "#reports";
  }

  if (type.includes("setting")) {
    return "#settings";
  }

  if (type.includes("product") || type.includes("indicator")) {
    return "#products";
  }

  return "#notifications";
}

function scrollAdminToSection(hash) {
  if (!hash) return;
  const targetId = hash.replace("#", "");
  const target = document.getElementById(targetId);
  if (target) {
    history.replaceState(null, "", hash);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function openAdminNotification(id) {
  const notification = adminNotificationItems().find((n) => String(n.id) === String(id));

  if (id) {
    try {
      await markAdminNotificationRead(id, { stayOpen: true });
    } catch (_) {
      // Continue navigation even if mark-read fails.
    }
  }

  const target = getAdminNotificationTarget(notification);
  document.getElementById("adminNotificationHost")?.classList.remove("open");

  // Ensure the most relevant live data is visible before scrolling.
  try {
    await fetchAdminLive();
  } catch (_) {}

  scrollAdminToSection(target);
}

function renderAdminNotificationBell() {
  const nav = document.querySelector(".page-admin .site-header .nav-links.static");
  if (!nav || !token) return;

  let host = document.getElementById("adminNotificationHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "adminNotificationHost";
    host.className = "notif-host admin-notif-host";
    nav.prepend(host);
  }

  const allItems = adminNotificationItems();
  const items = allItems.slice(0, 8);
  const unreadCount = adminUnreadCount();
  const totalCount = allItems.length;

  host.innerHTML = `
    <button class="notif-bell-btn" id="adminNotifBellBtn" type="button" aria-label="Admin notifications">
      <span class="bell-icon">🔔</span>
      ${notificationBadgeHtml(unreadCount)}
    </button>
    <div class="notif-panel" id="adminNotifPanel">
      <div class="notif-panel-head">
        <strong>Admin Notifications</strong>
        <button type="button" id="adminNotifReadAll">Mark all read</button>
      </div>
      <div class="notif-list">
        ${items.length ? items.map((n) => `
          <button class="notif-item ${isAdminNotificationUnread(n) ? "is-unread" : "is-read"}" type="button" data-admin-notif-id="${escapeAttr(n.id)}">
            <span class="notif-dot"></span>
            <span>
              <strong>${escapeHtml(n.title || "Notification")}</strong>
              <small>${escapeHtml(n.message || "")}</small>
              <em>${escapeHtml(formatAdminNotificationTime(n.createdAt))}</em>
            </span>
          </button>
        `).join("") : `<div class="notif-empty">No admin notifications yet.</div>`}
      </div>
    </div>
  `;

  document.getElementById("adminNotifBellBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    host.classList.toggle("open");
  });

  document.getElementById("adminNotifReadAll")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    await markAdminNotificationsReadAll();
  });

  host.querySelectorAll("[data-admin-notif-id]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await openAdminNotification(btn.dataset.adminNotifId);
    });
  });
}
function formatAdminNotificationTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch (_) {
    return value;
  }
}
async function fetchAdminLive() {
  if (!token || !data) return;

  const live = await api(`/api/admin/live?t=${Date.now()}`, { headers: authHeaders() });
  const nextSignature = JSON.stringify({
    accessInbox: live.accessInbox,
    supportTickets: live.supportTickets,
    notifications: live.notifications,
    counts: live.counts
  });

  if (nextSignature === lastAdminLiveSignature) return;
  lastAdminLiveSignature = nextSignature;

  data.accessInbox = live.accessInbox || data.accessInbox || [];
  data.supportTickets = live.supportTickets || data.supportTickets || [];
  data.notifications = live.notifications || data.notifications || [];
  data.adminUnreadNotifications = Number.isFinite(Number(live.unreadCount))
    ? Number(live.unreadCount)
    : (data.notifications || []).filter(isAdminNotificationUnread).length;

  // Prevent an in-flight/stale live poll response from restoring the badge right after Mark all read.
  if (Date.now() - adminLastReadAllAt < 3000) {
    data.notifications = (data.notifications || []).map((n) => ({
      ...n,
      readAt: n.readAt || new Date().toISOString(),
      unread: false
    }));
    data.adminUnreadNotifications = 0;
  }
  data.counts = { ...(data.counts || {}), ...(live.counts || {}) };

  console.log("[Admin notification bell count]", {
    unreadCount: data.adminUnreadNotifications,
    totalCount: (data.notifications || []).length
  });

  const active = document.activeElement;
  const editingAccess = active?.closest?.("#accessTickets");
  const editingSupport = active?.closest?.("#supportTickets");

  renderAdminCounts();
  renderAdminNotificationBell();
  renderNotifications();

  if (!editingAccess) renderAccessTickets();
  if (!editingSupport) renderSupportTickets();

  const liveStatus = document.getElementById("adminLiveStatus");
  if (liveStatus) liveStatus.textContent = `Live sync: ${new Date().toLocaleTimeString()}`;
}
function startAdminLivePolling() {
  if (adminLiveTimer) return;
  fetchAdminLive().catch((e) => console.warn("[Admin live sync failed]", e.message));
  adminLiveTimer = setInterval(() => {
    fetchAdminLive().catch((e) => console.warn("[Admin live sync failed]", e.message));
  }, 5000);

  document.addEventListener("click", () => {
    document.getElementById("adminNotificationHost")?.classList.remove("open");
  });
}
function stopAdminLivePolling() {
  if (adminLiveTimer) {
    clearInterval(adminLiveTimer);
    adminLiveTimer = null;
  }
}
async function markAdminNotificationRead(id, options = {}) {
  if (!id) return;
  const res = await api(`/api/admin/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    headers: authHeaders()
  });
  data.notifications = res.notifications || data.notifications || [];
  data.adminUnreadNotifications = Number.isFinite(Number(res.unreadCount))
    ? Number(res.unreadCount)
    : (data.notifications || []).filter(isAdminNotificationUnread).length;
  renderAdminNotificationBell();

  if (!options.stayOpen) {
    document.getElementById("adminNotificationHost")?.classList.remove("open");
  }
}
async function markAdminNotificationsReadAll() {
  adminLastReadAllAt = Date.now();

  // Optimistic UI: clear badge immediately, before waiting for server.
  const localReadAt = new Date().toISOString();
  data.notifications = (data.notifications || []).map((n) => ({
    ...n,
    readAt: n.readAt || localReadAt,
    unread: false
  }));
  data.adminUnreadNotifications = 0;
  lastAdminLiveSignature = "";
  renderNotifications();
  renderAdminNotificationBell();

  const res = await api(`/api/admin/notifications/read-all?t=${Date.now()}`, {
    method: "PATCH",
    cache: "no-store",
    headers: authHeaders()
  });

  const readAt = res.readAt || localReadAt;
  data.notifications = (res.notifications || data.notifications || []).map((n) => ({
    ...n,
    readAt: n.readAt || readAt,
    unread: false
  }));
  data.adminUnreadNotifications = 0;
  lastAdminLiveSignature = "";

  renderAdminNotificationBell();

  console.log("[Admin notification mark all read]", {
    unreadCount: data.adminUnreadNotifications,
    beforeUnread: res.beforeUnread,
    afterUnread: res.afterUnread,
    totalCount: (data.notifications || []).length
  });
}

async function loadAdmin() {
  if (!token) {
    showApp();
    return;
  }
  try {
    data = await api("/api/admin/data", { headers: authHeaders() });
    showApp();
    renderAll();
    renderAdminNotificationBell();
    startAdminLivePolling();
    if (window.location.hash) {
      setTimeout(() => scrollAdminToSection(window.location.hash), 250);
    }
  } catch (e) {
    localStorage.removeItem("whalex_admin_token");
    token = "";
    stopAdminLivePolling();
    document.getElementById("adminNotificationHost")?.remove();
    showApp();
    showMsg("loginMsg", e.message, true);
  }
}

function renderAll() {
  renderAdminDashboard();
  renderAdminCounts();
  renderUserAccounts();
  renderAccessTickets();
  renderSupportTickets();
  renderNotifications();
  renderMonthlyReports();
  renderReviews();
  renderProfits();
  renderProducts();
  renderPricing();
  renderSettings();
  renderVideos();
}


async function loadAccessTicketsOnly() {
  try {
    const res = await api("/api/admin/access-tickets", { headers: authHeaders() });
    data.accessInbox = res.inbox || res.tickets || [];
    data.accessTickets = res.tickets || [];
    if (data.counts) { data.counts.accessTickets = res.count || 0; data.counts.accessInbox = res.inboxCount || (res.inbox || []).length || 0; }
    renderAccessTickets();
    renderAdminDashboard();
    renderAdminCounts();
    renderAdminNotificationBell();
  } catch (e) {
    alert(e.message);
  }
}


function parseYmdDate(value) {
  const text = String(value || "").slice(0, 10);
  if (!text) return null;
  const d = new Date(`${text}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function adminToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function adminDaysUntil(value) {
  const d = parseYmdDate(value);
  if (!d) return null;
  return Math.ceil((d.getTime() - adminToday().getTime()) / 86400000);
}

function allAccessTicketsForDashboard() {
  const map = new Map();
  [...(data?.accessTickets || []), ...(data?.accessInbox || [])].forEach((ticket) => {
    if (ticket?.id && !map.has(ticket.id)) map.set(ticket.id, ticket);
  });
  return [...map.values()];
}

function isTicketGranted(ticket) {
  return String(ticket?.status || "").toLowerCase() === "done" &&
    String(ticket?.accessStatus || "").toLowerCase() === "granted";
}

function isTicketActive(ticket) {
  const remaining = adminDaysUntil(ticket?.accessEndDate || ticket?.endDate || "");
  return isTicketGranted(ticket) && (remaining === null || remaining >= 0);
}

function isTicketExpired(ticket) {
  const remaining = adminDaysUntil(ticket?.accessEndDate || ticket?.endDate || "");
  return isTicketGranted(ticket) && remaining !== null && remaining < 0;
}

function isTicketTrial(ticket) {
  return String(ticket?.accessType || ticket?.plan || "").toLowerCase().includes("trial");
}

function isTicketPaid(ticket) {
  return !isTicketTrial(ticket);
}

function moneyNumber(value) {
  const n = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function activePricingAmount() {
  const pricing = data?.pricing || {};
  return moneyNumber(pricing.price || pricing.monthlyPrice || pricing.amount || pricing.paidAmount || 0);
}


function goToAdminSection(sectionId) {
  if (!sectionId) return;
  const target = document.getElementById(sectionId);
  if (!target) return;

  window.location.hash = sectionId;
  target.scrollIntoView({ behavior: "smooth", block: "start" });

  target.classList.add("section-focus-pulse");
  setTimeout(() => target.classList.remove("section-focus-pulse"), 1400);
}

function dashboardMetric(label, value, hint = "", tone = "", targetSection = "") {
  const clickable = targetSection ? " dashboard-clickable" : "";
  const clickAttr = targetSection ? ` role="button" tabindex="0" onclick="goToAdminSection('${targetSection}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goToAdminSection('${targetSection}')}"` : "";

  return `
    <div class="dashboard-metric ${tone ? `tone-${tone}` : ""}${clickable}"${clickAttr}>
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
      ${hint ? `<small>${escapeHtml(hint)}</small>` : ""}
      ${targetSection ? `<em>Open details</em>` : ""}
    </div>
  `;
}

function dashboardListItem(ticket, type = "request") {
  const endDate = ticket?.accessEndDate || ticket?.endDate || "-";
  const status = type === "expiry"
    ? `${adminDaysUntil(endDate)} days left`
    : cleanAccessStatusLabel(ticket);
  return `
    <div class="dashboard-list-item">
      <div>
        <strong>${escapeHtml(ticket?.name || "User")}</strong>
        <span>${escapeHtml(accessTypeDisplayLabel(ticket))} · ${escapeHtml(ticket?.tradingViewUsername || ticket?.email || "-")}</span>
      </div>
      <div class="dashboard-list-meta">
        <span>${escapeHtml(status)}</span>
        <small>${escapeHtml(type === "expiry" ? `Ends ${endDate}` : (ticket?.createdAt || ticket?.id || "-"))}</small>
      </div>
    </div>
  `;
}


function approvalQueueItem(ticket) {
  const paid = isTicketPaid(ticket);
  const proofOk = !!ticket?.paymentProof;
  const paymentId = paymentIdDisplay(ticket);
  const proofText = paid ? (proofOk ? "Proof OK" : "Proof missing") : "Trial";
  const proofTone = paid ? (proofOk ? "success" : "danger") : "info";

  return `
    <article class="approval-queue-item compact-approval-item ${paid ? "paid-request" : "trial-request"}">
      <div class="approval-main">
        <div>
          <div class="approval-title-row">
            <strong>${escapeHtml(ticket?.name || "User")}</strong>
            <span class="mini-status tone-${proofTone}">${escapeHtml(proofText)}</span>
          </div>
          <p>${escapeHtml(accessTypeDisplayLabel(ticket))} · TV: ${escapeHtml(ticket?.tradingViewUsername || "-")}</p>
          <p class="approval-compact-meta">
            ${escapeHtml(ticket?.email || "-")}
            ${paid ? ` · UTR: ${escapeHtml(paymentId)}` : ""}
          </p>
        </div>
        <div class="approval-actions">
          <button class="btn mini primary" type="button" onclick="goToAdminSection('accessTickets')">Review</button>
        </div>
      </div>
    </article>
  `;
}

function renderApprovalQueue(pending = []) {
  const paidWaiting = pending.filter(isTicketPaid);
  const trialWaiting = pending.filter(isTicketTrial);

  if (!pending.length) {
    return `
      <section class="approval-queue-panel clean-approval-panel is-clear">
        <div class="approval-queue-head compact-head">
          <div>
            <span class="section-kicker">Most Important</span>
            <h3>No approval pending</h3>
            <p>Access request queue is clear.</p>
          </div>
          <button class="btn ghost" type="button" onclick="goToAdminSection('accessTickets')">Access Tickets</button>
        </div>
      </section>
    `;
  }

  return `
    <section class="approval-queue-panel clean-approval-panel needs-action">
      <div class="approval-queue-head compact-head">
        <div>
          <span class="section-kicker">Most Important</span>
          <h3>${pending.length} request${pending.length === 1 ? "" : "s"} waiting for approval</h3>
          <p>${paidWaiting.length} paid · ${trialWaiting.length} trial. Review these first.</p>
        </div>
        <button class="btn primary" type="button" onclick="goToAdminSection('accessTickets')">Open Access Tickets</button>
      </div>

      <div class="approval-queue-list compact-approval-list">
        ${pending.map(approvalQueueItem).join("")}
      </div>
    </section>
  `;
}

function renderAdminDashboard() {
  const box = $("adminDashboardBox");
  if (!box || !data) return;

  const tickets = allAccessTicketsForDashboard();
  const support = data.supportTickets || [];

  const pending = tickets
    .filter((t) => String(t.status || "").toLowerCase() === "open")
    .sort((a, b) => String(b.createdAt || b.id || "").localeCompare(String(a.createdAt || a.id || "")));

  const active = tickets.filter(isTicketActive);
  const activeTrial = active.filter(isTicketTrial);
  const activePaid = active.filter(isTicketPaid);
  const expiring2 = active.filter((t) => adminDaysUntil(t.accessEndDate || t.endDate || "") >= 0 && adminDaysUntil(t.accessEndDate || t.endDate || "") <= 2);
  const supportOpen = support.filter((s) => String(s.status || "open").toLowerCase() !== "closed");
  box.innerHTML = `
    ${renderApprovalQueue(pending)}

    <div class="dashboard-grid admin-dashboard-grid clean-admin-metrics">
      ${dashboardMetric("Waiting Approval", pending.length, "Needs admin action", pending.length ? "warning" : "success", "accessTickets")}
      ${dashboardMetric("Active Paid", activePaid.length, "Monthly users", "success", "userAccounts")}
      ${dashboardMetric("Active Trial", activeTrial.length, "Trial users", "info", "userAccounts")}
      ${dashboardMetric("Expiring in 2 Days", expiring2.length, "Follow up / reminder", expiring2.length ? "warning" : "neutral", "accessTickets")}
      ${dashboardMetric("Open Support", supportOpen.length, "Needs reply", supportOpen.length ? "warning" : "neutral", "supportTickets")}
    </div>
  `;
}

function renderAdminCounts() {
  const box = $("adminCountsBox");
  if (!box || !data) return;
  const counts = data.counts || {};
  box.innerHTML = `
    <div class="admin-count-pill"><strong>${counts.accessInbox ?? (data.accessInbox || data.accessTickets || []).length}</strong><span>Access Inbox</span></div>
    <div class="admin-count-pill"><strong>${counts.users ?? (data.userAccounts || []).length}</strong><span>Users</span></div>
    <div class="admin-count-pill"><strong>${counts.supportTickets ?? (data.supportTickets || []).length}</strong><span>Support Tickets</span></div>
    <div class="admin-count-pill"><strong>${counts.notifications ?? (data.notifications || []).length}</strong><span>Notifications</span></div>
  `;
}

function renderUserAccounts() {
  const box = $("userAccountsAdmin");
  if (!box) return;
  const items = data.userAccounts || [];
  box.innerHTML = items.length ? items.map((u) => `
    <div class="list-item">
      <h3>${escapeHtml(u.name || "User")}</h3>
      <p><strong>Email:</strong> ${escapeHtml(u.email || "-")} · <strong>Phone:</strong> ${escapeHtml(u.phone || "-")}</p>
      <p><strong>Telegram:</strong> ${escapeHtml(u.telegramId || "-")} · <strong>TradingView:</strong> ${escapeHtml(u.tradingViewUsername || "-")}</p>
      <p><strong>Created:</strong> ${escapeHtml(u.createdAt || "-")}</p>
    </div>
  `).join("") : `<div class="list-item"><p>No users yet.</p></div>`;
}


function isPdfEvidence(url = "") {
  const u = String(url || "").toLowerCase().split("?")[0];
  return u.endsWith(".pdf") || u.includes("/raw/upload/");
}

function renderAdminEvidence(url, options = {}) {
  if (!url) {
    return `<div class="evidence-panel missing">
      <div>
        <span class="section-kicker">Evidence</span>
        <strong>No payment proof / screenshot uploaded</strong>
        <p>User did not upload a screenshot/evidence file for this request.</p>
      </div>
    </div>`;
  }

  const title = options.title || "Payment Proof / Evidence";
  const subtitle = options.subtitle || "Uploaded screenshot or PDF evidence";
  const kind = options.kind || "access";
  const id = options.id || "";
  const pdf = isPdfEvidence(url);

  return `<div class="evidence-panel">
    <div class="evidence-head">
      <div>
        <span class="section-kicker">Evidence</span>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(subtitle)}</p>
      </div>
      <div class="evidence-actions">
        <a class="btn ghost mini-action-btn" href="${escapeAttr(url)}" target="_blank" rel="noopener">Open</a>
        ${id ? `<button class="btn primary mini-action-btn" type="button" onclick="downloadAdminEvidence('${escapeAttr(kind)}','${escapeAttr(id)}')">Download</button>` : `<a class="btn primary mini-action-btn" href="${escapeAttr(url)}" download>Download</a>`}
      </div>
    </div>
    <div class="evidence-preview ${pdf ? "pdf-evidence" : ""}">
      ${pdf
        ? `<div class="pdf-preview-icon">PDF</div>`
        : `<img src="${escapeAttr(url)}" alt="${escapeAttr(title)}" loading="lazy" onerror="this.style.display='none'; this.closest('.evidence-preview')?.classList.add('file-only');">`}
      <div class="evidence-file-note">${pdf ? "PDF evidence uploaded" : "Screenshot preview. If preview fails, use Open or Download."}</div>
    </div>
  </div>`;
}

async function downloadAdminEvidence(kind, id) {
  try {
    const endpoint = kind === "support"
      ? `/api/admin/support-tickets/${encodeURIComponent(id)}/attachment/download`
      : kind === "trial-feedback"
        ? `/api/admin/access-tickets/${encodeURIComponent(id)}/trial-feedback-attachment/download`
        : `/api/admin/access-tickets/${encodeURIComponent(id)}/payment-proof/download`;

    const res = await fetch(endpoint, { headers: authHeaders() });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || "Unable to download evidence.");
    }

    const blob = await res.blob();
    const disposition = res.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const filename = match?.[1] || `${kind}-evidence-${id}`;

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);

    successToast("admin_data_refreshed", {
      title: "Evidence downloaded",
      message: "Screenshot/evidence file downloaded successfully."
    });
  } catch (e) {
    errorToast(e, {
      title: "Unable to download evidence"
    });
  }
}


function accessDeliveryStatusLabel(value = "") {
  const raw = String(value || "pending").toLowerCase();
  if (raw === "given") return "Given";
  if (raw === "removed") return "Removed";
  if (raw === "invite_generated") return "Invite Generated";
  if (raw === "joined") return "Joined";
  if (raw === "left") return "Left";
  return "Pending";
}

function accessDeliveryStatusClass(value = "") {
  const raw = String(value || "pending").toLowerCase();
  if (["given", "joined"].includes(raw)) return "success";
  if (["removed", "left"].includes(raw)) return "danger";
  if (raw === "invite_generated") return "warning";
  return "neutral";
}

function renderTicketActivityLog(t) {
  const log = Array.isArray(t.activityLog) ? t.activityLog.slice(0, 6) : [];
  if (!log.length) return `<div class="notice soft">No access activity recorded yet.</div>`;

  return `
    <div class="ticket-activity-log">
      ${log.map((item) => `
        <div class="ticket-activity-row">
          <strong>${escapeHtml(item.message || item.action || "Activity")}</strong>
          <span>${escapeHtml(item.actor || "system")} · ${escapeHtml(item.at || "-")}</span>
        </div>
      `).join("")}
    </div>
  `;
}


function telegramLinksForTicket(t = {}) {
  const links = Array.isArray(t.telegramInviteLinks) ? t.telegramInviteLinks : [];
  if (links.length) return links;
  if (t.telegramInviteLink) {
    return [{
      id: "primary-telegram",
      name: "Telegram Group",
      chatId: "",
      inviteLink: t.telegramInviteLink,
      status: t.telegramAccessStatus || "invite_generated",
      generatedAt: t.telegramInviteGeneratedAt || "",
      error: ""
    }];
  }
  return [];
}

function renderAdminTelegramLinks(t = {}) {
  const links = telegramLinksForTicket(t);
  if (!links.length) {
    return `<div class="notice soft">No Telegram invite links generated yet.</div>`;
  }

  return `
    <div class="telegram-destination-list">
      ${links.map((item, index) => `
        <div class="telegram-destination-row ${item.error ? "has-error" : ""}">
          <div>
            <strong>${escapeHtml(item.name || `Telegram ${index + 1}`)}</strong>
            <span>${escapeHtml(item.chatId || "")}${item.botTokenMasked ? ` · Bot: ${escapeHtml(item.botTokenMasked)}` : ""}</span>
            ${item.inviteLink ? `<a href="${escapeAttr(item.inviteLink)}" target="_blank" rel="noopener">Open invite link</a>` : `<small>${escapeHtml(item.error || "Invite not generated")}</small>`}
          </div>
          <div>
            <select id="tg-dest-status-${escapeAttr(t.id)}-${index}">
              <option value="pending" ${String(item.status || "pending") === "pending" ? "selected" : ""}>Pending</option>
              <option value="invite_generated" ${String(item.status || "") === "invite_generated" ? "selected" : ""}>Invite Generated</option>
              <option value="joined" ${String(item.status || "") === "joined" ? "selected" : ""}>Joined</option>
              <option value="left" ${String(item.status || "") === "left" ? "selected" : ""}>Left</option>
              <option value="removed" ${String(item.status || "") === "removed" ? "selected" : ""}>Removed</option>
            </select>
            <button class="btn ghost mini" type="button" onclick="saveTelegramDestinationStatus('${escapeAttr(t.id)}', ${index})">Update</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderAccessTickets() {
  const box = $("accessTicketsAdmin");
  if (!box) return;
  const items = data.accessInbox || data.accessTickets || [];

  box.innerHTML = items.length ? items.map((t) => `
    <div class="list-item access-admin-card">
      <div class="access-admin-head">
        <div>
          <h3>${escapeHtml(t.name || "No name")} ${statusBadge(t.status)}</h3>
          <p><strong>${escapeHtml(t.plan || "WhaleX Access")}</strong> · ${escapeHtml(t.accessType || "paid")} ${t.auditOnly ? "· Audit-only fallback" : ""}</p>
        </div>
        <div class="duration-pill">${escapeHtml(durationText(t))}</div>
      </div>

      <div class="admin-summary-grid">
        <p><strong>Ticket</strong><br>${escapeHtml(t.id)}</p>
          <p><strong>Access Type</strong><br>${escapeHtml(accessTypeDisplayLabel(t))}</p>
        <p><strong>Email</strong><br>${escapeHtml(t.email || "-")}</p>
        <p><strong>Phone</strong><br>${escapeHtml(t.phone || "-")}</p>
        <p><strong>Telegram</strong><br>${escapeHtml(t.telegramId || "-")}</p>
        <p><strong>Telegram Numeric ID</strong><br>${escapeHtml(t.telegramNumericId || "-")}</p>
        <p><strong>TradingView</strong><br>${escapeHtml(t.tradingViewUsername || "-")}</p>
        ${isTrialTicket(t) ? "" : `<p><strong>Payment</strong><br>${escapeHtml(cleanPaymentStatusLabel(t.paymentStatus))}</p><p><strong>Payment ID / UTR</strong><br>${escapeHtml(paymentIdDisplay(t))}</p>`}
        <p><strong>Access</strong><br>${escapeHtml(cleanAccessStatusLabel(t))}</p>
        <p><strong>Dates</strong><br>${escapeHtml(t.accessStartDate || "-")} to ${escapeHtml(t.accessEndDate || "-")}</p>
      </div>

      <div class="access-delivery-panel">
        <div class="delivery-status-card">
          <span>TradingView Access</span>
          <strong class="${accessDeliveryStatusClass(t.tradingViewAccessStatus)}-text">${escapeHtml(accessDeliveryStatusLabel(t.tradingViewAccessStatus))}</strong>
          <small>${escapeHtml(t.tradingViewAccessUpdatedAt || "Not updated yet")}</small>
        </div>
        <div class="delivery-status-card">
          <span>Telegram Group</span>
          <strong class="${accessDeliveryStatusClass(t.telegramAccessStatus)}-text">${escapeHtml(accessDeliveryStatusLabel(t.telegramAccessStatus))}</strong>
          <small>${telegramLinksForTicket(t).length ? `${telegramLinksForTicket(t).length} destination${telegramLinksForTicket(t).length === 1 ? "" : "s"}` : "No invite link"}</small>
        </div>
      </div>

      ${isTrialTicket(t) ? "" : `${t.paymentId ? `<p><strong>Payment ID / UTR:</strong> ${escapeHtml(t.paymentId)}</p>` : ""}${renderAdminEvidence(t.paymentProof, { id: t.id, kind: "access", title: "Payment Proof / Screenshot", subtitle: t.paymentId ? `UTR / Payment ID: ${t.paymentId}` : "Uploaded payment proof screenshot or PDF" })}`}
      ${t.accessType === "trial" ? `
        <div class="trial-feedback-admin-panel">
          <h4>Trial Feedback</h4>
          <p><strong>Status:</strong> ${escapeHtml(t.trialFeedbackStatus || "-")}${t.trialFeedbackRating ? ` · <strong>Rating:</strong> ${escapeHtml(t.trialFeedbackRating)}` : ""}</p>
          ${t.trialFeedbackText ? `<p><strong>Feedback:</strong> ${escapeHtml(t.trialFeedbackText)}</p>` : ""}
          ${renderAdminEvidence(t.trialFeedbackAttachment, { id: t.id, kind: "trial-feedback", title: "Trial Feedback Attachment / Profit Screenshot", subtitle: "Optional user-uploaded feedback proof, result, or screenshot" })}
        </div>` : ""}

      ${t.auditOnly ? `<div class="notice error">Fallback inbox record found, but original ticket record is missing. Ask user to submit again if you need to approve this exact ticket.</div>` : ""}\n      <div class="notice soft">Select Start Date. End Date auto-fills immediately. Set Ticket Status to <strong>Done</strong> when access is granted.</div>

      <div class="form-grid compact-admin-ticket-form">
        <label>Ticket Status
          <select id="status-${escapeAttr(t.id)}" onchange="syncAccessDates('${escapeAttr(t.id)}', '${escapeAttr(t.accessType || "paid")}')">
            <option value="open" ${t.status==="open"?"selected":""}>Open</option>
            <option value="done" ${t.status==="done"?"selected":""}>Done</option>
            <option value="rejected" ${t.status==="rejected"?"selected":""}>Rejected</option>
          </select>
        </label>
        <label>Access Start Date
          <input id="start-${escapeAttr(t.id)}" type="date" value="${escapeAttr(t.accessStartDate || "")}" onchange="syncAccessDates('${escapeAttr(t.id)}', '${escapeAttr(t.accessType || "paid")}')">
        </label>
        <label>Access End Date
          <input id="end-${escapeAttr(t.id)}" type="date" value="${escapeAttr(t.accessEndDate || "")}" readonly>
        </label>
        <div id="date-hint-${escapeAttr(t.id)}" class="date-auto-hint" style="grid-column:1/-1"></div>
        <label style="grid-column:1/-1">Admin Note
          <input id="note-${escapeAttr(t.id)}" value="${escapeAttr(t.adminNote || "")}">
        </label>
      </div>

      <div class="access-ops-panel">
        <div>
          <h4>TradingView Access</h4>
          <select id="tv-status-${escapeAttr(t.id)}">
            <option value="pending" ${String(t.tradingViewAccessStatus || "pending") === "pending" ? "selected" : ""}>Pending</option>
            <option value="given" ${String(t.tradingViewAccessStatus || "") === "given" ? "selected" : ""}>Given</option>
            <option value="removed" ${String(t.tradingViewAccessStatus || "") === "removed" ? "selected" : ""}>Removed</option>
          </select>
          <button class="btn ghost" type="button" onclick="saveTradingViewStatus('${escapeAttr(t.id)}')">Update TradingView</button>
        </div>

        <div>
          <h4>Telegram Groups / Channels</h4>
          <button class="btn ghost" type="button" onclick="generateTelegramInvite('${escapeAttr(t.id)}')">${telegramLinksForTicket(t).length ? "Regenerate / Retry Invites" : "Generate Invites Now"}</button>
          <p class="microcopy">On approval, invite links are generated automatically. Use this only to retry or regenerate.</p>
          ${renderAdminTelegramLinks(t)}
        </div>
      </div>

      <details class="ticket-activity-details">
        <summary>Access Activity Log</summary>
        ${renderTicketActivityLog(t)}
      </details>

      <div class="list-actions">${t.auditOnly ? "" : `<button class="btn primary" onclick="saveAccessTicket(\'${escapeAttr(t.id)}\', \'${escapeAttr(t.accessType || "paid")}\')">Save Ticket</button>`}</div>
    </div>
  `).join("") : `<div class="list-item"><p>No access tickets visible yet. Click Reload Access Tickets. If still empty, the request was not saved in database.</p></div>`;

  items.forEach((t) => syncAccessDates(t.id, t.accessType || "paid"));
}

async function saveAccessTicket(id, accessType = "paid") {
  try {
    syncAccessDates(id, accessType);
    const status = document.getElementById(`status-${id}`).value;
    const start = document.getElementById(`start-${id}`).value;
    const end = document.getElementById(`end-${id}`).value;

    if (status === "done") {
      if (!start || !end) {
        alert("Select Access Start Date. End Date will auto-fill.");
        return;
      }
      if (new Date(`${start}T00:00:00Z`) >= new Date(`${end}T00:00:00Z`)) {
        alert("Access Start Date must be before Access End Date.");
        return;
      }
    }

    const res = await api(`/api/admin/access-tickets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        status,
        accessStartDate: start,
        accessEndDate: end,
        adminNote: document.getElementById(`note-${id}`).value
      })
    });

    successToast("admin_ticket_saved", { message: res.message || "Access ticket changes have been saved successfully." });
    await loadAdmin();
  } catch (e) {
    alert(e.message);
  }
}


async function generateTelegramInvite(id) {
  try {
    const hasExisting = telegramLinksForTicket((data.accessTickets || []).find((t) => t.id === id) || {}).length > 0;
    const res = await api(`/api/admin/access-tickets/${encodeURIComponent(id)}/telegram-invite`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ force: hasExisting })
    });
    successToast("telegram_invite_generated", { title: "Telegram invites ready", message: res.message || "Telegram invite links are ready and sent to user." });
    await loadAdmin();
  } catch (e) {
    errorToast(e);
  }
}

async function saveTelegramStatus(id) {
  try {
    const status = document.getElementById(`tg-status-${id}`)?.value || "pending";
    const res = await api(`/api/admin/access-tickets/${encodeURIComponent(id)}/telegram-status`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ status })
    });
    successToast("telegram_status_saved", { title: "Telegram status updated", message: res.message || "Telegram status updated." });
    await loadAdmin();
  } catch (e) {
    errorToast(e);
  }
}

async function saveTelegramDestinationStatus(id, index) {
  try {
    const status = document.getElementById(`tg-dest-status-${id}-${index}`)?.value || "pending";
    const res = await api(`/api/admin/access-tickets/${encodeURIComponent(id)}/telegram-destination-status`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ index, status })
    });
    successToast("telegram_destination_status_saved", { title: "Telegram destination updated", message: res.message || "Telegram destination status updated." });
    await loadAdmin();
  } catch (e) {
    errorToast(e);
  }
}

async function saveTradingViewStatus(id) {
  try {
    const status = document.getElementById(`tv-status-${id}`)?.value || "pending";
    const res = await api(`/api/admin/access-tickets/${encodeURIComponent(id)}/tradingview-status`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ status })
    });
    successToast("tradingview_status_saved", { title: "TradingView status updated", message: res.message || "TradingView status updated." });
    await loadAdmin();
  } catch (e) {
    errorToast(e);
  }
}


function renderSupportTickets() {
  const box = $("supportTicketsAdmin");
  if (!box) return;
  const items = data.supportTickets || [];
  box.innerHTML = items.length ? items.map((t) => `
    <div class="list-item">
      <h3>${escapeHtml(t.subject || "Support Ticket")} ${approvalBadge(t.status || "open")}</h3>
      <p><strong>Ticket:</strong> ${escapeHtml(t.id)} · <strong>Priority:</strong> ${escapeHtml(t.priority || "-")} · <strong>Category:</strong> ${escapeHtml(t.category || "-")}</p>
      <p><strong>Name:</strong> ${escapeHtml(t.name || "-")} · <strong>Email:</strong> ${escapeHtml(t.email || "-")} · <strong>Phone:</strong> ${escapeHtml(t.phone || "-")}</p>
      <p>${escapeHtml(t.message || "")}</p>
      ${renderAdminEvidence(t.attachment, { id: t.id, kind: "support", title: "Support Attachment", subtitle: "Uploaded support screenshot or PDF" })}
      <div class="form-grid">
        <label>Status
          <select id="support-status-${escapeAttr(t.id)}">
            <option value="open" ${t.status==="open"?"selected":""}>Open</option>
            <option value="done" ${t.status==="done"?"selected":""}>Done</option>
            <option value="rejected" ${t.status==="rejected"?"selected":""}>Rejected</option>
          </select>
        </label>
        <label style="grid-column:1/-1">Admin Reply
          <input id="support-reply-${escapeAttr(t.id)}" value="${escapeAttr(t.adminReply || "")}">
        </label>
      </div>
      <div class="list-actions"><button class="btn ghost" onclick="saveSupportTicket('${escapeAttr(t.id)}')">Save Support</button></div>
    </div>
  `).join("") : `<div class="list-item"><p>No support tickets yet.</p></div>`;
}
async function saveSupportTicket(id) {
  try {
    await api(`/api/admin/support-tickets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        status: document.getElementById(`support-status-${id}`).value,
        adminReply: document.getElementById(`support-reply-${id}`).value
      })
    });
    successToast("admin_support_saved");
    await loadAdmin();
  } catch (e) {
    errorToast(e);
  }
}

async function testAdminNotification() {
  try {
    const res = await api("/api/admin/test-notification", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({})
    });
    successToast("admin_notification_test", { message: res.message || "Admin notification test completed successfully." });
    await loadAdmin();
  } catch (e) {
    errorToast(e);
  }
}

function renderNotifications() {
  const box = $("notificationsAdmin");
  if (!box) return;
  const items = data.notifications || [];

  box.innerHTML = items.length ? items.map((n) => `
    <div class="list-item notification-admin-card ${n.readAt ? "is-read" : "is-unread"}">
      <div class="notification-card-head">
        <h3>${escapeHtml(n.title || "Notification")} ${n.readAt ? "" : `<span class="status open">Unread</span>`}</h3>
        ${n.readAt ? "" : `<button class="btn ghost mini-action-btn" type="button" onclick="markAdminNotificationRead('${escapeAttr(n.id)}')">Mark read</button>`}
      </div>
      <p>${escapeHtml(n.message || "")}</p>
      <div class="admin-summary-grid">
        <p><strong>Type</strong><br>${escapeHtml(n.type || "-")}</p>
        <p><strong>Email To</strong><br>${escapeHtml(n.email || "-")}</p>
        <p><strong>Email Status</strong><br>${escapeHtml(n.emailStatus || "skipped")}</p>
        <p><strong>Created</strong><br>${escapeHtml(n.createdAt || "-")}</p>
      </div>
      ${n.emailError ? `<div class="notice error">${escapeHtml(n.emailError)}</div>` : ""}
    </div>
  `).join("") : `<div class="list-item"><p>No admin notifications yet.</p></div>`;
}

function renderMonthlyReports() {
  const box = $("monthlyReportBox");
  if (!box) return;
  const items = data.monthlyReports || [];
  box.innerHTML = items.length ? `
    <h3>Saved Reports</h3>
    ${items.slice(0, 8).map((r) => `<div class="list-item"><strong>${escapeHtml(r.month || "-")}</strong> · ${escapeHtml(r.totalOnboarded || 0)} onboarded · ${escapeHtml(r.generatedAt || "-")}</div>`).join("")}
  ` : `<div class="notice soft">No saved reports yet.</div>`;
}
async function previewMonthlyReport() {
  const month = $("monthlyReportForm")?.month?.value || "";
  const res = await api(`/api/admin/monthly-report?month=${encodeURIComponent(month)}`, { headers: authHeaders() });
  $("monthlyReportBox").innerHTML = `<div class="notice soft"><strong>${escapeHtml(res.report.month)}</strong>: ${escapeHtml(res.report.totalOnboarded)} onboarded users.</div>`;
}
async function generateMonthlyReport() {
  const month = $("monthlyReportForm")?.month?.value || "";
  const res = await api("/api/admin/monthly-report/generate", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ month })
  });
  successToast("admin_report_generated", { message: res.message || "Monthly report has been generated successfully." });
  await loadAdmin();
}
function downloadMonthlyReport() {
  const month = $("monthlyReportForm")?.month?.value || "";
  window.open(`/api/admin/monthly-report/download?month=${encodeURIComponent(month)}&token=${encodeURIComponent(token)}`, "_blank");
}

function renderReviews() {
  const box = $("reviewsAdmin");
  if (!box) return;
  const items = data.reviews || [];
  box.innerHTML = items.length ? items.map((r) => `
    <div class="list-item">
      <h3>${escapeHtml(r.name || "Review")} ${approvalBadge(r.status)}</h3>
      <p><strong>Rating:</strong> ${escapeHtml(r.rating || "-")} · <strong>Role:</strong> ${escapeHtml(r.role || "-")}</p>
      <p>${escapeHtml(r.text || "")}</p>
      <div class="list-actions">
        <button class="btn ghost" onclick="updateReview('${escapeAttr(r.id)}','approved')">Approve</button>
        <button class="btn ghost" onclick="updateReview('${escapeAttr(r.id)}','rejected')">Reject</button>
        <button class="btn ghost" onclick="deleteReview('${escapeAttr(r.id)}')">Delete</button>
      </div>
    </div>
  `).join("") : `<div class="list-item"><p>No reviews yet.</p></div>`;
}
async function updateReview(id, status) {
  try {
    await api(`/api/admin/reviews/${encodeURIComponent(id)}`, { method: "PATCH", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ status }) });
    successToast("admin_review_updated", { message: status === "approved" ? "Review approved successfully." : "Review rejected successfully." });
    await loadAdmin();
  } catch (e) { errorToast(e); }
}
async function deleteReview(id) {
  if (!confirm("Delete review?")) return;
  try {
    await api(`/api/admin/reviews/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeaders() });
    successToast("admin_review_deleted");
    await loadAdmin();
  } catch (e) { errorToast(e); }
}

function renderProfits() {
  const box = $("profitsAdmin");
  if (!box) return;
  const items = data.profits || [];
  box.innerHTML = items.length ? items.map((p) => `
    <div class="list-item">
      <h3>${escapeHtml(p.title || "Profit")} ${approvalBadge(p.status)}</h3>
      <p><strong>Name:</strong> ${escapeHtml(p.name || "-")} · <strong>Date:</strong> ${escapeHtml(p.date || "-")}</p>
      <p>${escapeHtml(p.caption || "")}</p>
      ${p.image ? renderAdminEvidence(p.image, { id: "", kind: "profit", title: "Profit / Result Screenshot", subtitle: "Uploaded result evidence screenshot" }) : ""}
      <div class="list-actions">
        <button class="btn ghost" onclick="updateProfit('${escapeAttr(p.id)}','approved')">Approve</button>
        <button class="btn ghost" onclick="updateProfit('${escapeAttr(p.id)}','rejected')">Reject</button>
        <button class="btn ghost" onclick="deleteProfit('${escapeAttr(p.id)}')">Delete</button>
      </div>
    </div>
  `).join("") : `<div class="list-item"><p>No profit screenshots yet.</p></div>`;
}
async function updateProfit(id, status) {
  try {
    await api(`/api/admin/profits/${encodeURIComponent(id)}`, { method: "PATCH", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ status }) });
    successToast("admin_profit_updated", { message: status === "approved" ? "Profit/result approved successfully." : "Profit/result rejected successfully." });
    await loadAdmin();
  } catch (e) { errorToast(e); }
}
async function deleteProfit(id) {
  if (!confirm("Delete profit item?")) return;
  try {
    await api(`/api/admin/profits/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeaders() });
    successToast("admin_profit_deleted");
    await loadAdmin();
  } catch (e) { errorToast(e); }
}


async function verifyPublicProductsAfterSave(expected = null) {
  try {
    const res = await fetch(`/api/public/products?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    });
    const json = await res.json();

    if (expected && json.products) {
      const item = json.products.find((p) => String(p.id) === String(expected.id));
      json.synced = !!item &&
        item.name === expected.name &&
        item.tag === expected.tag &&
        item.description === expected.description &&
        JSON.stringify(item.features || []) === JSON.stringify(expected.features || []);
    }

    console.log("[Admin verified public products]", json);
    return json;
  } catch (e) {
    console.warn("[Admin verify public products failed]", e.message);
    return null;
  }
}

function renderProducts() {
  const box = $("productsAdmin");
  if (!box) return;
  const items = data.products || [];
  box.innerHTML = items.map((prod) => `
    <form class="list-item form-grid product-edit-form" data-id="${escapeAttr(prod.id)}">
      ${input("name", prod.name, "Indicator Name")}
      ${input("tag", prod.tag, "Tag")}
      ${textarea("description", prod.description, "Description")}
      ${textarea("features", (prod.features || []).join("\n"), "Features - one per line")}
      <button class="btn primary" type="submit">Save Indicator</button>
    </form>
  `).join("");
  document.querySelectorAll(".product-edit-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = asFormData(form);
      const expected = {
        id: form.dataset.id,
        name: String(body.name || "").trim(),
        tag: String(body.tag || "").trim(),
        description: String(body.description || "").trim(),
        features: String(body.features || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
      };

      const res = await api(`/api/admin/products/${encodeURIComponent(form.dataset.id)}`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body)
      });

      const publicCheck = await verifyPublicProductsAfterSave(expected);
      localStorage.setItem("whalex_products_updated_at", String(Date.now()));

      if (res.synced && publicCheck?.synced !== false) {
        successToast("admin_indicator_saved", {
          message: "Indicator details saved and synced to the user portal."
        });
      } else {
        errorToast(new Error("Indicator saved, but user portal sync verification failed. Please open /api/public/products and check the product data."));
      }

      await loadAdmin();
    });
  });
}

function renderPricing() {
  const box = $("pricingForm");
  if (!box) return;
  const p = data.pricing || {};
  box.innerHTML = [
    `<div class="admin-form-section-title">Current Live Plan</div>`,
    input("planName", p.planName, "Plan Name"),
    input("oldPrice", p.oldPrice, "Old Price"),
    input("currentPrice", p.currentPrice, "Current Monthly Price"),
    input("discountText", p.discountText, "Discount Text"),
    input("monthlyLabel", p.monthlyLabel || "Monthly Access", "Monthly Label"),
    input("monthlyDays", p.monthlyDays || "30", "Monthly Days", "number"),
    `<label>Monthly Enabled<select name="monthlyEnabled"><option value="true" ${String(p.monthlyEnabled ?? "true") === "true" ? "selected" : ""}>Enabled</option><option value="false" ${String(p.monthlyEnabled) === "false" ? "selected" : ""}>Disabled</option></select></label>`,
    `<div class="admin-form-section-title">Trial Plan</div>`,
    input("trialLabel", p.trialLabel || "3-Day Trial Access", "Trial Label"),
    input("trialDays", p.trialDays || "3", "Trial Days", "number"),
    `<label>Trial Enabled<select name="trialEnabled"><option value="true" ${String(p.trialEnabled ?? "true") === "true" ? "selected" : ""}>Enabled</option><option value="false" ${String(p.trialEnabled) === "false" ? "selected" : ""}>Disabled</option></select></label>`,
    `<div class="admin-form-section-title">Future Plans — Ready, hidden until enabled</div>`,
    input("quarterlyLabel", p.quarterlyLabel || "Quarterly Access", "Quarterly Label"),
    input("quarterlyDays", p.quarterlyDays || "90", "Quarterly Days", "number"),
    input("quarterlyPrice", p.quarterlyPrice || "", "Quarterly Price"),
    `<label>Quarterly Enabled<select name="quarterlyEnabled"><option value="false" ${String(p.quarterlyEnabled ?? "false") !== "true" ? "selected" : ""}>Disabled</option><option value="true" ${String(p.quarterlyEnabled) === "true" ? "selected" : ""}>Enabled</option></select></label>`,
    input("halfYearlyLabel", p.halfYearlyLabel || "Half Yearly Access", "Half Yearly Label"),
    input("halfYearlyDays", p.halfYearlyDays || "180", "Half Yearly Days", "number"),
    input("halfYearlyPrice", p.halfYearlyPrice || "", "Half Yearly Price"),
    `<label>Half Yearly Enabled<select name="halfYearlyEnabled"><option value="false" ${String(p.halfYearlyEnabled ?? "false") !== "true" ? "selected" : ""}>Disabled</option><option value="true" ${String(p.halfYearlyEnabled) === "true" ? "selected" : ""}>Enabled</option></select></label>`,
    input("yearlyLabel", p.yearlyLabel || "Yearly Access", "Yearly Label"),
    input("yearlyDays", p.yearlyDays || "365", "Yearly Days", "number"),
    input("yearlyPrice", p.yearlyPrice || "", "Yearly Price"),
    `<label>Yearly Enabled<select name="yearlyEnabled"><option value="false" ${String(p.yearlyEnabled ?? "false") !== "true" ? "selected" : ""}>Disabled</option><option value="true" ${String(p.yearlyEnabled) === "true" ? "selected" : ""}>Enabled</option></select></label>`,
    `<button class="btn primary" type="submit">Save Pricing</button>`
  ].join("");
}

function renderSettings() {
  const box = $("settingsForm");
  if (!box) return;
  const s = data.settings || {};
  box.innerHTML = [
    `<div class="admin-form-section-title">Payment Settings</div>`,
    input("upiId", s.upiId, "UPI ID"),
    input("upiPayeeName", s.upiPayeeName || s.brandName || "WhaleX", "UPI Payee Name"),
    input("razorpayLink", s.razorpayLink, "Razorpay Link / Payment Link"),
    `<div class="payment-preview-card">
      <strong>Live QR Preview</strong>
      <span>Generated automatically from UPI ID + price.</span>
      <img src="/api/payment/upi-qr.svg?t=${Date.now()}" alt="UPI QR Preview" />
    </div>`,
    `<div class="admin-form-section-title">Notification Channels</div>`,
    `<label>Email Notifications<select name="notificationEmailEnabled"><option value="true" ${String(s.notificationEmailEnabled ?? "true") !== "false" ? "selected" : ""}>Enabled</option><option value="false" ${String(s.notificationEmailEnabled) === "false" ? "selected" : ""}>Disabled</option></select></label>`,
    `<label>WhatsApp Notifications<select name="notificationWhatsappEnabled"><option value="false" ${String(s.notificationWhatsappEnabled ?? "false") !== "true" ? "selected" : ""}>Disabled</option><option value="true" ${String(s.notificationWhatsappEnabled) === "true" ? "selected" : ""}>Enabled</option></select></label>`,
    input("whatsappProvider", s.whatsappProvider || "", "WhatsApp Provider / Notes"),
    input("whatsappAdminPhone", s.whatsappAdminPhone || "", "WhatsApp Admin Phone"),
    `<label>Telegram Notifications<select name="notificationTelegramEnabled"><option value="false" ${String(s.notificationTelegramEnabled ?? "false") !== "true" ? "selected" : ""}>Disabled</option><option value="true" ${String(s.notificationTelegramEnabled) === "true" ? "selected" : ""}>Enabled</option></select></label>`,
    input("telegramBotToken", s.telegramBotToken || "", "Telegram Bot Token"),
    textarea("telegramDestinations", s.telegramDestinations || "", "Telegram Destinations — one per line: Name | Chat ID / @channel | Bot Token | enabled"),
    input("telegramGroupChatId", s.telegramGroupChatId || "", "Fallback Single Telegram Group / Chat ID"),
    input("telegramInviteExpireHours", s.telegramInviteExpireHours || "24", "Telegram Invite Expiry Hours", "number"),
    `<div class="notice soft" style="grid-column:1/-1">Multiple Telegram destinations format: WhaleX Main Group | -1001234567890 | 123456:ABC_BOT_TOKEN | enabled. If all groups use the same bot, leave per-line bot token blank and use the global Telegram Bot Token as fallback. Add each bot as admin in its own group/channel and give invite-link permission.</div>`,
    `<div class="admin-form-section-title">Website Settings</div>`,
    input("brandName", s.brandName, "Brand Name"),
    input("supportEmail", s.supportEmail, "Support Email"),
    input("telegramLink", s.telegramLink, "Telegram Link"),
    textarea("heroTitle", s.heroTitle, "Hero Title"),
    textarea("heroSubtitle", s.heroSubtitle, "Hero Subtitle"),
    `<button class="btn primary" type="submit">Save Settings</button>`
  ].join("");
}

function renderVideos() {
  const box = $("videosAdmin");
  if (!box) return;
  const items = data.videos || [];
  box.innerHTML = items.length ? items.map((v) => `
    <div class="list-item">
      <h3>${escapeHtml(v.title || "Video")} ${approvalBadge(v.status)}</h3>
      <p><strong>YouTube ID:</strong> ${escapeHtml(v.youtubeId || "-")}</p>
      <p>${escapeHtml(v.description || "")}</p>
      <div class="list-actions">
        <button class="btn ghost" onclick="updateVideo('${escapeAttr(v.id)}','approved')">Approve</button>
        <button class="btn ghost" onclick="updateVideo('${escapeAttr(v.id)}','rejected')">Reject</button>
        <button class="btn ghost" onclick="deleteVideo('${escapeAttr(v.id)}')">Delete</button>
      </div>
    </div>
  `).join("") : `<div class="list-item"><p>No videos yet.</p></div>`;
}
async function updateVideo(id, status) {
  try {
    await api(`/api/admin/videos/${encodeURIComponent(id)}`, { method: "PATCH", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ status }) });
    successToast("admin_video_updated", { message: status === "approved" ? "Video approved successfully." : "Video rejected successfully." });
    await loadAdmin();
  } catch (e) { errorToast(e); }
}
async function deleteVideo(id) {
  if (!confirm("Delete video?")) return;
  try {
    await api(`/api/admin/videos/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeaders() });
    successToast("admin_video_deleted");
    await loadAdmin();
  } catch (e) { errorToast(e); }
}

document.addEventListener("DOMContentLoaded", () => {
  showApp();

  $("loginBtn")?.addEventListener("click", async () => {
    try {
      const res = await api("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: $("adminPassword").value })
      });
      token = res.token;
      localStorage.setItem("whalex_admin_token", token);
      showMsg("loginMsg", "");
      successToast("login_success", { title: "Admin login successful", message: "Welcome back to WhaleX Admin." });
      await loadAdmin();
    } catch (e) {
      showMsg("loginMsg", e.message, true);
    }
  });

  $("logoutBtn")?.addEventListener("click", async () => {
    try {
      await api("/api/admin/logout", { method: "POST", headers: authHeaders() });
    } catch (_) {}
    localStorage.removeItem("whalex_admin_token");
    token = "";
    showApp();
  });

  $("refreshBtn")?.addEventListener("click", async () => {
    await loadAdmin();
    successToast("admin_data_refreshed");
  });

  $("pricingForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/admin/pricing", {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(asFormData(e.target))
      });
      successToast("admin_pricing_saved");
      await loadAdmin();
    } catch (err) { errorToast(err); }
  });

  $("settingsForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(asFormData(e.target))
      });
      successToast("admin_settings_saved");
      await loadAdmin();
    } catch (err) { errorToast(err); }
  });

  $("addReviewForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/admin/reviews", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(asFormData(e.target))
      });
      e.target.reset();
      successToast("admin_review_added");
      await loadAdmin();
    } catch (err) { errorToast(err); }
  });

  $("addProfitForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/admin/profits", {
        method: "POST",
        headers: authHeaders(),
        body: new FormData(e.target)
      });
      e.target.reset();
      successToast("admin_profit_added");
      await loadAdmin();
    } catch (err) { errorToast(err); }
  });

  $("addVideoForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/admin/videos", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(asFormData(e.target))
      });
      e.target.reset();
      successToast("admin_video_added");
      await loadAdmin();
    } catch (err) { errorToast(err); }
  });

  $("monthlyReportForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await previewMonthlyReport();
  });
  $("generateReportBtn")?.addEventListener("click", generateMonthlyReport);
  $("downloadReportBtn")?.addEventListener("click", downloadMonthlyReport);

  loadAdmin();
});
