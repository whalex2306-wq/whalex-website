function msg(id, text, isError=false) {
  document.getElementById(id).innerHTML = `<div class="notice ${isError ? "error" : ""}">${text}</div>`;
}
async function postJson(url, form, msgId) {
  try {
    const body = Object.fromEntries(new FormData(form));
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed");
    form.reset();
    msg(msgId, json.message || "Submitted successfully.");
    if (window.showStandardSuccess) {
      const key = msgId === "reviewMsg" ? "review_submitted" : "profit_submitted";
      window.showStandardSuccess(key, { message: json.message || "Submitted successfully." });
    }
    if (window.showStandardSuccess) {
      const key = msgId === "reviewMsg" ? "review_submitted" : "profit_submitted";
      window.showStandardSuccess(key, { message: json.message || "Submitted successfully." });
    }
  } catch (e) { msg(msgId, e.message, true); }
}
async function postForm(url, form, msgId) {
  try {
    const res = await fetch(url, { method: "POST", body: new FormData(form) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed");
    form.reset();
    msg(msgId, json.message || "Submitted successfully.");
  } catch (e) { msg(msgId, e.message, true); }
}
document.getElementById("reviewForm").addEventListener("submit", (e) => {
  e.preventDefault();
  postJson("/api/user/review", e.target, "reviewMsg");
});
document.getElementById("profitForm").addEventListener("submit", (e) => {
  e.preventDefault();
  postForm("/api/user/profit", e.target, "profitMsg");
});