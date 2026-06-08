
let whaleXUserNotificationTimer = null;
let whaleXUserNotifications = [];
let whaleXUserUnreadCount = 0;
let whaleXUserLastReadAllAt = 0;

function userEscapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[m]));
}

function isUserNotificationUnread(notification) {
  if (!notification) return false;
  if (notification.unread === true) return true;
  return !notification.readAt;
}

function notificationBadgeHtml(unreadCount) {
  const unread = Number(unreadCount || 0);
  if (!unread) return "";

  return `<span class="notif-count is-unread-count" title="${unread} unread notifications">${unread > 99 ? "99+" : unread}</span>`;
}

function formatNotificationTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch (_) {
    return value;
  }
}


function getUserNotificationTarget(notification) {
  const type = String(notification?.type || "").toLowerCase();

  if (
    type.includes("access") ||
    type.includes("trial") ||
    type.includes("payment")
  ) {
    return "user.html#access";
  }

  if (type.includes("password")) {
    return "login.html";
  }

  if (type.includes("support")) {
    return "support.html";
  }

  if (type.includes("review")) {
    return "results.html";
  }

  if (type.includes("profit")) {
    return "results.html";
  }

  if (type.includes("video")) {
    return "videos.html";
  }

  return "user.html";
}

async function openUserNotification(id) {
  const notification = whaleXUserNotifications.find((n) => String(n.id) === String(id));

  if (id) {
    try {
      await markUserNotificationRead(id, { stayOpen: true });
    } catch (_) {
      // Navigation should still happen even if mark-read fails.
    }
  }

  const target = getUserNotificationTarget(notification);
  window.location.href = target;
}

function renderUserBell() {
  const host = document.getElementById("userNotificationHost");
  if (!host) return;

  const unreadCount = whaleXUserUnreadCount;
  const totalCount = whaleXUserNotifications.length;
  const items = whaleXUserNotifications.slice(0, 8);

  host.innerHTML = `
    <button class="notif-bell-btn" id="userNotifBellBtn" type="button" aria-label="Notifications">
      <span class="bell-icon">🔔</span>
      ${notificationBadgeHtml(unreadCount)}
    </button>
    <div class="notif-panel" id="userNotifPanel">
      <div class="notif-panel-head">
        <strong>Notifications</strong>
        <button type="button" id="userNotifReadAll">Mark all read</button>
      </div>
      <div class="notif-list">
        ${items.length ? items.map((n) => `
          <button class="notif-item ${isUserNotificationUnread(n) ? "is-unread" : "is-read"}" type="button" data-user-notif-id="${userEscapeHtml(n.id)}">
            <span class="notif-dot"></span>
            <span>
              <strong>${userEscapeHtml(n.title || "Notification")}</strong>
              <small>${userEscapeHtml(n.message || "")}</small>
              <em>${userEscapeHtml(formatNotificationTime(n.createdAt))}</em>
            </span>
          </button>
        `).join("") : `<div class="notif-empty">No notifications yet.</div>`}
      </div>
    </div>
  `;

  document.getElementById("userNotifBellBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    host.classList.toggle("open");
  });

  document.getElementById("userNotifReadAll")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    await markUserNotificationsReadAll();
  });

  host.querySelectorAll("[data-user-notif-id]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await openUserNotification(btn.dataset.userNotifId);
    });
  });
}

async function fetchUserNotifications() {
  const token = localStorage.getItem("whalex_user_token") || "";
  if (!token) return;

  const res = await fetch(`/api/user/notifications?t=${Date.now()}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` }
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) return;

  whaleXUserNotifications = json.notifications || [];
  whaleXUserUnreadCount = Number.isFinite(Number(json.unreadCount))
    ? Number(json.unreadCount)
    : whaleXUserNotifications.filter(isUserNotificationUnread).length;

  // Prevent an in-flight/stale poll response from bringing the badge back immediately after Mark all read.
  if (Date.now() - whaleXUserLastReadAllAt < 3000) {
    whaleXUserNotifications = whaleXUserNotifications.map((n) => ({
      ...n,
      readAt: n.readAt || new Date().toISOString(),
      unread: false
    }));
    whaleXUserUnreadCount = 0;
  }

  console.log("[User notification bell count]", {
    unreadCount: whaleXUserUnreadCount,
    totalCount: whaleXUserNotifications.length
  });

  renderUserBell();
}

