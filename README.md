# West Tech CrossFit website

The website for **West Tech CrossFit**, the WCTA CrossFit Club at West Career & Technical Academy in Las Vegas.
It's plain HTML, CSS and JavaScript, hosted free on GitHub Pages. There's no build step: edit a file, commit, and the site updates in about a minute.

## Pages

| File | Page |
|---|---|
| `index.html` | Home: hero, programs, photo gallery, coaches, events, Instagram |
| `about.html` | Story, mission, facility, sponsors |
| `coaches/index.html` | All coaches |
| `coaches/eric-swenson.html`, `coaches/cresen-swenson.html`, `coaches/grayson-gearin.html` | Coach profiles (photo, about, certifications) |
| `schedule.html` | Weekly schedule + map |
| `events.html` | Teen Fitness Series, Fast Times, CrossFit Open, Masters |
| `wod.html` | Workout of the day (SugarWOD) + benchmark workouts |
| `join.html` | How to join + FAQ |
| `contact.html` | Contact form + coach emails |

The header and footer are shared by every page and live in `assets/js/site.js`. Change them there once.

## Filling in the blanks

Anything still unknown is highlighted on the site with a **yellow dashed box**. In the code, search for `class="tbd"` to find every one, replace the text, and delete the `<span class="tbd">` wrapper.

## Site settings: `assets/js/config.js`

- `CONTACT_EMAIL`: where the contact form sends messages.
- `FORM_ENDPOINT`: optional. Paste a free [Formspree](https://formspree.io) endpoint so messages send without opening an email app.
- `SUGARWOD_HTML_URL`: paste the SugarWOD HTML feed URL to show live workouts on the WOD page (see below).
- `TEEN_SERIES_FORM` / `FAST_TIMES_SIGNUP`: registration links for the event buttons.

## Connecting SugarWOD

SugarWOD can publish workouts as an RSS feed or an HTML page ([SugarWOD's guide](https://www.sugarwod.com/2017/03/publish-your-workouts-anywhere/)).
A coach with admin access to the West Tech CrossFit SugarWOD account creates an **HTML page** feed, copies the URL, and pastes it into `SUGARWOD_HTML_URL`. The WOD page then shows the live workouts automatically.

## Photos

- **Gallery:** put photos in `images/gallery/` and add a line to the gallery in `index.html`. Size classes: `big` (2×2), `tall` (1×2), `wide` (2×1), or none.
- **Coaches:** save portraits as `images/coaches/eric-swenson.jpg`, `cresen-swenson.jpg` and `grayson-gearin.jpg` (about 800×1000). They replace the placeholder silhouettes automatically.
- Keep photos under about 500 KB each. Only post photos of students who have permission to be on the site (CCSD rule).

## Logo

`assets/img/logo.svg` is the full logo and `assets/img/logo-mark.svg` is the round "WT" badge used as the browser tab icon.

## Rules to keep

- The footer disclaimer ("not endorsed by WCTA or CCSD") is required by CCSD Regulation 5132 for club websites. Don't remove it.
- The CrossFit trademark notice in the footer should stay too.
