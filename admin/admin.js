/* West Tech CrossFit — Site Builder
   A visual editor for the real pages. It loads each page's HTML straight from the GitHub repo,
   lets you click to edit text and photos, add/move/remove sections, and publishes a single commit.
   Claude (or anyone) can keep changing the site in the repo; the builder always opens the newest version. */
(() => {
  "use strict";

  // ---------------------------------------------------------------- setup
  const AC = window.ADMIN_CONFIG || {};
  const OWNER = AC.OWNER, REPO = AC.REPO, BRANCH = AC.BRANCH || "main";
  const DEV = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const SITE_URL = location.href.split(/\/admin(?:\/|\?|#|$)/)[0] + "/";
  const API = "https://api.github.com";
  const TOKEN_KEY = "wtcf-admin-token";
  const CONFIG_PATH = "assets/js/config.js";
  const CONFIG_HEADER = "/* SITE SETTINGS — edit these in the admin (yoursite/admin → Settings) or by hand.\n   Keep everything between the braces valid JSON so the admin can read it. */\n";
  const PAGE_ORDER = ["index.html", "about.html", "coaches/index.html", "schedule.html", "events.html", "wod.html", "join.html", "contact.html"];

  const S = {
    token: null, user: null, backend: null,
    tree: {}, head: null,
    pages: {}, order: [], current: null,
    config: {}, configSha: null, configBaseline: "", configDirty: false,
    uploads: {}, deletes: new Set(),
    selected: null, mode: "edit", device: "desktop", tab: "pages",
    nextId: 1, phCache: null,
  };

  // ---------------------------------------------------------------- tiny helpers
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cur = () => S.pages[S.current];
  const depth = (p) => (p.match(/\//g) || []).length;
  const relPrefix = (p) => "../".repeat(depth(p));
  const cleanUrl = (p) => p.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "");
  const isPage = (p) => /\.html$/.test(p) && !/^(admin|assets|images)\//.test(p) && p !== "404.html";
  const isImage = (p) => /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(p) && /^(images|assets\/img)\//.test(p);
  const slugify = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const stamp = () => new Date().toISOString().replace(/\D/g, "").slice(0, 14);

  function resolvePath(pagePath, src) { try { return new URL(src, "https://x.invalid/" + pagePath).pathname.replace(/^\//, ""); } catch (e) { return src; } }
  function prettyName(p) {
    const fixed = { "index.html": "Home", "coaches/index.html": "Coaches", "wod.html": "WOD" };
    if (fixed[p]) return fixed[p];
    const n = p.replace(/\.html$/, "").split("/").pop().replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return p.startsWith("coaches/") ? "Coach · " + n : n;
  }
  function timeAgo(d) {
    const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return "just now";
    const m = Math.round(s / 60); if (m < 60) return m + " min ago";
    const h = Math.round(m / 60); if (h < 24) return h + " hr ago";
    const dd = Math.round(h / 24); if (dd < 30) return dd + " day" + (dd > 1 ? "s" : "") + " ago";
    return new Date(d).toLocaleDateString();
  }
  function b64ToUtf8(b64) {
    const bin = atob(String(b64).replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // ---------------------------------------------------------------- icons
  const P = {
    pages: "M7 3h7l5 5v13H7zM14 3v5h5", mark: "M14.5 4.5l5 5-8 8-5-5zM9 15l-4 4h6", image: "M3 5h18v14H3zM3 16l5-5 5 5 3-3 5 5M15.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
    gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12h2M3 12h2M12 3v2M12 19v2M17 7l1.5-1.5M5.5 18.5L7 17M17 17l1.5 1.5M5.5 5.5L7 7",
    clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2", help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01",
    undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3", redo: "M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
    desktop: "M3 4h18v12H3zM8 20h8M12 16v4", tablet: "M6 2h12v20H6zM11 18h2", phone: "M8 2h8v20H8zM11 18h2",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", pencil: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
    upload: "M12 16V4M7 9l5-5 5 5M4 20h16", plus: "M12 5v14M5 12h14", trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
    up: "M12 19V5M6 11l6-6 6 6", down: "M12 5v14M6 13l6 6 6-6", copy: "M9 9h11v11H9zM5 15V4h11",
    link: "M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1", unlink: "M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1M3 3l18 18",
    bold: "M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z", italic: "M19 4h-9M14 20H5M15 4L9 20", eraser: "M16 3l5 5-11 11H5l-2-2zM9 19h12",
    ext: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6", x: "M6 6l12 12M18 6L6 18", check: "M5 12l5 5 9-10", rocket: "M9 15l-3-3c1-4 5-9 12-9 0 7-5 11-9 12zM5 15c-1 2-1 4-1 4s2 0 4-1M15 8a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
    layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5", file: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6", text: "M5 6V4h14v2M12 4v16M9 20h6", section: "M3 5h18v6H3zM3 15h18v4H3z",
    sparkle: "M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z", menu: "M4 6h16M4 12h16M4 18h16", github: "",
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="${P[n] || ""}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  // ---------------------------------------------------------------- toasts, modals, loading
  function toast(msg, kind = "info", ms = 3400) {
    const t = document.createElement("div");
    t.className = "toast " + kind; t.innerHTML = msg;
    $("#toasts").appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, ms);
  }
  function setLoading(msg) {
    const L = $("#loading");
    if (!msg) return L.classList.add("hidden");
    $("#loading-msg").textContent = msg; L.classList.remove("hidden");
  }
  function modal({ title, body, actions = [], wide = false, onClose }) {
    const wrap = document.createElement("div");
    wrap.className = "modal-back";
    wrap.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-close aria-label="Close">${icon("x")}</button></div><div class="modal-body"></div><div class="modal-foot"></div></div>`;
    const b = $(".modal-body", wrap);
    if (typeof body === "string") b.innerHTML = body; else if (body) b.appendChild(body);
    const foot = $(".modal-foot", wrap);
    let closed = false;
    const close = () => { if (closed) return; closed = true; wrap.classList.remove("show"); setTimeout(() => wrap.remove(), 200); document.removeEventListener("keydown", onKey); onClose && onClose(); };
    actions.forEach((a) => {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "btn " + (a.kind || ""); btn.innerHTML = a.label;
      btn.addEventListener("click", () => (a.onClick ? a.onClick(close, wrap, btn) : close()));
      foot.appendChild(btn);
    });
    if (!actions.length) foot.remove();
    wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) close(); });
    $("[data-close]", wrap).addEventListener("click", close);
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    $("#modal-root").appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add("show"));
    return { el: wrap, close };
  }
  function ask(title, text, okLabel = "OK", kind = "primary") {
    return new Promise((res) => {
      modal({ title, body: `<p>${text}</p>`, onClose: () => res(false),
        actions: [{ label: "Cancel", onClick: (c) => { res(false); c(); } }, { label: okLabel, kind, onClick: (c) => { res(true); c(); } }] });
    });
  }
  function prompt2(title, label, value = "", placeholder = "") {
    return new Promise((res) => {
      const body = document.createElement("div");
      body.innerHTML = `<label class="field"><span>${esc(label)}</span><input type="text" value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`;
      const inp = $("input", body);
      let done = false;
      const m = modal({ title, body, onClose: () => { if (!done) res(null); },
        actions: [{ label: "Cancel", onClick: (c) => { done = true; res(null); c(); } }, { label: "Save", kind: "primary", onClick: (c) => { done = true; res(inp.value); c(); } }] });
      setTimeout(() => { inp.focus(); inp.select(); }, 50);
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { done = true; res(inp.value); m.close(); } });
    });
  }

  // ---------------------------------------------------------------- backends
  const GH = {
    async req(method, path, body) {
      const r = await fetch(API + path, {
        method, cache: "no-store",
        headers: Object.assign({ Authorization: "Bearer " + S.token, Accept: "application/vnd.github+json" }, body ? { "Content-Type": "application/json" } : {}),
        body: body ? JSON.stringify(body) : undefined,
      });
      if (r.status === 401) { const e = new Error("Your GitHub sign-in expired. Sign in again — your edits are kept as a draft on this computer."); e.code = 401; throw e; }
      if (!r.ok) { let m = ""; try { m = (await r.json()).message; } catch (e) {} throw new Error("GitHub said: " + (m || r.status + " " + r.statusText)); }
      return r.status === 204 ? null : r.json();
    },
    async loadTree() {
      const ref = await this.req("GET", `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
      const head = ref.object.sha;
      const commit = await this.req("GET", `/repos/${OWNER}/${REPO}/git/commits/${head}`);
      const tree = await this.req("GET", `/repos/${OWNER}/${REPO}/git/trees/${commit.tree.sha}?recursive=1`);
      const files = {};
      tree.tree.forEach((t) => { if (t.type === "blob") files[t.path] = t.sha; });
      return { head, treeSha: commit.tree.sha, files };
    },
    async readText(path) {
      const sha = S.tree[path];
      if (!sha) throw new Error(path + " isn't in the repo.");
      const blob = await this.req("GET", `/repos/${OWNER}/${REPO}/git/blobs/${sha}`);
      return { text: b64ToUtf8(blob.content), sha };
    },
    async readTextAt(path, ref) {
      const r = await this.req("GET", `/repos/${OWNER}/${REPO}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${ref}`);
      return b64ToUtf8(r.content);
    },
    async commits(path) {
      return this.req("GET", `/repos/${OWNER}/${REPO}/commits?sha=${BRANCH}&per_page=20` + (path ? "&path=" + encodeURIComponent(path) : ""));
    },
    async commit(tree, files, message, onStep) {
      const entries = [];
      let i = 0;
      for (const f of files) {
        i++; onStep && onStep(`Uploading ${i} of ${files.length}: ${f.path}`);
        if (f.delete) { if (tree.files[f.path]) entries.push({ path: f.path, mode: "100644", type: "blob", sha: null }); continue; }
        const blob = await this.req("POST", `/repos/${OWNER}/${REPO}/git/blobs`, f.b64 != null ? { content: f.b64, encoding: "base64" } : { content: f.text, encoding: "utf-8" });
        entries.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
      }
      onStep && onStep("Saving the new version…");
      const newTree = await this.req("POST", `/repos/${OWNER}/${REPO}/git/trees`, { base_tree: tree.treeSha, tree: entries });
      const commit = await this.req("POST", `/repos/${OWNER}/${REPO}/git/commits`, { message, tree: newTree.sha, parents: [tree.head] });
      onStep && onStep("Publishing…");
      await this.req("PATCH", `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha });
      return commit;
    },
  };

  // Local test mode (localhost): reads files from the local server, publishing is switched off.
  const DEV_FILES = ["index.html", "about.html", "coaches/index.html", "coaches/eric-swenson.html", "coaches/cresen-swenson.html", "coaches/grayson-gearin.html", "schedule.html", "events.html", "wod.html", "join.html", "contact.html", "terms.html", "privacy.html", CONFIG_PATH,
    "images/gallery/dumbbell-snatch.jpg", "images/gallery/overhead-lockout.jpg", "images/gallery/row-sprint.jpg", "images/gallery/pull-up-crowd.jpg", "images/gallery/after-the-workout.jpg", "images/gallery/game-day-gym.jpg", "images/gallery/rower-mural.jpg", "images/gallery/judge-high-five.jpg", "images/gallery/between-stations.jpg", "images/gallery/outdoor-lift.jpg", "images/team/memorial-day-crew.jpg", "assets/img/logo.svg", "assets/img/logo-mark.svg"];
  const DEVB = {
    async loadTree() { const files = {}; DEV_FILES.forEach((p) => (files[p] = "local")); return { head: "local", treeSha: "local", files }; },
    async readText(path) { const r = await fetch(SITE_URL + path, { cache: "no-store" }); if (!r.ok) throw new Error("Couldn't load " + path); return { text: await r.text(), sha: "local" }; },
    async readTextAt() { throw new Error("History is only available on the live admin."); },
    async commits() { return []; },
    async commit() { throw new Error("Publishing is turned off in local test mode. Use the live admin to publish."); },
  };
  const B = () => S.backend;

  // ---------------------------------------------------------------- page models
  const parseHTML = (t) => new DOMParser().parseFromString(t, "text/html");
  function serialize(doc, keepIds) {
    const el = doc.documentElement.cloneNode(true);
    if (!keepIds) { el.removeAttribute("data-cms-id"); el.querySelectorAll("[data-cms-id]").forEach((x) => x.removeAttribute("data-cms-id")); }
    return "<!doctype html>\n" + el.outerHTML + "\n";
  }
  function assignIds(doc) { [doc.body, ...doc.body.querySelectorAll("*")].forEach((el) => el.setAttribute("data-cms-id", String(S.nextId++))); }
  function reId(el) { [el, ...el.querySelectorAll("*")].forEach((x) => x.setAttribute("data-cms-id", String(S.nextId++))); }
  const byId = (doc, id) => doc.querySelector(`[data-cms-id="${id}"]`);
  const fdoc = () => { const f = $("#frame"); return f && f.contentDocument; };
  const inFrame = (id) => { const d = fdoc(); return d && d.querySelector(`[data-cms-id="${id}"]`); };
  function bumpIds(doc) { $$("[data-cms-id]", doc).forEach((x) => { const n = +x.getAttribute("data-cms-id"); if (n >= S.nextId) S.nextId = n + 1; }); }

  function makeModel(path, text, sha) {
    const doc = parseHTML(text);
    const baseline = serialize(doc, false);
    assignIds(doc);
    return { path, sha, doc, baseline, dirty: false, undo: [], redo: [], isNew: false };
  }
  async function getPage(path) {
    if (S.pages[path]) return S.pages[path];
    const { text, sha } = await B().readText(path);
    const m = makeModel(path, text, sha);
    const d = readDraft(path);
    if (d && d.html && d.html !== m.baseline) m.draft = d;
    S.pages[path] = m;
    return m;
  }
  function markDirty(m) {
    m.dirty = m.isNew || serialize(m.doc, false) !== m.baseline;
    if (m.dirty) saveDraftSoon(m); else clearDraft(m.path);
    S.phCache = null;
    updateChrome();
  }
  function pushUndo(m) { m.undo.push(serialize(m.doc, true)); if (m.undo.length > 80) m.undo.shift(); m.redo = []; updateChrome(); }
  function restoreSnapshot(m, html) { m.doc = parseHTML(html); bumpIds(m.doc); markDirty(m); render(); renderInspector(); }
  function undo() { const m = cur(); if (!m || !m.undo.length) return; m.redo.push(serialize(m.doc, true)); restoreSnapshot(m, m.undo.pop()); }
  function redo() { const m = cur(); if (!m || !m.redo.length) return; m.undo.push(serialize(m.doc, true)); restoreSnapshot(m, m.redo.pop()); }

  // drafts (kept in this browser until published or discarded)
  const draftKey = (k) => "wtcf-draft:" + OWNER + "/" + REPO + ":" + k;
  function readDraft(k) { try { return JSON.parse(localStorage.getItem(draftKey(k)) || "null"); } catch (e) { return null; } }
  function writeDraft(k, data) { try { localStorage.setItem(draftKey(k), JSON.stringify(Object.assign({ at: Date.now() }, data))); } catch (e) {} }
  function clearDraft(k) { try { localStorage.removeItem(draftKey(k)); } catch (e) {} }
  const draftTimers = {};
  function saveDraftSoon(m) { clearTimeout(draftTimers[m.path]); draftTimers[m.path] = setTimeout(() => writeDraft(m.path, { baseSha: m.sha, html: serialize(m.doc, false), isNew: m.isNew }), 500); }
  function saveAllDrafts() { Object.values(S.pages).forEach((m) => { if (m.dirty) writeDraft(m.path, { baseSha: m.sha, html: serialize(m.doc, false), isNew: m.isNew }); }); if (S.configDirty) writeDraft("config", { html: configText() }); }

  // config.js
  function parseConfig(text) { const m = text.match(/SITE_CONFIG\s*=\s*(\{[\s\S]*\})\s*;?\s*$/); try { return m ? JSON.parse(m[1]) : {}; } catch (e) { toast("Couldn't read config.js — Settings may be incomplete.", "error"); return {}; } }
  const configText = () => CONFIG_HEADER + "window.SITE_CONFIG = " + JSON.stringify(S.config, null, 2) + ";\n";
  async function loadConfig() {
    const { text, sha } = await B().readText(CONFIG_PATH);
    S.configSha = sha; S.configBaseline = text; S.config = parseConfig(text); S.configDirty = false;
    const d = readDraft("config");
    if (d && d.html && d.html !== text) { S.config = parseConfig(d.html); S.configDirty = true; toast("Restored your unpublished Settings changes."); }
  }
  function configChanged() { S.configDirty = configText() !== S.configBaseline; if (S.configDirty) writeDraft("config", { html: configText() }); else clearDraft("config"); updateChrome(); rerenderSoon(); }

  // ---------------------------------------------------------------- rendering the page into the editor
  const INLINE = new Set(["A", "B", "STRONG", "I", "EM", "SPAN", "BR", "SMALL", "SUP", "SUB", "MARK", "CODE", "U", "S"]);
  const SKIP_SEL = "script,style,iframe,svg,select,textarea,input,option,noscript,#site-header,#site-footer,[data-config-email],[data-consent-embed],.embed-placeholder,.lightbox";
  function inlineDeep(el) { for (const c of el.children) { if (!INLINE.has(c.tagName) || !inlineDeep(c)) return false; } return true; }
  function isUnit(el) {
    if (el.matches(SKIP_SEL)) return false;
    let text = false;
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { if (n.textContent.trim()) text = true; }
      else if (n.nodeType === 1) { if (!INLINE.has(n.tagName) || !inlineDeep(n)) return false; if (n.textContent.trim()) text = true; }
    }
    return text;
  }
  function markUnits(el) { for (const c of el.children) { if (c.matches(SKIP_SEL)) continue; if (isUnit(c)) c.setAttribute("data-cms-text", ""); else markUnits(c); } }

  const EDIT_CSS = `
    [data-cms-text]{cursor:text;outline:2px dashed transparent;outline-offset:3px;border-radius:3px;transition:outline-color .15s}
    [data-cms-text]:hover{outline-color:rgba(56,200,240,.95)}
    [data-cms-text].cms-sel-text,[data-cms-text][contenteditable="true"]{outline:3px solid #FF6EB4 !important;outline-offset:3px;background-color:rgba(255,110,180,.07)}
    img[data-cms-id]{cursor:pointer}
    img[data-cms-id]:hover{outline:3px dashed #38C8F0;outline-offset:-3px}
    .photo-slot{cursor:pointer}
    .cms-sel-img{outline:4px solid #FF6EB4 !important;outline-offset:-4px}
    .cms-sel-block{outline:3px solid #9B7BFF !important;outline-offset:2px}
    .cms-sel-section{box-shadow:inset 0 0 0 3px rgba(155,123,255,.55) !important}
    .tbd{cursor:pointer;box-shadow:0 0 0 2px rgba(229,184,0,.35)}
    #site-header,#site-footer{cursor:not-allowed}
    a,button{cursor:text}
    .cms-flash{animation:cmsflash 1.6s ease 2}
    @keyframes cmsflash{0%,100%{box-shadow:none}50%{box-shadow:0 0 0 6px #FFE14D}}
    .lightbox,.consent-bar{display:none !important}`;

  function buildRenderHTML(m, preview) {
    const d = parseHTML(serialize(m.doc, true));
    const dir = m.path.includes("/") ? m.path.slice(0, m.path.lastIndexOf("/") + 1) : "";
    const base = d.createElement("base"); base.href = SITE_URL + dir;
    d.head.prepend(base);
    if (!preview) {
      const flag = d.createElement("script"); flag.textContent = "window.CMS_EDIT = true;";
      base.after(flag);
      const st = d.createElement("style"); st.textContent = EDIT_CSS; d.head.appendChild(st);
      $$("details", d).forEach((x) => x.setAttribute("open", ""));
      markUnits(d.body);
    }
    $$("script[src]", d).forEach((s) => {
      if (/assets\/js\/config\.js/.test(s.getAttribute("src"))) {
        const inline = d.createElement("script");
        inline.textContent = "window.SITE_CONFIG = " + JSON.stringify(S.config).replace(/</g, "\\u003c") + ";";
        s.replaceWith(inline);
      }
    });
    $$("img[src]", d).forEach((img) => { const p = resolvePath(m.path, img.getAttribute("src")); if (S.uploads[p]) img.setAttribute("src", S.uploads[p].dataUrl); });
    $$("a[href]", d).forEach((a) => { const p = resolvePath(m.path, a.getAttribute("href")); if (S.uploads[p]) a.setAttribute("href", S.uploads[p].dataUrl); });
    return "<!doctype html>\n" + d.documentElement.outerHTML;
  }

  let renderToken = 0;
  function render(opts = {}) {
    const m = cur(); if (!m) return;
    const f = $("#frame");
    const prev = opts.scrollTo != null ? opts.scrollTo : ((f.contentWindow && f.contentWindow.scrollY) || 0);
    const my = ++renderToken;
    f.onload = () => {
      if (my !== renderToken) return;
      bindFrame();
      try { f.contentWindow.scrollTo(0, prev); } catch (e) {}
      if (opts.select) reselect(opts.select);
      else if (S.selected) reselect(S.selected.id, true);
      if (opts.flash) flashEl(opts.flash);
    };
    f.srcdoc = buildRenderHTML(m, S.mode === "preview");
  }
  const rerenderSoon = debounce(() => render(), 350);

  function flashEl(id) {
    const el = inFrame(id); if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.classList.add("cms-flash");
    setTimeout(() => el.classList.remove("cms-flash"), 3400);
  }

  // ---------------------------------------------------------------- editing inside the frame
  function clearFrameSelection() {
    const d = fdoc(); if (!d) return;
    $$("[contenteditable]", d).forEach((x) => { x.removeAttribute("contenteditable"); x.removeAttribute("spellcheck"); });
    $$(".cms-sel-img,.cms-sel-block,.cms-sel-text,.cms-sel-section", d).forEach((x) => x.classList.remove("cms-sel-img", "cms-sel-block", "cms-sel-text", "cms-sel-section"));
  }
  function deselect() { clearFrameSelection(); S.selected = null; renderInspector(); }
  function markSection(el) { const sec = el && el.closest("main > *"); if (sec) sec.classList.add("cms-sel-section"); }

  function reselect(id, quiet) {
    const el = inFrame(id);
    if (!el) { S.selected = null; renderInspector(); return; }
    clearFrameSelection();
    const kind = S.selected && S.selected.id === id ? S.selected.kind : (el.tagName === "IMG" ? "image" : el.hasAttribute("data-cms-text") ? "text" : "block");
    S.selected = { kind, id };
    el.classList.add(kind === "image" ? "cms-sel-img" : kind === "text" ? "cms-sel-text" : "cms-sel-block");
    markSection(el);
    if (!quiet) el.scrollIntoView({ block: "nearest" });
    renderInspector();
  }

  function selectText(unit, e) {
    const id = unit.getAttribute("data-cms-id");
    if (S.selected && S.selected.id === id && unit.isContentEditable) { renderInspector(); return; }
    clearFrameSelection();
    unit.setAttribute("contenteditable", "true");
    unit.setAttribute("spellcheck", "true");
    unit.classList.add("cms-sel-text");
    markSection(unit);
    unit.focus({ preventScroll: true });
    const d = fdoc();
    if (e && d.caretRangeFromPoint) {
      const r = d.caretRangeFromPoint(e.clientX, e.clientY);
      if (r && unit.contains(r.startContainer)) { const sel = d.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
    }
    S.selected = { kind: "text", id };
    renderInspector();
  }
  function selectImage(img) {
    clearFrameSelection();
    img.classList.add("cms-sel-img"); markSection(img);
    S.selected = { kind: "image", id: img.getAttribute("data-cms-id") };
    renderInspector();
  }
  function selectBlock(el) {
    const target = el.closest(REPEAT_SEL) || el.closest("main > *") || el;
    if (!target.hasAttribute("data-cms-id")) return;
    clearFrameSelection();
    target.classList.add("cms-sel-block"); markSection(target);
    S.selected = { kind: "block", id: target.getAttribute("data-cms-id") };
    renderInspector();
  }

  function bindFrame() {
    const d = fdoc(); if (!d) return;
    if (S.mode === "preview") {
      d.addEventListener("click", (e) => { const a = e.target.closest("a[href]"); if (a && !/^#/.test(a.getAttribute("href"))) { e.preventDefault(); toast("Links are switched off in Preview so you stay in the builder."); } }, true);
      d.addEventListener("submit", (e) => e.preventDefault(), true);
      return;
    }
    d.addEventListener("click", onFrameClick, true);
    d.addEventListener("input", onFrameInput, true);
    d.addEventListener("keydown", onFrameKey, true);
    d.addEventListener("paste", onFramePaste, true);
    d.addEventListener("drop", (e) => e.preventDefault(), true);
    d.addEventListener("dragstart", (e) => e.preventDefault(), true);
    d.addEventListener("submit", (e) => e.preventDefault(), true);
    d.addEventListener("keydown", onShortcut, true);
  }

  function onFrameClick(e) {
    const t = e.target;
    if (t.closest("a, button, summary, label")) e.preventDefault();
    if (t.closest("#site-header, #site-footer")) { toast("The menu, top bar and footer are edited in <b>Settings</b>."); openTab("settings"); return; }
    const slot = t.closest(".photo-slot");
    const img = t.tagName === "IMG" ? t : (slot ? slot.querySelector("img") : null);
    if (img && img.hasAttribute("data-cms-id")) return selectImage(img);
    const unit = t.closest("[data-cms-text]");
    if (unit) return selectText(unit, e);
    const blk = t.closest("main [data-cms-id]");
    if (blk) return selectBlock(blk);
    deselect();
  }

  function cleanInner(unit) {
    const c = unit.cloneNode(true);
    const doc = unit.ownerDocument;
    $$("font", c).forEach((f) => f.replaceWith(...f.childNodes));
    $$("div, p", c).forEach((x) => { x.before(doc.createElement("br")); x.replaceWith(...x.childNodes); });
    $$("[contenteditable],[spellcheck]", c).forEach((x) => { x.removeAttribute("contenteditable"); x.removeAttribute("spellcheck"); });
    $$("[class]", c).forEach((x) => { x.classList.remove("cms-flash"); if (!x.getAttribute("class")) x.removeAttribute("class"); });
    $$("span:not([class]):not([style]):not([data-cms-id])", c).forEach((s) => s.replaceWith(...s.childNodes));
    return c.innerHTML.replace(/(<br>)+$/, "");
  }
  function syncUnit(unit) {
    const m = cur(); const src = byId(m.doc, unit.getAttribute("data-cms-id")); if (!src) return;
    const html = cleanInner(unit);
    if (src.innerHTML === html) return;
    if (!m._typing) pushUndo(m);
    m._typing = true; clearTimeout(m._tt); m._tt = setTimeout(() => (m._typing = false), 1200);
    src.innerHTML = html;
    markDirty(m);
    refreshPlaceholderCard();
  }
  function onFrameInput(e) { const u = e.target.closest && e.target.closest("[data-cms-text]"); if (u) syncUnit(u); }
  function onFramePaste(e) {
    if (!(e.target.closest && e.target.closest("[data-cms-text]"))) return;
    e.preventDefault();
    const t = (e.clipboardData || window.clipboardData).getData("text/plain");
    fdoc().execCommand("insertText", false, t.replace(/\r?\n+/g, " "));
  }
  function onFrameKey(e) {
    const unit = e.target.closest && e.target.closest("[data-cms-text]");
    if (!unit) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (!e.shiftKey && /^(H1|H2|H3|H4|H5|SUMMARY|BUTTON|A|STRONG|B)$/.test(unit.tagName)) { unit.blur(); deselect(); return; }
      fdoc().execCommand("insertLineBreak");
    }
    if (e.key === "Escape") { unit.blur(); deselect(); }
  }
  function onShortcut(e) {
    const mod = e.metaKey || e.ctrlKey; if (!mod) return;
    const k = e.key.toLowerCase();
    const editing = e.target && e.target.isContentEditable;
    if (k === "s") { e.preventDefault(); saveAllDrafts(); toast("Saved as a draft on this computer. Click <b>Publish</b> to put it live."); }
    else if (k === "enter") { e.preventDefault(); openPublish(); }
    else if (k === "z" && !editing) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (k === "b" && editing) { e.preventDefault(); fmt("bold"); }
    else if (k === "i" && editing) { e.preventDefault(); fmt("italic"); }
    else if (k === "k" && editing) { e.preventDefault(); addLink(); }
  }

  function fmt(cmd, val) {
    const d = fdoc(); if (!d || !S.selected || S.selected.kind !== "text") return;
    const u = inFrame(S.selected.id); if (!u) return;
    if (d.activeElement !== u) u.focus();
    try { d.execCommand("styleWithCSS", false, false); } catch (e) {}
    d.execCommand(cmd, false, val);
    syncUnit(u);
  }
  async function addLink() {
    const d = fdoc(); const sel = d.getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    if (!range || range.collapsed) return toast("Highlight the words you want to turn into a link first.");
    const url = await prompt2("Add a link", "Link address", "https://", "https://… or a page like join");
    if (!url) return;
    const u = inFrame(S.selected.id); u.focus();
    sel.removeAllRanges(); sel.addRange(range);
    fmt("createLink", url.trim());
  }

  // ---------------------------------------------------------------- items & sections
  const REPEAT_SEL = ".gallery > a, .grid > *, .steps > *, details, .timeline > li, .checklist > li, .cert-list > li, .event, .contact-list > li, .stat-row > *, .facts > .fact, .scales > .scale, .week > .day, .legal-doc li, .ticker-track > span, .footer-links > li";
  const SECTION_BG = { section: [["", "Plain"], ["bg-cyan", "Cyan"], ["bg-pink", "Pink"], ["bg-yellow", "Yellow"], ["bg-ink", "Black"]], "page-hero": [["", "Cyan"], ["pink", "Pink"], ["yellow", "Yellow"]] };

  function itemOf(srcEl) { const it = srcEl.closest(REPEAT_SEL); return it && it.closest("main") ? it : null; }
  function sectionOf(srcEl) { return srcEl.closest("main > *"); }
  function sectionLabel(sec) {
    const h = sec.querySelector("h1, h2, .eyebrow, h3, .mission-text");
    const t = h ? h.textContent.trim().replace(/\s+/g, " ") : "";
    return t ? (t.length > 34 ? t.slice(0, 32) + "…" : t) : (sec.className || "Section");
  }
  function itemLabel(it) {
    if (it.matches(".gallery > a")) return "Gallery photo";
    if (it.matches("details")) return "FAQ question";
    if (it.matches(".coach-card")) return "Coach card";
    if (it.matches(".event")) return "Event";
    if (it.matches(".bench")) return "Workout card";
    if (it.matches(".cert-list > li")) return "Certification";
    if (it.matches(".week > .day")) return "Day";
    if (it.matches("li")) return "List item";
    if (it.matches(".fact")) return "Fact";
    if (it.matches(".step")) return "Step";
    if (it.matches(".card")) return "Card";
    return "Item";
  }
  function op(fn, opts = {}) {
    const m = cur(); pushUndo(m);
    const res = fn(m);
    markDirty(m);
    render(Object.assign({}, opts, typeof res === "string" ? { select: res } : {}));
    if (res === null) { S.selected = null; renderInspector(); }
  }
  function duplicateEl(id) { op((m) => { const s = byId(m.doc, id); const c = s.cloneNode(true); reId(c); s.after(c); return c.getAttribute("data-cms-id"); }); toast("Duplicated. Edit the copy, it's right after the original."); }
  function moveEl(id, dir) {
    op((m) => {
      const s = byId(m.doc, id);
      if (dir < 0) { const p = s.previousElementSibling; if (p) p.before(s); }
      else { const n = s.nextElementSibling; if (n) n.after(s); }
      return id;
    });
  }
  async function deleteEl(id, what) {
    if (!(await ask("Delete " + what.toLowerCase() + "?", "You can undo this with the Undo button.", "Delete", "danger"))) return;
    op((m) => { const s = byId(m.doc, id); if (s) s.remove(); return null; });
  }
  function setSectionBg(id, kind, cls) {
    op((m) => { const s = byId(m.doc, id); SECTION_BG[kind].forEach(([c]) => c && s.classList.remove(c)); if (cls) s.classList.add(cls); return S.selected ? S.selected.id : id; });
  }

  // ---------------------------------------------------------------- section templates
  const IMG = (n) => `images/gallery/${n}.jpg`;
  const TEMPLATES = [
    { id: "text", name: "Text block", desc: "Heading, intro and a paragraph", art: '<i class="y" style="width:30%;height:8px"></i><i style="width:70%;height:12px"></i><i style="height:6px"></i><i style="width:80%;height:6px"></i>',
      html: `<section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">New section</span><h2>Your heading here</h2></div><p>A short intro that sits next to the heading.</p></div><p class="lead">Write something great here. Click any text to edit it, and use the panel on the right to add more.</p></div></section>` },
    { id: "split", name: "Photo + text", desc: "A photo beside a heading and button", art: '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;height:100%"><i class="c"></i><div style="display:grid;gap:4px;align-content:center"><i style="height:10px"></i><i style="height:6px"></i><i class="p" style="width:50%;height:8px"></i></div></div>',
      html: `<section class="section"><div class="wrap split"><div class="framed" style="aspect-ratio: 4 / 3"><img src="${IMG("dumbbell-snatch")}" alt="Describe this photo" loading="lazy"></div><div><span class="eyebrow">New section</span><h2>Photo and text</h2><p>Click the photo to swap it, and click any text to edit it.</p><a class="btn btn-pink" href="join">Learn more</a></div></div></section>` },
    { id: "cards", name: "Three cards", desc: "Icons, titles and short text", art: '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;height:100%"><i></i><i></i><i></i></div>',
      html: `<section class="section bg-cyan"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Highlights</span><h2>Three big ideas</h2></div><p>A short intro for these cards.</p></div><div class="grid grid-3"><div class="card"><div class="icon">💪</div><h3>Card one</h3><p>Say something short and punchy.</p></div><div class="card"><div class="icon">🔥</div><h3>Card two</h3><p>Say something short and punchy.</p></div><div class="card"><div class="icon">🏆</div><h3>Card three</h3><p>Say something short and punchy.</p></div></div></div></section>` },
    { id: "photo-cards", name: "Photo cards", desc: "Three cards with photos and links", art: '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;height:100%"><i class="c"></i><i class="p"></i><i class="y"></i></div>',
      html: `<section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Programs</span><h2>Photo cards</h2></div></div><div class="grid grid-3"><article class="card program-card"><div class="program-img"><img src="${IMG("row-sprint")}" alt="Describe this photo" loading="lazy"></div><div class="program-body"><span class="tag">Label</span><h3>Card title</h3><p>A sentence or two about this.</p><a href="schedule">Learn more →</a></div></article><article class="card program-card"><div class="program-img"><img src="${IMG("overhead-lockout")}" alt="Describe this photo" loading="lazy" style="object-position: 50% 30%"></div><div class="program-body"><span class="tag">Label</span><h3>Card title</h3><p>A sentence or two about this.</p><a href="events">Learn more →</a></div></article><article class="card program-card"><div class="program-img"><img src="${IMG("game-day-gym")}" alt="Describe this photo" loading="lazy"></div><div class="program-body"><span class="tag">Label</span><h3>Card title</h3><p>A sentence or two about this.</p><a href="join">Learn more →</a></div></article></div></div></section>` },
    { id: "gallery", name: "Photo gallery", desc: "A grid of photos with captions", art: '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:4px;height:100%"><i class="c"></i><i></i><i class="p"></i></div>',
      html: `<section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Gallery</span><h2>More photos</h2></div><p>Click a photo to swap it. Use Duplicate to add more.</p></div><div class="gallery"><a class="big" href="${IMG("game-day-gym")}" data-caption="Caption"><img src="${IMG("game-day-gym")}" alt="Describe this photo" loading="lazy"></a><a class="tall" href="${IMG("rower-mural")}" data-caption="Caption"><img src="${IMG("rower-mural")}" alt="Describe this photo" loading="lazy"></a><a href="${IMG("row-sprint")}" data-caption="Caption"><img src="${IMG("row-sprint")}" alt="Describe this photo" loading="lazy"></a><a href="${IMG("judge-high-five")}" data-caption="Caption"><img src="${IMG("judge-high-five")}" alt="Describe this photo" loading="lazy"></a></div></div></section>` },
    { id: "faq", name: "Questions (FAQ)", desc: "Click-to-open questions", art: '<i style="height:12px"></i><i style="height:12px"></i><i style="height:12px"></i>',
      html: `<section class="section"><div class="wrap" style="max-width: 860px"><div class="section-head"><div><span class="eyebrow">FAQ</span><h2>Good questions</h2></div></div><details open><summary>Your first question?</summary><p>The answer goes here.</p></details><details><summary>Another question?</summary><p>The answer goes here.</p></details></div></section>` },
    { id: "facts", name: "Quick facts", desc: "Big numbers in a strip", art: '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;height:100%"><i class="c"></i><i class="p"></i><i class="y"></i></div>',
      html: `<section class="section"><div class="wrap"><div class="facts"><div class="fact"><strong>3</strong><span>Days a week</span></div><div class="fact"><strong>$0</strong><span>To join</span></div><div class="fact"><strong>100%</strong><span>Effort</span></div></div></div></section>` },
    { id: "statement", name: "Big statement", desc: "Bold black band with one line", art: '<div style="background:#111;border-radius:6px;display:grid;place-items:center;height:100%"><i class="p" style="width:60%;height:10px"></i></div>',
      html: `<section class="mission-band"><div class="wrap"><span class="eyebrow">Say it loud</span><p class="mission-text">A big bold statement</p></div></section>` },
    { id: "cta", name: "Call to action", desc: "Pink band with a button", art: '<div style="background:#FF6EB4;border-radius:6px;display:flex;align-items:center;justify-content:space-between;padding:0 8px;height:100%"><i style="width:45%;height:10px;background:#111"></i><i class="y" style="width:25%;height:12px"></i></div>',
      html: `<section class="cta-band"><div class="wrap"><h2>Ready to train?</h2><a class="btn btn-yellow" href="join">Join free</a></div></section>` },
  ];
  function adjustPaths(html, pagePath) {
    const pre = relPrefix(pagePath); if (!pre) return html;
    return html.replace(/\b(src|href)="(?!https?:|mailto:|tel:|#|data:|\.\.\/)([^"]*)"/g, (m0, a, v) => `${a}="${pre}${v}"`);
  }
  function openTemplates() {
    const m = cur(); if (!m) return;
    const sel = S.selected && byId(m.doc, S.selected.id);
    const after = sel ? sectionOf(sel) : null;
    const body = document.createElement("div");
    body.innerHTML = `<p>Pick a section. It'll be added ${after ? "right after <b>" + esc(sectionLabel(after)) + "</b>" : "at the bottom of the page"}.</p><div class="tpl-grid">${TEMPLATES.map((t) => `<button class="tpl" data-t="${t.id}" type="button"><div class="tpl-art">${t.art}</div><strong>${esc(t.name)}</strong><span>${esc(t.desc)}</span></button>`).join("")}</div>`;
    const md = modal({ title: "Add a section", body, wide: true });
    $$(".tpl", body).forEach((b) => b.addEventListener("click", () => {
      const t = TEMPLATES.find((x) => x.id === b.dataset.t);
      md.close();
      op((mm) => {
        const tmp = mm.doc.createElement("div"); tmp.innerHTML = adjustPaths(t.html, mm.path);
        const sec = tmp.firstElementChild; reId(sec);
        const anchor = after ? byId(mm.doc, after.getAttribute("data-cms-id")) : null;
        if (anchor) anchor.after(sec); else mm.doc.querySelector("main").appendChild(sec);
        return sec.getAttribute("data-cms-id");
      }, {});
      setTimeout(() => { if (S.selected) flashEl(S.selected.id); }, 400);
      toast("Section added. Click any text or photo in it to make it yours.", "success");
    }));
  }

  // ---------------------------------------------------------------- images
  async function processFile(file) {
    const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "photo";
    if (/svg|gif/.test(file.type)) {
      const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
      const path = `images/uploads/${base}-${stamp()}.${file.type.includes("svg") ? "svg" : "gif"}`;
      S.uploads[path] = { dataUrl, b64: dataUrl.split(",")[1] };
      return path;
    }
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch (e) { throw new Error(`"${file.name}" isn't a photo this browser can read. Try a JPG or PNG (iPhone HEIC photos: share/export as JPG first).`); }
    const max = 1800, scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL("image/jpeg", 0.86);
    const path = `images/uploads/${base}-${stamp()}.jpg`;
    S.uploads[path] = { dataUrl, b64: dataUrl.split(",")[1] };
    return path;
  }
  function pickFiles(multiple) {
    return new Promise((res) => {
      const inp = $("#file-input"); inp.multiple = !!multiple; inp.value = "";
      inp.onchange = () => res([...inp.files]);
      inp.click();
    });
  }
  async function uploadInto(id) {
    const [file] = await pickFiles(false); if (!file) return;
    setLoading("Preparing your photo…");
    try { const path = await processFile(file); setImage(id, path); toast("Photo swapped. It goes live when you Publish.", "success"); updateChrome(); }
    catch (e) { toast(esc(e.message), "error", 6000); }
    finally { setLoading(null); }
  }
  async function uploadToLibrary() {
    const files = await pickFiles(true); if (!files.length) return;
    setLoading("Preparing photos…");
    let n = 0;
    for (const f of files) { try { await processFile(f); n++; } catch (e) { toast(esc(e.message), "error", 6000); } }
    setLoading(null);
    if (n) toast(`${n} photo${n > 1 ? "s" : ""} added to the library. They upload when you Publish.`, "success");
    updateChrome(); renderPanel();
  }
  function setImage(id, path) {
    op((m) => {
      const s = byId(m.doc, id);
      const rel = relPrefix(m.path) + path;
      const old = s.getAttribute("src");
      s.setAttribute("src", rel); s.removeAttribute("srcset");
      const a = s.closest("a[href]");
      if (a && (a.getAttribute("href") === old || resolvePath(m.path, a.getAttribute("href")) === resolvePath(m.path, old || ""))) a.setAttribute("href", rel);
      return id;
    }, { select: id });
  }
  function chooseFromLibrary(id) {
    const body = document.createElement("div");
    body.innerHTML = `<p>Pick a photo for this spot, or upload a new one.</p><div class="row" style="margin-bottom:10px"><button class="btn primary" data-up type="button">${icon("upload")} Upload new</button></div><div class="media-grid" style="grid-template-columns:repeat(4,1fr)">${mediaList().map((p) => `<button data-p="${esc(p)}" type="button" title="${esc(p)}"><img src="${esc(mediaSrc(p))}" alt="" loading="lazy"><span class="tag">${esc(p.split("/").pop())}</span></button>`).join("")}</div>`;
    const md = modal({ title: "Choose a photo", body, wide: true });
    $("[data-up]", body).addEventListener("click", () => { md.close(); uploadInto(id); });
    $$("[data-p]", body).forEach((b) => b.addEventListener("click", () => { md.close(); setImage(id, b.dataset.p); }));
  }
  function mediaList() {
    const set = new Set(Object.keys(S.tree).filter(isImage));
    Object.keys(S.uploads).forEach((p) => set.add(p));
    S.deletes.forEach((p) => set.delete(p));
    return [...set].sort((a, b) => (S.uploads[b] ? 1 : 0) - (S.uploads[a] ? 1 : 0) || a.localeCompare(b));
  }
  const mediaSrc = (p) => (S.uploads[p] ? S.uploads[p].dataUrl : SITE_URL + p);

  // ---------------------------------------------------------------- placeholders (yellow boxes)
  async function loadAllPages() { for (const p of S.order) { try { await getPage(p); } catch (e) {} } }
  function placeholders() {
    if (S.phCache) return S.phCache;
    const out = [];
    S.order.forEach((p) => { const m = S.pages[p]; if (!m) return; $$(".tbd", m.doc.body).forEach((el) => out.push({ path: p, id: el.getAttribute("data-cms-id"), text: el.textContent.trim() })); });
    return (S.phCache = out);
  }
  function replacePlaceholder(path, id, value) {
    const m = S.pages[path]; const el = byId(m.doc, id); if (!el) return;
    pushUndo(m);
    if (value == null) el.replaceWith(...el.childNodes);
    else el.replaceWith(m.doc.createTextNode(value));
    markDirty(m);
    if (path === S.current) render();
  }
  function refreshPlaceholderCard() { if (S.tab === "placeholders") renderPanelSoon(); updateRail(); }

  // ---------------------------------------------------------------- inspector
  function field(label, html, help) { return `<label class="field"><span>${esc(label)}</span>${html}${help ? `<small>${help}</small>` : ""}</label>`; }
  function renderInspector() {
    const box = $("#inspector"); if (!box) return;
    const m = cur(); if (!m) { box.innerHTML = ""; return; }
    let h = "";
    if (m.draft) {
      const stale = m.draft.baseSha && m.sha && m.draft.baseSha !== m.sha;
      h += `<div class="alert warn"><b>Unpublished edits found</b> from ${timeAgo(m.draft.at)}.${stale ? " Heads up: this page was updated since then, and restoring would undo those updates." : ""}<div class="row" style="margin-top:8px"><button class="btn small primary" data-act="draft-restore" type="button">Restore</button><button class="btn small" data-act="draft-drop" type="button">Discard</button></div></div>`;
    }
    if (S.mode === "preview") {
      h += `<div class="empty-state"><div class="big-ic">${icon("eye")}</div><p><b>Preview mode</b><br>This is how visitors see the page, with animations. Switch back to <b>Edit</b> to make changes.</p></div>`;
      box.innerHTML = h; bindInspector(box); return;
    }
    const sel = S.selected && byId(m.doc, S.selected.id);
    if (!sel) { box.innerHTML = h + pageCard(m); bindInspector(box); return; }

    if (S.selected.kind === "text") {
      h += `<div class="insp-title">${icon("text")} Text <span class="pill pink">${esc(sel.tagName.toLowerCase())}</span></div>`;
      h += `<div class="card"><h3>Style</h3><div class="toolbar">
        <button class="btn" data-fmt="bold" title="Bold (Ctrl/Cmd+B)" type="button">${icon("bold")}</button>
        <button class="btn" data-fmt="italic" title="Italic (Ctrl/Cmd+I)" type="button">${icon("italic")}</button>
        <button class="btn" data-act="link" title="Link selected words (Ctrl/Cmd+K)" type="button">${icon("link")}</button>
        <button class="btn" data-fmt="unlink" title="Remove link" type="button">${icon("unlink")}</button>
        <button class="btn" data-fmt="removeFormat" title="Clear bold/italic" type="button">${icon("eraser")}</button></div>
        <p style="margin:10px 0 0">Click in the page and type. <span class="kbd">Shift</span>+<span class="kbd">Enter</span> adds a line break.</p></div>`;
      const tbds = $$(".tbd", sel);
      if (tbds.length) {
        h += `<div class="card" style="border-color:#5a4a10"><h3>${icon("mark")} Yellow placeholder${tbds.length > 1 ? "s" : ""}</h3><p>Type the real info and click Replace. The yellow box goes away.</p>${tbds.map((t) => `<div class="ph" style="margin-bottom:8px"><div class="ph-text">${esc(t.textContent.trim())}</div><div class="row"><input class="inp" data-ph-in="${t.getAttribute("data-cms-id")}" placeholder="Type the real text"><button class="btn small primary" data-ph-go="${t.getAttribute("data-cms-id")}" type="button">Replace</button></div><div class="row"><button class="btn small ghost" data-ph-keep="${t.getAttribute("data-cms-id")}" type="button">Keep text, remove highlight</button></div></div>`).join("")}</div>`;
      }
    }
    if (S.selected.kind === "image") {
      const src = sel.getAttribute("src") || "";
      const p = resolvePath(m.path, src);
      const pos = (sel.style.objectPosition || "50% 50%").split(/\s+/).map((v) => parseFloat(v));
      const a = sel.closest("a");
      const gal = a && a.matches(".gallery > a");
      h += `<div class="insp-title">${icon("image")} Photo ${S.uploads[p] && !S.uploads[p].published ? '<span class="pill warn">New</span>' : ""}</div>`;
      h += `<div class="card"><img class="thumb-big" src="${esc(src ? mediaSrc(p) : "")}" alt="" onerror="this.style.visibility='hidden'"><div class="row"><button class="btn primary" data-act="img-upload" type="button">${icon("upload")} Upload new</button><button class="btn" data-act="img-library" type="button">${icon("image")} Library</button></div></div>`;
      h += `<div class="card"><h3>Framing</h3><p>Slide to choose which part of the photo shows when it's cropped.</p>
        <div class="range-row"><span>↔</span><input type="range" min="0" max="100" value="${isNaN(pos[0]) ? 50 : pos[0]}" data-pos="x"><span>${isNaN(pos[0]) ? 50 : pos[0]}%</span></div>
        <div class="range-row"><span>↕</span><input type="range" min="0" max="100" value="${isNaN(pos[1]) ? 50 : pos[1]}" data-pos="y"><span>${isNaN(pos[1]) ? 50 : pos[1]}%</span></div></div>`;
      h += `<div class="card"><h3>Details</h3>${field("Description (for screen readers)", `<input data-attr="alt" value="${esc(sel.getAttribute("alt") || "")}">`, "Describe what's in the photo.")}
        ${gal ? field("Caption on hover", `<input data-gal="caption" value="${esc(a.getAttribute("data-caption") || "")}">`) + field("Tile size", `<select data-gal="size">${[["", "Normal"], ["big", "Big (2×2)"], ["tall", "Tall"], ["wide", "Wide"]].map(([v, l]) => `<option value="${v}" ${v ? (a.classList.contains(v) ? "selected" : "") : (!["big", "tall", "wide"].some((c) => a.classList.contains(c)) ? "selected" : "")}>${l}</option>`).join("")}</select>`) : ""}</div>`;
    }
    if (S.selected.kind === "block") {
      h += `<div class="insp-title">${icon("layers")} ${esc(itemOf(sel) ? itemLabel(itemOf(sel)) : "Section")}</div><p class="hint">Click text or a photo inside it to edit those.</p>`;
    }
    // link editing (for the selection or the thing it sits inside)
    const linkEl = sel.closest("a") || (S.selected.kind === "text" && sel.matches("a") ? sel : null);
    if (linkEl && !(S.selected.kind === "image" && linkEl.matches(".gallery > a"))) {
      if (linkEl.hasAttribute("data-config-href")) h += `<div class="card"><h3>${icon("link")} Link</h3><p>This button's link comes from <b>Settings → ${esc(linkEl.getAttribute("data-config-href"))}</b>.</p><button class="btn small" data-act="open-settings" type="button">Open Settings</button></div>`;
      else h += `<div class="card"><h3>${icon("link")} Link</h3>${field("Goes to", `<input data-link value="${esc(linkEl.getAttribute("href") || "")}" list="page-links">`, "A page like <code>join</code>, a full https:// address, or mailto:someone@example.com")}<datalist id="page-links">${S.order.map((p) => `<option value="${esc(relPrefix(m.path) + cleanUrl(p))}">`).join("")}</datalist></div>`;
    }
    const it = itemOf(sel);
    if (it) {
      const iid = it.getAttribute("data-cms-id");
      h += `<div class="card"><h3>${icon("copy")} ${esc(itemLabel(it))}</h3><div class="row">
        <button class="btn small" data-act="dup" data-id="${iid}" type="button">${icon("copy")} Duplicate</button>
        <button class="btn small" data-act="up" data-id="${iid}" title="Move up / left" type="button">${icon("up")}</button>
        <button class="btn small" data-act="down" data-id="${iid}" title="Move down / right" type="button">${icon("down")}</button>
        <button class="btn small danger" data-act="del" data-id="${iid}" data-what="${esc(itemLabel(it))}" type="button">${icon("trash")}</button></div></div>`;
    }
    const sec = sectionOf(sel);
    if (sec) {
      const sid = sec.getAttribute("data-cms-id");
      const kind = sec.classList.contains("page-hero") ? "page-hero" : sec.classList.contains("section") ? "section" : null;
      const curBg = kind ? (SECTION_BG[kind].find(([c]) => c && sec.classList.contains(c)) || [""])[0] : "";
      h += `<div class="card"><h3>${icon("section")} Section · ${esc(sectionLabel(sec))}</h3>
        ${kind ? field("Background", `<select data-bg="${kind}" data-id="${sid}">${SECTION_BG[kind].map(([c, l]) => `<option value="${c}" ${c === curBg ? "selected" : ""}>${l}</option>`).join("")}</select>`) : ""}
        <div class="row"><button class="btn small" data-act="up" data-id="${sid}" type="button">${icon("up")} Up</button><button class="btn small" data-act="down" data-id="${sid}" type="button">${icon("down")} Down</button><button class="btn small" data-act="dup" data-id="${sid}" type="button">${icon("copy")} Copy</button><button class="btn small danger" data-act="del" data-id="${sid}" data-what="Section" type="button">${icon("trash")}</button></div>
        <div class="row"><button class="btn small primary block" data-act="add-section" type="button">${icon("plus")} Add a section below</button></div></div>`;
    }
    h += `<button class="btn ghost block" data-act="deselect" type="button">${icon("x")} Done (show page settings)</button>`;
    box.innerHTML = h;
    bindInspector(box);
  }
  function pageCard(m) {
    const title = (m.doc.querySelector("title") || {}).textContent || "";
    const desc = (m.doc.querySelector('meta[name="description"]') || { getAttribute: () => "" }).getAttribute("content") || "";
    const count = placeholders().filter((x) => x.path === m.path).length;
    return `<div class="insp-title">${icon("file")} ${esc(prettyName(m.path))} ${m.dirty ? '<span class="pill warn">Unpublished</span>' : '<span class="pill green">Live</span>'}</div>
      <div class="card"><div class="empty-state" style="padding:6px"><div class="big-ic">${icon("pencil")}</div><p><b>Click anything on the page to edit it.</b><br>Text: click and type. Photos: click to swap. Sections: use the panel that appears here.</p></div></div>
      ${count ? `<div class="card" style="border-color:#5a4a10"><h3>${icon("mark")} ${count} yellow placeholder${count > 1 ? "s" : ""} on this page</h3><button class="btn small primary" data-act="open-placeholders" type="button">Fill them in</button></div>` : ""}
      <div class="card"><h3>${icon("plus")} Build</h3><button class="btn primary block" data-act="add-section" type="button">${icon("plus")} Add a section</button></div>
      <div class="card"><h3>${icon("gear")} Page settings</h3>
        ${field("Browser tab title", `<input data-head="title" value="${esc(title)}">`)}
        ${field("Search description", `<textarea data-head="description">${esc(desc)}</textarea>`, "Shown by Google under the page title.")}
        <div class="row"><a class="btn small" href="${esc(SITE_URL + cleanUrl(m.path))}" target="_blank" rel="noopener">${icon("ext")} Open live page</a>
        ${m.dirty ? `<button class="btn small danger" data-act="discard" type="button">Discard my edits</button>` : ""}
        ${m.path !== "index.html" ? `<button class="btn small danger" data-act="delete-page" type="button">${icon("trash")} Delete page</button>` : ""}</div></div>`;
  }
  function bindInspector(box) {
    const m = cur();
    $$("[data-fmt]", box).forEach((b) => { b.addEventListener("mousedown", (e) => e.preventDefault()); b.addEventListener("click", () => fmt(b.dataset.fmt)); });
    $$("[data-act]", box).forEach((b) => {
      if (b.dataset.act === "link") b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => act(b.dataset.act, b));
    });
    $$("[data-ph-go]", box).forEach((b) => b.addEventListener("click", () => {
      const v = $(`[data-ph-in="${b.dataset.phGo}"]`, box).value.trim();
      if (!v) return toast("Type the real text first, or use “Keep text, remove highlight”.");
      replacePlaceholder(m.path, b.dataset.phGo, v); S.selected = null; renderInspector(); toast("Placeholder replaced.", "success");
    }));
    $$("[data-ph-in]", box).forEach((i) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") $(`[data-ph-go="${i.dataset.phIn}"]`, box).click(); }));
    $$("[data-ph-keep]", box).forEach((b) => b.addEventListener("click", () => { replacePlaceholder(m.path, b.dataset.phKeep, null); S.selected = null; renderInspector(); }));
    const sel = S.selected && byId(m.doc, S.selected.id);
    $$("[data-pos]", box).forEach((r) => {
      let pushed = false;
      r.addEventListener("input", () => {
        if (!pushed) { pushUndo(m); pushed = true; }
        const x = $('[data-pos="x"]', box).value, y = $('[data-pos="y"]', box).value;
        r.nextElementSibling.textContent = r.value + "%";
        sel.style.objectPosition = `${x}% ${y}%`;
        const f = inFrame(S.selected.id); if (f) f.style.objectPosition = `${x}% ${y}%`;
        markDirty(m);
      });
      r.addEventListener("change", () => (pushed = false));
    });
    $$("[data-attr]", box).forEach((i) => i.addEventListener("change", () => { pushUndo(m); sel.setAttribute(i.dataset.attr, i.value); const f = inFrame(S.selected.id); if (f) f.setAttribute(i.dataset.attr, i.value); markDirty(m); }));
    $$("[data-gal]", box).forEach((i) => i.addEventListener("change", () => {
      const a = sel.closest("a");
      if (i.dataset.gal === "caption") { pushUndo(m); a.setAttribute("data-caption", i.value); markDirty(m); const fa = inFrame(a.getAttribute("data-cms-id")); if (fa) fa.setAttribute("data-caption", i.value); }
      else op(() => { ["big", "tall", "wide"].forEach((c) => a.classList.remove(c)); if (i.value) a.classList.add(i.value); return S.selected.id; });
    }));
    const li = $("[data-link]", box);
    if (li) li.addEventListener("change", () => {
      const a = sel.closest("a") || sel; pushUndo(m);
      a.setAttribute("href", li.value.trim()); markDirty(m);
      const fa = inFrame(a.getAttribute("data-cms-id")); if (fa) fa.setAttribute("href", li.value.trim());
      toast("Link updated.");
    });
    $$("[data-bg]", box).forEach((s) => s.addEventListener("change", () => setSectionBg(s.dataset.id, s.dataset.bg, s.value)));
    $$("[data-head]", box).forEach((i) => i.addEventListener("change", () => {
      pushUndo(m);
      if (i.dataset.head === "title") { let t = m.doc.querySelector("title"); t.textContent = i.value; }
      else { let d = m.doc.querySelector('meta[name="description"]'); if (!d) { d = m.doc.createElement("meta"); d.setAttribute("name", "description"); m.doc.head.appendChild(d); } d.setAttribute("content", i.value); }
      markDirty(m); renderPanel();
    }));
  }
  async function act(a, el) {
    const m = cur();
    switch (a) {
      case "deselect": return deselect();
      case "link": return addLink();
      case "dup": return duplicateEl(el.dataset.id);
      case "up": return moveEl(el.dataset.id, -1);
      case "down": return moveEl(el.dataset.id, 1);
      case "del": return deleteEl(el.dataset.id, el.dataset.what || "Item");
      case "add-section": return openTemplates();
      case "img-upload": return uploadInto(S.selected.id);
      case "img-library": return chooseFromLibrary(S.selected.id);
      case "open-settings": return openTab("settings");
      case "open-placeholders": return openTab("placeholders");
      case "draft-restore": { const d = m.draft; m.draft = null; pushUndo(m); m.doc = parseHTML(d.html); assignIds(m.doc); markDirty(m); render(); renderInspector(); return toast("Your unpublished edits are back.", "success"); }
      case "draft-drop": { m.draft = null; clearDraft(m.path); return renderInspector(); }
      case "discard": {
        if (!(await ask("Discard your edits to this page?", "This page goes back to what's live right now.", "Discard", "danger"))) return;
        if (m.isNew) { delete S.pages[m.path]; S.order = S.order.filter((p) => p !== m.path); clearDraft(m.path); renderPanel(); return openPage("index.html"); }
        pushUndo(m); m.doc = parseHTML(m.baseline); assignIds(m.doc); markDirty(m); S.selected = null; render(); renderInspector(); return;
      }
      case "delete-page": return deletePage(m.path);
    }
  }

  // ---------------------------------------------------------------- pages
  function sortPages(list) {
    const rank = (p) => { const i = PAGE_ORDER.indexOf(p); if (i >= 0) return i; if (p.startsWith("coaches/")) return 50; if (/^(terms|privacy)\.html$/.test(p)) return 90; return 70; };
    return list.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }
  async function openPage(path) {
    setLoading("Opening " + prettyName(path) + "…");
    try {
      await getPage(path);
      S.current = path; S.selected = null;
      try { localStorage.setItem("wtcf-admin-last", path); } catch (e) {}
      history.replaceState(null, "", location.pathname + "?page=" + encodeURIComponent(path));
      render({ scrollTo: 0 }); renderInspector(); updateChrome();
      if (S.tab === "pages") renderPanel();
    } catch (e) { toast(esc(e.message), "error", 6000); if (e.code === 401) showLogin({ error: e.message }); }
    finally { setLoading(null); }
  }
  function newPageHTML(title, slug) {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} · West Tech CrossFit</title>
  <meta name="description" content="${esc(title)} at West Tech CrossFit, the CrossFit club at West Career &amp; Technical Academy in Las Vegas.">
  <link rel="icon" href="assets/img/logo-mark.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/fonts/fonts.css">
  <link rel="stylesheet" href="assets/css/style.css">
  <script>document.documentElement.classList.add("js")</script>
</head>
<body data-root="" data-page="${esc(slug)}">
  <header id="site-header"></header>

  <main>
    <section class="page-hero">
      <div class="wrap">
        <span class="eyebrow">West Tech CrossFit</span>
        <h1>${esc(title)}</h1>
        <p class="lead">Write a short intro for this page. Then click “Add a section” to build it out.</p>
      </div>
    </section>
    ${TEMPLATES[0].html}
  </main>

  <footer id="site-footer"></footer>
  <script src="assets/js/config.js"></script>
  <script src="assets/js/site.js"></script>
</body>
</html>
`;
  }
  function copyPageHTML(m, title, slug) {
    let html = serialize(m.doc, false);
    if (depth(m.path)) html = html.replace(/\b(src|href)="\.\.\//g, '$1="');
    const d = parseHTML(html);
    d.body.setAttribute("data-root", ""); d.body.setAttribute("data-page", slug);
    const t = d.querySelector("title"); if (t) t.textContent = title + " · West Tech CrossFit";
    return serialize(d, false);
  }
  function newPage() {
    const body = document.createElement("div");
    body.innerHTML = field("Page name", `<input data-n placeholder="e.g. Sponsors">`) +
      field("Web address", `<div class="row" style="flex-wrap:nowrap"><span style="color:var(--faint);white-space:nowrap">…/</span><input data-s class="inp" placeholder="sponsors"></div>`) +
      `<label class="row" style="gap:8px;margin:6px 0 6px;color:var(--text)"><input type="checkbox" data-menu checked> Add it to the menu</label>` +
      `<label class="row" style="gap:8px;color:var(--text)"><input type="checkbox" data-copy> Start from a copy of “${esc(prettyName(S.current))}”</label><div data-err></div>`;
    const n = $("[data-n]", body), s = $("[data-s]", body);
    let touched = false;
    n.addEventListener("input", () => { if (!touched) s.value = slugify(n.value); });
    s.addEventListener("input", () => (touched = true));
    const md = modal({ title: "New page", body, actions: [{ label: "Cancel" }, { label: `${icon("plus")} Create page`, kind: "primary", onClick: (close) => {
      const name = n.value.trim(), slug = slugify(s.value || n.value);
      const err = (t) => ($("[data-err]", body).innerHTML = `<div class="alert error" style="margin-top:10px">${esc(t)}</div>`);
      if (!name) return err("Give the page a name.");
      if (!slug) return err("Give the page a web address.");
      const path = slug + ".html";
      if (["admin", "assets", "images", "coaches", "index"].includes(slug) || S.tree[path] || S.pages[path]) return err("That address is already used. Try another.");
      const html = $("[data-copy]", body).checked ? copyPageHTML(cur(), name, slug) : newPageHTML(name, slug);
      const m = makeModel(path, html, null); m.isNew = true; m.baseline = "";
      S.pages[path] = m; S.order.push(path); markDirty(m);
      if ($("[data-menu]", body).checked) { S.config.NAV = S.config.NAV || []; S.config.NAV.push({ label: name, href: slug }); configChanged(); }
      close(); openPage(path);
      toast(`“${esc(name)}” created. It goes live when you Publish.`, "success");
    } }] });
    setTimeout(() => n.focus(), 60);
    return md;
  }
  async function deletePage(path) {
    if (!(await ask(`Delete “${esc(prettyName(path))}”?`, "The page is removed from the website when you Publish, and links to it will stop working. You can't undo this from the builder after publishing.", "Delete page", "danger"))) return;
    const m = S.pages[path];
    if (!(m && m.isNew)) S.deletes.add(path);
    delete S.pages[path]; clearDraft(path);
    S.order = S.order.filter((p) => p !== path);
    const href = cleanUrl(path);
    if (S.config.NAV && S.config.NAV.some((x) => x.href === href)) { S.config.NAV = S.config.NAV.filter((x) => x.href !== href); configChanged(); }
    S.phCache = null; updateChrome(); renderPanel();
    await openPage("index.html");
  }
  function restoreNewPageDrafts() {
    const pre = draftKey("");
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); if (!k || !k.startsWith(pre)) continue;
      const path = k.slice(pre.length);
      const d = readDraft(path);
      if (d && d.isNew && /\.html$/.test(path) && !S.tree[path] && !S.pages[path]) {
        const m = makeModel(path, d.html, null); m.isNew = true; m.baseline = ""; m.dirty = true;
        S.pages[path] = m; S.order.push(path);
      }
    }
  }

  // ---------------------------------------------------------------- side panel
  const TABS = [["pages", "Pages", "pages"], ["placeholders", "Yellow placeholders", "mark"], ["media", "Photos", "image"], ["settings", "Settings", "gear"], ["history", "History", "clock"], ["help", "Help", "help"]];
  function renderRail() {
    const r = $("#rail");
    r.innerHTML = TABS.map(([id, label, ic]) => `<button data-tab="${id}" title="${esc(label)}" aria-label="${esc(label)}" class="${S.tab === id && !$("#app").classList.contains("panel-closed") ? "on" : ""}" type="button">${icon(ic)}${id === "placeholders" ? '<span class="badge" id="ph-badge" hidden></span>' : ""}</button>`).join("");
    $$("[data-tab]", r).forEach((b) => b.addEventListener("click", () => openTab(b.dataset.tab, true)));
    updateRail();
  }
  function updateRail() {
    const b = $("#ph-badge"); if (!b) return;
    const n = placeholders().length;
    b.hidden = !n; b.textContent = n;
  }
  function openTab(id, toggle) {
    const app = $("#app");
    if (toggle && S.tab === id && !app.classList.contains("panel-closed")) { app.classList.add("panel-closed"); renderRail(); return; }
    S.tab = id; app.classList.remove("panel-closed");
    renderRail(); renderPanel();
  }
  const renderPanelSoon = debounce(() => renderPanel(), 200);
  function head(title, extra = "") { return `<div class="panel-head"><h2>${esc(title)}</h2>${extra}</div>`; }
  function renderPanel() {
    const P2 = $("#panel"); if (!P2) return;
    const fn = { pages: panelPages, placeholders: panelPlaceholders, media: panelMedia, settings: panelSettings, history: panelHistory, help: panelHelp }[S.tab];
    fn && fn(P2);
  }

  function panelPages(el) {
    const counts = {}; placeholders().forEach((x) => (counts[x.path] = (counts[x.path] || 0) + 1));
    const item = (p) => { const m = S.pages[p]; return `<button class="item ${p === S.current ? "on" : ""}" data-open="${esc(p)}" type="button">${icon("file")}<span>${esc(prettyName(p))}<span class="sub">/${esc(cleanUrl(p))}</span></span><span class="meta">${counts[p] ? `<span class="pill warn" title="Yellow placeholders">${counts[p]}</span>` : ""}${m && m.dirty ? '<span class="dirty-dot" title="Unpublished edits"></span>' : ""}</span></button>`; };
    const groups = [["Main pages", S.order.filter((p) => !p.includes("/") && !/^(terms|privacy)\.html$/.test(p) && PAGE_ORDER.includes(p))], ["Your pages", S.order.filter((p) => !p.includes("/") && !PAGE_ORDER.includes(p) && !/^(terms|privacy)\.html$/.test(p))], ["Coaches", S.order.filter((p) => p.startsWith("coaches/") && p !== "coaches/index.html")], ["Legal", S.order.filter((p) => /^(terms|privacy)\.html$/.test(p))]];
    el.innerHTML = head("Pages", `<button class="btn small primary" data-new type="button">${icon("plus")} New</button>`) +
      `<div class="panel-body">${groups.filter((g) => g[1].length).map(([g, list]) => `<div class="group-label">${g}</div><div class="list">${list.map(item).join("")}</div>`).join("")}
      <p class="hint" style="margin-top:16px">A yellow dot means a page has edits that aren't live yet.</p></div>`;
    $("[data-new]", el).addEventListener("click", newPage);
    $$("[data-open]", el).forEach((b) => b.addEventListener("click", () => openPage(b.dataset.open)));
  }

  function panelPlaceholders(el) {
    const loadedAll = S.order.every((p) => S.pages[p]);
    const list = placeholders();
    const byPage = {}; list.forEach((x) => (byPage[x.path] = byPage[x.path] || []).push(x));
    el.innerHTML = head("Yellow placeholders", `<span class="pill warn">${list.length}</span>`) + `<div class="panel-body">
      <p class="hint">These are the yellow dashed boxes on the site: info we still need. Type the real text and hit Replace, or keep the text and just remove the highlight.</p>
      ${!loadedAll ? `<p class="hint">Checking every page…</p>` : ""}
      ${!list.length && loadedAll ? `<div class="empty-state"><div class="big-ic">${icon("check")}</div><p><b>All filled in!</b><br>No yellow placeholders left anywhere.</p></div>` : ""}
      ${Object.entries(byPage).map(([p, items]) => `<div class="group-label">${esc(prettyName(p))}</div>` + items.map((x) => `
        <div class="ph"><div class="ph-text">${esc(x.text)}</div>
          <div class="row"><input class="inp" data-in="${x.id}" data-p="${esc(p)}" placeholder="Type the real text"><button class="btn small primary" data-go="${x.id}" data-p="${esc(p)}" type="button">Replace</button></div>
          <div class="row"><button class="btn small ghost" data-show="${x.id}" data-p="${esc(p)}" type="button">${icon("eye")} Show me</button><button class="btn small ghost" data-keep="${x.id}" data-p="${esc(p)}" type="button">Remove highlight</button></div>
        </div>`).join("")).join("")}</div>`;
    $$("[data-go]", el).forEach((b) => b.addEventListener("click", () => {
      const v = $(`[data-in="${b.dataset.go}"]`, el).value.trim();
      if (!v) return toast("Type the real text first.");
      replacePlaceholder(b.dataset.p, b.dataset.go, v); renderPanel(); updateRail(); toast("Replaced. Publish when you're ready.", "success");
    }));
    $$("[data-in]", el).forEach((i) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") $(`[data-go="${i.dataset.in}"]`, el).click(); }));
    $$("[data-keep]", el).forEach((b) => b.addEventListener("click", () => { replacePlaceholder(b.dataset.p, b.dataset.keep, null); renderPanel(); updateRail(); }));
    $$("[data-show]", el).forEach((b) => b.addEventListener("click", async () => {
      if (b.dataset.p !== S.current) await openPage(b.dataset.p);
      setTimeout(() => { const f = inFrame(b.dataset.show); const u = f && f.closest("[data-cms-text]"); if (u) { selectText(u); flashEl(u.getAttribute("data-cms-id")); } }, 500);
    }));
    if (!loadedAll) loadAllPages().then(() => { S.phCache = null; updateRail(); if (S.tab === "placeholders") renderPanel(); });
  }

  function panelMedia(el) {
    const list = mediaList();
    const imgSel = S.selected && S.selected.kind === "image";
    el.innerHTML = head("Photos", `<button class="btn small primary" data-up type="button">${icon("upload")} Upload</button>`) + `<div class="panel-body">
      <p class="hint">${imgSel ? "<b>A photo is selected.</b> Click any photo below to put it there." : "Upload photos here, or click a photo on the page to swap it. Big photos are resized automatically."}</p>
      <div class="media-grid">${list.map((p) => `<button data-p="${esc(p)}" type="button" title="${esc(p)}"><img src="${esc(mediaSrc(p))}" alt="" loading="lazy">${S.uploads[p] && !S.uploads[p].published ? '<span class="pill warn new">New</span>' : ""}<span class="tag">${esc(p.split("/").pop())}</span></button>`).join("")}</div></div>`;
    $("[data-up]", el).addEventListener("click", uploadToLibrary);
    $$("[data-p]", el).forEach((b) => b.addEventListener("click", () => {
      const p = b.dataset.p;
      if (S.selected && S.selected.kind === "image") return setImage(S.selected.id, p);
      const u = S.uploads[p] && !S.uploads[p].published;
      const body = `<img src="${esc(mediaSrc(p))}" alt="" style="width:100%;max-height:50vh;object-fit:contain;border-radius:10px;background:#000;margin-bottom:10px"><p><code>${esc(p)}</code></p><p>To use it, click a photo on the page, then pick this one.</p>`;
      modal({ title: "Photo", body, actions: [
        ...(u ? [{ label: `${icon("trash")} Don't upload`, kind: "danger", onClick: (c) => { delete S.uploads[p]; c(); updateChrome(); renderPanel(); } }] : []),
        { label: "Copy file path", onClick: (c) => { navigator.clipboard && navigator.clipboard.writeText(p); toast("Copied."); c(); } },
        { label: "Close", kind: "primary" }] });
    }));
  }

  const SETTINGS = [
    ["Contact", [["CONTACT_EMAIL", "Contact email", "Where the contact form sends messages."], ["FORM_ENDPOINT", "Form service address (optional)", "Paste a Formspree endpoint to send messages without opening an email app."]]],
    ["Sign-up & links", [["TEEN_SERIES_FORM", "Teen Fitness Series sign-up link"], ["FAST_TIMES_SIGNUP", "Fast Times sign-up link", "Leave empty to show “Sign-ups open soon”."], ["SUGARWOD_HTML_URL", "SugarWOD HTML feed", "Shows live workouts on the WOD page."], ["INSTAGRAM_URL", "Instagram link"], ["INSTAGRAM_HANDLE", "Instagram handle"]]],
    ["Header & footer", [["TOPBAR_TEXT", "Top bar text"], ["JOIN_BUTTON_TEXT", "Menu button text"], ["MISSION_TAGLINE", "Mission tagline", "Shows in the footer."], ["FOOTER_TAGLINE", "Footer script line"], ["FOOTER_VISIT", "Footer · Visit", "One line per row.", true], ["FOOTER_TRAIN", "Footer · Train", "One line per row.", true]]],
  ];
  function panelSettings(el) {
    const c = S.config;
    const nav = c.NAV || [];
    el.innerHTML = head("Settings", S.configDirty ? '<span class="pill warn">Unpublished</span>' : "") + `<div class="panel-body">
      <p class="hint">These show on every page: the top bar, menu, footer and sign-up buttons.</p>
      ${SETTINGS.map(([g, fields]) => `<div class="group-label">${g}</div>` + fields.map(([k, l, help, multi]) => field(l, multi ? `<textarea data-k="${k}">${esc(c[k] || "")}</textarea>` : `<input data-k="${k}" value="${esc(c[k] || "")}">`, help ? esc(help) : "")).join("")).join("")}
      <div class="group-label">Menu</div>
      <p class="hint">Label, then the page it opens (like <code>about</code> or <code>coaches/</code>). Leave the address empty for Home.</p>
      <div data-nav>${nav.map((n, i) => `<div class="nav-row"><input class="inp" data-nl="${i}" value="${esc(n.label)}"><input class="inp" data-nh="${i}" value="${esc(n.href)}" list="nav-pages"><div class="mini"><button class="icon-btn" data-nu="${i}" title="Move up" type="button">${icon("up")}</button><button class="icon-btn" data-nx="${i}" title="Remove" type="button">${icon("x")}</button></div></div>`).join("")}</div>
      <datalist id="nav-pages">${S.order.map((p) => `<option value="${esc(cleanUrl(p))}">`).join("")}</datalist>
      <button class="btn small" data-na type="button">${icon("plus")} Add menu link</button></div>`;
    $$("[data-k]", el).forEach((i) => i.addEventListener("input", () => { c[i.dataset.k] = i.value; configChanged(); }));
    const navChanged = (rerender) => { configChanged(); if (rerender) renderPanel(); };
    $$("[data-nl]", el).forEach((i) => i.addEventListener("input", () => { nav[+i.dataset.nl].label = i.value; navChanged(); }));
    $$("[data-nh]", el).forEach((i) => i.addEventListener("input", () => { nav[+i.dataset.nh].href = i.value.trim(); navChanged(); }));
    $$("[data-nu]", el).forEach((b) => b.addEventListener("click", () => { const i = +b.dataset.nu; if (i > 0) { [nav[i - 1], nav[i]] = [nav[i], nav[i - 1]]; navChanged(true); } }));
    $$("[data-nx]", el).forEach((b) => b.addEventListener("click", () => { nav.splice(+b.dataset.nx, 1); navChanged(true); }));
    $("[data-na]", el).addEventListener("click", () => { c.NAV = nav; nav.push({ label: "New link", href: "" }); navChanged(true); });
  }

  async function panelHistory(el) {
    const m = cur();
    el.innerHTML = head("History") + `<div class="panel-body"><div class="seg" style="margin-bottom:12px"><button data-scope="page" class="${S.histScope !== "site" ? "on" : ""}" type="button">This page</button><button data-scope="site" class="${S.histScope === "site" ? "on" : ""}" type="button">Whole site</button></div><div data-list><p class="hint">Loading…</p></div></div>`;
    $$("[data-scope]", el).forEach((b) => b.addEventListener("click", () => { S.histScope = b.dataset.scope; panelHistory(el); }));
    const list = $("[data-list]", el);
    if (DEV) { list.innerHTML = `<p class="hint">History shows on the live admin (it reads from GitHub).</p>`; return; }
    try {
      const commits = await B().commits(S.histScope === "site" ? null : (m && !m.isNew ? m.path : null));
      if (S.tab !== "history") return;
      list.innerHTML = commits.length ? commits.map((c) => `<div class="commit"><img src="${esc((c.author && c.author.avatar_url) || "")}" alt="" onerror="this.style.visibility='hidden'"><div><div class="msg">${esc(c.commit.message.split("\n")[0])}</div><div class="when">${esc((c.author && c.author.login) || c.commit.author.name)} · ${timeAgo(c.commit.author.date)}</div><div class="row"><a class="btn small ghost" href="${esc(c.html_url)}" target="_blank" rel="noopener">${icon("ext")} Details</a>${m && !m.isNew ? `<button class="btn small" data-restore="${c.sha}" type="button">${icon("undo")} Restore this page</button>` : ""}</div></div></div>`).join("") : `<p class="hint">No history yet.</p>`;
      $$("[data-restore]", list).forEach((b) => b.addEventListener("click", async () => {
        if (!(await ask("Restore this page?", `“${esc(prettyName(m.path))}” goes back to how it was in that version. It won't be live until you Publish, and you can Undo.`, "Restore"))) return;
        try {
          setLoading("Loading that version…");
          const text = await B().readTextAt(m.path, b.dataset.restore);
          pushUndo(m); m.doc = parseHTML(text); assignIds(m.doc); markDirty(m); S.selected = null; render(); renderInspector();
          toast("Restored. Publish to make it live.", "success");
        } catch (e) { toast(esc(e.message.includes("404") || e.message.includes("Not Found") ? "That page didn't exist in that version." : e.message), "error", 6000); }
        finally { setLoading(null); }
      }));
    } catch (e) { list.innerHTML = `<div class="alert error">${esc(e.message)}</div>`; }
  }

  function panelHelp(el) {
    el.innerHTML = head("Help") + `<div class="panel-body">
      <div class="card"><h3>${icon("pencil")} Editing</h3><ul class="tips">
        <li><b>Text:</b> click it and type. Select words to make them bold, italic or a link.</li>
        <li><b>Photos:</b> click one, then Upload new or pick from the Library. Use the Framing sliders to fix the crop.</li>
        <li><b>Lists, cards and photos:</b> click one and use Duplicate, the arrows or Delete.</li>
        <li><b>Sections:</b> “Add a section” gives you ready-made blocks: text, photo + text, cards, galleries, FAQs and more.</li>
        <li><b>Menu, top bar, footer, sign-up links:</b> in Settings.</li></ul></div>
      <div class="card"><h3>${icon("mark")} Yellow boxes</h3><p>The Yellow placeholders tab lists every box that still needs real info, across all pages.</p></div>
      <div class="card"><h3>${icon("rocket")} Publishing</h3><ul class="tips">
        <li>Nothing goes live until you click <b>Publish</b>. Your edits are kept on this computer as a draft until then.</li>
        <li>After publishing, the live site updates in about a minute. Then hard refresh: <span class="kbd">Cmd</span>+<span class="kbd">Shift</span>+<span class="kbd">R</span> on Mac, <span class="kbd">Ctrl</span>+<span class="kbd">F5</span> on Windows.</li>
        <li>Made a mistake? Undo, or open History and restore an older version.</li></ul></div>
      <div class="card"><h3>${icon("sparkle")} Shortcuts</h3><ul class="tips">
        <li><span class="kbd">Ctrl/Cmd</span>+<span class="kbd">Z</span> undo · add <span class="kbd">Shift</span> to redo</li>
        <li><span class="kbd">Ctrl/Cmd</span>+<span class="kbd">S</span> save draft · <span class="kbd">Ctrl/Cmd</span>+<span class="kbd">Enter</span> publish</li>
        <li><span class="kbd">Ctrl/Cmd</span>+<span class="kbd">B</span> / <span class="kbd">I</span> / <span class="kbd">K</span> bold, italic, link</li></ul></div>
      <div class="card"><h3>${icon("sparkle")} Bigger changes</h3><p>New designs, new features and big layout changes: ask Claude. Anything Claude changes shows up here automatically the next time you open the builder.</p></div></div>`;
  }

  // ---------------------------------------------------------------- publish
  function collectChanges() {
    const out = [];
    Object.values(S.pages).forEach((m) => { if (m.dirty) out.push({ path: m.path, text: serialize(m.doc, false), baseSha: m.isNew ? null : m.sha, isNew: m.isNew, label: prettyName(m.path), kind: m.isNew ? "New page" : "Page" }); });
    if (S.configDirty) out.push({ path: CONFIG_PATH, text: configText(), baseSha: S.configSha, label: "Settings (menu, footer, links)", kind: "Settings" });
    Object.entries(S.uploads).forEach(([p, u]) => { if (!u.published) out.push({ path: p, b64: u.b64, label: p.split("/").pop(), kind: "Photo" }); });
    S.deletes.forEach((p) => out.push({ path: p, delete: true, baseSha: S.tree[p], label: prettyName(p), kind: "Delete page" }));
    return out;
  }
  function changeCount() { let n = 0; Object.values(S.pages).forEach((m) => m.dirty && n++); if (S.configDirty) n++; Object.values(S.uploads).forEach((u) => !u.published && n++); return n + S.deletes.size; }
  function openPublish() {
    const ch = collectChanges();
    if (!ch.length) return toast("Nothing to publish yet. Make an edit first.");
    const icn = (k) => (k === "Photo" ? "image" : k === "Settings" ? "gear" : k === "Delete page" ? "trash" : "file");
    const body = document.createElement("div");
    body.innerHTML = `<p>These go live on the website:</p><ul class="change-list">${ch.map((c) => `<li>${icon(icn(c.kind))} ${esc(c.label)} <span class="pill ${c.kind === "Delete page" ? "pink" : ""}">${esc(c.kind)}</span></li>`).join("")}</ul>${field("What changed? (optional)", `<input data-msg placeholder="e.g. Updated Thursday times">`)}<div data-status></div>`;
    modal({ title: "Publish to the live site", body, actions: [{ label: "Cancel" }, { label: `${icon("rocket")} Publish now`, kind: "primary", onClick: (close, wrap, btn) => doPublish(ch, $("[data-msg]", wrap).value, close, wrap, btn) }] });
    setTimeout(() => { const i = $("[data-msg]", body); i && i.focus(); }, 60);
  }
  async function doPublish(ch, note, close, wrap, btn) {
    btn.disabled = true;
    const status = $("[data-status]", wrap);
    const step = (t) => (status.innerHTML = `<div class="alert"><span class="spinner" style="display:inline-block;width:14px;height:14px;border-width:2px;vertical-align:-2px;margin-right:8px"></span>${esc(t)}</div>`);
    try {
      step("Checking for newer changes…");
      const tree = await B().loadTree();
      const conflicts = ch.filter((c) => (c.baseSha && tree.files[c.path] && tree.files[c.path] !== c.baseSha) || (c.isNew && tree.files[c.path]));
      if (conflicts.length) { close(); return showConflicts(conflicts); }
      const msg = (note.trim() || "Update the website from the Site Builder") + "\n\n" + ch.map((c) => `- ${c.kind}: ${c.label}`).join("\n") + (S.user ? `\n\nPublished by @${S.user.login} from /admin` : "");
      await B().commit(tree, ch, msg, step);
      step("Done! Refreshing…");
      const t2 = await B().loadTree(); S.tree = t2.files; S.head = t2.head;
      ch.forEach((c) => {
        if (c.path === CONFIG_PATH) { S.configSha = S.tree[CONFIG_PATH]; S.configBaseline = c.text; S.configDirty = configText() !== c.text; clearDraft("config"); }
        else if (c.b64 != null) { if (S.uploads[c.path]) S.uploads[c.path].published = true; }
        else if (c.delete) { S.deletes.delete(c.path); }
        else { const m = S.pages[c.path]; if (m) { m.sha = S.tree[c.path]; m.baseline = c.text; m.isNew = false; m.draft = null; m.dirty = serialize(m.doc, false) !== m.baseline; clearDraft(c.path); } }
      });
      close(); updateChrome(); renderPanel(); renderInspector();
      const live = SITE_URL + cleanUrl(S.current || "index.html");
      modal({ title: "Published! 🎉", body: `<p>Your changes are saved to GitHub. The live website rebuilds in <b>about a minute</b>.</p><p>Then open the site and do a <b>hard refresh</b> so your browser grabs the new version: <span class="kbd">Cmd</span>+<span class="kbd">Shift</span>+<span class="kbd">R</span> on Mac or <span class="kbd">Ctrl</span>+<span class="kbd">F5</span> on Windows.</p>`,
        actions: [{ label: "Keep editing" }, { label: `${icon("ext")} Open live page`, kind: "primary", onClick: (c) => { window.open(live, "_blank", "noopener"); c(); } }] });
    } catch (e) {
      btn.disabled = false;
      status.innerHTML = `<div class="alert error">${esc(e.message)}</div>`;
      if (e.code === 401) { saveAllDrafts(); setTimeout(() => showLogin({ error: e.message }), 1800); }
    }
  }
  function showConflicts(list) {
    modal({ title: "Someone else updated the site", body: `<p>These changed on GitHub after you opened them (maybe Claude updated them):</p><ul class="change-list">${list.map((c) => `<li>${icon("file")} ${esc(c.label)}</li>`).join("")}</ul><p>To keep both of you safe, <b>nothing was published</b>. Reload those to get the newest version, then redo your edits on them. Copy any text you want to keep first.</p>`,
      actions: [{ label: "Not now" }, { label: "Reload those", kind: "primary", onClick: async (close) => {
        close(); setLoading("Getting the newest version…");
        try {
          const t = await B().loadTree(); S.tree = t.files; S.head = t.head;
          for (const c of list) { if (c.path === CONFIG_PATH) await loadConfig(); else { delete S.pages[c.path]; clearDraft(c.path); } }
          S.phCache = null; await openPage(S.current in S.pages ? S.current : (S.order.includes(S.current) ? S.current : "index.html"));
          toast("Up to date. Redo your edits on those pages, then Publish.", "success", 5000);
        } catch (e) { toast(esc(e.message), "error", 6000); } finally { setLoading(null); }
      } }] });
  }

  // ---------------------------------------------------------------- top bar
  function updateChrome() {
    const m = cur();
    if (m) {
      $("#page-label").innerHTML = esc(prettyName(m.path)) + (m.dirty ? ' <span class="dot">● unpublished</span>' : "");
      $("#live-link").href = SITE_URL + cleanUrl(m.path);
    }
    const n = changeCount();
    $("#publish-btn").innerHTML = `${icon("rocket")} <span>Publish</span>${n ? ` <span class="count">${n}</span>` : ""}`;
    $("#undo-btn").disabled = !m || !m.undo.length;
    $("#redo-btn").disabled = !m || !m.redo.length;
    if (S.tab === "pages") renderPanelSoon();
    updateRail();
  }
  let chromeBound = false;
  function bindChrome() {
    if (chromeBound) return; chromeBound = true;
    const dev = { desktop: "desktop", tablet: "tablet", phone: "phone" };
    $$("#device-seg button").forEach((b) => { b.innerHTML = icon(dev[b.dataset.device]); b.addEventListener("click", () => {
      S.device = b.dataset.device; $$("#device-seg button").forEach((x) => x.classList.toggle("on", x === b));
      $("#frame-wrap").className = "frame-wrap " + (S.device === "desktop" ? "" : S.device);
    }); });
    $("#undo-btn").innerHTML = icon("undo"); $("#redo-btn").innerHTML = icon("redo");
    $("#undo-btn").addEventListener("click", undo); $("#redo-btn").addEventListener("click", redo);
    $$("#mode-seg button").forEach((b) => { b.innerHTML = b.dataset.mode === "edit" ? `${icon("pencil")} <span>Edit</span>` : `${icon("eye")} <span>Preview</span>`; b.addEventListener("click", () => {
      if (S.mode === b.dataset.mode) return;
      S.mode = b.dataset.mode; $$("#mode-seg button").forEach((x) => x.classList.toggle("on", x === b));
      S.selected = null; render(); renderInspector();
    }); });
    $("#live-link").innerHTML = `${icon("ext")} <span>View live</span>`;
    $("#publish-btn").addEventListener("click", openPublish);
    $("#repo-link").href = `https://github.com/${OWNER}/${REPO}`;
    $("#user-btn").addEventListener("click", (e) => { e.stopPropagation(); $("#user-pop").hidden = !$("#user-pop").hidden; });
    document.addEventListener("click", () => ($("#user-pop").hidden = true));
    $("#signout").addEventListener("click", () => { saveAllDrafts(); localStorage.removeItem(TOKEN_KEY); location.reload(); });
    document.addEventListener("keydown", onShortcut);
    window.addEventListener("beforeunload", (e) => { if (changeCount()) { saveAllDrafts(); e.preventDefault(); e.returnValue = ""; } });
    window.addEventListener("unhandledrejection", (e) => { if (e.reason && e.reason.code === 401) { saveAllDrafts(); showLogin({ error: e.reason.message }); } });
  }

  // ---------------------------------------------------------------- sign in & start
  function showLogin(opts = {}) {
    setLoading(null);
    $("#app").classList.add("hidden"); $("#login").classList.remove("hidden");
    $("#login-msg").innerHTML = opts.error ? `<div class="alert error">${esc(opts.error)}</div>`
      : opts.setup ? `<div class="alert warn"><b>Almost there.</b> GitHub sign-in isn't connected yet. Put the Cloudflare Worker address in <code>admin/admin-config.js</code> (<code>AUTH_URL</code>). The steps are in <code>admin/SETUP.md</code>.</div>` : "";
    const btn = $("#signin");
    btn.disabled = !!opts.setup;
    btn.onclick = () => { btn.disabled = true; location.href = String(AC.AUTH_URL).replace(/\/+$/, "") + "/login?return=" + encodeURIComponent(location.origin + location.pathname); };
  }
  async function startApp() {
    $("#login").classList.add("hidden"); $("#app").classList.remove("hidden");
    setLoading("Loading the website…");
    try {
      bindChrome();
      $("#user-btn").innerHTML = (S.user.avatar_url ? `<img src="${esc(S.user.avatar_url)}" alt="">` : "") + `<span>@${esc(S.user.login)}</span>`;
      if (DEV) $("#dev-flag").hidden = false;
      const t = await B().loadTree(); S.tree = t.files; S.head = t.head;
      S.order = sortPages(Object.keys(S.tree).filter(isPage));
      restoreNewPageDrafts();
      await loadConfig();
      renderRail(); renderPanel();
      const want = new URLSearchParams(location.search).get("page") || localStorage.getItem("wtcf-admin-last") || "index.html";
      await openPage(S.order.includes(want) ? want : "index.html");
      loadAllPages().then(() => { S.phCache = null; updateRail(); if (S.tab === "placeholders" || S.tab === "pages") renderPanel(); });
    } catch (e) {
      setLoading(null);
      if (e.code === 401) return showLogin({ error: e.message });
      toast(esc(e.message), "error", 8000);
    }
  }
  async function boot() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get("token")) { try { localStorage.setItem(TOKEN_KEY, h.get("token")); } catch (e) {} }
    const hashErr = h.get("error");
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    if (DEV) { S.backend = DEVB; S.user = { login: "local-test", avatar_url: "" }; return startApp(); }
    if (!AC.AUTH_URL) return showLogin({ setup: true });
    if (hashErr) return showLogin({ error: "GitHub sign-in didn't finish: " + hashErr });
    S.token = localStorage.getItem(TOKEN_KEY);
    if (!S.token) return showLogin();
    S.backend = GH;
    setLoading("Checking your GitHub access…");
    try {
      const user = await GH.req("GET", "/user");
      const repo = await GH.req("GET", `/repos/${OWNER}/${REPO}`);
      if (!repo.permissions || !repo.permissions.push) {
        localStorage.removeItem(TOKEN_KEY);
        return showLogin({ error: `@${user.login} isn't a collaborator on ${OWNER}/${REPO}, so the builder stays locked. The repo owner can add you on GitHub under Settings → Collaborators.` });
      }
      S.user = user;
      await startApp();
    } catch (e) {
      if (e.code === 401) localStorage.removeItem(TOKEN_KEY);
      showLogin({ error: e.message });
    }
  }
  boot();
})();
