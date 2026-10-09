# West Tech CrossFit website

The website for **West Tech CrossFit**, the WCTA CrossFit Club at West Career & Technical Academy in Las Vegas. Providing Functional Fitness Since 2014.
Plain HTML, CSS and JavaScript on GitHub Pages: **https://inkhavens.github.io/westtech-crossfit/**

## Editing the site: the Site Builder
Go to **https://inkhavens.github.io/westtech-crossfit/admin/** and sign in with GitHub (repo collaborators only).
- Click any text to edit it, click any photo to swap it, and use "Add a section" for new blocks.
- **Yellow placeholders** tab: every yellow dashed box that still needs real info.
- **Settings** tab: menu, top bar, footer, contact email and sign-up links.
- **Publish** commits your changes here. The live site updates in about a minute, then hard refresh (Cmd+Shift+R / Ctrl+F5).

One-time sign-in setup: see `admin/SETUP.md`.

## Pages
`index.html` (home), `about.html`, `coaches/` (+ a page per coach), `schedule.html`, `events.html`, `wod.html`, `join.html`, `contact.html`, `terms.html`, `privacy.html`.
Links use clean addresses (`/about` instead of `/about.html`); GitHub Pages serves both.

## How it's built
- `assets/css/style.css`: all styles and animations.
- `assets/js/site.js`: shared header, footer, privacy banner, animations, gallery lightbox and contact form.
- `assets/js/config.js`: site settings (edited from the builder's Settings tab). Must stay valid JSON.
- `assets/fonts/`: self-hosted fonts (no Google requests).
- `admin/`: the Site Builder. `admin/worker/worker.js` is the sign-in helper that runs on Cloudflare.

## Privacy banner
Every visitor gets an Accept / Decline bar. Declining keeps outside services (Google Maps, the SugarWOD feed) switched off. Anything new that loads from another company should use `data-consent-embed` or check `window.siteHasConsent()`.

## Rules to keep
- The footer disclaimer ("not endorsed by WCTA or CCSD") is required by CCSD Regulation 5132 for club websites.
- Keep the CrossFit trademark notice.
- Only post photos of students who have permission to be on the site.
