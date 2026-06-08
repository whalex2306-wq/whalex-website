function msg(id, text, isError=false) {
  document.getElementById(id).innerHTML = `<div class="notice ${isError ? "error" : ""}">${text}</div>`;
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
document.getElementById("paymentForm").addEventListener("submit", (e) => { e.preventDefault(); postForm("/api/user/payment-proof", e.target, "paymentMsg"); });
document.getElementById("reviewForm").addEventListener("submit", (e) => { e.preventDefault(); postJson("/api/user/review", e.target, "reviewMsg"); });
document.getElementById("profitForm").addEventListener("submit", (e) => { e.preventDefault(); postForm("/api/user/profit", e.target, "profitMsg"); });

async function loadVideos() {
  const res = await fetch("/api/public");
  const data = await res.json();
  document.getElementById("clientVideos").innerHTML = data.videos.length ? data.videos.map((v) => `
    <article class="video-card">
      <div class="video-frame">${v.youtubeId ? `<iframe src="https://www.youtube.com/embed/${v.youtubeId}" title="${v.title}" allowfullscreen></iframe>` : "Video coming soon"}</div>
      <h3>${v.title}</h3><p>${v.description || ""}</p>
    </article>`).join("") : `<div class="video-card"><h3>No videos yet</h3><p>Videos added from admin will show here.</p></div>`;
}
loadVideos();
