// Some browser extensions (Bitdefender's Anti-tracker/Safepay are the well-known source of
// `bis_skin_checked`/`bis_register`) mutate the live DOM — adding their own attributes to
// arbitrary elements anywhere on the page — before React hydrates. React then compares its own
// server-rendered markup against that already-mutated DOM, finds an attribute it never produced,
// and logs a hydration-mismatch error. `suppressHydrationWarning` (see layout.tsx) only covers the
// exact element it's placed on, not descendants, and the extension can touch any element anywhere
// in the tree — so instead of chasing one element, this strips the known attributes proactively,
// as early as possible (this file loads blocking, in <head>, the same way theme-init.js does) and
// keeps stripping them for the life of the page via a MutationObserver. If the attribute is gone
// by the time hydration runs its comparison, there's nothing left to mismatch on. Loaded as a
// blocking <script src> in <head> (see layout.tsx) so it runs during HTML parsing, before hydration.
//
// This can't be a 100% guarantee — it's still a race against whenever the extension's own content
// script decides to run — but it removes the attribute markedly faster than a human would notice,
// and covers every element it might land on, not just one. The complete fix, if this still shows
// up, is disabling that extension for localhost (or using a browser profile with no extensions)
// while developing; nothing server-rendered can prevent a browser extension from editing the page
// after it arrives.
(function () {
  try {
    var ATTRS = ["bis_skin_checked", "bis_register"];

    function strip(node) {
      if (!(node instanceof Element)) return;
      for (var i = 0; i < ATTRS.length; i++) {
        if (node.hasAttribute(ATTRS[i])) node.removeAttribute(ATTRS[i]);
      }
    }

    // Catches anything already injected before this script ran.
    for (var i = 0; i < ATTRS.length; i++) {
      var existing = document.querySelectorAll("[" + ATTRS[i] + "]");
      for (var j = 0; j < existing.length; j++) strip(existing[j]);
    }

    // Catches anything injected from here on — `subtree: true` on <html> covers <body> and
    // everything in it even though <body> doesn't exist in the DOM yet when this first runs.
    new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var mutation = mutations[m];
        if (mutation.type === "attributes") strip(mutation.target);
        else for (var n = 0; n < mutation.addedNodes.length; n++) strip(mutation.addedNodes[n]);
      }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ATTRS, childList: true, subtree: true });
  } catch {}
})();
