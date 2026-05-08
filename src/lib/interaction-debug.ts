/**
 * Interaction Debug Mode
 * Toggle: window.__toggleInteractionDebug()  OR  add ?debug-ui=1 to URL
 *
 * On hover/click, logs to console:
 *  - Element + selector
 *  - Computed transform / box-shadow / filter / pointer-events / transition
 *  - Matched CSS rules touching transform/transition/filter/pointer-events (specificity-aware)
 *  - Whether a matched rule used !important and overrode the lift effect
 *  - Ancestors with `filter`, `transform`, `overflow:hidden`, `pointer-events:none`
 *    (these create stacking/containing-block traps that break hover lift, dropdowns, dialogs)
 */

const STORAGE_KEY = "__interaction_debug__";
const HIGHLIGHT_ATTR = "data-iadbg-highlight";

const PROPS = ["transform", "transition", "filter", "pointer-events", "box-shadow", "opacity"] as const;

function shortSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls = (el.getAttribute("class") || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((c) => `.${c}`)
    .join("");
  return `${tag}${id}${cls}`;
}

function specificity(sel: string): [number, number, number] {
  const ids = (sel.match(/#[\w-]+/g) || []).length;
  const classes = (sel.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+(?:\([^)]+\))?/g) || []).length;
  const types = (sel.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
  return [ids, classes, types];
}

function findMatchedRules(el: Element) {
  const matched: { selector: string; cssText: string; sheet: string; spec: [number, number, number]; important: boolean }[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    if (!rules) continue;
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule)) continue;
      let touches = false;
      for (const p of PROPS) {
        if (rule.style.getPropertyValue(p)) {
          touches = true;
          break;
        }
      }
      if (!touches) continue;
      try {
        if (el.matches(rule.selectorText)) {
          let important = false;
          for (const p of PROPS) {
            if (rule.style.getPropertyPriority(p) === "important") important = true;
          }
          matched.push({
            selector: rule.selectorText,
            cssText: rule.style.cssText,
            sheet: sheet.href ? sheet.href.split("/").pop() || sheet.href : "<inline>",
            spec: specificity(rule.selectorText),
            important,
          });
        }
      } catch {
        /* skip invalid selectors like :host-context */
      }
    }
  }
  matched.sort((a, b) => {
    if (a.important !== b.important) return a.important ? -1 : 1;
    for (let i = 0; i < 3; i++) if (a.spec[i] !== b.spec[i]) return b.spec[i] - a.spec[i];
    return 0;
  });
  return matched;
}

function findAncestorTraps(el: Element) {
  const traps: { el: Element; reasons: string[] }[] = [];
  let cur: Element | null = el.parentElement;
  while (cur && cur !== document.documentElement) {
    const cs = getComputedStyle(cur);
    const reasons: string[] = [];
    if (cs.filter && cs.filter !== "none") reasons.push(`filter: ${cs.filter}`);
    if (cs.transform && cs.transform !== "none") reasons.push(`transform: ${cs.transform}`);
    if (cs.pointerEvents === "none") reasons.push(`pointer-events: none`);
    if (cs.overflow !== "visible" && cs.overflow !== "auto") reasons.push(`overflow: ${cs.overflow}`);
    if (cs.contain && cs.contain !== "none") reasons.push(`contain: ${cs.contain}`);
    if (reasons.length) traps.push({ el: cur, reasons });
    cur = cur.parentElement;
  }
  return traps;
}

