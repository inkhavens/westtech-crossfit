/* Shared header, footer and small interactions for every page.
   Each page sets <body data-root="" data-page="home">; pages inside /coaches use data-root="../". */
(function () {
  var cfg = window.SITE_CONFIG || {};
  var body = document.body;
  var root = body.dataset.root || "";
  var page = body.dataset.page || "";

  var NAV = [
    ["home", "index.html", "Home"],
    ["about", "about.html", "About"],
    ["coaches", "coaches/index.html", "Coaches"],
    ["schedule", "schedule.html", "Schedule"],
    ["events", "events.html", "Events"],
    ["wod", "wod.html", "WOD"],
    ["contact", "contact.html", "Contact"]
  ];

  var IG_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zm0 3.4a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8zm0 10.6a4.2 4.2 0 1 1 0-8.4 4.2 4.2 0 0 1 0 8.4zm6.7-11.9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>';

  // ---------- Header ----------
  var header = document.getElementById("site-header");
  if (header) {
    var links = NAV.map(function (n) {
      var cur = n[0] === page ? ' aria-current="page"' : "";
      return '<li><a href="' + root + n[1] + '"' + cur + ">" + n[2] + "</a></li>";
    }).join("");
    header.innerHTML =
      '<div class="topbar"><div class="wrap topbar-inner">' +
        "<span>Mon · Wed · Fri &nbsp;3:00 PM &nbsp;·&nbsp; WCTA CrossFit Gym</span>" +
        '<a href="' + (cfg.INSTAGRAM_URL || "#") + '" target="_blank" rel="noopener">' + IG_ICON + " " + (cfg.INSTAGRAM_HANDLE || "") + "</a>" +
      "</div></div>" +
      '<nav class="nav wrap" aria-label="Main">' +
        '<a class="brand" href="' + root + 'index.html"><img src="' + root + 'assets/img/logo.svg" alt="West Tech CrossFit home" width="190" height="76"></a>' +
        '<button class="nav-toggle" aria-expanded="false" aria-controls="nav-links"><span></span><span></span><span></span><span class="sr-only">Menu</span></button>' +
        '<ul id="nav-links" class="nav-links">' + links +
          '<li class="nav-cta"><a class="btn btn-pink" href="' + root + 'join.html">Join Free</a></li>' +
        "</ul>" +
      "</nav>";
    var toggle = header.querySelector(".nav-toggle");
    toggle.addEventListener("click", function () {
      var open = header.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // ---------- Footer ----------
  var footer = document.getElementById("site-footer");
  if (footer) {
    footer.innerHTML =
      '<div class="checker-band" aria-hidden="true"></div>' +
      '<div class="wrap footer-grid">' +
        '<div class="footer-brand">' +
          '<img src="' + root + 'assets/img/logo.svg" alt="West Tech CrossFit" width="260" height="104">' +
          '<p class="script">The House of Hustle and Muscle</p>' +
        "</div>" +
        "<div><h4>Visit</h4><p>West Career &amp; Technical Academy<br>11945 W. Charleston Blvd.<br>Las Vegas, NV 89135</p></div>" +
        "<div><h4>Train</h4><p>Mon · Wed · Fri<br>3:00 – 4:00 PM<br>Free for WCTA students</p></div>" +
        '<div><h4>Explore</h4><ul class="footer-links">' +
          NAV.slice(1).map(function (n) { return '<li><a href="' + root + n[1] + '">' + n[2] + "</a></li>"; }).join("") +
          '<li><a href="' + root + 'join.html">Join</a></li>' +
          '<li><a href="' + (cfg.INSTAGRAM_URL || "#") + '" target="_blank" rel="noopener">Instagram</a></li>' +
        "</ul></div>" +
      "</div>" +
      '<div class="wrap legal">' +
        "<p>This website is a student publication of the WCTA CrossFit Club. Its content is not endorsed by West Career &amp; Technical Academy or the Clark County School District.</p>" +
        "<p>CrossFit® is a registered trademark of CrossFit, LLC. West Tech CrossFit is an independently operated, non-profit CrossFit affiliate.</p>" +
        "<p>© " + new Date().getFullYear() + " West Tech CrossFit · WCTA Wranglers</p>" +
      "</div>";
  }

  // ---------- Placeholder images: hide broken <img> and keep the styled placeholder ----------
  document.querySelectorAll("img[data-fallback]").forEach(function (img) {
    function fail() { img.closest(".photo-slot").classList.add("empty"); img.remove(); }
    if (img.complete && img.naturalWidth === 0) fail();
    else img.addEventListener("error", fail);
  });

  // ---------- Config-driven links ----------
  document.querySelectorAll("[data-config-href]").forEach(function (a) {
    var v = cfg[a.dataset.configHref];
    if (v) { a.href = v; } else { a.classList.add("is-disabled"); a.removeAttribute("href"); a.setAttribute("aria-disabled", "true"); if (a.dataset.emptyText) a.textContent = a.dataset.emptyText; }
  });
  document.querySelectorAll("[data-config-email]").forEach(function (a) {
    var v = cfg.CONTACT_EMAIL;
    if (v) { a.href = "mailto:" + v; a.textContent = v; }
  });

  // ---------- Lightbox for galleries ----------
  var gallery = document.querySelectorAll(".gallery a");
  if (gallery.length) {
    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML = '<button class="lb-close" aria-label="Close">×</button><button class="lb-prev" aria-label="Previous photo">‹</button><img alt=""><button class="lb-next" aria-label="Next photo">›</button>';
    document.body.appendChild(box);
    var lbImg = box.querySelector("img");
    var idx = 0;
    function show(i) {
      idx = (i + gallery.length) % gallery.length;
      var a = gallery[idx];
      lbImg.src = a.getAttribute("href");
      lbImg.alt = a.querySelector("img").alt;
    }
    function close() { box.classList.remove("open"); document.body.style.overflow = ""; }
    gallery.forEach(function (a, i) {
      a.addEventListener("click", function (e) {
        e.preventDefault(); show(i); box.classList.add("open"); document.body.style.overflow = "hidden";
        box.querySelector(".lb-close").focus();
      });
    });
    box.querySelector(".lb-close").addEventListener("click", close);
    box.querySelector(".lb-prev").addEventListener("click", function () { show(idx - 1); });
    box.querySelector(".lb-next").addEventListener("click", function () { show(idx + 1); });
    box.addEventListener("click", function (e) { if (e.target === box) close(); });
    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(idx - 1);
      if (e.key === "ArrowRight") show(idx + 1);
    });
  }

  // ---------- SugarWOD embed ----------
  var sw = document.getElementById("sugarwod-embed");
  if (sw) {
    if (cfg.SUGARWOD_HTML_URL) {
      sw.innerHTML = '<iframe src="' + cfg.SUGARWOD_HTML_URL + '" title="Workouts from SugarWOD" loading="lazy"></iframe>';
      sw.classList.add("live");
    }
  }

  // ---------- Contact form ----------
  var form = document.getElementById("contact-form");
  if (form) {
    var status = form.querySelector(".form-status");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var data = new FormData(form);
      if (cfg.FORM_ENDPOINT) {
        status.textContent = "Sending…";
        fetch(cfg.FORM_ENDPOINT, { method: "POST", body: data, headers: { Accept: "application/json" } })
          .then(function (r) {
            if (!r.ok) throw new Error();
            form.reset();
            status.textContent = "Thanks! A coach will get back to you soon.";
          })
          .catch(function () { status.textContent = "Something went wrong. Please email us instead."; });
      } else {
        var subject = "[West Tech CrossFit] " + data.get("topic") + " — " + data.get("name");
        var bodyText = data.get("message") + "\n\n— " + data.get("name") + " (" + data.get("role") + ")\n" + data.get("email");
        window.location.href = "mailto:" + (cfg.CONTACT_EMAIL || "") + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(bodyText);
        status.textContent = "Your email app should open with the message ready to send.";
      }
    });
  }

  // ---------- Motion ----------
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canObserve = "IntersectionObserver" in window;

  // Header shrinks once you scroll past the top
  if (header && canObserve) {
    var sentinel = document.createElement("div");
    sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:90px;pointer-events:none";
    body.prepend(sentinel);
    new IntersectionObserver(function (e) { header.classList.toggle("scrolled", !e[0].isIntersecting); }).observe(sentinel);
  }

  // "Scroll" cue on the home hero
  var hero = document.querySelector(".hero");
  if (hero) hero.insertAdjacentHTML("beforeend", '<div class="scroll-cue" aria-hidden="true"></div>');

  // Marker highlight behind section headings
  document.querySelectorAll(".section-head h2, .split h2").forEach(function (h) {
    h.innerHTML = '<span class="mark">' + h.innerHTML + "</span>";
  });

  // Numbers in the quick facts count up
  document.querySelectorAll(".fact strong").forEach(function (s) {
    var m = s.textContent.trim().match(/^(\D*)(\d+)(\D*)$/);
    if (m && +m[2] > 0) { s.dataset.count = m[2]; s.dataset.pre = m[1]; s.dataset.post = m[3]; }
  });
  function countUp(s) {
    var end = +s.dataset.count, t0 = null;
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / 1200, 1), eased = 1 - Math.pow(1 - p, 3);
      s.textContent = s.dataset.pre + Math.round(end * eased) + s.dataset.post;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Everything below fades/slides in as it scrolls into view
  var AUTO = ".section-head, .gallery a, .card, .bench, .event, .facts, .framed, .map, .ig-strip, .week, .wod-board, details, .cert, .stat, .contact-list li, .cta-band h2, .cta-band .btn, .photo-frame, .profile-block, .profile h1, .profile .role, .crumbs, .footer-grid > div";
  document.querySelectorAll(AUTO).forEach(function (el) {
    if (el.closest(".hero, .page-hero, .lightbox")) return;
    if (el.parentElement && el.parentElement.closest(".reveal")) return;
    el.classList.add("reveal");
    if (el.matches(".gallery a")) el.classList.add("zoom");
  });
  document.querySelectorAll(".split").forEach(function (s) {
    var kids = s.children;
    if (kids[0]) kids[0].classList.add("reveal", "from-left");
    if (kids[1]) kids[1].classList.add("reveal", "from-right");
  });

  function revealEl(el, delay) {
    setTimeout(function () {
      el.classList.add("in");
      el.querySelectorAll(".mark").forEach(function (m) { m.classList.add("in"); });
      el.querySelectorAll("[data-count]").forEach(countUp);
      // Hand the element back to its normal (snappy) hover transitions
      setTimeout(function () { el.classList.remove("reveal", "in", "from-left", "from-right", "zoom"); }, 950);
    }, delay);
  }

  var revealables = document.querySelectorAll(".reveal");
  if (reduceMotion || !canObserve) {
    revealables.forEach(function (el) { el.classList.add("in"); });
    document.querySelectorAll(".mark").forEach(function (m) { m.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      var perParent = new Map();
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var parent = en.target.parentElement, i = perParent.get(parent) || 0;
        perParent.set(parent, i + 1);
        revealEl(en.target, Math.min(i, 6) * 90);
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    revealables.forEach(function (el) { io.observe(el); });
  }
})();
