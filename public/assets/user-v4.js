function msg(id, text, isError=false) {
  document.getElementById(id).innerHTML = `<div class="notice ${isError ? "error" : ""}">${text}</div>`;
}
function renderTicket(ticket) {
  return `<div class="ticket-status-card">
    <h3>Ticket: ${ticket.id}</h3>
    <p><strong>TradingView Username:</strong> ${ticket.tradingViewUsername || "-"}</p>
    <p><strong>Payment Status:</strong> ${ticket.paymentStatus || "-"}</p>
    <p><strong>Access Status:</strong> ${ticket.accessStatus || "-"}</p>
    <p><strong>Start Date:</strong> ${ticket.accessStartDate || "-"}</p>
    <p><strong>End Date:</strong> ${ticket.accessEndDate || "-"}</p>
    <p><strong>Ticket Status:</strong> ${ticket.status || "-"}</p>
    ${ticket.adminNote ? `<p><strong>WhaleX Note:</strong> ${ticket.adminNote}</p>` : ""}
  </div>`;
}
function renderSupport(ticket) {
  return `<div class="ticket-status-card">
    <h3>Ticket: ${ticket.id}</h3>
    <p><strong>Subject:</strong> ${ticket.subject || "-"}</p>
    <p><strong>Category:</strong> ${ticket.category || "-"}</p>
    <p><strong>Priority:</strong> ${ticket.priority || "-"}</p>
    <p><strong>Status:</strong> ${ticket.status || "-"}</p>
    ${ticket.adminReply ? `<p><strong>WhaleX Reply:</strong> ${ticket.adminReply}</p>` : ""}
  </div>`;
}
async function postForm(url, form, msgId, renderer) {
  try {
    const res = await fetch(url, { method: "POST", body: new FormData(form) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed");
    form.reset();
    const extra = json.ticket ? renderer(json.ticket) : "";
    msg(msgId, `${json.message || "Submitted successfully."}${extra}`);
  } catch (e) { msg(msgId, e.message, true); }
}
async function postJson(url, form, msgId) {
  try {
    const body = Object.fromEntries(new FormData(form));
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed");
    form.reset();
    msg(msgId, json.message || "Submitted successfully.");
  } catch (e) { msg(msgId, e.message, true); }
}
document.getElementById("accessTicketForm").addEventListener("submit", (e) => {
  e.preventDefault();
  postForm("/api/user/access-ticket", e.target, "accessTicketMsg", renderTicket);
});
document.getElementById("supportTicketForm").addEventListener("submit", (e) => {
  e.preventDefault();
  postForm("/api/user/support-ticket", e.target, "supportTicketMsg", renderSupport);
});
document.getElementById("checkAccessForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  try {
    const res = await fetch(`/api/user/access-ticket?ticketId=${encodeURIComponent(data.ticketId)}&email=${encodeURIComponent(data.email)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    document.getElementById("accessStatusBox").innerHTML = renderTicket(json.ticket);
  } catch (err) { msg("accessStatusBox", err.message, true); }
});
document.getElementById("checkSupportForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  try {
    const res = await fetch(`/api/user/support-ticket?ticketId=${encodeURIComponent(data.ticketId)}&email=${encodeURIComponent(data.email)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    document.getElementById("supportStatusBox").innerHTML = renderSupport(json.ticket);
  } catch (err) { msg("supportStatusBox", err.message, true); }
});
document.getElementById("reviewForm").addEventListener("submit", (e) => {
  e.preventDefault();
  postJson("/api/user/review", e.target, "reviewMsg");
});
document.getElementById("profitForm").addEventListener("submit", (e) => {
  e.preventDefault();
  postForm("/api/user/profit", e.target, "profitMsg", () => "");
});

function stars(n) { return "★".repeat(Number(n || 5)) + "☆".repeat(Math.max(0, 5 - Number(n || 5))); }
function reviewCard(r) {
  return `<article class="mini-card"><div class="review-stars">${stars(r.rating)}</div><p>“${r.text}”</p><h3>${r.name}</h3><span>${r.role || "Trader"}</span></article>`;
}
function profitCard(p) {
  return `<article class="mini-card image-card"><img src="${p.image}" alt="${p.title}"/><h3>${p.title}</h3><p>${p.caption || ""}</p></article>`;
}
async function loadApproved() {
  const res = await fetch("/api/public");
  const data = await res.json();
  const box = document.getElementById("approvedContent");
  const buttons = [...document.querySelectorAll("[data-approved-tab]")];

  function show(tab) {
    buttons.forEach((b) => b.classList.toggle("active", b.dataset.approvedTab === tab));
    if (tab === "reviews") {
      box.innerHTML = data.reviews.length ? data.reviews.map(reviewCard).join("") : `<article class="mini-card"><h3>No approved reviews yet</h3></article>`;
    } else {
      box.innerHTML = data.profits.length ? data.profits.map(profitCard).join("") : `<article class="mini-card"><h3>No approved screenshots yet</h3></article>`;
    }
  }
  buttons.forEach((b) => b.addEventListener("click", () => show(b.dataset.approvedTab)));
  show("reviews");
}
loadApproved().catch(console.error);
