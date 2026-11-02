// Applies the visitor's saved theme before first paint, so a dark-mode visitor never sees a white flash.
// Light is the default; dark only applies when the visitor chose it with the theme toggle.
(function () {
  try {
    if (localStorage.getItem("theme") === "dark") document.documentElement.classList.add("dark");
  } catch {
    // Storage blocked: stay on light.
  }
})();
