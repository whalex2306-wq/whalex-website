let currentUser = null;
let userToken = localStorage.getItem("whalex_user_token") || "";
let currentOpenRequest = null;
let myAccessTickets = [];
let accessPublicData = null;
let accessPublicDataLoadStarted = false;
let duplicateInfoTimer = null;
let feedbackPopupCurrentTicket = null;

function msg(id, text, isError=false) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="notice ${isError ? "error" : ""}">${text}</div>`;
}
function userHeaders(extra = {}) {
  return userToken ? { ...extra, Authorization: `Bearer ${userToken}` } : extra;
}
function statusLabel(value) {
  const raw = String(value || "-").toLowerCase();
  if (raw === "open") return "Open";
  if (raw === "done") return "Done";
  if (raw === "rejected") return "Rejected";
  if (raw === "not_granted") return "Verification Pending";
  const label = String(value || "-").replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function statusClass(value) {
  const v = String(value || "").toLowerCase();
  if (v === "rejected") return "status-red";
  if (v === "done") return "status-green";
  if (v === "open") return "status-orange";
  return "status-neutral";
}
function overallStatusClass(ticket) {
  const v = String(ticket?.status || "").toLowerCase();
  if (v === "rejected") return "status-red";
  if (v === "done") return "status-green";
  if (v === "open") return "status-orange";
  return "status-neutral";
}

function accessStatusLabel(ticket) {
  const requestStatus = String(ticket?.status || "").toLowerCase();
  const accessStatus = String(ticket?.accessStatus || "").toLowerCase();

  if (requestStatus === "rejected") return "Rejected";
  if (accessStatus === "granted") return "Granted";
  if (accessStatus === "expired") return "Expired";
  if (accessStatus === "blocked") return "Blocked";
  if (accessStatus === "not_granted" || requestStatus === "open") return "Verification Pending";

  return statusLabel(ticket?.accessStatus || ticket?.status || "open");
}

function requestTypeTitle(ticket) {
  return ticket?.accessType === "trial" ? "3-Day Trial Request" : "Paid Access Request";
}

function accessWaitMessage(ticket) {
  if (!ticket) return "Your request is under verification.";
  const requestStatus = String(ticket.status || "").toLowerCase();

  if (requestStatus === "rejected") return "Your request was rejected. Please check the WhaleX note or contact support.";
  if (ticket.accessStatus === "granted") return "Your WhaleX access is active.";
  if (ticket.accessType === "trial") return "Trial request submitted. WhaleX will verify and activate trial access within 48 hours.";
  if (ticket.paymentStatus === "pending") return "Payment verification is pending. WhaleX will grant access after verification.";
  return "Your access request is under verification.";
}
function isPendingRequest(ticket) {
  return String(ticket?.status || "").toLowerCase() === "open";
}
function ticketDropdownLabel(ticket) {
  if (!ticket) return "";
  const type = ticket.accessType === "trial" ? "3-Day Trial Request" : "Paid Access Request";
  const status = statusLabel(ticket.status || "open");
  const idTail = String(ticket.id || "").slice(-8);
  return `${type} · ${status} · ${idTail}`;
}

function fillTrackerDropdown(tickets = []) {
  const select = document.getElementById("accessRequestSelect");
  if (!select) return;

  const previous = select.value;
  select.innerHTML = `<option value="">Select your request</option>`;

  tickets.forEach((ticket) => {
    const option = document.createElement("option");
    option.value = ticket.id;
    option.textContent = ticketDropdownLabel(ticket);
    select.appendChild(option);
  });

  if (previous && tickets.some((t) => t.id === previous)) {
    select.value = previous;
  } else if (tickets.length === 1) {
    select.value = tickets[0].id;
  }
}

function clearTrackerStatus() {
  const box = document.getElementById("accessStatusBox");
  if (box) box.innerHTML = "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[m]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}


function isPdfEvidence(url = "") {
  const u = String(url || "").toLowerCase().split("?")[0];
  return u.endsWith(".pdf") || u.includes("/raw/upload/");
}

function renderUserEvidence(url, title = "Payment Proof") {
  if (!url) return "";

  const pdf = isPdfEvidence(url);
  return `<div class="user-evidence-panel">
    <div class="user-evidence-head">
      <div>
        <span>Evidence</span>
        <strong>${escapeHtml(title)}</strong>
      </div>
      <div class="evidence-actions">
        <a class="btn ghost mini-action-btn" href="${escapeAttr(url)}" target="_blank" rel="noopener">Open</a>
        <a class="btn primary mini-action-btn" href="${escapeAttr(url)}" download>Download</a>
      </div>
    </div>
    <div class="user-evidence-preview ${pdf ? "pdf-evidence" : ""}">
      ${pdf
        ? `<div class="pdf-preview-icon">PDF</div>`
        : `<img src="${escapeAttr(url)}" alt="${escapeAttr(title)}" loading="lazy" onerror="this.style.display='none'; this.closest('.user-evidence-preview')?.classList.add('file-only');">`}
      <small>${pdf ? "PDF proof uploaded." : "Payment proof screenshot uploaded."}</small>
    </div>
  </div>`;
}


function renderUserEvidenceSafe(url, title = "Payment Proof") {
  try {
    return renderUserEvidence(url, title);
  } catch (e) {
    console.warn("[Evidence render skipped]", e.message);
    return "";
  }
}


function accessTypeDisplayLabel(ticket) {
  const raw = String(ticket?.accessType || ticket?.plan || "").toLowerCase();
  if (raw.includes("trial")) return "3-Day Trial Access";
  return ticket?.plan || "WhaleX V1 Access";
}

function paymentIdDisplay(ticket) {
  return String(ticket?.paymentId || ticket?.utr || ticket?.transactionId || "").trim() || "-";
}

function isTrialTicket(ticket) {
  return String(ticket?.accessType || ticket?.plan || "").toLowerCase().includes("trial");
}

function renderRequestCard(ticket, options = {}) {
  if (!ticket) return "";

  const title = requestTypeTitle(ticket);
  const feedbackLine = ticket.accessType === "trial"
    ? `<div><span>Trial Feedback</span><strong>${escapeHtml(statusLabel(ticket.trialFeedbackStatus))}${ticket.trialFeedbackDueDate ? ` · Due ${escapeHtml(ticket.trialFeedbackDueDate)}` : ""}</strong></div>`
    : "";

  const successBanner = options.submitted
    ? `<div class="access-success-banner compact-success">
        <strong>Request submitted successfully.</strong>
        <span>${escapeHtml(accessWaitMessage(ticket))}</span>
      </div>`
    : "";

  return `<article class="access-request-card">
    ${successBanner}
    <div class="request-card-head">
      <div>
        <span class="request-type">${escapeHtml(title)}</span>
        <h3 class="${overallStatusClass(ticket)}-text">${escapeHtml(accessStatusLabel(ticket))}</h3>
      </div>
      <span class="status-pill ${overallStatusClass(ticket)}">${escapeHtml(statusLabel(ticket.status))}</span>
    </div>

    <div class="request-detail-grid">
      <div><span>Ticket ID</span><strong>${escapeHtml(ticket.id)}</strong></div>
      <div><span>Access Type</span><strong>${escapeHtml(accessTypeDisplayLabel(ticket))}</strong></div>
      ${isTrialTicket(ticket) ? "" : `<div><span>Payment</span><strong class="${statusClass(ticket.paymentStatus)}-text">${escapeHtml(statusLabel(ticket.paymentStatus))}</strong></div>`}
      ${isTrialTicket(ticket) ? "" : `<div><span>Payment ID / UTR</span><strong>${escapeHtml(paymentIdDisplay(ticket))}</strong></div>`}
      <div><span>TradingView</span><strong>${escapeHtml(ticket.tradingViewUsername || "-")}</strong></div>
      <div><span>Telegram</span><strong>${escapeHtml(ticket.telegramId || "-")}</strong></div>
      <div><span>TradingView Access</span><strong class="${accessDeliveryStatusClass(ticket.tradingViewAccessStatus)}-text">${escapeHtml(accessDeliveryStatusLabel(ticket.tradingViewAccessStatus))}</strong></div>
      <div><span>Telegram Groups / Channels</span><strong class="${accessDeliveryStatusClass(ticket.telegramAccessStatus)}-text">${escapeHtml(accessDeliveryStatusLabel(ticket.telegramAccessStatus))}</strong>${telegramInviteButton(ticket)}</div>
      <div><span>Start Date</span><strong>${escapeHtml(ticket.accessStartDate || "-")}</strong></div>
      <div><span>End Date</span><strong>${escapeHtml(ticket.accessEndDate || "-")}</strong></div>
      ${feedbackLine}
    </div>

    ${isTrialTicket(ticket) ? "" : renderUserEvidenceSafe(ticket.paymentProof, "Payment Proof / Screenshot")}
    <div class="notice soft">${escapeHtml(accessWaitMessage(ticket))}</div>
    ${ticket.trialFeedbackAttachment ? `<p><strong>Feedback Attachment:</strong> <a href="${escapeHtml(ticket.trialFeedbackAttachment)}" target="_blank" rel="noopener">Open uploaded attachment</a></p>` : ""}
    ${ticket.adminNote ? `<p class="admin-note"><strong>WhaleX Note:</strong> ${escapeHtml(ticket.adminNote)}</p>` : ""}
    ${renderUserActivityLog(ticket)}
  </article>`;
}
function renderTicket(ticket, options = {}) {
  return renderRequestCard(ticket, options);
}
function setFormValues(form, user) {
  if (!form || !user) return;
  ["name", "email", "phone", "telegramId", "tradingViewUsername"].forEach((key) => {
    if (form.elements[key]) form.elements[key].value = user[key] || "";
  });
}

function setMissingFormValues(form, user) {
  if (!form || !user) return;
  ["name", "email", "phone", "telegramId", "tradingViewUsername"].forEach((key) => {
    if (form.elements[key] && !String(form.elements[key].value || "").trim()) {
      form.elements[key].value = user[key] || "";
    }
  });
}

function applyPlanIntentFromUrl() {
  const select = document.getElementById("accessPlan");
  if (!select) return;

  const url = new URL(window.location.href);
  const plan = String(url.searchParams.get("plan") || "").toLowerCase();
  const hash = String(window.location.hash || "").toLowerCase();

  if (plan === "trial" || hash.includes("trial")) {
    select.value = "3-Day Trial Access";
    setTimeout(() => {
      document.getElementById("access")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  }

  if (plan === "paid") {
    select.value = "WhaleX V1 Access";
  }
}

function fillAllUserForms() {
  if (!currentUser) return;
  setFormValues(document.getElementById("accessTicketForm"), currentUser);

  const checkEmail = document.querySelector('#checkAccessForm input[name="email"]');
  if (checkEmail) checkEmail.value = currentUser.email || "";

  const feedbackEmail = document.querySelector('#trialFeedbackForm input[name="email"]');
  if (feedbackEmail) feedbackEmail.value = currentUser.email || "";

  const dueTicket = findDueTrialFeedbackTicket(myAccessTickets || []);
  const feedbackTicketId = document.querySelector('#trialFeedbackForm input[name="ticketId"]');
  if (feedbackTicketId && dueTicket) feedbackTicketId.value = dueTicket.id || "";
}
function autoFillStatusCheck(ticket) {
  if (!ticket) return;
  const select = document.getElementById("accessRequestSelect");
  if (select) select.value = ticket.id || "";
}
function saveLatestTicket(ticket) {
  if (!ticket) return;
  localStorage.setItem("whalex_latest_access_ticket", JSON.stringify({
    id: ticket.id,
    email: ticket.email,
    savedAt: new Date().toISOString()
  }));
}
function restoreLatestTicketHint() {
  // Tracker now uses logged-in user's request dropdown.
}

function accessDateValue(ticket, key) {
  return String(ticket?.[key] || "").slice(0, 10);
}

function parseAccessDate(value) {
  const text = String(value || "").slice(0, 10);
  if (!text) return null;
  const d = new Date(`${text}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysRemaining(endDateValue) {
  const end = parseAccessDate(endDateValue);
  if (!end) return null;
  return Math.ceil((end.getTime() - todayMidnight().getTime()) / 86400000);
}

