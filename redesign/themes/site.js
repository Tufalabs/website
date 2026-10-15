// the way back from a post, while choosing among variants (?back=a|b|c|d, remembered for the visit)
(() => {
    const q = new URLSearchParams(location.search).get('back');
    let v = 'c';
    try { if (q) sessionStorage.setItem('tufa-back', q); v = sessionStorage.getItem('tufa-back') || v; } catch (e) { v = q || v; }
    document.documentElement.dataset.back = v;
})();
var tauMs = (v) => { v = String(v).trim(); const n = parseFloat(v); return isNaN(n) ? 120 : /ms$/.test(v) || !/s$/.test(v) ? n : n * 1000; };   // the beat in ms ("120ms", or ".12s" after minifying)
// Site behaviour that needs a script: the page lifecycle the router drives, the header (menu, nav point, theme), each
// page's parts (statement sizing, page name, compute sheet, build-up, privacy policy) and the creature.
// A page's own parts (each script registers them in window.__tufaPages) run for every page: on the first load and for each
// page the router brings in (router.js); the cleanups they return run when that page is left. Without the router, once.
window.tufaPage = (() => {
    let cleanups = [], viewed = false;
    const run = (fn) => { try { const c = fn(); if (typeof c === 'function') cleanups.push(c); } catch (e) { console.error(e); } };
    document.addEventListener('DOMContentLoaded', () => { if (!viewed) window.tufaPage.view(); });
    return {
        view() { viewed = true; (window.__tufaPages || []).forEach(run); },
        leave() { const c = cleanups.reverse(); cleanups = []; c.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); },
    };
})();
(() => {
    const root = document.documentElement;
    if (root.classList.contains('off-js')) return;   // bisect switch (?off=js)

    // a new page opens at its top (the browser, or an embedding frame, may otherwise keep the old scroll); back and
    // forward still return to where the reader was, and a #link still goes to its section
    const entry = performance.getEntriesByType('navigation')[0];
    if (!location.hash && (!entry || entry.type === 'navigate')) { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; scrollTo(0, 0); }
    addEventListener('pageshow', (e) => { if (e.persisted || entry?.type === 'back_forward') history.scrollRestoration = 'auto'; });
    // what belongs to the page: run for every page (router.js: the first load and each page swup brings in)
    (window.__tufaPages ||= []).push(() => {
    // images come into focus as they load
    document.querySelectorAll('main img').forEach((im) => { if (im.complete) return; im.classList.add('is-loading'); const done = () => im.classList.remove('is-loading'); im.addEventListener('load', done, { once: true }); im.addEventListener('error', done, { once: true }); });

    // long statements step down one size so they stay a statement, not a wall of display type
    const LONG = 140;
    document.querySelectorAll('.home-content > p:nth-of-type(2), .page-lede, .page:not(:has(.page-lede)) > .page-content > p:first-child')
        .forEach((p) => { if (!p.hasAttribute('data-pre')) p.classList.toggle('is-long', p.textContent.trim().length > LONG); });   // the build marks most already (tools/prerender.py)

    // the page name as the head's headline, above the statement (CSS sets it); the home page keeps its statement
    const statement = document.querySelector('.page-lede, .page:not(:has(.page-lede)) > .page-content > p:first-child');
    const title = document.querySelector('.page-title')?.textContent.trim();
    if (statement && title && !statement.querySelector('.band-kicker')) { const k = document.createElement('span'); k.className = 'band-kicker'; k.setAttribute('aria-hidden', 'true'); k.textContent = title; statement.prepend(k); }
    // the name of the lab heads every page, the largest text there; the header keeps only the mark
    const headText = document.querySelector('.home-content > p:nth-of-type(2)');   // the home page only: elsewhere the page name leads
    if (headText && !headText.querySelector('.band-brand')) { const b = document.createElement('span'); b.className = 'band-brand'; b.setAttribute('aria-hidden', 'true'); b.textContent = 'Tufa Labs'; headText.prepend(b); }

    // compute table → comparison sheet: the systems as columns, the measures as rows. Each value is one
    // line (figure, unit, reference) with the per-cluster figure as a quiet line below. The table stays
    // for screen readers.
    const table = document.querySelector('.compute-table');
    if (table) {
        const keys = [...table.querySelectorAll('thead th')].map((th) => th.innerHTML.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
        const refs = (el) => [...el.querySelectorAll('sup')].map((sp) => sp.cloneNode(true));
        const mainText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
        const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
        const rows = [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.children]);
        // draft copy: both clusters are running, so no "Current" / "Expected" kickers; each has a name
        const NAMES = [[/DGX B200/, 'Kander'], [/GB300/, 'Thur']];
        rows.forEach((cells) => {
            const t = cells[0].firstChild;
            if (t && t.nodeType === 3) t.textContent = t.textContent.replace(/^\s*[^:]*:\s*/, (m) => (cells.length > 2 ? '\n                    ' : m));
        });
        const nameOf = (cells) => (NAMES.find(([re]) => re.test(mainText(cells[0]))) || [, ''])[1];
        const systems = rows.filter((cells) => cells.length > 2), extra = rows.filter((cells) => cells.length <= 2);
        const sheet = el('div', 'spec-sheet'); sheet.setAttribute('aria-hidden', 'true');
        sheet.style.setProperty('--systems', systems.length);
        // the first row: each cluster's name, its system (with references) a quiet line beneath
        const names = el('div', 'spec-row spec-names'); names.append(el('span', 'spec-k', 'System'));
        systems.forEach((cells) => {
            const t = mainText(cells[0]), sys = t.includes(':') ? t.split(/:\s*/)[1] : t;
            const c = el('div', 'spec-cell'), l = el('span', 'spec-line'); l.append(el('b', '', nameOf(cells))); c.append(l);
            const n = el('span', 'spec-n', sys + ' '); refs(cells[0]).forEach((r) => n.append(r)); c.append(n);
            names.append(c);
        });
        sheet.append(names);
        // and in the table kept for screen readers
        const thName = document.createElement('th'); thName.textContent = 'Name';
        table.querySelector('thead tr')?.insertBefore(thName, table.querySelector('thead th:nth-child(2)'));
        rows.forEach((cells) => { const td = document.createElement('td'); td.textContent = cells.length > 2 ? nameOf(cells) : ''; cells[0].after(td); });
        // a value: "864 PFLOPS sparse, 432 PFLOPS dense" → 864 / 432  PFLOPS sparse / dense
        const value = (td) => {
            const parts = mainText(td).split(/,\s*/).map((p) => p.match(/^([\d.,]+)\s*(.*)$/) || [p, '', p]);
            const line = el('span', 'spec-line');
            if (parts.every((m) => m[1])) {
                const units = parts.map((m) => m[2].split(' ')), same = units.every((u) => u[0] === units[0][0]);
                line.append(el('b', '', parts.map((m) => m[1]).join(' / ')));
                line.append(el('i', '', same && parts.length > 1 ? `${units[0][0]} ${units.map((u) => u.slice(1).join(' ')).join(' / ')}` : parts.map((m) => m[2]).join(' / ')));
            } else line.textContent = mainText(td);
            refs(td).forEach((r) => line.append(r));
            const v = el('div', 'spec-cell'); v.append(line);
            const note = td.querySelector('.per-cluster-note');
            if (note) v.append(el('span', 'spec-n', note.textContent.replace(/^\(|\)$/g, '')));
            return v;
        };
        keys.slice(1).forEach((key, i) => {
            const row = el('div', 'spec-row'); row.append(el('span', 'spec-k', key));
            systems.forEach((cells) => row.append(value(cells[i + 1])));
            sheet.append(row);
        });
        // anything that is not a measure of both systems (extra rented capacity) belongs in the note under the sheet
        const foot = table.closest('.compute-table-wrap')?.querySelector('.compute-footnote') || table.parentElement.querySelector('.compute-footnote');
        extra.forEach((cells) => { const k = mainText(cells[0]), v = mainText(cells[1]); if (foot) foot.append(` ${k}: ${v.charAt(0).toLowerCase() + v.slice(1)}.`); });
        table.classList.add('is-sheeted');
        table.after(sheet);
    }
    });

    // phone menu: one header row (logo + Menu); the list opens above the header rule
    const nav = document.querySelector('.site-nav');
    const row = document.querySelector('.header-content');
    if (!nav || !row) return;
    const list = nav.querySelector('ul');

    // the active point, beside the current page's item. Between pages it travels from the item that was active (a move:
    // 4τ, the one curve): from the last page after a full load, or live when the router brings the next page in
    const desktop = matchMedia('(min-width: 901px)'), cssv = (k) => getComputedStyle(root).getPropertyValue(k);
    const still = () => root.classList.contains('no-motion');   // small movements: they stay under the system's reduced motion
    const items = () => [...list.querySelectorAll('a[href]')].filter((a) => !a.closest('.theme-item'));
    const current = () => items().find((a) => a.classList.contains('active'));
    const at = (a) => { const l = list.getBoundingClientRect(), r = a.getBoundingClientRect(), gap = parseFloat(getComputedStyle(root).fontSize) * 0.375; return { x: r.left - l.left - gap, w: 0, y: r.top - l.top + r.height / 2 }; };   // beside the label, a quarter line to its left, level with its text
    const mark = document.createElement('span');
    mark.className = 'nav-mark'; mark.setAttribute('aria-hidden', 'true');
    const place = (p) => { mark.style.top = `${p.y}px`; mark.style.transform = `translateX(${p.x}px)`; };
    const slide = (from, to) => {
        if (!from || still() || from.x === to.x || !mark.animate) return;
        const k = Math.min(2.5, 1 + Math.abs(to.x - from.x) / 120);   /* stretched along its path while it travels, round again when it lands */
        mark.animate([{ transform: `translateX(${from.x}px) scaleX(1)` }, { transform: `translateX(${(from.x + to.x) / 2}px) scaleX(${k})`, offset: 0.5 }, { transform: `translateX(${to.x}px) scaleX(1)` }], { duration: 4 * tauMs(cssv('--tau')), easing: cssv('--ease').trim() || 'ease-in-out' });
    };
    const show = () => { const a = current(); mark.hidden = !a || !desktop.matches; if (a && desktop.matches) place(at(a)); };
    if (desktop.matches) {
        list.style.position = 'relative'; list.appendChild(mark);
        root.classList.add('has-nav-mark');
        show();
        let from = null;
        try { from = JSON.parse(sessionStorage.getItem('tufa-nav-mark') || 'null'); sessionStorage.removeItem('tufa-nav-mark'); } catch (e) {}
        if (current()) slide(from, at(current()));   // travel from the last page's item, unhurried
        addEventListener('resize', show);
        document.fonts?.ready.then(show);
        // leaving for a full page load: remember where the mark was
        addEventListener('pagehide', () => { const a = current(); if (a) try { sessionStorage.setItem('tufa-nav-mark', JSON.stringify(at(a))); } catch (e) {} });
    }
    // the router brought a page in: its own nav says which item is active (the build decides: a post marks its section)
    window.tufaNav = {
        select(href) {
            const prev = current(), from = prev && mark.isConnected && !mark.hidden ? at(prev) : null;
            const next = href ? items().find((a) => a.getAttribute('href') === href) : null;
            items().forEach((a) => { const on = a === next; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
            if (!mark.isConnected) return;
            show(); if (next && !mark.hidden) slide(from, at(next));
        },
        close: () => set(false),
    };
    list.id = 'site-nav-list';
    const button = row.querySelector('.nav-toggle') || document.createElement('button');   // the build writes it into the header (tools/prerender.py)
    button.type = 'button';
    button.className = 'nav-toggle';
    button.setAttribute('aria-controls', list.id);
    // closing, the list folds up (1.5τ, the one curve) and the header's rule rises with it; opening again stops the fold
    let fold = null;
    const set = (open) => {
        fold?.cancel(); fold = null; root.classList.remove('nav-closing');
        if (!open && root.classList.contains('nav-open') && !desktop.matches && !still() && nav.animate) {
            root.classList.add('nav-closing');
            fold = nav.animate([{ height: `${nav.offsetHeight}px`, opacity: 1 }, { height: '0px', opacity: 0 }],
                { duration: 1.5 * tauMs(cssv('--tau')), easing: cssv('--ease').trim() || 'ease-in-out' });
            const f = fold; f.finished.then(() => { if (fold === f) { root.classList.remove('nav-closing'); fold = null; } }).catch(() => {});
        }
        root.classList.toggle('nav-open', open);
        button.setAttribute('aria-expanded', String(open));
        button.textContent = open ? 'Close' : 'Menu';
    };
    button.addEventListener('click', () => { set(!root.classList.contains('nav-open')); if (root.classList.contains('nav-open')) list.querySelectorAll('a').forEach(prefetch); });
    // the next page is fetched ahead: when the menu opens (phones), or the pointer rests on a link (desktop)
    const fetched = new Set();
    function prefetch(a) { const u = a.href; if (!u || fetched.has(u) || a.classList.contains('active') || new URL(u).origin !== location.origin) return; fetched.add(u);
        if (window.tufaSwup?.preload) { window.tufaSwup.preload(u)?.catch?.(() => {}); return; }   // the router keeps it, ready to swap in
        const l = document.createElement('link'); l.rel = 'prefetch'; l.href = u; document.head.appendChild(l); }
    list.querySelectorAll('a').forEach((a) => a.addEventListener('pointerenter', () => prefetch(a)));
    // a tap answers at once: the item takes the point, the menu folds away and the old page clears while the next one loads
    list.addEventListener('click', (e) => {
        const a = e.target.closest('a'); if (!a || !root.classList.contains('nav-open') || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
        if (new URL(a.href, location.href).pathname === location.pathname) { set(false); return; }   // this very page: the menu folds, the page stays (the router takes it to its top)
        list.querySelectorAll('a.active').forEach((x) => { x.classList.remove('active'); x.removeAttribute('aria-current'); });
        a.classList.add('active'); a.setAttribute('aria-current', 'page'); set(false); root.classList.add('is-leaving');   // and the page under the header clears
    });
    addEventListener('pageshow', (e) => { if (e.persisted) { set(false); root.classList.remove('is-leaving'); } });   // back to this page from the cache: the menu closed
    // leaving for a page that loads in full: it builds up with short waits (the head script reads this before paint)
    addEventListener('pagehide', () => { try { sessionStorage.setItem('tufa-inside', String(Date.now())); } catch (e) {} });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('nav-open')) { set(false); button.focus(); } });
    matchMedia('(min-width: 901px)').addEventListener?.('change', (e) => e.matches && set(false));
    set(false);
    // light / dark: the whole system inverted (the tint carries over); remembered, applied before paint by the head script
    const theme = document.createElement('button');
    theme.type = 'button'; theme.className = 'theme-toggle';
    const showTheme = () => { const dark = root.dataset.theme === 'dark'; theme.setAttribute('aria-pressed', String(dark)); theme.setAttribute('aria-label', dark ? 'Switch to the light design' : 'Switch to the dark design'); };
    const flip = () => {
        const dark = root.dataset.theme !== 'dark';
        if (dark) root.dataset.theme = 'dark'; else delete root.dataset.theme;
        try { localStorage.setItem('tufa-theme', dark ? 'dark' : 'light'); } catch (e) { /* storage blocked */ }
        showTheme();
    };
    // the switch: the other theme spreads from the ring as a soft-edged disc until it covers the page (a view
    // transition: the new page is revealed through a growing radial mask, 8τ on the one curve)
    theme.addEventListener('click', () => {
        if (root.classList.contains('no-motion') || !document.startViewTransition) { flip(); return; }
        // reduced motion (the system asks): no disc sweeping the whole screen, the themes cross-fade
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) { document.startViewTransition(flip); return; }
        const b = theme.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
        const R = 2 * Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 48;   // the edge is soft over half the radius, so the disc grows to twice the farthest corner
        root.style.setProperty('--vx', `${x}px`); root.style.setProperty('--vy', `${y}px`); root.style.setProperty('--vd', `${2 * R}px`);
        root.classList.add('theme-flip');   // the disc itself is CSS (system.css: theme-disc)
        const t = document.startViewTransition(flip);
        t.finished.finally(() => root.classList.remove('theme-flip'));
    });
    showTheme();
    const li = document.createElement('li'); li.className = 'theme-item'; li.appendChild(theme); list.appendChild(li);   // last in the nav: the layout stays as it was
    if (!button.isConnected) row.appendChild(button);
})();

