// Adapted from app-designer/scripts/shoot.mjs. Pure DOM analysis for CUA evaluation.
// Targets responsive web concepts and actual workspace content. No browser automation is included.
// Native device chrome and pixel-contrast screenshot pass are omitted and must be reported separately.
(() => {
  const SLOP_WORDS = [
    "effortless", "seamless", "unlock", "elevate", "supercharge", "empower", "revolutioni",
    "game-chang", "next-level", "welcome back", "let's get started", "your journey", "journey awaits",
    "lorem", "ipsum", "john doe", "jane doe", "user name", "ai-powered", "powered by ai",
    "all in one place", "at your fingertips", "take control", "level up", "stay on track",
    "crush your", "smarter way", "like never before", "transform your",
  ];
  const parse = (c) => {
    const m = c && c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hsl = ({ r, g, b }) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: h * 60, s, l };
  };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const isChrome = (el) => el.closest(".ac-status,.ac-island,.ac-home,.mini");

  const out = [];
  const smallPhone = !!document.documentElement.style.getPropertyValue("--screen-w") || getComputedStyle(document.documentElement).getPropertyValue("--screen-w").trim() !== "402px";
  for (const screen of document.querySelectorAll(".app, .workspace-content, dialog[open]")) {
    // At a small-phone size, a storyboard or App Store panel is not a screen.
    if (smallPhone && screen.dataset.chrome === "none") continue;
    const name = screen.dataset.name || screen.closest(".direction")?.id || location.pathname;
    // Root controls the viewport through CUA; this scanner does not scroll.
    const fails = [], warns = [], facts = {};
    const sr = screen.getBoundingClientRect();
    const all = [...screen.querySelectorAll("*")].filter((e) => !isChrome(e));
    const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05 && r.bottom > sr.top && r.top < sr.bottom; };

    // Text-bearing elements: own a non-empty direct text node.
    const textElsAll = all.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && visible(e));
    const textEls = textElsAll.filter((e) => !e.closest("[data-system]"));
    const text = textEls.map((e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ")).join(" \n ");

    // Effective solid background behind an element (null if an image/gradient is in the way).
    const bgOf = (el) => {
      let layers = [];
      for (let n = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
        const c = parse(cs.backgroundColor);
        if (c && c.a > 0) { layers.push(c); if (c.a >= 0.99) break; }
        if (n === screen) break;
      }
      let base = { r: 255, g: 255, b: 255, a: 1 };
      for (let i = layers.length - 1; i >= 0; i--) base = blend(layers[i], base);
      return base;
    };

    // Typography
    const fams = new Map(), sizes = new Map(), weights = new Set();
    let tiny = [], lowContrast = [], centered = 0, blocks = 0, edge = [], overImage = [];
    const pxJobs = [], pxBase = out.length * 1000;
    for (const e of textEls) {
      const cs = getComputedStyle(e);
      const fam = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
      fams.set(fam, (fams.get(fam) || 0) + 1);
      const px = Number.parseFloat(cs.fontSize);
      sizes.set(px, (sizes.get(px) || 0) + 1);
      weights.add(cs.fontWeight);
      const t = e.textContent.trim().slice(0, 40);
      if (px < 11 && !e.closest("[data-system]")) tiny.push(`${px}px "${t}"`);
      const fg = parse(cs.color);
      let bg = bgOf(e);
      // Is there an image, an SVG or a gradient between this text and its
      // solid ground? Then the solid ground is not what the eye sees.
      if (bg) {
        const r0 = e.getBoundingClientRect();
        const stack = document.elementsFromPoint(r0.left + Math.min(r0.width / 2, 40), r0.top + r0.height / 2);
        const at = stack.indexOf(e);
        for (const n of stack.slice(at + 1)) {
          if (n.contains(e)) break;
          if (n.matches("img,svg,canvas,video,picture") || n.closest("svg") || getComputedStyle(n).backgroundImage !== "none") {
            bg = null; overImage.push(`"${t}"`);
            const id = String(pxJobs.length + pxBase);
            // Read-only CUA scan: record the job without tagging the element.
            const large = px >= 24 || (px >= 18.6 && +cs.fontWeight >= 600);
            if (fg) pxJobs.push({ id, t, fg, need: large ? 3 : 4.5 });
            break;
          }
          if ((parse(getComputedStyle(n).backgroundColor)?.a || 0) > 0.95) break;
        }
      }
      if (fg && bg) {
        const ratio = contrast(blend(fg, bg), bg);
        const large = px >= 24 || (px >= 18.6 && +cs.fontWeight >= 600);
        if (ratio < (large ? 3 : 4.5)) lowContrast.push(`${ratio.toFixed(2)}:1 ${px}px "${t}"`);
      }
      if (e.textContent.trim().length > 24) { blocks++; if (cs.textAlign === "center") centered++; }
      if (!e.closest("[data-bleed],[data-scrolls]")) {
        const rg = document.createRange(); rg.selectNodeContents(e);
        for (const r of rg.getClientRects()) {
          if (r.width < 1) continue;
          const inset = Math.min(r.left - sr.left, sr.right - r.right);
          if (inset >= 0 && inset < 12) { edge.push(`${Math.round(inset)}px "${t}"`); break; }
        }
      }
    }
    facts.fonts = Object.fromEntries(fams);
    facts.sizes = [...sizes.keys()].sort((a, b) => b - a);
    facts.weights = [...weights].sort();
    const famList = [...fams.keys()].filter((f) => !/^(-apple-system|system-ui|SF Pro)/i.test(f));
    if (famList.length > 2) fails.push(`More than two type families in content: ${famList.join(", ")}`);
    if (/^Inter$/i.test(famList[0] || "") || [...fams.keys()].some((f) => /^(Inter|Poppins|Montserrat)$/i.test(f)))
      warns.push(`Default-reach font in use (${[...fams.keys()].filter((f) => /^(Inter|Poppins|Montserrat)$/i.test(f)).join(", ")}). Defend it or replace it.`);
    if (sizes.size > 8) warns.push(`${sizes.size} distinct text sizes. A type scale has 5 to 7 steps: ${facts.sizes.join(", ")}`);
    if (sizes.size <= 3 && textEls.length > 8) warns.push(`Only ${sizes.size} text sizes across ${textEls.length} text elements. Hierarchy is flat.`);
    const maxPx = Math.max(...sizes.keys());
    if (textEls.length > 6 && maxPx < 26 && !screen.hasAttribute("data-dense")) warns.push(`Largest text is ${maxPx}px. No element owns the screen. (Mark data-dense if this is deliberate.)`);
    if (tiny.length) fails.push(`Text below 11pt (iOS floor): ${tiny.slice(0, 4).join("; ")}`);
    if (lowContrast.length) fails.push(`Contrast below WCAG on solid ground: ${lowContrast.slice(0, 5).join("; ")}`);
    // Safe areas: text under the status bar or the home indicator.
    const under = [];
    for (const e of textEls) {
      if (e.closest("[data-bleed]")) continue;
      const r = e.getBoundingClientRect();
      if (false && r.top < sr.top + 52 && r.bottom > sr.top + 8) under.push(`"${e.textContent.trim().slice(0, 24)}" (status bar)`);
      if (false && r.bottom > sr.bottom - 16) under.push(`"${e.textContent.trim().slice(0, 24)}" (home indicator)`);
    }
    if (under.length) warns.push(`Text inside the system's safe areas: ${under.slice(0, 3).join("; ")}`);
    if (blocks >= 4 && centered / blocks > 0.6) warns.push(`${centered}/${blocks} text blocks centred. Centred everything reads as a template.`);
    if (edge.length) warns.push(`Text within 12pt of the screen edge: ${edge.slice(0, 3).join("; ")}`);

    // Clipping and collisions: the defects a clean scan used to hide.
    const clipped = [], overlaps = [], offscreen = [], crowded = [], stacked = [];
    const boxes = [];
    for (const e of textElsAll) {
      const cs = getComputedStyle(e);
      const t = e.textContent.trim().slice(0, 30);
      if (cs.overflow !== "visible" || cs.overflowX !== "visible") {
        if (e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== "ellipsis") clipped.push(`"${t}"`);
        if (e.scrollHeight > e.clientHeight + 2 && !cs.webkitLineClamp?.match(/\d/)) clipped.push(`"${t}" (height)`);
      }
      for (const n of e.childNodes) {
        if (n.nodeType !== 3 || !n.textContent.trim()) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        const fs = Number.parseFloat(cs.fontSize);
        for (const lr of rg.getClientRects()) {
          if (lr.width < 1) continue;
          // The ink, not the line box: caps and figures sit about 0.98em
          // above the line box's bottom edge, descenders end near it. Giant
          // display type no longer collides with its own leading.
          const inkTop = Math.max(lr.top, lr.bottom - 0.98 * fs), inkBottom = lr.bottom - 0.04 * fs;
          const r = { left: lr.left, right: lr.right, top: inkTop, bottom: inkBottom, width: lr.width, height: inkBottom - inkTop };
          boxes.push({ e, r, t });
          if ((r.left < sr.left - 1 || r.right > sr.right + 1) && !e.closest("[data-bleed],[data-scrolls]")) offscreen.push(`"${t}"`);
        }
      }
    }
    // Ancestors with overflow hidden that cut a text box.
    for (const b of boxes) {
      for (let n = b.e.parentElement; n && n !== screen; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.overflow === "visible" && cs.overflowX === "visible") continue;
        if (n.hasAttribute("data-scrolls")) break; // a scroll view: cut on purpose
        const pr = n.getBoundingClientRect();
        if (b.r.right > pr.right + 1 || b.r.left < pr.left - 1 || b.r.bottom > pr.bottom + 2) { clipped.push(`"${b.t}" cut by its container`); }
        break;
      }
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.e === b.e || a.e.contains(b.e) || b.e.contains(a.e)) continue;
      // Content scrolling under the floating glass layer is iOS 26, not a collision.
      const floats = (x) => x.e.closest(".glass,.glass-dark,[data-system],[data-float]");
      if (!floats(a) !== !floats(b)) continue;
      // The presenting view behind a sheet is covered on purpose.
      if (a.e.closest("[data-behind]") || b.e.closest("[data-behind]")) continue;
      const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (ox > 2 && oy > Math.min(a.r.height, b.r.height) * 0.35) overlaps.push(`"${a.t}" / "${b.t}"`);
      else if (oy > Math.min(a.r.height, b.r.height) * 0.6 && ox > -3 && ox <= 2) crowded.push(`"${a.t}" / "${b.t}"`);
      else if (ox > 4 && oy > -2 && oy <= Math.min(a.r.height, b.r.height) * 0.35) stacked.push(`"${a.t}" / "${b.t}"`);
    }
    if (clipped.length) fails.push(`Text clipped: ${[...new Set(clipped)].slice(0, 4).join("; ")}`);
    if (overlaps.length) fails.push(`Text overlapping text: ${[...new Set(overlaps)].slice(0, 4).join("; ")}`);
    if (stacked.length) warns.push(`Lines of text touching vertically (ink under 2pt apart): ${[...new Set(stacked)].slice(0, 3).join("; ")}`);
    if (crowded.length) fails.push(`Text touching text (under 3pt apart): ${[...new Set(crowded)].slice(0, 4).join("; ")}`);
    if (offscreen.length) fails.push(`Text running off the screen (mark data-bleed if deliberate): ${[...new Set(offscreen)].slice(0, 3).join("; ")}`);
    const lefts = new Set(textEls.filter((e) => e.textContent.trim().length > 2).map((e) => Math.round((e.getBoundingClientRect().left - sr.left) / 3) * 3).filter((x) => x > 0 && x < 140));
    facts.leftEdges = lefts.size;
    if (lefts.size > 5 && !screen.hasAttribute("data-dense")) warns.push(`${lefts.size} distinct left edges in the left third. Align to fewer verticals.`);

    // Copy
    const emoji = text.match(/\p{Extended_Pictographic}/gu);
    if (emoji) fails.push(`Emoji in UI copy or as icons: ${[...new Set(emoji)].join(" ")}`);
    const lower = text.toLowerCase();
    const hits = SLOP_WORDS.filter((w) => lower.includes(w));
    if (hits.length) fails.push(`Slop copy: ${hits.map((h) => `"${h}"`).join(", ")}`);
    const greet = textEls.find((e) => /^(good (morning|afternoon|evening|night)|hi|hey|hello|welcome)\b/i.test(e.textContent.trim()) && e.getBoundingClientRect().top - sr.top < 260);
    if (greet) fails.push(`Greeting at the top of the screen: "${greet.textContent.trim().slice(0, 40)}". Spend that space on the thing itself.`);
    if (/\u2014/.test(text)) warns.push("Em dash in visible copy. Usually a period or colon reads cleaner.");
    if (/!\s/.test(text + " ") && (text.match(/!/g) || []).length > 1) warns.push(`${(text.match(/!/g) || []).length} exclamation marks. The UI is shouting.`);

    // Colour, gradients, shadows, cards
    const accents = new Map();
    let gradients = 0, purpleGrad = 0, glows = 0, shadows = 0, cards = [], chips = 0, blurBlobs = 0;
    for (const e of all) {
      if (!visible(e)) continue;
      const cs = getComputedStyle(e);
      if (e.closest("[data-system]")) continue;
      for (const prop of ["color", "backgroundColor", "borderTopColor", "fill", "stroke"]) {
        if ((prop === "fill" || prop === "stroke") && !(e.namespaceURI === "http://www.w3.org/2000/svg")) continue;
        const c = parse(cs[prop]);
        if (!c || c.a < 0.5) continue;
        if (prop === "borderTopColor" && Number.parseFloat(cs.borderTopWidth) === 0) continue;
        const { h, s, l } = hsl(c);
        if (s > 0.38 && l > 0.15 && l < 0.85) { const k = Math.round(h / 24) * 24 % 360; accents.set(k, (accents.get(k) || 0) + 1); }
      }
      const bi = cs.backgroundImage;
      if (bi && bi.includes("gradient")) {
        gradients++;
        const stops = [...bi.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0])).filter(Boolean).map(hsl);
        if (stops.some((x) => x.s > 0.35 && x.h >= 235 && x.h <= 295)) purpleGrad++;
      }
      const f = cs.filter + " " + cs.backdropFilter;
      const r = e.getBoundingClientRect();
      if (/blur\((\d{2,})/.test(cs.filter) && r.width > 80) blurBlobs++;
      if (cs.boxShadow !== "none") {
        shadows++;
        for (const sh of cs.boxShadow.split(/,(?![^(]*\))/)) {
          const c = parse(sh); const nums = sh.replace(/rgba?\([^)]+\)/, "").trim().split(/\s+/).map(Number.parseFloat);
          if (c && !/inset/.test(sh) && Math.abs(nums[0]) < 1 && Math.abs(nums[1]) < 1 && (nums[2] || 0) > 8 && hsl(c).s > 0.4) glows++;
        }
      }
      const radius = Number.parseFloat(cs.borderTopLeftRadius);
      const filled = (parse(cs.backgroundColor)?.a || 0) > 0.05 || cs.boxShadow !== "none" || Number.parseFloat(cs.borderTopWidth) > 0;
      if (radius >= 10 && filled && r.width > 120 && r.height > 56) cards.push(e);
      if (!e.closest("[data-system]") && r.width >= 26 && r.width <= 48 && Math.abs(r.width - r.height) < 2 && radius >= 6 && radius < r.width / 2 - 1 && filled && e.querySelector("svg,img,i,span"))
        chips++;
    }
    const hues = [...accents.entries()].filter(([, n]) => n >= 1).map(([h]) => h);
    facts.accentHues = hues;
    if (hues.length > 3) fails.push(`${hues.length} saturated hue families (${hues.join("°, ")}°). One accent, maybe one semantic colour. This is confetti.`);
    else if (hues.length === 3) warns.push(`Three saturated hue families (${hues.join("°, ")}°). Is each one earning its place?`);
    if (purpleGrad) fails.push(`Purple/indigo gradient x${purpleGrad}. The single most recognisable AI tell.`);
    if (gradients > 2) warns.push(`${gradients} gradients. Gradients are a seasoning, not a surface treatment.`);
    if (glows) fails.push(`Coloured zero-offset glow shadow x${glows}.`);
    if (blurBlobs) fails.push(`Large blurred blob x${blurBlobs}. Ambient orbs behind content are a slop signature.`);
    if (chips >= 3) warns.push(`${chips} icon-in-tinted-square chips. If every row has one, none of them mean anything.`);
    // Floating "+" action button in or above the tab bar
    for (const e of all) {
      if (!visible(e)) continue;
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      const bg = parse(cs.backgroundColor);
      if (r.width >= 44 && r.width <= 72 && Math.abs(r.width - r.height) < 2 && Number.parseFloat(cs.borderTopLeftRadius) >= r.width / 2 - 1
        && bg && bg.a > 0.8 && hsl(bg).s > 0.35 && sr.bottom - r.bottom < 140 && Math.abs((r.left + r.right) / 2 - (sr.left + sr.right) / 2) < 30) {
        fails.push("Centred floating action button over the tab bar. Put the primary action where the content is."); break;
      }
    }
    let nested = 0;
    for (const c of cards) if (cards.some((o) => o !== c && o.contains(c))) nested++;
    facts.cards = cards.length;
    if (nested >= 2) fails.push(`Cards nested inside cards x${nested}. Group with space, not boxes.`);
    if (cards.length >= 6 && !screen.hasAttribute("data-dense")) warns.push(`${cards.length} card containers on one screen. Is the screen just a stack of boxes?`);
    if (shadows > 6) warns.push(`${shadows} elements cast shadows. Depth should come from one or two layers, not every tile.`);

    // Touch targets
    const small = [];
    for (const e of screen.querySelectorAll("button,a,[role=button],[data-tap],input,select")) {
      if (isChrome(e) || !visible(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 44 && r.height < 44 && !e.hasAttribute("data-hit-expanded")) small.push(`${Math.round(r.width)}x${Math.round(r.height)} "${(e.getAttribute("aria-label") || e.textContent).trim().slice(0, 20)}"`);
    }
    if (small.length) warns.push(`Tap targets under 44pt (add padding, or data-hit-expanded if the hit area is larger than the drawing): ${small.slice(0, 4).join("; ")}`);

    out.push({ name, fails, warns, facts, pxJobs, chrome: false && !screen.classList.contains("app-icon") });
  }
  return out;
})
