function cleanProductName(value, fallback = "WhaleX") {
  const text = String(value || "").trim();
  return /backend\s+test/i.test(text) ? fallback : text;
}

function cleanProductForDisplay(product = {}) {
  const fallbackName =
    product?.id === "orderflow" ? "WhaleX OrderFlow" :
    product?.id === "risk-manager" ? "WhaleX Risk Manager" :
    "WhaleX";

  return {
    ...product,
    name: cleanProductName(product?.name, fallbackName),
    tag: /backend\s+test/i.test(String(product?.tag || "")) ? "" : product?.tag,
    description: /backend\s+test/i.test(String(product?.description || "")) ? "" : product?.description,
    features: Array.isArray(product?.features)
      ? product.features.filter((x) => !/backend\s+test/i.test(String(x || "")))
      : product?.features
  };
}

function cleanProductsForDisplay(products = []) {
  return (products || []).map(cleanProductForDisplay);
}


const pageName = (location.pathname.split("/").pop() || "index.html").split("?")[0];
const iconMap = { whalex: "WX", orderflow: "OF", "risk-manager": "RM" };

let whaleXPublicData = null;
let publicDataSignature = "";
let activeProductIndex = 0;
let activeResultTab = "reviews";
let resultButtonsBound = false;
let homeSliderStarted = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[m]));
}

function stars(n) {
  return "★".repeat(Number(n || 5)) + "☆".repeat(Math.max(0, 5 - Number(n || 5)));
}

function videoEmbed(video) {
  if (!video.youtubeId) return `<div class="video-frame">Video coming soon</div>`;
  return `<div class="video-frame"><iframe src="https://www.youtube.com/embed/${escapeHtml(video.youtubeId)}" title="${escapeHtml(video.title)}" allowfullscreen></iframe></div>`;
}


function shortProductText(product) {
  const features = Array.isArray(product?.features) ? product.features.filter(Boolean) : [];
  if (features.length) return features.slice(0, 2).join(". ");

  const text = String(product?.description || "").trim();
  if (!text) return "Indicator details will appear here.";
  const firstSentence = text.split(/[.!?]/).map((x) => x.trim()).filter(Boolean)[0];
  return firstSentence || text;
}

function productInitials(product) {
  if (iconMap[product?.id]) return iconMap[product.id];
  const name = String(product?.name || "WX").trim();
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "WX";
}

function renderHomeProductCards() {
  const products = cleanProductsForDisplay(whaleXPublicData?.products || []).filter((p) => p && p.name);
  if (!products.length) return;

  const cardHtml = products.slice(0, 3).map((p) => `
    <div class="live-home-product-card" data-product-id="${escapeHtml(p.id || "")}">
      <span>${escapeHtml(productInitials(p))}</span>
      <h3>${escapeHtml(cleanProductName(p.name, "Indicator"))}</h3>
      <p>${escapeHtml(shortProductText(p))}</p>
    </div>
  `).join("");

  const liveGrid = document.getElementById("homeSuiteGrid");
  if (liveGrid) {
    liveGrid.innerHTML = cardHtml;
    liveGrid.setAttribute("data-live-rendered", "true");
  }

  const homeSlides = [...document.querySelectorAll(".screen-slide")];
  const suiteSlide = document.getElementById("homeSuiteSlide") || homeSlides[1];
  const suiteGrid = suiteSlide?.querySelector(".three-feature-screen");
  if (suiteGrid && suiteGrid !== liveGrid) {
    suiteGrid.innerHTML = cardHtml;
    suiteGrid.setAttribute("data-live-rendered", "true");
  }

  document.querySelectorAll("[data-live-products='true']").forEach((grid) => {
    grid.innerHTML = cardHtml;
    grid.setAttribute("data-live-rendered", "true");
  });

  const title = document.querySelector(".slide-top strong");
  if (title && products[0]?.name) {
    title.textContent = `${cleanProductName(products[0].name, "WhaleX")} Structure`;
  }

  console.log("[WhaleX home indicator cards refreshed]", products.map((p) => ({
    id: p.id,
    name: p.name,
    tag: p.tag
  })));
}

