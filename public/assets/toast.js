(function () {
  const DEFAULT_DURATION = 4200;

  const messages = {
    access_request_submitted: ["Request submitted", "Your WhaleX access request has been submitted successfully."],
    trial_request_submitted: ["Trial request submitted", "Your 3-day trial request has been submitted successfully."],
    trial_feedback_submitted: ["Feedback submitted", "Thanks. Your trial feedback has been submitted successfully."],
    support_ticket_created: ["Support ticket created", "Your support ticket has been submitted successfully."],
    review_submitted: ["Review submitted", "Your review has been submitted successfully and is pending approval."],
    profit_submitted: ["Result submitted", "Your result screenshot has been submitted successfully and is pending approval."],
    profile_saved: ["Details saved", "Your saved details have been updated successfully."],
    reset_link_sent: ["Reset link sent", "If the email exists, a password reset link has been sent."],
    password_reset: ["Password reset", "Your password has been reset successfully. You can log in now."],
    login_success: ["Login successful", "Welcome back to WhaleX."],
    account_created: ["Account created", "Your WhaleX account has been created successfully."],

    admin_ticket_saved: ["Access ticket saved", "Access ticket changes have been saved successfully."],
    admin_support_saved: ["Support ticket saved", "Support ticket changes have been saved successfully."],
    admin_pricing_saved: ["Pricing saved", "Pricing details have been saved successfully."],
    admin_settings_saved: ["Settings saved", "Website settings have been saved successfully."],
    admin_indicator_saved: ["Indicator saved", "Indicator details have been saved successfully and will sync to the user portal."],
    admin_review_added: ["Review added", "Review has been added successfully."],
    admin_review_updated: ["Review updated", "Review status has been updated successfully."],
    admin_review_deleted: ["Review deleted", "Review has been deleted successfully."],
    admin_profit_added: ["Result added", "Profit/result item has been added successfully."],
    admin_profit_updated: ["Result updated", "Profit/result status has been updated successfully."],
    admin_profit_deleted: ["Result deleted", "Profit/result item has been deleted successfully."],
    admin_video_added: ["Video added", "YouTube video has been added successfully."],
    admin_video_updated: ["Video updated", "Video status has been updated successfully."],
    admin_video_deleted: ["Video deleted", "Video has been deleted successfully."],
    admin_report_generated: ["Report generated", "Monthly report has been generated successfully."],
    admin_notification_test: ["Test notification sent", "Admin notification test completed successfully."],
    admin_data_refreshed: ["Data refreshed", "Admin data has been refreshed successfully."]
  };

  function ensureContainer() {
    let container = document.getElementById("whalexToastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "whalexToastContainer";
      container.className = "whalex-toast-container";
      document.body.appendChild(container);
    }
    return container;
  }

  function closeToast(toast) {
    if (!toast) return;
    toast.classList.add("is-leaving");
    setTimeout(() => toast.remove(), 220);
  }

  function whaleXToast(options = {}) {
    const type = options.type || "success";
    const title = options.title || (type === "error" ? "Something went wrong" : "Done");
    const message = options.message || "";
    const duration = Number(options.duration || DEFAULT_DURATION);

    const container = ensureContainer();
    const toast = document.createElement("div");
    toast.className = `whalex-toast ${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.innerHTML = `
      <div class="toast-icon">${type === "error" ? "!" : type === "warning" ? "!" : "✓"}</div>
      <div class="toast-content">
        <strong>${escapeToast(title)}</strong>
        ${message ? `<span>${escapeToast(message)}</span>` : ""}
      </div>
      <button class="toast-close" type="button" aria-label="Close message">×</button>
    `;

    container.appendChild(toast);

    toast.querySelector(".toast-close")?.addEventListener("click", () => closeToast(toast));

    if (duration > 0) {
      setTimeout(() => closeToast(toast), duration);
    }

    return toast;
  }

  function escapeToast(value) {
    return String(value ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[m]));
  }

  function showStandardSuccess(key, override = {}) {
    const base = messages[key] || ["Saved", "Changes have been saved successfully."];
    return whaleXToast({
      type: "success",
      title: override.title || base[0],
      message: override.message || base[1],
      duration: override.duration || DEFAULT_DURATION
    });
  }

  function showStandardError(error, override = {}) {
    return whaleXToast({
      type: "error",
      title: override.title || "Unable to complete action",
      message: override.message || (error?.message || String(error || "Please try again.")),
      duration: override.duration || 5200
    });
  }

  function showStandardInfo(title, message, duration = DEFAULT_DURATION) {
    return whaleXToast({ type: "info", title, message, duration });
  }

  window.whaleXToast = whaleXToast;
  window.showStandardSuccess = showStandardSuccess;
  window.showStandardError = showStandardError;
  window.showStandardInfo = showStandardInfo;
})();