// The build-up, by the rules: the page name and the statement are written (letters in reading order, the first at
// its start, the last 4τ later, each fading from a 2u blur over 4τ); content blocks start in order of height.
// window.tufaBuild.split(el) is also used by hero.js for the page name it adds.
(() => {
    const root = document.documentElement;
    if (root.classList.contains('no-motion')) { window.tufaBuild = { split() {} }; return; }   // (under reduced motion the build-up stays: fades, without blur)
    const TAU = tauMs(getComputedStyle(root).getPropertyValue('--tau'));   // the beat, in ms
    let bt = 1;   // the waits' pace, read for each page (shorter when moving on within the site)
    let seed = (Math.random() * 2147483646 + 1) | 0; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // smooth value noise on a line: a random value every `cell` units, smoothstep in between
    const noise1 = (n, cell) => { const lat = Array.from({ length: Math.ceil(n / cell) + 2 }, rnd); return Array.from({ length: n }, (_, i) => { const g = i / cell, k = Math.floor(g), f = g - k, s = f * f * (3 - 2 * f); return lat[k] + (lat[k + 1] - lat[k]) * s; }); };
    const split = (el, { unit = 'word', base = 0, spread = 400, drift = 0.4, cell = 3 } = {}) => {
        if (!el || el.dataset.split) return; el.dataset.split = '1';
        const pieces = []; const walk = (node) => { [...node.childNodes].forEach((c) => {
            if (c.nodeType === 3) { const parts = unit === 'char' ? [...c.textContent] : c.textContent.split(/(\s+)/); const frag = document.createDocumentFragment();
                parts.forEach((t) => { if (!t) return; if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; } const sp = document.createElement('span'); sp.className = 'bw'; sp.textContent = t; pieces.push(sp); frag.appendChild(sp); });
                c.replaceWith(frag); }
            else if (c.nodeType === 1 && !c.classList.contains('band-kicker') && !c.classList.contains('band-brand')) walk(c);
        }); };
        walk(el);
        // write: letters start in reading order, evenly, the first at `base` and the last `spread` later
        // (the wait before shortens between pages; the sweep keeps its pace)
        pieces.forEach((sp, i) => { sp.style.animationDelay = `${Math.round(base * bt + (i / Math.max(1, pieces.length - 1)) * spread)}ms`; });
        el.classList.add('is-split');
    };
    window.tufaBuild = { split: (el) => split(el, { unit: 'char', base: 0, spread: 2 * TAU }) };   // write: letters start within 2τ, each 4τ, so many blur in together
    (window.__tufaPages ||= []).push(() => {   // for every page (router.js)
    bt = parseFloat(getComputedStyle(root).getPropertyValue('--bt')) || 1;
    document.querySelectorAll('.band-brand, .band-kicker').forEach((k) => window.tufaBuild.split(k));   // write: the largest text (the lab's name at home, the page name elsewhere)
    // the statement, word by word
    // write is for the largest text only: the page name (added above), or the home statement where there is no name;
    // every other text appears, as a whole, with a fade

    // content blocks: by their height on the page (first screen only matters), with noise
    const blocks = [...document.querySelectorAll('.home-content > :not(.section-line):not(.rail-wrap):not(p:nth-of-type(2)), .page > .page-content > :not(.section-line):not(.rail-wrap):not(:first-child), .post-content > *, .post-list > li, .team-list > *')];
    if (blocks.length) {
        const top0 = Math.min(...blocks.map((b) => b.getBoundingClientRect().top)), vh = innerHeight || 800;
        blocks.forEach((b, i) => { const dy = Math.max(0, Math.min(1.2, (b.getBoundingClientRect().top - top0) / vh)); b.style.animationDelay = `${Math.round((2 * TAU + dy * 4 * TAU) * bt)}ms`; /* delay by height: from 2τ, over 4τ */ });
    }
    });
})();