async function markUserNotificationRead(id, options = {}) {
  const token = localStorage.getItem("whalex_user_token") || "";
  if (!token || !id) return;

  await fetch(`/api/user/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!options.skipReload) {
    await fetchUserNotifications();
  }

  if (!options.stayOpen) {
    document.getElementById("userNotificationHost")?.classList.remove("open");
  }
}

async function markUserNotificationsReadAll() {
  const token = localStorage.getItem("whalex_user_token") || "";
  if (!token) return;

  whaleXUserLastReadAllAt = Date.now();

  // Optimistic UI: clear the badge immediately.
  const localReadAt = new Date().toISOString();
  whaleXUserNotifications = (whaleXUserNotifications || []).map((n) => ({
    ...n,
    readAt: n.readAt || localReadAt,
    unread: false
  }));
  whaleXUserUnreadCount = 0;
  renderUserBell();

  const res = await fetch(`/api/user/notifications/read-all?t=${Date.now()}`, {
    method: "PATCH",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` }
  });

  const json = await res.json().catch(() => ({}));

  if (res.ok) {
    const readAt = json.readAt || localReadAt;
    whaleXUserNotifications = (json.notifications || whaleXUserNotifications || []).map((n) => ({
      ...n,
      readAt: n.readAt || readAt,
      unread: false
    }));
    whaleXUserUnreadCount = 0;
    renderUserBell();

    console.log("[User notification mark all read]", {
      unreadCount: whaleXUserUnreadCount,
      beforeUnread: json.beforeUnread,
      afterUnread: json.afterUnread,
      totalCount: whaleXUserNotifications.length
    });
  } else {
    await fetchUserNotifications();
  }
}

function startUserNotificationPolling() {
  if (whaleXUserNotificationTimer) return;
  fetchUserNotifications().catch(() => {});
  whaleXUserNotificationTimer = setInterval(() => {
    fetchUserNotifications().catch(() => {});
  }, 6000);

  document.addEventListener("click", () => {
    document.getElementById("userNotificationHost")?.classList.remove("open");
  });
}

async function loadWhaleXUserBar() {
  const token = localStorage.getItem("whalex_user_token") || "";
  if (!token) {
    document.body.classList.remove("whalex-logged-in");
    document.body.classList.add("whalex-logged-out");
    return;
  }

  try {
    const res = await fetch(`/api/user/profile?t=${Date.now()}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json();

    if (!res.ok || !json.user) {
      localStorage.removeItem("whalex_user_token");
      document.body.classList.remove("whalex-logged-in");
      document.body.classList.add("whalex-logged-out");
      return;
    }

    const user = json.user;
    document.body.classList.add("whalex-logged-in");
    document.body.classList.remove("whalex-logged-out");

    document.querySelectorAll('a[href="login.html"]').forEach((a) => {
      const text = (a.textContent || "").trim().toLowerCase();
      if (text.includes("login") || text.includes("create account") || text.includes("profile")) {
        a.style.display = "none";
        a.classList.add("logged-hidden-login-link");
      }
    });

    document.querySelectorAll("[data-hide-when-logged-in]").forEach((el) => {
      el.style.display = "none";
    });

    document.querySelectorAll("[data-logged-in-text]").forEach((el) => {
      el.textContent = el.getAttribute("data-logged-in-text");
    });

    const header = document.querySelector(".site-header");
    if (!header) return;

    if (!document.getElementById("whalexUserBar")) {
      const bar = document.createElement("div");
      bar.id = "whalexUserBar";
      bar.className = "user-top-bar";
      bar.innerHTML = `
        <div class="container user-top-inner">
          <div class="user-top-left">
            <span class="user-dot"></span>
            <strong>${userEscapeHtml(user.name || "WhaleX User")}</strong>
            <span>${userEscapeHtml(user.email || "")}</span>
          </div>
          <div class="user-top-details">
            <span><b>Phone:</b> ${userEscapeHtml(user.phone || "-")}</span>
            <span><b>Telegram:</b> ${userEscapeHtml(user.telegramId || "-")}</span>
            <span><b>TradingView:</b> ${userEscapeHtml(user.tradingViewUsername || "-")}</span>
          </div>
          <div class="user-top-actions">
            <div id="userNotificationHost" class="notif-host user-notif-host"></div>
            <a href="user.html">My Access</a>
            <button type="button" id="userBarLogout">Logout</button>
          </div>
        </div>
      `;

      header.insertAdjacentElement("afterend", bar);

      document.getElementById("userBarLogout")?.addEventListener("click", async () => {
        try {
          await fetch("/api/user/logout", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (_) {}
        localStorage.removeItem("whalex_user_token");
        window.location.href = "login.html";
      });
    }

    startUserNotificationPolling();
  } catch (_) {
    // Keep public pages silent if profile fetch fails.
  }
}

loadWhaleXUserBar();
