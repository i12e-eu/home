/* Enhance the page shell using authored labels and fragment identifiers.
   Inline contents remain available if JavaScript is unavailable. */
(() => {
  "use strict";

  const main = document.querySelector("main[data-document-navigation]");
  const article = main?.querySelector(":scope > .plan-document, :scope > .document-content");
  if (!article) return;
  const mode = main.dataset.documentNavigation;
  const alwaysVisible = mode === "articles";
  const bilingual = alwaysVisible || mode === "deed";
  const sections = [];
  const entry = (heading, target = heading) => ({
    heading, id: target.id, label: heading.textContent.trim(), children: []
  });
  let inlineContents;

  if (bilingual) {
    for (const block of article.querySelectorAll('.deed-language[lang="en"]')) {
      const heading = block.querySelector("h2, h3");
      if (alwaysVisible) {
        if (heading.tagName === "H3") sections.push(entry(heading, block));
      } else if (heading.tagName === "H2") sections.push(entry(heading, block));
      else sections.at(-1)?.children.push(entry(heading, block));
    }
  } else if (mode === "corpus") {
    inlineContents = article.querySelector(".corpus-contents");
    for (const category of article.querySelectorAll(".corpus-category[id]")) {
      const section = entry(category.querySelector(":scope > h2"), category);
      section.children = [...category.querySelectorAll(".corpus-subject > h3[id]")].map(heading => entry(heading));
      sections.push(section);
    }
  } else if (mode === "references") {
    inlineContents = article.querySelector(".document-contents");
    const overview = article.querySelector("h2[id]");
    if (overview) sections.push(entry(overview));
    for (const link of inlineContents?.querySelectorAll('a[href^="#"]') || []) {
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (target && article.contains(target)) {
        sections.push({...entry(target), label: link.textContent.trim()});
      }
    }
  } else {
    inlineContents = mode === "checklist" ? article.querySelector(".decision-checklist-jump") : null;
    for (const heading of article.querySelectorAll("h2[id], h3[id]")) {
      if (mode === "checklist" || heading.tagName === "H2") sections.push(entry(heading));
      else sections.at(-1)?.children.push(entry(heading));
    }
  }
  if (!sections.length) return;

  const sidebar = document.createElement("aside");
  sidebar.className = "document-sidebar";

  const toggle = alwaysVisible ? null : document.createElement("button");
  const contentsHeading = toggle || document.createElement("h2");
  contentsHeading.textContent = "Contents";
  contentsHeading.className = alwaysVisible ? "document-contents-heading" : "document-contents-toggle";
  if (toggle) {
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Contents");
    toggle.setAttribute("aria-controls", "document-contents");
  }

  const navigation = document.createElement("nav");
  navigation.id = "document-contents";
  navigation.setAttribute("aria-label", `${article.querySelector("h1").textContent.trim()} contents`);
  const list = document.createElement("ul");
  list.className = "document-contents-list";
  const destinations = new Map();

  function linkItem(destination, label = destination.label) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${encodeURIComponent(destination.id)}`;
    link.textContent = label;
    destinations.set(link, destination.heading);
    item.append(link);
    return item;
  }

  function renderLinks(language = "en") {
    const openGroups = [...list.querySelectorAll("details")].map(group => group.open);
    list.replaceChildren();
    destinations.clear();
    function translated(destination) {
      if (!bilingual) return destination;
      const block = document.getElementById(destination.id.replace(/-(nl|en)$/, `-${language}`));
      return entry(block.querySelector("h2, h3"), block);
    }
    for (const original of sections) {
      const section = {...translated(original), children: original.children.map(translated)};
      const {children} = section;
      if (!children.length) {
        list.append(linkItem(section));
        continue;
      }
      const item = document.createElement("li");
      const group = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = section.label;
      const links = document.createElement("ul");
      links.append(linkItem(section, "Section overview"));
      for (const child of children) links.append(linkItem(child));
      group.append(summary, links);
      item.append(group);
      list.append(item);
    }
    [...list.querySelectorAll("details")].forEach((group, index) => { group.open = openGroups[index] || false; });
  }
  renderLinks();
  navigation.append(list);
  sidebar.append(contentsHeading, navigation);
  if (bilingual) {
    sidebar.prepend(document.getElementById("document-type-controls"));
    article.querySelector("#deed-comparison").addEventListener("deed-language-change", event => renderLinks(event.detail.language));
  }

  const wideScreen = window.matchMedia("(min-width: 75em)");
  const preferenceKey = "i12e.deed.contents-collapsed.v1";
  let desktopCollapsed = false;
  if (!alwaysVisible) {
    try { desktopCollapsed = localStorage.getItem(preferenceKey) === "true"; } catch { /* Keep the default. */ }
  }
  let mobileOpen = false;

  function readingTop() {
    if (alwaysVisible) return 24;
    return !wideScreen.matches || desktopCollapsed
      ? sidebar.offsetHeight + (parseFloat(getComputedStyle(sidebar).top) || 0) + 16 : 24;
  }

  function measureSidebar() {
    main.style.setProperty("--document-reading-top", `${readingTop()}px`);
  }

  function notifyLayout() {
    measureSidebar();
    main.dispatchEvent(new CustomEvent("document-layout-change", {bubbles: true}));
  }

  function capturePosition() {
    const top = readingTop();
    if (article.getBoundingClientRect().top > top) return null;
    const target = [...article.querySelectorAll("h1, h2, h3, h4, p, li, dt, dd, tr")].find(node => {
      const rect = node.getBoundingClientRect();
      return rect.height > 0 && rect.bottom > top;
    });
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    return {target, progress: Math.max(0, Math.min(1, (top - rect.top) / rect.height)), offset: Math.max(0, rect.top - top)};
  }

  function restorePosition(position) {
    if (position) {
      const rect = position.target.getBoundingClientRect();
      window.scrollTo({top: scrollY + rect.top + rect.height * position.progress - readingTop() - position.offset, behavior: "instant"});
    }
    notifyLayout();
  }

  function render() {
    if (alwaysVisible) {
      navigation.hidden = false;
      measureSidebar();
      return;
    }
    const expanded = wideScreen.matches ? !desktopCollapsed : mobileOpen;
    main.classList.toggle("document-contents-collapsed", wideScreen.matches && desktopCollapsed);
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-controls", mode === "deed" && wideScreen.matches
      ? "document-contents document-type-controls" : "document-contents");
    navigation.hidden = !expanded;
    measureSidebar();
  }

  function resize() {
    if (alwaysVisible) {
      notifyLayout();
      return;
    }
    const focusedElement = document.activeElement;
    if (!wideScreen.matches && navigation.contains(focusedElement)) mobileOpen = true;
    render();
    if (wideScreen.matches && desktopCollapsed && sidebar.contains(focusedElement)) {
      toggle.focus({preventScroll: true});
    }
    notifyLayout();
  }

  toggle?.addEventListener("click", () => {
    const position = wideScreen.matches ? capturePosition() : null;
    if (wideScreen.matches) {
      desktopCollapsed = !desktopCollapsed;
      try { localStorage.setItem(preferenceKey, String(desktopCollapsed)); } catch { /* Session controls remain usable. */ }
    } else mobileOpen = !mobileOpen;
    render();
    requestAnimationFrame(() => restorePosition(position));
  });

  sidebar.addEventListener("focusout", event => {
    if (alwaysVisible || wideScreen.matches || !mobileOpen || sidebar.contains(event.relatedTarget)) return;
    mobileOpen = false;
    render();
  });

  sidebar.addEventListener("keydown", event => {
    if (alwaysVisible || event.key !== "Escape" || wideScreen.matches || !mobileOpen) return;
    mobileOpen = false;
    render();
    toggle.focus({preventScroll: true});
    event.preventDefault();
  });

  navigation.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey
      || event.shiftKey || event.altKey) return;
    const heading = destinations.get(event.target.closest("a"));
    if (!heading) return;
    mobileOpen = false;
    render();
    // Let native fragment navigation finish before focusing the heading. Corpus
    // category fragments target the enclosing section rather than the heading.
    requestAnimationFrame(() => {
      if (!heading.hasAttribute("tabindex")) {
        heading.setAttribute("tabindex", "-1");
        heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), {once: true});
      }
      heading.focus({preventScroll: true});
    });
  });

  wideScreen.addEventListener("change", resize);
  article.before(sidebar);
  main.classList.add("document-layout");
  inlineContents?.classList.add("document-inline-contents");
  render();
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(measureSidebar).observe(sidebar);
  window.addEventListener("resize", measureSidebar);
})();
