/*
  SITE SETTINGS — edit these values to update the whole site.
  Anything left as "" is treated as "not set yet" and the site shows a fallback.
*/
window.SITE_CONFIG = {
  // Where the contact form sends messages.
  // Option A (easiest): leave FORM_ENDPOINT empty and the form opens the visitor's email app addressed to CONTACT_EMAIL.
  // Option B: create a free form at https://formspree.io and paste its endpoint here, e.g. "https://formspree.io/f/abcd1234".
  FORM_ENDPOINT: "",
  CONTACT_EMAIL: "swensem@nv.ccsd.net", // from the club's Teen Fitness Series flyer — confirm which coach this belongs to

  // SugarWOD: a coach with SugarWOD admin access can create an "HTML page" feed
  // (SugarWOD → Settings → Integrations / Publishing → HTML) and paste the URL here.
  // When set, the WOD page shows the live workouts automatically.
  SUGARWOD_HTML_URL: "",

  INSTAGRAM_URL: "https://www.instagram.com/westtechcrossfit/",
  INSTAGRAM_HANDLE: "@westtechcrossfit",

  // Teen Fitness Series registration (from the Instagram bio). Update each season.
  TEEN_SERIES_FORM: "https://docs.google.com/forms/d/e/1FAIpQLSfZTBxYZVkXG0wK-Qc5UAD2cD1Hvji0Sh5bHtHAJTUudSbdjQ/viewform",
  // Fast Times at West Tech High sign-up link — add when registration opens.
  FAST_TIMES_SIGNUP: ""
};
