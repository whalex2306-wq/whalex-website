function setMsg(id, text, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = text ? `<div class="notice ${isError ? "error" : ""}">${text}</div>` : "";
}

function setButtonLoading(form, loading) {
  const btn = form?.querySelector('button[type="submit"]');
  if (!btn) return;
  if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
  btn.disabled = !!loading;
  btn.textContent = loading ? "Resetting..." : btn.dataset.originalText;
}

const params = new URLSearchParams(window.location.search);
const resetEmail = params.get("email") || "";
const resetToken = params.get("token") || "";

if (!resetEmail || !resetToken) {
  setMsg("resetMsg", "Reset link is missing or invalid. Please request a new password reset link.", true);
}

document.getElementById("resetPasswordForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("resetMsg", "");

  const data = Object.fromEntries(new FormData(e.target));
  if (data.password !== data.confirmPassword) {
    setMsg("resetMsg", "Passwords do not match.", true);
    return;
  }

  try {
    setButtonLoading(e.target, true);
    const res = await fetch("/api/user/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: resetEmail,
        token: resetToken,
        password: data.password
      })
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Unable to reset password.");

    setMsg("resetMsg", `${json.message || "Password reset successfully."} <a href="login.html">Login now</a>`);
    if (window.showStandardSuccess) window.showStandardSuccess("password_reset", { message: json.message || "Password reset successfully. You can login now." });
    e.target.reset();
  } catch (err) {
    setMsg("resetMsg", err.message, true);
  } finally {
    setButtonLoading(e.target, false);
  }
});
