/* Single-language reading preferences never alter the authored bilingual document. */
(() => {
  "use strict";
  const comparison = document.getElementById("deed-comparison");
  const toolbar = document.getElementById("language-toolbar");
  const controls = document.getElementById("document-type-controls");
  if (!comparison || !toolbar || !controls) return;
  const documentLabel = comparison.dataset.documentLabel || "Deed text";
  const article = comparison.closest(".plan-document");
  const main = article.closest("main");
  const buttons = [...toolbar.querySelectorAll("button[data-language]")];
  const languageKey = "i12e.deed.language.v1";
  const validLanguage = value => value === "nl" || value === "en";
  function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch { /* Session controls remain usable. */ } }
  let language = validLanguage(read(languageKey)) ? read(languageKey) : "en";
  let revision = 0;
  const wide = matchMedia("(min-width: 75em)");
  function readingTop() {
    if (main.dataset.documentNavigation === "articles") return 24;
    const sidebar = document.querySelector(".document-sidebar");
    const aboveBody = !wide.matches || main.classList.contains("document-contents-collapsed");
    return aboveBody && sidebar
      ? sidebar.offsetHeight + (parseFloat(getComputedStyle(sidebar).top) || 0) + 16 : 24;
  }
  function capture() {
    const top = readingTop();
    const blocks = [...comparison.querySelectorAll(`.deed-language[lang="${language}"]`)];
    if (comparison.getBoundingClientRect().top > top) return null;
    const block = blocks.find(node => node.getBoundingClientRect().bottom > top) || blocks.at(-1);
    if (!block) return null;
    const clauses = [...block.querySelectorAll("[id]")];
    const target = clauses.find(node => node.getBoundingClientRect().bottom > top) || block;
    const rect = target.getBoundingClientRect();
    return {id: target.id, blockId: block.id, progress: Math.max(0, Math.min(1, (top - rect.top) / rect.height)), offset: Math.max(0, rect.top - top)};
  }
  function instantScroll(y) {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo({top: y, behavior: "instant"});
    root.style.scrollBehavior = previous;
  }
  function restore(position) {
    const current = ++revision;
    requestAnimationFrame(() => {
      if (current !== revision || !position) return;
      const mapped = id => document.getElementById(id.replace(/-(nl|en)$/, `-${language}`));
      const target = mapped(position.id) || mapped(position.blockId);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      instantScroll(scrollY + rect.top + rect.height * position.progress - readingTop() - position.offset);
    });
  }
  function fragmentTarget() {
    try { return document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return null; }
  }
  function selectLanguage(next, persist = false, preserve = false) {
    const position = preserve ? capture() : null;
    language = validLanguage(next) ? next : "en";
    comparison.dataset.language = language;
    comparison.setAttribute("aria-label", `${documentLabel} in ${language === "nl" ? "Dutch" : "English"}`);
    buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.language === language)));
    comparison.dispatchEvent(new CustomEvent("deed-language-change", {detail: {language}}));
    if (persist) save(languageKey, language);
    if (preserve) {
      const target = fragmentTarget();
      if (target && comparison.contains(target) && /-(nl|en)$/.test(target.id)) {
        const id = target.id.replace(/-(nl|en)$/, `-${language}`);
        if (document.getElementById(id)) history.replaceState(history.state, "", `#${encodeURIComponent(id)}`);
      }
      restore(position);
    }
  }
  function revealFragment() {
    const target = fragmentTarget();
    const block = target?.closest(".deed-language");
    if (!block || !comparison.contains(block)) return;
    selectLanguage(block.lang);
    const current = ++revision;
    requestAnimationFrame(() => {
      if (current === revision) instantScroll(scrollY + target.getBoundingClientRect().top - readingTop());
    });
  }
  buttons.forEach(button => button.addEventListener("click", () => selectLanguage(button.dataset.language, true, true)));
  window.addEventListener("hashchange", revealFragment);
  selectLanguage(language);
  controls.hidden = false;
  const sidebar = document.querySelector(".document-sidebar");
  function measureSidebar() {
    main.style.setProperty("--deed-reading-top", `${readingTop()}px`);
  }
  if (sidebar && typeof ResizeObserver !== "undefined") new ResizeObserver(measureSidebar).observe(sidebar);
  window.addEventListener("resize", measureSidebar);
  document.addEventListener("document-layout-change", measureSidebar);
  measureSidebar();
  revealFragment();
  // Initial browser history restoration and font loading can follow defer/RAF.
  // Re-align a deep link once layout settles, unless the reader has taken over.
  let interacted = false;
  for (const event of ["pointerdown", "keydown", "wheel", "touchstart"]) {
    window.addEventListener(event, () => { interacted = true; }, {once: true, passive: true});
  }
  window.addEventListener("load", () => {
    (document.fonts?.ready || Promise.resolve()).then(() => {
      requestAnimationFrame(() => { if (!interacted) revealFragment(); });
    });
  }, {once: true});
})();