// The privacy policy comes from a widget (kept, so its legal text stays current). Once it has rendered, its content
// is adopted into the page: the intro becomes the statement under the page name, the date a metadata line, and the
// topics sections with the index (the widget's "Privacy policy" heading repeats the title, so its sub-topics are
// promoted); the widget's own stylesheet and title are dropped. (A page of its own: the router loads it in full, so its
// widget script runs; the watch stops if the page is left before the widget has rendered.)
(window.__tufaPages ||= []).push(() => {
    const w = document.querySelector('privacybee-widget'), content = w && w.closest('.page-content'); if (!content) return;
    const adopt = (wrap) => {
        const nodes = [...wrap.children].filter((n) => n.tagName !== 'LINK' && n.tagName !== 'H1');
        const out = []; let promote = false, date = null, intro = null;
        nodes.forEach((n) => {
            const t = n.textContent.trim();
            if (!date && n.tagName === 'P' && /^last update/i.test(t)) { date = t; return; }
            if (!intro && n.tagName === 'P' && !out.length) { intro = n; return; }
            if (n.tagName === 'H2' && /^privacy policy$/i.test(t)) { promote = true; return; }
            let el = n;
            if (promote && (n.tagName === 'H3' || n.tagName === 'H4')) { el = document.createElement(n.tagName === 'H3' ? 'h2' : 'h3'); el.innerHTML = n.innerHTML; if (n.id) el.id = n.id; }
            el.removeAttribute('class'); el.querySelectorAll('[class]').forEach((x) => x.removeAttribute('class'));
            out.push(el);
        });
        // the widget's cards (icon, title, "view more") become plain lists: data categories by name, services as a link
        // with their category; the repeated date and the numbered contents (the index does that) are dropped
        const leafs = (card) => { const t = []; const walk = (n) => n.childNodes.forEach((c) => { if (c.nodeType === 3) { const v = c.textContent.trim(); if (v) t.push(v); } else if (c.nodeType === 1 && c.tagName.toLowerCase() !== 'svg') walk(c); }); walk(card); return t.filter((v) => !/^view more/i.test(v)); };
        const heads = out.filter((el) => /^H[23]$/.test(el.tagName)).map((el) => el.textContent.trim().toLowerCase());
        for (let i = out.length - 1; i >= 0; i--) {
            const el = out[i], cards = [...el.querySelectorAll('[role="dialog"]')];
            if (cards.length) {
                const ul = document.createElement('ul');
                cards.forEach((c) => { const t = leafs(c), url = t.find((v) => /^https?:\/\//.test(v)), li = document.createElement('li');
                    if (url) { const name = t[0], tags = [...new Set(t.filter((v) => v !== name && v !== url))]; const a2 = document.createElement('a'); a2.href = url; a2.textContent = name; a2.target = '_blank'; a2.rel = 'noopener noreferrer'; li.append(a2); if (tags.length) { const tg = document.createElement('span'); tg.className = 'privacy-tag'; tg.textContent = tags.join(' · '); li.append(' ', tg); } }
                    else li.textContent = t[0] || '';
                    ul.append(li); });
                out.splice(i, 1, ul); continue;
            }
            if (el.tagName === 'P' && /^last update/i.test(el.textContent.trim())) { out.splice(i, 1); continue; }
            const links = el.querySelectorAll ? [...el.querySelectorAll('a')].map((x) => x.textContent.replace(/^\s*\d+\.\s*/, '').trim().toLowerCase()) : [];
            if (links.length > 2 && links.every((v) => heads.includes(v)) && el.textContent.replace(/[\d.\s]/g, '').length <= links.join('').replace(/\s/g, '').length + 4) { out.splice(i, 1); continue; }   // numbered contents as links
            if (/^(OL|UL)$/.test(el.tagName)) { const items = [...el.querySelectorAll('li')].map((li) => li.textContent.replace(/^\s*\d+\.\s*/, '').trim().toLowerCase()); if (items.length > 2 && items.every((v) => heads.includes(v))) out.splice(i, 1); }
            const inner = el.querySelector && el.querySelector('ol, ul'); if (el.tagName === 'DIV' && inner && !el.querySelector('p, h2, h3, h4')) { const items = [...inner.querySelectorAll('li')].map((li) => li.textContent.replace(/^\s*\d+\.\s*/, '').trim().toLowerCase()); if (items.length > 2 && items.every((v) => heads.includes(v))) out.splice(i, 1); }
        }
        wrap.querySelectorAll('link').forEach((l) => l.remove());
        const first = content.firstChild;
        if (intro) { const p = document.createElement('p'); p.innerHTML = intro.innerHTML; content.insertBefore(p, first);
            const title = document.querySelector('.page-title')?.textContent.trim(); if (title) { const k = document.createElement('span'); k.className = 'band-kicker'; k.setAttribute('aria-hidden', 'true'); k.textContent = title; p.prepend(k); window.tufaBuild?.split(k); } }
        if (date) { const d = document.createElement('p'); d.className = 'privacy-updated'; d.textContent = date; content.insertBefore(d, first); }
        out.forEach((el) => content.insertBefore(el, first));
        w.classList.add('is-adopted');
        window.tufaSections?.();
    };
    // the widget renders in stages: adopt once it has been quiet for a moment
    let quiet = 0; const settle = () => { clearTimeout(quiet); quiet = setTimeout(() => { const wrap = w.querySelector('.prx_wrapper'); if (wrap && wrap.querySelector('h2')) { obs.disconnect(); adopt(wrap); } }, 300); };
    const obs = new MutationObserver(settle); obs.observe(w, { childList: true, subtree: true, characterData: true }); settle();
    return () => { clearTimeout(quiet); obs.disconnect(); };
});

// The creature (the identity repo's js/creature.js): in the header, on the bar beside the logo, the same animal on every
// page; on the identity page, the large marks too.
(() => {
    const svg = document.querySelector('svg.logo-image');
    // the header's ground, measured live: from the header's content column on the left (never out into the page margin)
    // to at most ~1.6 body widths towards the navigation, and up and down within the header bar. The logo's link covers
    // all of it, so the whole ground is a way home, not only where the animal stands.
    const ground = (m, r, k) => {
        const W = m.W, nav = document.querySelector('.site-nav ul'), home = r.left, navL = nav ? nav.getBoundingClientRect().left : innerWidth - 40;
        const col = (svg.closest('a') || svg).parentElement.getBoundingClientRect().left, L = -Math.min(1.2 * W, Math.max(0, home - col) * k), R = Math.min(1.6 * W, Math.max(0, navL - (home + r.width) - 28) * k);
        const bar = svg.closest('.site-header')?.getBoundingClientRect(), U = bar ? -Math.max(0, r.top - bar.top - 14) * k : 0, D = bar ? Math.max(0, bar.bottom - 16 - r.bottom) * k : 0;
        const link = svg.closest('a');
        if (link) { const lr = link.getBoundingClientRect(), hit = [r.left + L / k - lr.left, r.top + U / k - lr.top, r.width + (R - L) / k, r.height + (D - U) / k].map((v) => v.toFixed(0) + 'px').join(' ');
            if (link.dataset.hit !== hit) { link.dataset.hit = hit; const [hl, ht, hw, hh] = hit.split(' '); link.style.setProperty('--hit-l', hl); link.style.setProperty('--hit-t', ht); link.style.setProperty('--hit-w', hw); link.style.setProperty('--hit-h', hh); } }
        return { cx: (L + R) / 2, rx: (R - L) / 2, cy: (U + D) / 2, ry: Math.max(0.001, (D - U) / 2), box: true };
    };
    window.TufaCreature?.mount(svg, { ground, dashCap: 1.5, homeNear: true, persist: 'tufa-creature' });
    // pages come and go under the header (router.js): the identity page's marks join, and leave with it
    (window.__tufaPages ||= []).push(() => window.TufaCreature?.track('.id-headmark svg, .id-pair .id-mark-big:not(.id-parts) svg'));
})();

// sidenotes beside their line: each at the height of the reference that cites it, pushed down only as far as the note
// before it needs; laid out again whenever the text reflows (fonts, images, maths, width)
(window.__tufaPages ||= []).push(() => {
    const pc = document.querySelector('body.post--sidenotes .post-content'); if (!pc) return;
    const wide = matchMedia('(min-width: 901px)');
    const grown = new Set();   // elements given room at their foot, reset on every layout
    const lay = () => {
        const notes = [...pc.querySelectorAll('.sidenote')];
        grown.forEach((el) => { el.style.marginBottom = ''; }); grown.clear();
        if (!wide.matches) { notes.forEach((n) => { n.style.top = ''; }); pc.style.minHeight = ''; return; }
        const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--line')) / 2 || 12;
        // each section after the first starts at its line; the notes of the section before must end above it. Where they
        // do not, the section's last element gets the difference at its foot: the next title, line and text move down together
        // (the section's end is the foot of its last element: the titles stick and the lines follow the layout, so neither is a fixed mark)
        const lastOf = (h) => { let p = h.previousElementSibling; while (p && (p.classList.contains('section-line') || p.classList.contains('rail-wrap'))) p = p.previousElementSibling; return p; };
        const heads = [...pc.children].filter((el) => el.tagName === 'H2').slice(1).filter(lastOf);
        const anchor = (n) => n.previousElementSibling?.previousElementSibling || n.parentElement;
        const items = [...notes.map((n) => [anchor(n).getBoundingClientRect().top, n]), ...heads.map((h) => [lastOf(h).getBoundingClientRect().bottom, h])]
            .sort((a, b) => a[0] - b[0]);
        let floor = -Infinity;
        for (const [, el] of items) {
            const top0 = pc.getBoundingClientRect().top;
            if (el.tagName === 'H2') {
                const prev = lastOf(el), at = prev.getBoundingClientRect().bottom - top0;
                if (floor > at) { prev.style.marginBottom = `${parseFloat(getComputedStyle(prev).marginBottom) + Math.ceil(floor - at)}px`; grown.add(prev); }
                floor = -Infinity;
                continue;
            }
            const top = Math.max(anchor(el).getBoundingClientRect().top - top0, floor);
            el.style.top = `${Math.round(top)}px`;
            floor = top + el.offsetHeight + gap;
        }
        pc.style.minHeight = floor > pc.offsetHeight ? `${Math.ceil(floor)}px` : '';
    };
    let raf = 0; const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(lay); };
    const ro = new ResizeObserver(soon); ro.observe(pc);
    wide.addEventListener('change', soon); document.fonts?.ready.then(lay); lay();
    return () => { ro.disconnect(); wide.removeEventListener('change', soon); cancelAnimationFrame(raf); };
});

