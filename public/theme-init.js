// Applies the theme before first paint, so nobody sees a flash of the wrong colours.
// Dark is the default; light applies only when the visitor chose it with the theme toggle.
// /print/* pages (rendered to PDF) always stay light.
(function () {
  var dark = true;
  try {
    if (localStorage.getItem("theme") === "light") dark = false;
  } catch {
    // Storage blocked: keep the default.
  }
  if (location.pathname.indexOf("/print/") === 0) dark = false;
  if (dark) document.documentElement.classList.add("dark");
})();
