/* Shared header, footer, privacy banner and interactions for every page.
   Each page sets <body data-root="" data-page="home">; pages inside /coaches use data-root="../".
   Header/footer text and the menu come from assets/js/config.js (editable in /admin → Settings).
   When the admin editor loads a page it sets window.CMS_EDIT = true, which turns off anything
   that would change the page's content (animations, link rewriting, the privacy banner). */
(function () {
  var cfg = window.SITE_CONFIG || {};
  var EDIT = window.CMS_EDIT === true;
  var body = document.body;
  var root = body.dataset.root || "";
  var page = body.dataset.page || "";
  if (EDIT) document.documentElement.classList.add("cms-edit");

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function lines(s) { return esc(s).split(/\n/).join("<br>"); }
  function link(href) { href = href || ""; if (/^(https?:|mailto:|tel:|#)/.test(href)) return href; return (root + href) || "./"; }

  var NAV = (cfg.NAV && cfg.NAV.length) ? cfg.NAV : [
    { label: "Home", href: "" }, { label: "About", href: "about" }, { label: "Coaches", href: "coaches/" },
    { label: "Schedule", href: "schedule" }, { label: "Events", href: "events" }, { label: "WOD", href: "wod" }, { label: "Contact", href: "contact" }
  ];
  function navLink(n, extra) {
    var key = String(n.href || "").replace(/\/$/, "") || "home";
    var cur = key === page ? ' aria-current="page"' : "";
    var ext = /^https?:/.test(n.href || "") ? ' target="_blank" rel="noopener"' : "";
    return '<a href="' + esc(link(n.href)) + '"' + cur + ext + (extra || "") + ">" + esc(n.label) + "</a>";
  }

  var IG_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zm0 3.4a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8zm0 10.6a4.2 4.2 0 1 1 0-8.4 4.2 4.2 0 0 1 0 8.4zm6.7-11.9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>';

  // ---------- Header ----------
  var header = document.getElementById("site-header");
  if (header) {
    header.innerHTML =
      '<div class="topbar"><div class="wrap topbar-inner">' +
        "<span>" + esc(cfg.TOPBAR_TEXT || "Mon · Wed · Fri 3:00 PM · WCTA CrossFit Gym") + "</span>" +
        '<a href="' + esc(cfg.INSTAGRAM_URL || "#") + '" target="_blank" rel="noopener">' + IG_ICON + " " + esc(cfg.INSTAGRAM_HANDLE || "") + "</a>" +
      "</div></div>" +
      '<nav class="nav wrap" aria-label="Main">' +
        '<a class="brand" href="' + esc(link("")) + '"><img src="' + root + 'assets/img/logo.svg" alt="West Tech CrossFit home" width="190" height="76"></a>' +
        '<button class="nav-toggle" aria-expanded="false" aria-controls="nav-links"><span></span><span></span><span></span><span class="sr-only">Menu</span></button>' +
        '<ul id="nav-links" class="nav-links">' + NAV.map(function (n) { return "<li>" + navLink(n) + "</li>"; }).join("") +
          '<li class="nav-cta"><a class="btn btn-pink" href="' + esc(link("join")) + '">' + esc(cfg.JOIN_BUTTON_TEXT || "Join Free") + "</a></li>" +
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
          '<p class="script">' + esc(cfg.FOOTER_TAGLINE || "The House of Hustle and Muscle") + "</p>" +
          (cfg.MISSION_TAGLINE ? '<p class="footer-mission">' + esc(cfg.MISSION_TAGLINE) + "</p>" : "") +
        "</div>" +
        "<div><h4>Visit</h4><p>" + lines(cfg.FOOTER_VISIT || "") + "</p></div>" +
        "<div><h4>Train</h4><p>" + lines(cfg.FOOTER_TRAIN || "") + "</p></div>" +
        '<div><h4>Explore</h4><ul class="footer-links">' +
          NAV.filter(function (n) { return n.href; }).map(function (n) { return "<li>" + navLink(n) + "</li>"; }).join("") +
          '<li><a href="' + esc(link("join")) + '">Join</a></li>' +
          '<li><a href="' + esc(cfg.INSTAGRAM_URL || "#") + '" target="_blank" rel="noopener">Instagram</a></li>' +
        "</ul></div>" +
      "</div>" +
      '<div class="wrap legal">' +
        "<p>This website is a student publication of the WCTA CrossFit Club. Its content is not endorsed by West Career &amp; Technical Academy or the Clark County School District.</p>" +
        "<p>CrossFit® is a registered trademark of CrossFit, LLC. West Tech CrossFit is an independently operated, non-profit CrossFit affiliate.</p>" +
        '<p class="legal-links"><a href="' + esc(link("terms")) + '">Terms of Use</a> · <a href="' + esc(link("privacy")) + '">Privacy Policy</a> · <button type="button" class="linklike" data-consent-open>Privacy settings</button></p>' +
        "<p>© " + new Date().getFullYear() + " West Tech CrossFit · WCTA Wranglers" + (cfg.MISSION_TAGLINE ? " · " + esc(cfg.MISSION_TAGLINE) : "") + "</p>" +
      "</div>";
  }

  // ---------- Privacy choice (Accept / Decline) ----------
  var CONSENT_KEY = "wtcf-consent-v1";
  function readConsent() { try { var v = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null"); return v && v.choice; } catch (e) { return null; } }
  window.SITE_CONSENT = readConsent();
  window.siteHasConsent = function () { return window.SITE_CONSENT === "accepted"; };
  function setConsent(choice) {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: choice, date: new Date().toISOString() })); } catch (e) {}
    window.SITE_CONSENT = choice;
    try { document.dispatchEvent(new CustomEvent("site:consent", { detail: choice })); } catch (e) {}
    renderEmbeds();
  }
  function showConsentBar() {
    if (EDIT) return;
    var old = document.getElementById("consent-bar");
    if (old) old.remove();
    var bar = document.createElement("div");
    bar.id = "consent-bar";
    bar.className = "consent-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Privacy choices");
    bar.innerHTML =
      '<div class="consent-inner">' +
        '<div class="consent-text"><strong>Your privacy, your call.</strong>' +
          "We don't run ads or trackers. A few extras, like the Google map and the live WOD feed, come from outside services that may collect data. " +
          "Accept to turn them on, or decline to keep them off. " +
          '<a href="' + esc(link("terms")) + '">Terms of Use</a> · <a href="' + esc(link("privacy")) + '">Privacy Policy</a></div>' +
        '<div class="consent-actions">' +
          '<button type="button" class="btn" data-consent="declined">Decline</button>' +
          '<button type="button" class="btn btn-pink" data-consent="accepted">Accept</button>' +
        "</div>" +
      "</div>";
    body.appendChild(bar);
    setTimeout(function () { bar.classList.add("show"); }, 60);
    bar.querySelectorAll("[data-consent]").forEach(function (b) {
      b.addEventListener("click", function () {
        setConsent(b.dataset.consent);
        bar.classList.remove("show");
        setTimeout(function () { bar.remove(); }, 500);
      });
    });
  }
  if (!EDIT) {
    if (!window.SITE_CONSENT) showConsentBar();
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("[data-consent-open]");
      if (t) { e.preventDefault(); showConsentBar(); }
    });
  }

  // ---------- Outside content that needs consent (maps, SugarWOD) ----------
  function placeholder(name, note) {
    return '<div class="embed-placeholder"><strong>' + esc(name) + '</strong><span>' + esc(note) + '</span><button type="button" class="btn btn-yellow">Load it this time</button></div>';
  }
  function renderEmbeds() {
    document.querySelectorAll("[data-consent-embed]").forEach(function (box) {
      var name = box.dataset.embedName || "Outside content";
      if (EDIT) { box.innerHTML = '<div class="embed-placeholder"><strong>' + esc(name) + "</strong><span>Shows here on the live site.</span></div>"; return; }
      if (box.querySelector("iframe")) return;
      if (window.SITE_CONSENT === "accepted" || box.dataset.loadOnce) {
        box.innerHTML = '<iframe src="' + esc(box.dataset.consentEmbed) + '" title="' + esc(box.dataset.embedTitle || name) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>';
      } else {
        box.innerHTML = placeholder(name + " is off", "It comes from an outside service that may collect data, so it only loads if you accept.");
        box.querySelector("button").addEventListener("click", function () { box.dataset.loadOnce = "1"; renderEmbeds(); });
      }
    });
    var sw = document.getElementById("sugarwod-embed");
    if (sw && cfg.SUGARWOD_HTML_URL && !EDIT && !sw.querySelector("iframe")) {
      if (window.SITE_CONSENT === "accepted" || sw.dataset.loadOnce) {
        sw.innerHTML = '<iframe src="' + esc(cfg.SUGARWOD_HTML_URL) + '" title="Workouts from SugarWOD" loading="lazy"></iframe>';
        sw.classList.add("live");
      } else if (!sw.querySelector(".sw-note")) {
        sw.insertAdjacentHTML("afterbegin", '<div class="sw-note">' + placeholder("The live SugarWOD feed is off", "Accept in the privacy banner, or load it just this once.") + "</div>");
        sw.querySelector(".sw-note button").addEventListener("click", function () { sw.dataset.loadOnce = "1"; renderEmbeds(); });
      }
    }
  }
  renderEmbeds();

  // ---------- Placeholder images: hide broken <img> and keep the styled placeholder ----------
  document.querySelectorAll("img[data-fallback]").forEach(function (img) {
    function fail() {
      var slot = img.closest(".photo-slot");
      if (slot) slot.classList.add("empty");
      if (EDIT) img.classList.add("cms-missing"); else img.remove();
    }
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) fail();
    else img.addEventListener("error", fail);
  });

  if (EDIT) return; // everything below changes the page at runtime, so the editor skips it

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
    body.appendChild(box);
    var lbImg = box.querySelector("img");
    var idx = 0;
    var showPhoto = function (i) {
      idx = (i + gallery.length) % gallery.length;
      var a = gallery[idx];
      lbImg.src = a.getAttribute("href");
      lbImg.alt = a.querySelector("img") ? a.querySelector("img").alt : "";
    };
    var closeBox = function () { box.classList.remove("open"); body.style.overflow = ""; };
    gallery.forEach(function (a, i) {
      a.addEventListener("click", function (e) {
        e.preventDefault(); showPhoto(i); box.classList.add("open"); body.style.overflow = "hidden";
        box.querySelector(".lb-close").focus();
      });
    });
    box.querySelector(".lb-close").addEventListener("click", closeBox);
    box.querySelector(".lb-prev").addEventListener("click", function () { showPhoto(idx - 1); });
    box.querySelector(".lb-next").addEventListener("click", function () { showPhoto(idx + 1); });
    box.addEventListener("click", function (e) { if (e.target === box) closeBox(); });
    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("open")) return;
      if (e.key === "Escape") closeBox();
      if (e.key === "ArrowLeft") showPhoto(idx - 1);
      if (e.key === "ArrowRight") showPhoto(idx + 1);
    });
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
  var AUTO = ".section-head, .gallery a, .card, .bench, .event, .facts, .framed, .map, .ig-strip, .week, .wod-board, details, .cert, .stat, .contact-list li, .cta-band h2, .cta-band .btn, .photo-frame, .profile-block, .profile h1, .profile .role, .crumbs, .footer-grid > div, .mission-band .wrap, .legal-doc > h2";
  document.querySelectorAll(AUTO).forEach(function (el) {
    if (el.closest(".hero, .page-hero, .lightbox, .consent-bar")) return;
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
