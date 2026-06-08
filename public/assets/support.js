function msg(id, text, isError=false) {
  document.getElementById(id).innerHTML = `<div class="notice ${isError ? "error" : ""}">${text}</div>`;
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
document.getElementById("supportTicketForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const res = await fetch("/api/user/support-ticket", { method: "POST", body: new FormData(e.target) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed");
    e.target.reset();
    msg("supportTicketMsg", `${json.message || "Support ticket created."}${json.ticket ? renderSupport(json.ticket) : ""}`);
    if (window.showStandardSuccess) window.showStandardSuccess("support_ticket_created", { message: json.message || "Support ticket created successfully." });
  } catch (err) { msg("supportTicketMsg", err.message, true); }
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