function activeAccessTickets(tickets = []) {
  return [...(tickets || [])]
    .filter((ticket) => {
      const status = String(ticket?.status || "").toLowerCase();
      const accessStatus = String(ticket?.accessStatus || "").toLowerCase();
      const end = ticket?.accessEndDate || ticket?.endDate || "";
      const remaining = daysRemaining(end);

      return status === "done" &&
        accessStatus === "granted" &&
        (remaining === null || remaining >= 0);
    })
    .sort((a, b) => {
      const aEnd = String(a.accessEndDate || a.endDate || "");
      const bEnd = String(b.accessEndDate || b.endDate || "");
      return bEnd.localeCompare(aEnd);
    });
}

function latestAccessTicket(tickets = []) {
  return [...(tickets || [])]
    .filter((ticket) => String(ticket?.status || "").toLowerCase() === "done")
    .sort((a, b) => String(b.accessEndDate || b.endDate || b.updatedAt || b.createdAt || "").localeCompare(String(a.accessEndDate || a.endDate || a.updatedAt || a.createdAt || "")))[0] || null;
}

function remainingLabel(ticket) {
  const end = ticket?.accessEndDate || ticket?.endDate || "";
  const remaining = daysRemaining(end);

  if (remaining === null) return "End date not available";
  if (remaining < 0) return `Expired ${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? "" : "s"} ago`;
  if (remaining === 0) return "Expires today";
  if (remaining === 1) return "1 day remaining";
  return `${remaining} days remaining`;
}