// variants b (in the header) and d (at the foot of the label column): the way back shows once the post's head has scrolled
// under the header
(window.__tufaPages ||= []).push(() => {
    const v = document.documentElement.dataset.back, back = document.querySelector('.post-back');
    if (!back || (v !== 'b' && v !== 'd')) return;
    const a = back.cloneNode(true); a.className = v === 'b' ? 'head-back' : 'foot-back'; a.setAttribute('aria-hidden', 'true'); a.tabIndex = -1;
    (v === 'b' ? document.querySelector('.site-header .logo-container') : document.body)[v === 'b' ? 'after' : 'append'](a);
    const header = document.querySelector('.site-header'), title = document.querySelector('.post-title') || back;
    const content = document.querySelector('.post-content, .page-content') || document.querySelector('main');
    const check = () => {
        document.documentElement.classList.toggle('is-past-head', title.getBoundingClientRect().bottom < header.getBoundingClientRect().bottom);
        if (v === 'd') a.style.left = `${Math.round(content.getBoundingClientRect().left)}px`;   // on the label column's edge, wherever the page sits
    };
    addEventListener('scroll', check, { passive: true }); addEventListener('resize', check); check();
    return () => { removeEventListener('scroll', check); removeEventListener('resize', check); a.remove(); document.documentElement.classList.remove('is-past-head'); };
});