function productHTML(p) {
  p = cleanProductForDisplay(p || {});
  if (!p || !p.id) {
    return `<div class="product-empty"><h2>No indicator details found</h2><p>Please add indicator details from admin.</p></div>`;
  }

  return `
    <div class="product-big-mark">${escapeHtml(iconMap[p.id] || "WX")}</div>
    <div>
      <span class="eyebrow">${escapeHtml(p.tag || "")}</span>
      <h2>${escapeHtml(p.name || "")}</h2>
      <p>${escapeHtml(p.description || "")}</p>
      <ul>${(p.features || []).map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
    </div>`;
}

function renderProductTabs(products) {
  const tabWrap = document.getElementById("productTabs") || document.querySelector(".tab-buttons");
  if (!tabWrap) return;

  tabWrap.id = "productTabs";
  tabWrap.innerHTML = (products || []).map((p, idx) => `
    <button class="${idx === activeProductIndex ? "active" : ""}" data-product="${idx}" type="button">
      ${escapeHtml(cleanProductName(p.name, p.id || `Indicator ${idx + 1}`))}
    </button>
  `).join("");

  tabWrap.querySelectorAll("[data-product]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeProductIndex = Number(btn.dataset.product || 0);
      renderProductsPage();
    });
  });
}

function renderProductsPage() {
  const screen = document.getElementById("productScreen");
  if (!screen) return;

  const products = cleanProductsForDisplay(whaleXPublicData?.products || []);
  if (activeProductIndex >= products.length) activeProductIndex = 0;

  renderProductTabs(products);
  screen.innerHTML = productHTML(products[activeProductIndex] || products[0]);
}

function reviewCard(r) {
  return `<article class="mini-card"><div class="review-stars">${stars(r.rating)}</div><p>“${escapeHtml(r.text)}”</p><h3>${escapeHtml(r.name)}</h3><span>${escapeHtml(r.role || "Trader")}</span></article>`;
}

function profitCard(p) {
  return `<article class="mini-card image-card"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}"/><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.caption || "")}</p></article>`;
}

function videoCard(v) {
  return `<article class="video-card">${videoEmbed(v)}<h3>${escapeHtml(v.title)}</h3><p>${escapeHtml(v.description || "")}</p></article>`;
}

function initHomeSlider() {
  if (homeSliderStarted) return;
  const slides = [...document.querySelectorAll(".screen-slide")];
  const buttons = [...document.querySelectorAll(".slider-controls button")];
  if (!slides.length) return;

  homeSliderStarted = true;

  function show(i) {
    slides.forEach((s, idx) => s.classList.toggle("active", idx === i));
    buttons.forEach((b, idx) => b.classList.toggle("active", idx === i));
  }

  buttons.forEach((btn, idx) => btn.addEventListener("click", () => show(idx)));
  let i = 0;
  setInterval(() => {
    i = (i + 1) % slides.length;
    show(i);
  }, 5000);
}

function bindResultButtons() {
  if (resultButtonsBound) return;
  const buttons = [...document.querySelectorAll("[data-result-tab]")];
  buttons.forEach((b) => b.addEventListener("click", () => {
    activeResultTab = b.dataset.resultTab || "reviews";
    renderResultsPage();
  }));
  resultButtonsBound = true;
}

function renderResultsPage() {
  const screen = document.getElementById("resultsScreen");
  if (!screen) return;

  const data = whaleXPublicData || {};
  const buttons = [...document.querySelectorAll("[data-result-tab]")];
  buttons.forEach((b) => b.classList.toggle("active", b.dataset.resultTab === activeResultTab));

  if (activeResultTab === "reviews") {
    screen.innerHTML = (data.reviews || []).length
      ? data.reviews.map(reviewCard).join("")
      : `<article class="mini-card"><h3>No verified reviews yet</h3><p>Verified reviews will appear here.</p></article>`;
  } else {
    screen.innerHTML = (data.profits || []).length
      ? data.profits.map(profitCard).join("")
      : `<article class="mini-card"><h3>No verified screenshots yet</h3><p>Verified screenshots will appear here.</p></article>`;
  }
}