function activeAccessStatusClass(ticket) {
  const remaining = daysRemaining(ticket?.accessEndDate || ticket?.endDate || "");
  if (remaining === null) return "neutral";
  if (remaining < 0) return "danger";
  if (remaining <= 2) return "warning";
  return "success";
}

function activeAccessSummaryLine(ticket) {
  const type = accessTypeDisplayLabel(ticket);
  const end = ticket?.accessEndDate || ticket?.endDate || "-";
  const remaining = remainingLabel(ticket);
  return `${type} · Ends ${end} · ${remaining}`;
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

function telegramLinksForUser(ticket = {}) {
  const links = Array.isArray(ticket.telegramInviteLinks) ? ticket.telegramInviteLinks : [];
  if (links.length) return links.filter((item) => item.inviteLink);
  if (ticket.telegramInviteLink) {
    return [{ name: "Telegram Group", inviteLink: ticket.telegramInviteLink, status: ticket.telegramAccessStatus || "invite_generated" }];
  }
  return [];
}

function telegramInviteButton(ticket) {
  const links = telegramLinksForUser(ticket);
  if (!links.length) return "";
  if (links.length === 1) {
    return `<a class="btn ghost mini-link-btn" href="${escapeHtml(links[0].inviteLink)}" target="_blank" rel="noopener">Open ${escapeHtml(links[0].name || "Telegram Invite")}</a>`;
  }
  return `
    <div class="user-telegram-links">
      ${links.map((item) => `<a class="btn ghost mini-link-btn" href="${escapeHtml(item.inviteLink)}" target="_blank" rel="noopener">${escapeHtml(item.name || "Telegram")}</a>`).join("")}
    </div>
  `;
}

function renderUserActivityLog(ticket) {
  const log = Array.isArray(ticket?.activityLog) ? ticket.activityLog.slice(0, 4) : [];
  if (!log.length) return "";
  return `
    <details class="ticket-activity-details user-activity-details">
      <summary>Access Activity</summary>
      <div class="ticket-activity-log">
        ${log.map((item) => `
          <div class="ticket-activity-row">
            <strong>${escapeHtml(item.message || item.action || "Activity")}</strong>
            <span>${escapeHtml(item.at || "-")}</span>
          </div>
        `).join("")}
      </div>
    </details>
  `;
}

function renderActiveAccessDashboard(tickets = []) {
  const section = document.getElementById("activeAccessDashboard");
  const box = document.getElementById("activeAccessDashboardBox");
  if (!box) return;

  if (!currentUser) {
    if (section) section.style.display = "none";
    box.innerHTML = "";
    return;
  }

  if (section) section.style.display = "block";

  const activeTickets = activeAccessTickets(tickets);
  const active = activeTickets[0];
  const pendingTickets = [...(tickets || [])].filter(isPendingRequest);
  const rejectedTickets = [...(tickets || [])].filter((ticket) => String(ticket?.status || "").toLowerCase() === "rejected");
  const latest = latestAccessTicket(tickets);
  const totalRequests = (tickets || []).length;

  const pendingSummary = pendingTickets.length
    ? `${pendingTickets.length} request${pendingTickets.length === 1 ? "" : "s"} pending`
    : "No pending request";

  const activeDays = active ? remainingLabel(active) : "No active access";
  const statusText = active ? "Active" : (latest ? accessStatusLabel(latest) : "Inactive");
  const accessType = active ? accessTypeDisplayLabel(active) : (latest ? accessTypeDisplayLabel(latest) : "-");

  const summaryCards = `
    <div class="dashboard-grid user-dashboard-grid">
      <div class="dashboard-metric tone-${active ? activeAccessStatusClass(active) : "neutral"}">
        <strong>${escapeHtml(statusText)}</strong>
        <span>Current Access</span>
        <small>${escapeHtml(activeDays)}</small>
      </div>
      <div class="dashboard-metric tone-info">
        <strong>${escapeHtml(accessType)}</strong>
        <span>Access Type</span>
        <small>${escapeHtml(active ? `Ends ${active.accessEndDate || active.endDate || "-"}` : "Use access request below")}</small>
      </div>
      <div class="dashboard-metric tone-${pendingTickets.length ? "warning" : "success"}">
        <strong>${escapeHtml(pendingTickets.length)}</strong>
        <span>Pending Requests</span>
        <small>${escapeHtml(pendingSummary)}</small>
      </div>
      <div class="dashboard-metric tone-neutral">
        <strong>${escapeHtml(totalRequests)}</strong>
        <span>Total Requests</span>
        <small>${escapeHtml(rejectedTickets.length ? `${rejectedTickets.length} rejected` : "Access history below")}</small>
      </div>
    </div>
  `;

  if (active) {
    const statusClass = activeAccessStatusClass(active);
    const extraActive = activeTickets.length > 1
      ? `<div class="active-access-extra">You have ${activeTickets.length} active accesses. Showing the latest access ending date.</div>`
      : "";

    box.innerHTML = `
      ${summaryCards}
      <article class="active-access-card active-${statusClass}">
        <div class="active-access-head">
          <div>
            <span class="request-type">${escapeHtml(accessTypeDisplayLabel(active))}</span>
            <h3>${escapeHtml(remainingLabel(active))}</h3>
            <p>${escapeHtml(activeAccessSummaryLine(active))}</p>
          </div>
          <span class="status-pill success">Active</span>
        </div>

        <div class="request-detail-grid active-access-grid">
          <div><span>Ticket ID</span><strong>${escapeHtml(active.id || "-")}</strong></div>
          <div><span>Access Type</span><strong>${escapeHtml(accessTypeDisplayLabel(active))}</strong></div>
          <div><span>Start Date</span><strong>${escapeHtml(active.accessStartDate || active.startDate || "-")}</strong></div>
          <div><span>End Date</span><strong>${escapeHtml(active.accessEndDate || active.endDate || "-")}</strong></div>
          <div><span>TradingView ID</span><strong>${escapeHtml(active.tradingViewUsername || "-")}</strong></div>
          <div><span>Telegram ID</span><strong>${escapeHtml(active.telegramId || "-")}</strong></div>
          <div><span>TradingView Access</span><strong class="${accessDeliveryStatusClass(active.tradingViewAccessStatus)}-text">${escapeHtml(accessDeliveryStatusLabel(active.tradingViewAccessStatus))}</strong></div>
          <div><span>Telegram Groups / Channels</span><strong class="${accessDeliveryStatusClass(active.telegramAccessStatus)}-text">${escapeHtml(accessDeliveryStatusLabel(active.telegramAccessStatus))}</strong>${telegramInviteButton(active)}</div>
          <div><span>Payment Status</span><strong>${escapeHtml(statusLabel(active.paymentStatus || "verified"))}</strong></div>
          <div><span>Access Status</span><strong>${escapeHtml(accessStatusLabel(active))}</strong></div>
        </div>

        ${extraActive}
      </article>
    `;
    return;
  }

  const latestLine = latest
    ? `<div class="notice soft">Latest access status: <strong>${escapeHtml(accessStatusLabel(latest))}</strong> · ${escapeHtml(accessTypeDisplayLabel(latest))} · Ends ${escapeHtml(latest.accessEndDate || latest.endDate || "-")}</div>`
    : "";

  box.innerHTML = `
    ${summaryCards}
    <article class="active-access-card active-neutral">
      <div class="active-access-head">
        <div>
          <span class="request-type">No Active Access</span>
          <h3>No active WhaleX access found</h3>
          <p>New access and renewal both use the same access request flow below.</p>
        </div>
        <span class="status-pill neutral">Inactive</span>
      </div>
      ${latestLine}
    </article>
  `;
}


function isTrialFeedbackDue(ticket = {}) {
  if (!ticket) return false;
  if (String(ticket.accessType || "").toLowerCase() !== "trial") return false;
  if (String(ticket.trialFeedbackStatus || "").toLowerCase() === "submitted") return false;
  if (ticket.feedbackDueNow === true) return true;

  const dueDate = String(ticket.trialFeedbackDueDate || "").slice(0, 10);
  if (!dueDate) return false;
  return new Date(`${dueDate}T00:00:00`).getTime() <= todayMidnight().getTime();
}

function feedbackPopupSnoozeKey(ticket) {
  const today = new Date().toISOString().slice(0, 10);
  return `whalex_trial_feedback_popup_snoozed_${ticket?.id || "unknown"}_${today}`;
}

function findDueTrialFeedbackTicket(tickets = []) {
  return [...(tickets || [])]
    .filter(isTrialFeedbackDue)
    .sort((a, b) => String(a.trialFeedbackDueDate || a.createdAt || "").localeCompare(String(b.trialFeedbackDueDate || b.createdAt || "")))[0] || null;
}

function openTrialFeedbackPopup(ticket) {
  const popup = document.getElementById("trialFeedbackPopup");
  const form = document.getElementById("trialFeedbackPopupForm");
  if (!popup || !form || !ticket) return;

  feedbackPopupCurrentTicket = ticket;

  const ticketInput = document.getElementById("trialFeedbackPopupTicketId");
  const emailInput = document.getElementById("trialFeedbackPopupEmail");
  if (ticketInput) ticketInput.value = ticket.id || "";
  if (emailInput) emailInput.value = ticket.email || currentUser?.email || "";

  const normalTicketInput = document.querySelector('#trialFeedbackForm input[name="ticketId"]');
  const normalEmailInput = document.querySelector('#trialFeedbackForm input[name="email"]');
  if (normalTicketInput) normalTicketInput.value = ticket.id || "";
  if (normalEmailInput) normalEmailInput.value = ticket.email || currentUser?.email || "";

  msg("trialFeedbackPopupMsg", "");
  popup.classList.add("is-open");
  popup.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => form.querySelector('select[name="rating"]')?.focus(), 80);
}

