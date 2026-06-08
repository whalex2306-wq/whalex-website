const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
if (menuBtn && navLinks) {
  menuBtn.addEventListener("click", () => navLinks.classList.toggle("open"));
  navLinks.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => navLinks.classList.remove("open")));
}

const pageName = location.pathname.split("/").pop() || "index.html";
const iconMap = { whalex: "WX", orderflow: "OF", "risk-manager": "RM" };

function stars(n) {
  return "★".repeat(Number(n || 5)) + "☆".repeat(Math.max(0, 5 - Number(n || 5)));
}
function videoEmbed(video) {
  if (!video.youtubeId) return `<div class="video-frame">Add YouTube ID in admin panel</div>`;
  return `<div class="video-frame"><iframe src="https://www.youtube.com/embed/${video.youtubeId}" title="${video.title}" allowfullscreen></iframe></div>`;
}
function productCard(p) {
  return `<article class="product-card premium">
    <div class="product-icon">${iconMap[p.id] || "WX"}</div>
    <span class="eyebrow">${p.tag || ""}</span>
    <h3>${p.name}</h3>
    <p>${p.description}</p>
    <ul>${(p.features || []).map((f) => `<li>${f}</li>`).join("")}</ul>
  </article>`;
}
function reviewCard(r) {
  return `<article class="review-card">
    <div class="review-stars">${stars(r.rating)}</div>
    <p>“${r.text}”</p>
    <h3>${r.name}</h3>
    <p>${r.role || "Trader"}</p>
  </article>`;
}
function profitCard(p) {
  return `<article class="profit-card">
    <img src="${p.image}" alt="${p.title}" />
    <h3>${p.title}</h3>
    <p>${p.caption || ""}</p>
    <span class="status approved">${p.date || ""}</span>
  </article>`;
}
function videoCard(v) {
  return `<article class="video-card">${videoEmbed(v)}<h3>${v.title}</h3><p>${v.description || ""}</p></article>`;
}
function setupCarouselButtons() {
  document.querySelectorAll(".carousel-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.target);
      const dir = Number(btn.dataset.dir || 1);
      if (target) target.scrollBy({ left: dir * 380, behavior: "smooth" });
    });
  });
}

async function loadSite() {
  const res = await fetch("/api/public");
  const data = await res.json();

  if (pageName === "index.html" || pageName === "") {
    const slides = data.slides || [];
    let i = 0;
    const kicker = document.getElementById("heroKicker");
    const title = document.getElementById("heroTitle");
    const text = document.getElementById("heroText");
    const cta = document.getElementById("heroCta");
    const dots = document.getElementById("sliderDots");

    function paintSlide(idx) {
      const s = slides[idx] || slides[0];
      if (!s) return;
      kicker.textContent = s.kicker;
      title.textContent = s.title;
      text.textContent = s.text;
      cta.textContent = s.cta;
      cta.href = s.link;
      dots.innerHTML = slides.map((_, n) => `<button class="${n === idx ? "active" : ""}" data-slide="${n}"></button>`).join("");
      dots.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { i = Number(b.dataset.slide); paintSlide(i); }));
    }
    paintSlide(i);
    setInterval(() => { i = (i + 1) % slides.length; paintSlide(i); }, 5200);

    const pc = document.getElementById("productsCarousel");
    if (pc) pc.innerHTML = data.products.map(productCard).join("");
  }

  if (pageName === "products.html") {
    const wrap = document.getElementById("productShowcase");
    wrap.innerHTML = data.products.map((p) => `
      <article class="product-detail-card" id="${p.id}">
        <div class="product-mark">${iconMap[p.id] || "WX"}</div>
        <div>
          <span class="eyebrow">${p.tag || ""}</span>
          <h2>${p.name}</h2>
          <p class="lead">${p.description}</p>
          <ul>${(p.features || []).map((f) => `<li>${f}</li>`).join("")}</ul>
        </div>
      </article>`).join("");
  }

  if (pageName === "results.html") {
    const rc = document.getElementById("reviewsCarousel");
    if (rc) rc.innerHTML = data.reviews.length ? data.reviews.map(reviewCard).join("") : `<article class="review-card"><h3>No approved reviews yet</h3><p>Approved reviews will appear here.</p></article>`;
    const pg = document.getElementById("profitsGrid");
    if (pg) pg.innerHTML = data.profits.length ? data.profits.map(profitCard).join("") : `<article class="profit-card"><h3>No approved screenshots yet</h3><p>Approved screenshots will appear here.</p></article>`;
  }

  if (pageName === "videos.html") {
    const vg = document.getElementById("videosGrid");
    if (vg) vg.innerHTML = data.videos.length ? data.videos.map(videoCard).join("") : `<article class="video-card"><div class="video-frame">No videos yet</div><h3>Videos coming soon</h3><p>Add YouTube videos from admin panel.</p></article>`;
  }

  if (pageName === "pricing.html") {
    document.getElementById("planName").textContent = data.pricing.planName;
    document.getElementById("oldPrice").textContent = data.pricing.oldPrice;
    document.getElementById("currentPrice").textContent = data.pricing.currentPrice;
    document.getElementById("discountText").textContent = data.pricing.discountText;
    document.getElementById("upiId").textContent = data.settings.upiId;
    const upiQr = document.getElementById("upiQrImage");
    if (upiQr) upiQr.src = `/api/payment/upi-qr.svg?t=${Date.now()}`;
    document.getElementById("razorpayBtn").href = data.settings.razorpayLink || "#";
  }

  if (pageName === "support.html") {
    document.getElementById("supportEmail").href = `mailto:${data.settings.supportEmail}`;
    document.getElementById("telegramLink").href = data.settings.telegramLink || "#";
  }

  setupCarouselButtons();
}
loadSite().catch(console.error);


// Final V2 homepage product cards and feature slider
async function loadFinalV2Home() {
  const grid = document.getElementById("homeProducts");
  if (!grid) return;
  const res = await fetch("/api/public");
  const data = await res.json();
  grid.innerHTML = data.products.map(productCard).join("");

  const slides = [...document.querySelectorAll(".feature-slide")];
  if (slides.length) {
    let idx = 0;
    setInterval(() => {
      slides[idx].classList.remove("active");
      idx = (idx + 1) % slides.length;
      slides[idx].classList.add("active");
    }, 3600);
  }
}
loadFinalV2Home().catch(console.error);
