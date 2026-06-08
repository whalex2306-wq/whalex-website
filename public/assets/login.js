let userToken = localStorage.getItem("whalex_user_token") || "";
let currentUser = null;

function setMsg(id, text, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = text ? `<div class="notice ${isError ? "error" : ""}">${text}</div>` : "";
}

function setButtonLoading(form, loading, text = "Please wait...") {
  const btn = form?.querySelector('button[type="submit"]');
  if (!btn) return;
  if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
  btn.disabled = !!loading;
  btn.textContent = loading ? text : btn.dataset.originalText;
}

function goHome() {
  window.location.href = "index.html";
}

async function apiJson(url, body, token = "") {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

async function fetchProfile() {
  if (!userToken) return null;

  try {
    const res = await fetch("/api/user/profile", {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    const json = await res.json();

    if (!res.ok || !json.user) {
      localStorage.removeItem("whalex_user_token");
      userToken = "";
      return null;
    }

    currentUser = json.user;
    return currentUser;
  } catch (_) {
    return null;
  }
}

async function redirectIfAlreadyLoggedIn() {
  const user = await fetchProfile();
  if (user) goHome();
}

function showForgotPassword() {
  const modal = document.getElementById("forgotPasswordModal");
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setMsg("loginMsg", "");
  setMsg("registerMsg", "");
  setMsg("forgotMsg", "");
  setTimeout(() => modal.querySelector('input[name="email"]')?.focus(), 80);
}

function closeForgotPassword() {
  const modal = document.getElementById("forgotPasswordModal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  setMsg("forgotMsg", "");
}

document.getElementById("showForgotPassword")?.addEventListener("click", showForgotPassword);
document.getElementById("closeForgotPassword")?.addEventListener("click", closeForgotPassword);
document.querySelectorAll("[data-close-forgot]").forEach((el) => {
  el.addEventListener("click", closeForgotPassword);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeForgotPassword();
});

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("loginMsg", "");

  try {
    setButtonLoading(e.target, true, "Logging in...");
    const body = Object.fromEntries(new FormData(e.target));
    const json = await apiJson("/api/user/login", body);

    localStorage.setItem("whalex_user_token", json.token);
    userToken = json.token;

    if (window.showStandardSuccess) window.showStandardSuccess("login_success");
    setTimeout(goHome, 350);
  } catch (err) {
    setMsg("loginMsg", err.message, true);
  } finally {
    setButtonLoading(e.target, false);
  }
});

document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("registerMsg", "");

  try {
    setButtonLoading(e.target, true, "Creating...");
    const body = Object.fromEntries(new FormData(e.target));
    const json = await apiJson("/api/user/register", body);

    localStorage.setItem("whalex_user_token", json.token);
    userToken = json.token;

    if (window.showStandardSuccess) window.showStandardSuccess("account_created");
    setTimeout(goHome, 350);
  } catch (err) {
    setMsg("registerMsg", err.message, true);
  } finally {
    setButtonLoading(e.target, false);
  }
});

document.getElementById("forgotPasswordForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("forgotMsg", "");

  try {
    setButtonLoading(e.target, true, "Sending...");
    const body = Object.fromEntries(new FormData(e.target));
    const json = await apiJson("/api/user/forgot-password", body);
    setMsg("forgotMsg", json.message || "If this email is registered, a password reset link has been sent.");
    if (window.showStandardSuccess) window.showStandardSuccess("reset_link_sent", { message: json.message || "If this email is registered, a password reset link has been sent." });
  } catch (err) {
    setMsg("forgotMsg", err.message, true);
  } finally {
    setButtonLoading(e.target, false);
  }
});

// If user opens login page while already logged in, send them Home.
redirectIfAlreadyLoggedIn();