function describe(el: Element, label: string) {
  const cs = getComputedStyle(el);
  const sel = shortSelector(el);
  const matched = findMatchedRules(el);
  const traps = findAncestorTraps(el);

  const baseInfo = {
    transform: cs.transform,
    transition: cs.transitionProperty + " | " + cs.transitionDuration,
    filter: cs.filter,
    "pointer-events": cs.pointerEvents,
    "box-shadow": cs.boxShadow.slice(0, 80) + (cs.boxShadow.length > 80 ? "…" : ""),
  };

  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `%c[IA-DEBUG ${label}]%c ${sel}`,
    "color:#fff;background:#7c3aed;padding:1px 6px;border-radius:3px;font-weight:600",
    "color:inherit;font-weight:600"
  );
  console.log("element:", el);
  console.table(baseInfo);

  if (matched.length === 0) {
    console.log("%cNo matching rules touch transform/filter/pointer-events.", "color:#888");
  } else {
    console.groupCollapsed(`Matched rules (${matched.length}) — sorted by precedence`);
    matched.forEach((m, i) => {
      const tag = m.important ? "%c!important" : "%c";
      const tagStyle = m.important
        ? "color:#fff;background:#dc2626;padding:1px 4px;border-radius:2px;font-weight:600"
        : "color:#888";
      console.log(
        `%c#${i + 1}%c [${m.spec.join(",")}] %c${m.selector}%c  ${tag}  — ${m.sheet}\n   ${m.cssText}`,
        "color:#7c3aed;font-weight:600",
        "color:#888",
        "color:#0ea5e9;font-weight:600",
        "color:inherit",
        tagStyle
      );
    });
    console.groupEnd();
  }

  if (traps.length) {
    console.groupCollapsed(
      `%c⚠ Ancestor traps (${traps.length})%c — these can break lift / dropdowns / dialogs`,
      "color:#f59e0b;font-weight:600",
      "color:#888"
    );
    traps.forEach((t) => console.log(shortSelector(t.el), t.reasons, t.el));
    console.groupEnd();
  }

  console.groupEnd();
}

let attached = false;
let lastHoverEl: Element | null = null;

function highlight(el: Element | null) {
  document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`).forEach((n) => n.removeAttribute(HIGHLIGHT_ATTR));
  if (el) el.setAttribute(HIGHLIGHT_ATTR, "");
}

function ensureStyle() {
  if (document.getElementById("ia-debug-style")) return;
  const s = document.createElement("style");
  s.id = "ia-debug-style";
  s.textContent = `
    [${HIGHLIGHT_ATTR}] { outline: 2px dashed #7c3aed !important; outline-offset: 2px !important; }
    #ia-debug-badge {
      position: fixed; bottom: 12px; left: 12px; z-index: 999999;
      background: #7c3aed; color: #fff; font: 600 11px/1 ui-sans-serif, system-ui;
      padding: 6px 10px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      cursor: pointer; user-select: none; letter-spacing: 0.5px;
    }
  `;
  document.head.appendChild(s);
}

function ensureBadge() {
  if (document.getElementById("ia-debug-badge")) return;
  const b = document.createElement("div");
  b.id = "ia-debug-badge";
  b.textContent = "🔍 IA-DEBUG ON — click to disable";
  b.onclick = () => disable();
  document.body.appendChild(b);
}

function onMouseOver(e: MouseEvent) {
  const el = e.target as Element | null;
  if (!el || el === lastHoverEl) return;
  // skip our own UI
  if (el.closest("#ia-debug-badge")) return;
  lastHoverEl = el;
  highlight(el);
  describe(el, "HOVER");
}

function onClick(e: MouseEvent) {
  const el = e.target as Element | null;
  if (!el) return;
  if (el.closest("#ia-debug-badge")) return;
  describe(el, "CLICK");
}

export function enable() {
  if (attached) return;
  attached = true;
  ensureStyle();
  ensureBadge();
  document.addEventListener("mouseover", onMouseOver, true);
  document.addEventListener("click", onClick, true);
  localStorage.setItem(STORAGE_KEY, "1");
  // eslint-disable-next-line no-console
  console.log(
    "%c[IA-DEBUG] enabled%c — hover any element to log matched CSS, traps, and computed values. Toggle with window.__toggleInteractionDebug()",
    "color:#fff;background:#7c3aed;padding:2px 6px;border-radius:3px;font-weight:600",
    "color:inherit"
  );
}

export function disable() {
  if (!attached) return;
  attached = false;
  document.removeEventListener("mouseover", onMouseOver, true);
  document.removeEventListener("click", onClick, true);
  highlight(null);
  document.getElementById("ia-debug-badge")?.remove();
  localStorage.removeItem(STORAGE_KEY);
  // eslint-disable-next-line no-console
  console.log("%c[IA-DEBUG] disabled", "color:#888");
}

export function init() {
  if (typeof window === "undefined") return;
  (window as any).__toggleInteractionDebug = () => (attached ? disable() : enable());
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get("debug-ui");
  const fromStorage = localStorage.getItem(STORAGE_KEY);
  if (fromUrl === "1" || fromUrl === "true") {
    localStorage.setItem(STORAGE_KEY, "1");
    enable();
  } else if (fromUrl === "0" || fromUrl === "false") {
    disable();
  } else if (fromStorage === "1") {
    enable();
  }
}