function renderVideosPage() {
  const screen = document.getElementById("videosScreen");
  if (!screen) return;
  const data = whaleXPublicData || {};
  screen.innerHTML = (data.videos || []).length
    ? data.videos.map(videoCard).join("")
    : `<article class="video-card"><div class="video-frame">No videos yet</div><h3>Videos coming soon</h3><p>Videos will appear here soon.</p></article>`;
}

function renderPricingPage() {
  const data = whaleXPublicData || {};
  if (!data.pricing || !data.settings) return;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value || "";
  };

  setText("planName", data.pricing.planName);
  setText("oldPrice", data.pricing.oldPrice);
  setText("currentPrice", data.pricing.currentPrice);
  setText("discountText", data.pricing.discountText);
  setText("upiId", data.settings.upiId);
  setText("upiPayeeName", data.settings.upiPayeeName || data.settings.brandName || "WhaleX");

  const plansBox = document.getElementById("availablePlansBox");
  if (plansBox) {
    const plans = (data.pricing.enabledPlans || data.pricing.plans || []).filter((p) => p.enabled !== false);
    plansBox.innerHTML = plans.map((p) => `
      <div class="plan-pill ${p.accessType === "trial" ? "trial" : "paid"}">
        <strong>${escapeHtml(p.label || p.planName || p.id)}</strong>
        <span>${escapeHtml(p.accessType === "trial" ? `${p.days || 3} days trial` : `${p.price || data.pricing.currentPrice || "-"} · ${p.days || 30} days`)}</span>
      </div>
    `).join("");
  }

  const upiQr = document.getElementById("upiQrImage");
  if (upiQr) upiQr.src = `/api/payment/upi-qr.svg?t=${Date.now()}`;

  const razorpayBtn = document.getElementById("razorpayBtn");
  if (razorpayBtn) razorpayBtn.href = data.settings.razorpayLink || "#";
}

function renderPublicPage() {
  if (pageName === "index.html" || pageName === "") {
    renderHomeProductCards();
    initHomeSlider();
  }
  if (pageName === "products.html") renderProductsPage();
  if (pageName === "results.html") {
    bindResultButtons();
    renderResultsPage();
  }
  if (pageName === "videos.html") renderVideosPage();
  if (pageName === "pricing.html") renderPricingPage();
}

async function fetchPublicData(forceRender = false) {
  const res = await fetch(`/api/public?t=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" }
  });

  const data = await res.json();

  const nextSignature = JSON.stringify({
    settings: data.settings,
    pricing: data.pricing,
    products: data.products,
    reviews: data.reviews,
    profits: data.profits,
    videos: data.videos,
    publicVersion: data.publicVersion
  });

  if (!forceRender && nextSignature === publicDataSignature) return;

  publicDataSignature = nextSignature;
  whaleXPublicData = data;

  // Hidden dev log only. No debug/live marker is shown to users.
  console.log("[WhaleX public data refreshed]", data.publicVersion || {});
  renderPublicPage();

  if (!forceRender) {
    document.dispatchEvent(new CustomEvent("whalex:publicDataUpdated", { detail: data }));
  }
}

async function boot() {
  await fetchPublicData(true);

  setInterval(() => {
    fetchPublicData(false).catch((err) => console.warn("[Public data refresh failed]", err.message));
  }, 5000);
}

window.addEventListener("storage", (event) => {
  if (event.key === "whalex_products_updated_at") {
    fetchPublicData(true).catch(() => {});
  }
});

boot().catch(console.error);
