async function whalexGetLoggedUser() {
  const token = localStorage.getItem("whalex_user_token") || "";
  if (!token) return null;

  try {
    const res = await fetch("/api/user/profile", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json();

    if (!res.ok || !json.user) {
      localStorage.removeItem("whalex_user_token");
      return null;
    }

    return json.user;
  } catch (_) {
    return null;
  }
}

function whalexGoLogin() {
  window.location.href = "login.html";
}

async function whalexRequireAuthPage() {
  const user = await whalexGetLoggedUser();
  if (!user) whalexGoLogin();
}

async function whalexGateBuyActions() {
  const user = await whalexGetLoggedUser();
  const loggedIn = !!user;

  document.body.classList.toggle("whalex-logged-in", loggedIn);
  document.body.classList.toggle("whalex-logged-out", !loggedIn);

  const protectedSelectors = [
    'a[href="user.html"]',
    'a[href="user.html#access"]',
    'a[href="submit-result.html"]',
    'a[href="pricing.html#pay"]',
    'a[href="#pay"]',
    'button[data-requires-login]',
    '.requires-login'
  ];

  document.querySelectorAll(protectedSelectors.join(",")).forEach((el) => {
    el.addEventListener("click", (e) => {
      if (loggedIn) return;
      e.preventDefault();
      e.stopPropagation();
      whalexGoLogin();
    });
  });

  // Text cleanup for logged out users.
  if (!loggedIn) {
    document.querySelectorAll("[data-hide-logged-out]").forEach((el) => {
      el.style.display = "none";
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const page = window.location.pathname.split("/").pop() || "index.html";

  if (["user.html", "submit-result.html"].includes(page)) {
    whalexRequireAuthPage();
  }

  whalexGateBuyActions();
});
