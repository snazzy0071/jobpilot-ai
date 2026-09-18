// Applies the user's stored theme choice before first paint — this has
// to run blocking, before hydration, to avoid a flash of the wrong
// theme (the server can't know a client's localStorage value). Served
// as a same-origin static file rather than inlined into the document
// so it loads under a strict `script-src 'self'` CSP with no
// `unsafe-inline` needed — CSP only restricts *inline* script content,
// never a same-origin `<script src>` load.
try {
  var stored = localStorage.getItem("theme");
  var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
} catch {}