function closeTrialFeedbackPopup({ snooze = false } = {}) {
  const popup = document.getElementById("trialFeedbackPopup");
  if (!popup) return;

  if (snooze && feedbackPopupCurrentTicket) {
    sessionStorage.setItem(feedbackPopupSnoozeKey(feedbackPopupCurrentTicket), "true");
  }

  popup.classList.remove("is-open");
  popup.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function maybeShowTrialFeedbackPopup(tickets = []) {
  const ticket = findDueTrialFeedbackTicket(tickets);
  if (!ticket) return;

  if (sessionStorage.getItem(feedbackPopupSnoozeKey(ticket)) === "true") return;
  if (document.getElementById("trialFeedbackPopup")?.classList.contains("is-open")) return;

  setTimeout(() => openTrialFeedbackPopup(ticket), 500);
}

async function submitTrialFeedbackForm(form, msgId = "trialFeedbackMsg", { closePopup = false } = {}) {
  const formData = new FormData(form);
  const res = await fetch("/api/user/trial-feedback", {
    method: "POST",
    body: formData
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Feedback submission failed.");

  form.reset();
  fillAllUserForms();

  const attachmentText = json.ticket?.trialFeedbackAttachment ? `<div class="notice soft">Attachment uploaded successfully.</div>` : "";
  const rendered = `${json.message || "Feedback submitted."}${attachmentText}${json.ticket ? renderRequestCard(json.ticket) : ""}`;
  msg(msgId, rendered);

  if (window.showStandardSuccess) {
    window.showStandardSuccess("trial_feedback_submitted", { message: json.message || "Feedback submitted successfully." });
  }

  if (json.ticket) {
    sessionStorage.removeItem(feedbackPopupSnoozeKey(json.ticket));
  }

  if (closePopup) {
    closeTrialFeedbackPopup({ snooze: false });
  }

  await loadMyAccessRequests();
  return json;
}

function renderMyAccessRequests(tickets = []) {
  const section = document.getElementById("myAccessRequests");
  const box = document.getElementById("myAccessRequestsBox");
  if (!box) return;

  if (!currentUser) {
    currentOpenRequest = null;
    renderActiveAccessDashboard([]);
    if (section) section.style.display = "none";
    box.innerHTML = `<div class="notice soft">Login to view your access requests.</div>`;
    return;
  }

  const openTickets = [...tickets]
    .filter(isPendingRequest)
    .sort((a, b) => String(b.createdAt || b.id || "").localeCompare(String(a.createdAt || a.id || "")));

  currentOpenRequest = openTickets[0] || null;

  if (!currentOpenRequest) {
    if (section) section.style.display = "none";
    box.innerHTML = "";
    return;
  }

  if (section) section.style.display = "block";

  const extraCount = openTickets.length > 1
    ? `<div class="notice soft duplicate-cleanup-note">You already have an Open request. New requests are blocked until this request is Done or Rejected.</div>`
    : "";

  box.innerHTML = renderRequestCard(currentOpenRequest) + extraCount;
}
async function loadMyAccessRequests() {

  const box = document.getElementById("myAccessRequestsBox");
  if (!box) return;

  if (!userToken || !currentUser) {
    renderMyAccessRequests([]);
    return;
  }

  try {
    box.innerHTML = `<div class="notice soft">Loading your access requests...</div>`;
    const res = await fetch("/api/user/my-access-tickets", { headers: userHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Unable to load access requests.");

    myAccessTickets = json.tickets || [];
    fillTrackerDropdown(myAccessTickets);
    renderActiveAccessDashboard(myAccessTickets);
    renderMyAccessRequests(myAccessTickets);
    maybeShowTrialFeedbackPopup(myAccessTickets);

    if (myAccessTickets && myAccessTickets.length) {
      autoFillStatusCheck(myAccessTickets[0]);
      saveLatestTicket(myAccessTickets[0]);
    }
  } catch (err) {
    box.innerHTML = `<div class="notice error">${err.message}</div>`;
  }
}

async function loadUserNotifications() {
  // Notification list was removed from the Access page in V80.
  // Notifications are now shown only through the bell dropdown.
}

async function loadProfile() {
  if (!userToken) {
    restoreLatestTicketHint();
    renderActiveAccessDashboard([]);
    renderMyAccessRequests([]);
    return;
  }

  try {
    const res = await fetch("/api/user/profile", { headers: userHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Login expired");

    currentUser = json.user;
    fillAllUserForms();
    applyPlanIntentFromUrl();
    restoreLatestTicketHint();
    await loadMyAccessRequests();
  } catch (e) {
    localStorage.removeItem("whalex_user_token");
    userToken = "";
    currentUser = null;
    restoreLatestTicketHint();
    renderActiveAccessDashboard([]);
    renderMyAccessRequests([]);
  }
}

function showDuplicateRequestInfo(ticket) {
  const text = "You already have an Open request. New requests are blocked until this request is Done or Rejected.";
  msg("accessTicketMsg", text, true);

  const statusBox = document.getElementById("accessStatusBox");
  if (ticket && statusBox) statusBox.innerHTML = renderRequestCard(ticket);

  if (duplicateInfoTimer) clearTimeout(duplicateInfoTimer);
  duplicateInfoTimer = setTimeout(() => {
    const el = document.getElementById("accessTicketMsg");
    if (el) el.innerHTML = "";
  }, 60000);

  document.getElementById("myAccessRequests")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed");
  return json;
}

function setSubmitState(form, isSubmitting) {
  const btn = form?.querySelector('button[type="submit"]');
  if (!btn) return;
  btn.disabled = !!isSubmitting;
  btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
  btn.textContent = isSubmitting ? "Submitting..." : btn.dataset.originalText;
}

async function postForm(url, form, msgId) {
  try {
    setSubmitState(form, true);
    if (currentOpenRequest && isPendingRequest(currentOpenRequest)) {
      showDuplicateRequestInfo(currentOpenRequest);
      return;
    }

    // Do not overwrite values typed by existing users before submit.
    if (currentUser) setMissingFormValues(form, currentUser);

    const res = await fetch(url, {
      method: "POST",
      headers: userHeaders(),
      body: new FormData(form)
    });

    const json = await res.json();
    if (!res.ok) {
      const err = new Error(json.error || "Failed");
      if (json.ticket) err.ticket = json.ticket;
      throw err;
    }

    const ticket = json.ticket;
    form.reset();
    fillAllUserForms();

    if (ticket) {
      if (currentUser) {
        ["name", "email", "phone", "telegramId", "tradingViewUsername"].forEach((key) => {
          if (ticket[key]) currentUser[key] = ticket[key];
        });
      }
      autoFillStatusCheck(ticket);
      saveLatestTicket(ticket);

      const statusBox = document.getElementById("accessStatusBox");
      if (statusBox) statusBox.innerHTML = renderRequestCard(ticket, { submitted: true });

      const successText = ticket.accessType === "trial"
        ? "3-day trial request submitted successfully. Trial access will be provided within 48 hours after verification."
        : "Access request submitted successfully. Access will be provided within 48 hours after payment verification.";

      msg(msgId, `${successText}${renderRequestCard(ticket, { submitted: true })}`);
      if (window.showStandardSuccess) {
        window.showStandardSuccess(ticket.accessType === "trial" ? "trial_request_submitted" : "access_request_submitted", {
          message: successText
        });
      }

      try {
        await loadMyAccessRequests();
      } catch (_) {
        // Do not hide success message if reload has any issue.
      }

      setTimeout(() => {
        document.getElementById("accessTicketMsg")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 250);
    } else {
      msg(msgId, json.message || "Submitted successfully.");
      if (window.showStandardSuccess) window.showStandardSuccess("access_request_submitted", { message: json.message || "Submitted successfully." });
    }
  } catch (e) {
    if (e.ticket) {
      saveLatestTicket(e.ticket);
      autoFillStatusCheck(e.ticket);
      currentOpenRequest = e.ticket;
      showDuplicateRequestInfo(e.ticket);
      await loadMyAccessRequests();
      return;
    }
    msg(msgId, e.message, true);
  } finally {
    setSubmitState(form, false);
  }
}


function isMonthlyPaidPlanSelected() {
  const form = document.getElementById("accessTicketForm") || document;
  const accessSelect = form.querySelector("select[name='plan'], select[name='accessType'], #accessPlan, #accessType");

  // IMPORTANT: When the user manually changes Access Type, the selected dropdown is the source of truth.
  // Do not let the old URL query (?plan=trial) keep the monthly fields hidden.
  if (accessSelect) {
    const selectedText = String(accessSelect.selectedOptions?.[0]?.textContent || "").toLowerCase();
    const selectedValue = String(accessSelect.value || "").toLowerCase();
    const currentChoice = `${selectedText} ${selectedValue}`.trim();

    if (currentChoice.includes("trial")) return false;
    if (currentChoice) return true;
  }

  const queryPlan = String(new URLSearchParams(location.search).get("plan") || "").toLowerCase();
  if (queryPlan.includes("trial")) return false;
  return true;
}


function enabledAccessPlans() {
  const pricing = accessPublicData?.pricing || {};
  const plans = pricing.enabledPlans || pricing.plans || [];
  return plans.length ? plans.filter((p) => p.enabled !== false) : [
    { id: "monthly", accessType: "paid", label: "WhaleX V1 Access", planName: "WhaleX V1 Access", days: 30, price: pricing.currentPrice || "" },
    { id: "trial", accessType: "trial", label: "3-Day Trial Access", planName: "3-Day Trial Access", days: 3, price: "Free" }
  ];
}

function refreshAccessPlanOptions() {
  const select = document.getElementById("accessPlan");
  if (!select) return;

  const current = select.value;
  const plans = enabledAccessPlans();
  select.innerHTML = plans.map((p) => `<option value="${escapeHtml(p.planName || p.label || p.id)}">${escapeHtml(p.label || p.planName || p.id)}</option>`).join("");

  if ([...select.options].some((o) => o.value === current)) {
    select.value = current;
  } else {
    const paid = plans.find((p) => p.accessType !== "trial");
    select.value = paid?.planName || paid?.label || plans[0]?.planName || plans[0]?.label || "";
  }
}

function selectedPlanMeta() {
  const select = document.getElementById("accessPlan");
  const value = String(select?.value || "").toLowerCase();
  return enabledAccessPlans().find((p) => {
    const candidates = [p.id, p.label, p.planName].map((x) => String(x || "").toLowerCase());
    return candidates.includes(value);
  }) || enabledAccessPlans()[0] || {};
}

function updateAccessPaymentDetails() {
  const meta = selectedPlanMeta();
  const pricing = accessPublicData?.pricing || {};
  const settings = accessPublicData?.settings || {};
  const payment = accessPublicData?.payment || {};
  const isPaid = String(meta.accessType || "").toLowerCase() !== "trial";

  const amount = document.getElementById("accessPaymentAmount");
  if (amount) amount.textContent = `${meta.label || meta.planName || "Monthly Access"} · ${meta.price || pricing.currentPrice || ""}`;

  const upiValue = payment.upiId || settings.upiId || "";
  const payeeValue = payment.upiPayeeName || settings.upiPayeeName || settings.brandName || "WhaleX";

  const upiId = document.getElementById("accessUpiId");
  if (upiId) upiId.textContent = upiValue || "UPI ID not configured";

  const payee = document.getElementById("accessUpiPayee");
  if (payee) payee.textContent = payeeValue;

  const qr = document.getElementById("accessUpiQrImage");
  if (qr) qr.src = `/api/payment/upi-qr.svg?t=${Date.now()}`;

  updatePaymentIdRequirement();
}

async function loadAccessPublicData() {
  if (accessPublicDataLoadStarted) return accessPublicData;
  accessPublicDataLoadStarted = true;

  try {
    const res = await fetch(`/api/public?t=${Date.now()}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Unable to load payment settings.");
    accessPublicData = json;
    refreshAccessPlanOptions();
    applyPlanIntentFromUrl();
    updateAccessPaymentDetails();
    return accessPublicData;
  } catch (err) {
    accessPublicDataLoadStarted = false;
    console.warn("[WhaleX access payment settings skipped]", err.message);
    updateAccessPaymentDetails();
    return null;
  }
}

function updatePaymentIdRequirement() {
  const form = document.getElementById("accessTicketForm") || document;
  const paymentIdInput = document.getElementById("paymentIdInput") || form.querySelector("[name='paymentId']");
  const paymentProofInput = document.getElementById("paymentProofInput") || form.querySelector("[name='paymentProof']");
  const paidOnlySections = form.querySelectorAll(".paid-access-only");

  const isPaid = isMonthlyPaidPlanSelected();

  paidOnlySections.forEach((section) => {
    if (isPaid) {
      section.classList.remove("is-hidden");
      section.hidden = false;
      section.removeAttribute("hidden");
      section.style.removeProperty("display");
      section.setAttribute("aria-hidden", "false");
    } else {
      section.classList.add("is-hidden");
      section.hidden = true;
      section.setAttribute("hidden", "");
      section.setAttribute("aria-hidden", "true");
    }

    section.querySelectorAll("input, select, textarea").forEach((field) => {
      // Preserve typed values and selected file while toggling Trial <-> Monthly.
      field.disabled = !isPaid;
    });
  });

  if (paymentIdInput) {
    paymentIdInput.required = isPaid;
    paymentIdInput.disabled = !isPaid;
    paymentIdInput.setAttribute("aria-required", isPaid ? "true" : "false");
    paymentIdInput.placeholder = isPaid ? "Mandatory: UTR / UPI Ref No. / Transaction ID" : "";
  }

  if (paymentProofInput) {
    paymentProofInput.required = isPaid;
    paymentProofInput.disabled = !isPaid;
    paymentProofInput.setAttribute("aria-required", isPaid ? "true" : "false");

    const hint = paymentProofInput.closest("label")?.querySelector(".field-hint");
    if (hint) hint.textContent = "Mandatory for monthly paid access. Upload successful payment screenshot/PDF.";
  }

  // V98: optional fields should not show optional badges. Required star appears only when field is truly required.
  console.log("[Access type payment field sync]", { isPaid, selected: form.querySelector("select[name='plan'], select[name='accessType'], #accessPlan, #accessType")?.value });
  window.refreshRequiredMarkers?.();
}

function validateMonthlyAccessPaymentId(form) {
  if (!isMonthlyPaidPlanSelected()) return true;

  const paymentId = String(form?.paymentId?.value || "").trim();
  if (paymentId) return true;

  msg("accessTicketMsg", "Payment ID / UTR is mandatory for monthly access. After payment, open your UPI/bank app transaction details and copy the UTR / UPI Ref No. / Transaction ID / Bank Reference No.", true);
  form?.paymentId?.focus();
  window.showStandardError?.(new Error("Payment ID / UTR is mandatory for monthly access."));
  return false;
}

function validateMonthlyAccessPaymentProof(form) {
  if (!isMonthlyPaidPlanSelected()) return true;

  const proofInput = form?.paymentProof || document.querySelector("#accessTicketForm [name='paymentProof']");
  if (proofInput?.files?.length) return true;

  msg("accessTicketMsg", "Payment Proof screenshot/PDF is mandatory for monthly access. Upload the successful payment screenshot or PDF receipt from your UPI/bank/Razorpay payment.", true);
  proofInput?.focus();
  window.showStandardError?.(new Error("Payment Proof screenshot/PDF is mandatory for monthly access."));
  return false;
}



document.getElementById("accessTicketForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  updatePaymentIdRequirement();
  if (!validateMonthlyAccessPaymentId(e.target)) return;
  if (!validateMonthlyAccessPaymentProof(e.target)) return;
  postForm("/api/user/access-ticket", e.target, "accessTicketMsg");
});

document.getElementById("accessPlan")?.addEventListener("change", updatePaymentIdRequirement);
updatePaymentIdRequirement();
document.getElementById("accessTrackerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const ticketId = document.getElementById("accessRequestSelect")?.value || "";
  if (!ticketId) {
    msg("accessStatusBox", "Please select an access request.", true);
    return;
  }

  try {
    const res = await fetch(`/api/user/my-access-ticket/${encodeURIComponent(ticketId)}`, {
      headers: userHeaders()
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Unable to load access request.");

    document.getElementById("accessStatusBox").innerHTML = renderRequestCard(json.ticket);
    saveLatestTicket(json.ticket);
  } catch (err) {
    msg("accessStatusBox", err.message, true);
  }
});
document.getElementById("trialFeedbackForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    await submitTrialFeedbackForm(e.target, "trialFeedbackMsg", { closePopup: false });
  } catch (err) {
    msg("trialFeedbackMsg", err.message, true);
  }
});

document.getElementById("trialFeedbackPopupForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    await submitTrialFeedbackForm(e.target, "trialFeedbackPopupMsg", { closePopup: true });
  } catch (err) {
    msg("trialFeedbackPopupMsg", err.message, true);
  }
});

document.querySelectorAll(".feedback-later-btn, [data-close-feedback-popup]").forEach((el) => {
  el.addEventListener("click", () => closeTrialFeedbackPopup({ snooze: true }));
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("trialFeedbackPopup")?.classList.contains("is-open")) {
    closeTrialFeedbackPopup({ snooze: true });
  }
});

loadProfile();


// V60: refresh required * markers after dynamic paid/trial field requirement changes.
document.addEventListener("change", (e) => {
  if (e.target && (e.target.id === "accessPlan" || e.target.name === "plan" || e.target.name === "accessType")) {
    setTimeout(() => window.refreshRequiredMarkers?.(), 0);
  }
}, true);

setTimeout(() => window.refreshRequiredMarkers?.(), 800);


// V66: keep trial/monthly payment field visibility synced and preserve entered data.
document.addEventListener("DOMContentLoaded", () => {
  const applyVisibility = () => {
    try {
      updatePaymentIdRequirement();
      window.refreshRequiredMarkers?.();
    } catch (e) {
      console.warn("[Access payment field visibility sync skipped]", e.message);
    }
  };

  applyVisibility();
  setTimeout(applyVisibility, 100);
  setTimeout(applyVisibility, 500);
  setTimeout(applyVisibility, 1200);

  document.addEventListener("change", (e) => {
    const target = e.target;
    if (!target) return;

    const name = String(target.name || "").toLowerCase();
    const id = String(target.id || "").toLowerCase();

    if (name.includes("accesstype") || name.includes("access") || name.includes("plan") || id.includes("access") || id.includes("plan")) {
      applyVisibility();
      updateAccessPaymentDetails?.();
    }
  }, true);
});


// V67: direct access type listener. Current dropdown value must override old URL query like ?plan=trial.
document.addEventListener("DOMContentLoaded", () => {
  const accessPlan = document.getElementById("accessPlan") || document.querySelector("#accessTicketForm select[name='plan'], #accessTicketForm select[name='accessType']");
  const sync = () => {
    updatePaymentIdRequirement();
    updateAccessPaymentDetails?.();
    window.refreshRequiredMarkers?.();
  };

  accessPlan?.addEventListener("change", sync);
  sync();
  setTimeout(sync, 50);
  setTimeout(sync, 250);
  setTimeout(sync, 750);
});


// V89: Load live Admin pricing/payment settings on My Access page.
// This fixes the UPI ID staying stuck on "Loading..." after V86/V88.
document.addEventListener("DOMContentLoaded", () => {
  try {
    loadAccessPublicData?.();
    setTimeout(() => updateAccessPaymentDetails?.(), 250);
    setTimeout(() => updateAccessPaymentDetails?.(), 900);
  } catch (e) {
    console.warn("[WhaleX payment settings load skipped]", e.message);
  }
});
