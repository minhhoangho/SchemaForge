/* Runs before the first paint, so it stays dependency-free ES5.
   Keep in sync with src/lib/theme/resolve-theme.ts; theme-init-script.test.ts
   asserts that both agree. */
(function () {
  var root = document.documentElement;
  var preference = root.getAttribute("data-theme-preference");
  var isDark =
    preference === "dark" ||
    (preference !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
})();
