// Site behaviour that needs a script: the phone menu, the long-statement step, and the page's build-up timing.
(() => {
    const root = document.documentElement;
    if (root.classList.contains('off-js')) return;   // bisect switch (?off=js)

    // a new page opens at its top (the browser, or an embedding frame, may otherwise keep the old scroll); back and
    // forward still return to where the reader was, and a #link still goes to its section
    const entry = performance.getEntriesByType('navigation')[0];
    if (!location.hash && (!entry || entry.type === 'navigate')) { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; scrollTo(0, 0); }
    // images come into focus as they load
    document.querySelectorAll('main img').forEach((im) => { if (im.complete) return; im.classList.add('is-loading'); const done = () => im.classList.remove('is-loading'); im.addEventListener('load', done, { once: true }); im.addEventListener('error', done, { once: true }); });
    addEventListener('pageshow', (e) => { if (e.persisted || entry?.type === 'back_forward') history.scrollRestoration = 'auto'; });

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

    // phone menu: one header row (logo + Menu); the list opens above the header rule
    const nav = document.querySelector('.site-nav');
    const row = document.querySelector('.header-content');
    if (!nav || !row) return;
    const list = nav.querySelector('ul');

    // the active point moves over from the item that was active on the previous page (a move: 4τ, the one curve)
    const active = nav.querySelector('a.active');
    if (active && matchMedia('(min-width: 901px)').matches) {
        const mark = document.createElement('span');
        mark.className = 'nav-mark'; mark.setAttribute('aria-hidden', 'true');
        list.style.position = 'relative'; list.appendChild(mark);
        document.documentElement.classList.add('has-nav-mark');
        const at = (a) => { const l = list.getBoundingClientRect(), r = a.getBoundingClientRect(), gap = parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.375; return { x: r.left - l.left - gap, w: 0, y: r.top - l.top + r.height / 2 }; };   // beside the label, a quarter line to its left, level with its text
        const place = (p) => { mark.style.top = `${p.y}px`; mark.style.transform = `translateX(${p.x}px)`; };
        const to = at(active);
        let from = null;
        try { from = JSON.parse(sessionStorage.getItem('tufa-nav-mark') || 'null'); sessionStorage.removeItem('tufa-nav-mark'); } catch (e) {}
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('no-motion');
        place(to);
        if (from && !still && from.x !== to.x && mark.animate) {
            // travel from the last page's item, unhurried
            const k = Math.min(2.5, 1 + Math.abs(to.x - from.x) / 120);   /* stretched along its path while it travels, round again when it lands */
            mark.animate([{ transform: `translateX(${from.x}px) scaleX(1)` }, { transform: `translateX(${(from.x + to.x) / 2}px) scaleX(${k})`, offset: 0.5 }, { transform: `translateX(${to.x}px) scaleX(1)` }], { duration: 4 * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tau')) || 120), easing: getComputedStyle(document.documentElement).getPropertyValue('--ease').trim() || 'ease-in-out' });
        }
        addEventListener('resize', () => place(at(active)));
        document.fonts?.ready.then(() => place(at(active)));
        // leaving the page: remember where the mark was
        addEventListener('pagehide', () => { try { sessionStorage.setItem('tufa-nav-mark', JSON.stringify(at(active))); } catch (e) {} });
    }
    list.id = 'site-nav-list';
    const button = row.querySelector('.nav-toggle') || document.createElement('button');   // the build writes it into the header (tools/prerender.py)
    button.type = 'button';
    button.className = 'nav-toggle';
    button.setAttribute('aria-controls', list.id);
    const set = (open) => {
        root.classList.toggle('nav-open', open);
        button.setAttribute('aria-expanded', String(open));
        button.textContent = open ? 'Close' : 'Menu';
    };
    button.addEventListener('click', () => { set(!root.classList.contains('nav-open')); if (root.classList.contains('nav-open')) list.querySelectorAll('a').forEach(prefetch); });
    // the next page is fetched ahead: when the menu opens (phones), or the pointer rests on a link (desktop)
    const fetched = new Set();
    function prefetch(a) { const u = a.href; if (!u || fetched.has(u) || a.classList.contains('active') || new URL(u).origin !== location.origin) return; fetched.add(u);
        const l = document.createElement('link'); l.rel = 'prefetch'; l.href = u; document.head.appendChild(l); }
    list.querySelectorAll('a').forEach((a) => a.addEventListener('pointerenter', () => prefetch(a)));
    // a tap answers at once: the item takes the point, the menu folds away and the old page clears while the next one loads
    list.addEventListener('click', (e) => {
        const a = e.target.closest('a'); if (!a || !root.classList.contains('nav-open') || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
        list.querySelectorAll('a.active').forEach((x) => { x.classList.remove('active'); x.removeAttribute('aria-current'); });
        a.classList.add('active'); a.setAttribute('aria-current', 'page'); set(false); root.classList.add('is-leaving');   // and the page under the header clears
    });
    addEventListener('pageshow', (e) => { if (e.persisted) { set(false); root.classList.remove('is-leaving'); } });
    // moving on within the site: the next page builds up at a third of the pace (the head script reads this before paint)
    addEventListener('pagehide', () => { try { sessionStorage.setItem('tufa-inside', String(Date.now())); } catch (e) {} });   // back to this page from the cache: the menu closed
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('nav-open')) { set(false); button.focus(); } });
    matchMedia('(min-width: 901px)').addEventListener?.('change', (e) => e.matches && set(false));
    set(false);
    // light / dark: the whole system inverted (the tint carries over); remembered, applied before paint by the head script
    const theme = document.createElement('button');
    theme.type = 'button'; theme.className = 'theme-toggle';
    const showTheme = () => { const dark = root.dataset.theme === 'dark'; theme.setAttribute('aria-pressed', String(dark)); theme.setAttribute('aria-label', dark ? 'Switch to the light design' : 'Switch to the dark design'); };
    try { CSS.registerProperty({ name: '--vr', syntax: '<length>', inherits: false, initialValue: '0px' }); } catch (e) { /* registered already, or unsupported */ }
    const flip = () => {
        const dark = root.dataset.theme !== 'dark';
        if (dark) root.dataset.theme = 'dark'; else delete root.dataset.theme;
        try { localStorage.setItem('tufa-theme', dark ? 'dark' : 'light'); } catch (e) { /* storage blocked */ }
        showTheme();
    };
    // the switch: the other theme spreads from the ring as a soft-edged disc until it covers the page (a view
    // transition: the new page is revealed through a growing radial mask, 8τ on the one curve)
    theme.addEventListener('click', () => {
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('no-motion');
        if (still || !document.startViewTransition || !window.CSS?.registerProperty) { flip(); return; }
        const b = theme.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
        const cs = getComputedStyle(root), R = 2 * Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 48;   // the edge is soft over half the radius, so the disc grows to twice the farthest corner
        root.style.setProperty('--vx', `${x}px`); root.style.setProperty('--vy', `${y}px`);
        root.classList.add('theme-flip');
        const t = document.startViewTransition(flip);
        t.ready.then(() => root.animate({ '--vr': ['0px', `${R}px`] }, { duration: 8 * (parseFloat(cs.getPropertyValue('--tau')) || 120), easing: cs.getPropertyValue('--ease').trim() || 'ease-in-out', pseudoElement: '::view-transition-new(root)', fill: 'both' })).catch(() => {});
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
    if (root.classList.contains('no-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches) { window.tufaBuild = { split() {} }; return; }
    const bt = parseFloat(getComputedStyle(root).getPropertyValue('--bt')) || 1, TAU = parseFloat(getComputedStyle(root).getPropertyValue('--tau')) || 120;   // the beat, in ms
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
        pieces.forEach((sp, i) => { sp.style.animationDelay = `${Math.round((base + (i / Math.max(1, pieces.length - 1)) * spread) * bt)}ms`; });
        el.classList.add('is-split');
    };
    window.tufaBuild = { split: (el) => split(el, { unit: 'char', base: 0, spread: 2 * TAU }) };   // write: letters start within 2τ, each 4τ, so many blur in together   // write: the name's letters over 4τ
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
})();

// The privacy policy comes from a widget (kept, so its legal text stays current). Once it has rendered, its content
// is adopted into the page: the intro becomes the statement under the page name, the date a metadata line, and the
// topics sections with the index (the widget's "Privacy policy" heading repeats the title, so its sub-topics are
// promoted); the widget's own stylesheet and title are dropped.
(() => {
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
})();

// The creature, alive: a small procedural animal that walks upright, never turning: along its ground forwards or
// backwards, and up or down the page as a sideways step (from its point of view). Each leg is two bones (hip-knee,
// knee-foot) solved by inverse kinematics in the creature's own frame; feet are planted on the page and step (lifted,
// along an arc, never with a neighbour) when they fall behind. The body follows its target on a spring and turns its
// heading: none. It walks left or right, forwards or backwards, upright; it never turns or rotates. Behaviour: far, it watches you;
// nearer, it shies; close, it escapes away from you to the edge of its ground and tucks only when cornered; come round
// it, or leave it room, and it runs for the other side. Left alone, it walks back home and stays there.
(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('no-motion') || !matchMedia('(hover: hover)').matches) return;
    const svgs = [...document.querySelectorAll('svg.logo-image, .id-headmark svg, .id-pair .id-mark-big:not(.id-parts) svg')].filter((s) => s.querySelector('.m-leg[data-hip]'));
    if (!svgs.length) return;
    const tau = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tau')) || 120) / 1000;
    const NS = 'http://www.w3.org/2000/svg', num = (el, a) => parseFloat(el.getAttribute(a)), pt = (s) => s.split(' ').map(Number);
    const ease = (t) => t * t * (3 - 2 * t), len = (v) => Math.hypot(v[0], v[1]), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const group = (svg, cls, kids, before) => { const g = document.createElementNS(NS, 'g'); g.setAttribute('class', cls); svg.insertBefore(g, before || null); kids.forEach((k) => k && g.appendChild(k)); return g; };
    const marks = svgs.map((svg) => {
        const W = svg.viewBox.baseVal.width, H = svg.viewBox.baseVal.height;
        const legsG = svg.querySelector(':scope > .m-legs');
        const hindG = svg.querySelector(':scope > .m-hind');                                  // behind the body, rigged like the legs
        const back = group(svg, 'm-torso m-torso-back', [svg.querySelector(':scope > .m-body')], legsG);
        const front = group(svg, 'm-torso m-torso-front', [...svg.querySelectorAll(':scope > .m-eye')]);
        const creature = group(svg, 'm-creature', [hindG, back, legsG, front]);
        const rigLeg = (g) => {
            const hip = pt(g.dataset.hip), knee = pt(g.dataset.knee), foot = pt(g.dataset.foot);
            const L1 = Math.hypot(knee[0] - hip[0], knee[1] - hip[1]), L2 = Math.hypot(foot[0] - knee[0], foot[1] - knee[1]);
            const bend = Math.sign((knee[0] - hip[0]) * (foot[1] - hip[1]) - (knee[1] - hip[1]) * (foot[0] - hip[0])) || 1;
            return { up: g.querySelector('.m-leg-up'), lo: g.querySelector('.m-leg-lo'), kc: g.querySelector('.m-knee'), hip, knee, foot, L1, L2, bend,
                     a1: Math.atan2(knee[1] - hip[1], knee[0] - hip[0]), a2: Math.atan2(foot[1] - knee[1], foot[0] - knee[0]),
                     Fw: null, step: null, rest: Math.hypot(foot[0] - hip[0], foot[1] - hip[1]) };
        };
        // two chains: the five legs (neighbours never step together), and the two hind legs (never together)
        const front5 = [...legsG.querySelectorAll('.m-leg[data-hip]')].map(rigLeg), hind2 = hindG ? [...hindG.querySelectorAll('.m-leg[data-hip]')].map(rigLeg) : [];
        [front5, hind2].forEach((chain) => chain.forEach((l, i) => { l.prev = chain[i - 1]; l.next = chain[i + 1]; }));
        const legs = [...hind2, ...front5], hinds = [];
        const eyes = [...front.querySelectorAll('.m-eye')].map((e) => { const w = e.querySelector('.m-white'), p = e.querySelector('.m-pupil');
            return { p, W: { x: num(w, 'cx'), y: num(w, 'cy'), r: num(w, 'r') }, rest: { x: num(p, 'cx'), y: num(p, 'cy') }, now: { x: num(p, 'cx'), y: num(p, 'cy') }, reach: num(w, 'r') - num(p, 'r') * 0.6 }; });
        const header = svg.classList.contains('logo-image');
        // its ground: an ellipse around home (the header: the rectangle of the header bar beside the logo)
        const area = header ? { cx: 0.375 * W, cy: 0, rx: 0.525 * W, ry: 0, box: true } : { cx: 0, cy: 0, rx: 0.42 * W, ry: 0.26 * H };
        return { svg, creature, back, front, legs, hinds, eyes, W, H, header, area, pivot: [W * 0.5, H * 0.8],
                 p: [0, 0], v: [0, 0], target: [0, 0], turnA: 0, phi: 0, duck: 0, tduck: 0, tilt: 0, bob: 0, shy: 0, gait: 0,
                 mode: 'free', lastNear: -1e9, wander: 0, calmSince: 0 };
    });
    // the creature's frame: world = p + pivot + R(phi) · S(fx, 1) · (local − pivot)
    const fxOf = (m) => Math.cos(m.turnA);
    const toWorld = (m, q) => { const fx = fxOf(m), a = m.phi, c = Math.cos(a), s2 = Math.sin(a), x = (q[0] - m.pivot[0]) * fx, y = q[1] - m.pivot[1]; return [m.p[0] + m.pivot[0] + x * c - y * s2, m.p[1] + m.pivot[1] + x * s2 + y * c]; };
    const toLocal = (m, w) => { const fx = fxOf(m), a = -m.phi, c = Math.cos(a), s2 = Math.sin(a), x = w[0] - m.p[0] - m.pivot[0], y = w[1] - m.p[1] - m.pivot[1]; return [m.pivot[0] + (x * c - y * s2) / fx, m.pivot[1] + x * s2 + y * c]; };
    const edge = (m, from, dir) => {   // the farthest point of its ground from `from` along `dir`
        const A = m.area;
        if (A.box) {   // a rectangle: along `dir`, but blocked sides are dropped first, so at a wall it slides along it instead of stopping
            const lo = [A.cx - A.rx, A.cy - A.ry], hi = [A.cx + A.rx, A.cy + A.ry], e = 0.01 * m.W, d = [...dir];
            for (const i of [0, 1]) if ((d[i] < 0 && from[i] <= lo[i] + e) || (d[i] > 0 && from[i] >= hi[i] - e)) d[i] = 0;
            const L = len(d); if (!L) return [...from];
            let t = Infinity; for (const i of [0, 1]) { d[i] /= L; if (d[i] > 1e-6) t = Math.min(t, (hi[i] - from[i]) / d[i]); if (d[i] < -1e-6) t = Math.min(t, (lo[i] - from[i]) / d[i]); }
            t = Math.max(0, t); return [from[0] + d[0] * t, from[1] + d[1] * t];
        }
        if (A.ry === 0) { const t = dir[0] > 0 ? (A.cx + A.rx - from[0]) : (A.cx - A.rx - from[0]); return [from[0] + t, 0]; }
        const ox = (from[0] - A.cx) / A.rx, oy = (from[1] - A.cy) / A.ry, dx = dir[0] / A.rx, dy = dir[1] / A.ry;
        const a = dx * dx + dy * dy, b = 2 * (ox * dx + oy * dy), cc = ox * ox + oy * oy - 1, t = (-b + Math.sqrt(Math.max(0, b * b - 4 * a * cc))) / (2 * a || 1);
        return [from[0] + dir[0] * t, from[1] + dir[1] * t];
    };
    let px = null, py = null, raf = 0, last = 0;
    const tick = (now) => {
        raf = 0; const dt = Math.min(0.04, (now - (last || now)) / 1000); last = now; let busy = false;
        for (const m of marks) {
            const r = m.svg.getBoundingClientRect(); if (!r.width) continue;
            const W = m.W, H = m.H, k = W / r.width, S = r.width;
            if (m.header) {   // the header logo's ground: from the page margin to just short of the navigation, measured live
                const nav = document.querySelector('.site-nav ul'), home = r.left, navL = nav ? nav.getBoundingClientRect().left : innerWidth - 40;
                // sideways: to the header's content column on the left (never out into the page margin), at most
                // ~1.6 body widths towards the navigation; up and down, within the header bar
                const col = (m.svg.closest('a') || m.svg).parentElement.getBoundingClientRect().left, L = -Math.min(1.2 * W, Math.max(0, home - col) * k), R = Math.min(1.6 * W, Math.max(0, navL - (home + r.width) - 28) * k);
                const bar = m.svg.closest('.site-header')?.getBoundingClientRect(), U = bar ? -Math.max(0, r.top - bar.top - 14) * k : 0, D = bar ? Math.max(0, bar.bottom - 16 - r.bottom) * k : 0;
                m.area.cx = (L + R) / 2; m.area.rx = (R - L) / 2; m.area.cy = (U + D) / 2; m.area.ry = Math.max(0.001, (D - U) / 2);
                const link = m.svg.closest('a');   // the link covers all of its ground, not only where it stands
                if (link) { const lr = link.getBoundingClientRect(), hit = [r.left + L / k - lr.left, r.top + U / k - lr.top, r.width + (R - L) / k, r.height + (D - U) / k].map((v) => v.toFixed(0) + 'px').join(' ');
                    if (link.dataset.hit !== hit) { link.dataset.hit = hit; const [hl, ht, hw, hh] = hit.split(' '); link.style.setProperty('--hit-l', hl); link.style.setProperty('--hit-t', ht); link.style.setProperty('--hit-w', hw); link.style.setProperty('--hit-h', hh); } }
            }
            const center = toWorld(m, [W * 0.5, H * 0.55]);
            const here = [r.left + center[0] / k, r.top + center[1] / k];
            const dv = px == null ? [0, 0] : [px - here[0], py - here[1]], d = px == null ? Infinity : len(dv);
            const near = Math.max(60, S * 0.75), far = Math.max(200, S * 2.2);
            let away = d ? [-dv[0] / d, -dv[1] / d] : [1, 0]; if (m.area.ry === 0) away = [away[0] >= 0 ? 1 : -1, 0];
            if (d < near * 0.35 && m.away && m.mode !== 'cornered') away = m.away;   // the pointer right on top of it: keep fleeing the way it was going (cornered, it looks for the open side)
            m.away = away;
            // ── behaviour ──
            const atP = (q) => len([q[0] - m.p[0], q[1] - m.p[1]]) < 0.04 * W;
            m.shy = 0;
            if (m.mode === 'dash' && (d < near * 0.8 || atP(m.target) || now - m.dashAt > 1500)) m.mode = 'free';   // a dash ends there, after a moment, or when you come close again
            if (m.mode === 'dash') {}
            else if (d < near) {
                m.lastNear = now; m.wander = 0; const e = edge(m, m.p, away);
                const was = m.mode; m.mode = atP(e) ? 'cornered' : 'flee'; m.target = e;
                if (m.mode === 'flee' && was !== 'flee') m.flinch = 1;   // coming close: it starts away at once
            } else {
                if (m.mode === 'cornered' && d > near * 1.15) { m.mode = 'dash'; m.dashAt = now; const back2 = [-(m.p[0] - m.area.cx), -(m.p[1] - m.area.cy)], L = len(back2) || 1; m.target = edge(m, [m.area.cx, m.area.cy], [back2[0] / L, back2[1] / L]);
                    if (m.header) { const t = [m.target[0] - m.p[0], m.target[1] - m.p[1]], tl = len(t), cap = 1.5 * W; if (tl > cap) m.target = [m.p[0] + t[0] * cap / tl, m.p[1] + t[1] * cap / tl]; } }   // the header: a few body widths out of the corner, not the whole bar
                else if (m.mode === 'flee') { m.mode = 'free'; m.target = [m.p[0] + m.v[0] * 0.25, m.p[1] + m.v[1] * 0.25]; }
                if (d < far && m.mode === 'free') m.shy = 1 - (d - near) / (far - near);
                const homeD = px == null ? Infinity : len([px - (r.left + W * 0.5 / k), py - (r.top + H * 0.55 / k)]);   // the pointer's distance from its home
                if (m.mode === 'free' && now - m.lastNear > 1500 && (d >= far || (m.header && homeD > near * 1.4))) {
                    m.target = [0, 0];   // left alone: back home, and stays there
                }
            }
            m.tduck = m.mode === 'cornered' ? 1 : 0;
            // ── body: a 2D spring towards the target, capped at its pace ──
            const kS = m.mode === 'flee' || m.mode === 'dash' ? 70 : 26, cS = 2 * Math.sqrt(kS) * 0.85, pace = (pxs) => clamp(pxs / S, 0.3, 1.5) * W;   // a pace in screen px/s, as body widths: small creatures cover more of their length, but never more than their legs can carry
            // the body never outruns its feet: the more a planted foot is stretched behind it, the slower it goes
            const vmax = pace(m.mode === 'dash' ? 150 : m.mode === 'flee' ? 120 : 70) * clamp(1 - ((m.strain || 0) - 1.02) * 3, 0.15, 1);
            if (m.flinch) { m.v = [m.v[0] + away[0] * vmax * 0.35, m.v[1] + away[1] * vmax * 0.35]; m.flinch = 0; }   // the flinch: off at once
            for (const i of [0, 1]) m.v[i] += (kS * (m.target[i] - m.p[i]) - cS * m.v[i]) * dt;
            const sp = len(m.v); if (sp > vmax) { m.v = [m.v[0] * vmax / sp, m.v[1] * vmax / sp]; }
            const p0 = [...m.p]; m.p = [m.p[0] + m.v[0] * dt, m.p[1] + m.v[1] * dt];
            { const A = m.area;   // never beyond its ground: hold it at the edge and drop any speed outwards
              if (A.box) { for (const i of [0, 1]) { const c = i ? A.cy : A.cx, r2 = i ? A.ry : A.rx; if (m.p[i] < c - r2 || m.p[i] > c + r2) { m.p[i] = clamp(m.p[i], c - r2, c + r2); m.v[i] = 0; } } }
              else if (A.ry === 0) { const lo = A.cx - A.rx, hi = A.cx + A.rx; if (m.p[0] < lo || m.p[0] > hi) { m.p[0] = clamp(m.p[0], lo, hi); m.v[0] = 0; } m.p[1] = 0; m.v[1] = 0; }
              else { const ex = (m.p[0] - A.cx) / A.rx, ey = (m.p[1] - A.cy) / A.ry, e2 = Math.hypot(ex, ey); if (e2 > 1) { m.p = [A.cx + ex / e2 * A.rx, A.cy + ey / e2 * A.ry]; const n = [ex / A.rx, ey / A.ry], nl = Math.hypot(n[0], n[1]) || 1, vn = (m.v[0] * n[0] + m.v[1] * n[1]) / nl; if (vn > 0) m.v = [m.v[0] - vn * n[0] / nl, m.v[1] - vn * n[1] / nl]; } } }
            const dP = [m.p[0] - p0[0], m.p[1] - p0[1]];
            const speed = len(m.v) / W;
            // ── heading: along the motion when walking (rotated, never upside down: heading right it mirrors); standing, towards you ──
            m.phi = 0; m.turnA = 0; m.hop = 0;   // it never turns or rotates: it walks sideways, upright
            const turning = Math.abs(fxOf(m)) < 0.35;
            m.duck += (m.tduck - m.duck) * Math.min(1, dt * 10);
            m.tilt += ((m.shy ? -m.shy * 3 : 0) - m.tilt) * Math.min(1, dt * 24);   // leaning away is quick
            // ── feet: planted on the page; in the creature's frame they slide back as it moves; far behind → step ──
            const vloc = (() => { const a = -m.phi, c = Math.cos(a), s2 = Math.sin(a), fx = fxOf(m); return [(m.v[0] * c - m.v[1] * s2) / (Math.abs(fx) < 0.35 ? 1e9 : fx), m.v[0] * s2 + m.v[1] * c]; })();
            let stepping = m.legs.filter((l) => l.step).length, liftSum = 0;
            const stretch = (l) => { if (!l.Fw) return 0; const q = toLocal(m, l.Fw), r2 = len([q[0] - l.hip[0], q[1] - l.hip[1]]); return r2 < 0.55 * l.rest ? 2 : r2 / Math.max(l.L1 + l.L2, l.rest); };   // too far, or in under the hip: first
            for (const l of [...m.legs].sort((a, b) => stretch(b) - stretch(a))) {   // the most stretched leg gets the next step
                if (!l.Fw || turning) { l.Fw = toWorld(m, l.foot); l.step = null; continue; }   // mid-turn the feet turn with it
                const lead = (k, cap) => { const o = [vloc[0] * k, vloc[1] * k], ol = len(o); return ol > cap ? [o[0] * cap / ol, o[1] * cap / ol] : o; };   // ahead in its direction, at most a part of its own reach
                const h0 = lead(0.07, 0.25 * l.rest), home = [l.foot[0] + h0[0], l.foot[1] + h0[1]];   // ahead in whichever direction it goes (up and down: a sideways step)
                if (!l.step) {
                    const Fl = toLocal(m, l.Fw), err = Math.hypot(Fl[0] - home[0], Fl[1] - home[1]), reach = Math.hypot(Fl[0] - l.hip[0], Fl[1] - l.hip[1]);
                    const need = speed > 0.02 ? Math.min(Math.max(0.07 * W, speed * 0.25 * W), 0.5 * l.rest) :   // a stride in proportion to the leg: a short leg steps before its foot passes under its hip
                                  (speed > 0.004 ? 0.03 * W : 0.012 * W);   // faster: longer strides (few legs in the air at once, each foot down for most of its stride)
                    const calm = stepping < 2 && !(l.prev && l.prev.step) && !(l.next && l.next.step);
                    const span = Math.max(l.L1 + l.L2, l.rest), full = reach > span + 0.05 * W;   // stretched well past its resting reach: it steps now, whatever the others are doing
                    const close = reach < Math.max(0.55 * l.rest, Math.abs(l.L1 - l.L2) * 1.5);   // or its foot drifting in under its hip (the knee would spin round): the same
                    if ((err > need && calm) || (reach > l.rest + 0.03 * W && stepping < 3) || ((full || close) && stepping < 4)) {
                        if (reach > span) { const s3 = span / reach; l.Fw = toWorld(m, [l.hip[0] + (Fl[0] - l.hip[0]) * s3, l.hip[1] + (Fl[1] - l.hip[1]) * s3]); }   // never from beyond its reach
                        const h1 = lead(0.17, 0.4 * l.rest); let toL = [l.foot[0] + h1[0], l.foot[1] + h1[1]];
                        { const o = [toL[0] - l.hip[0], toL[1] - l.hip[1]], ol = len(o), cap = Math.max(span * 0.92, l.rest); if (ol > cap) toL = [l.hip[0] + o[0] * cap / ol, l.hip[1] + o[1] * cap / ol]; }   // a foot lands within easy reach (or at its resting spot), never at full stretch
                        l.step = { t: 0, from: [...l.Fw], toL, dur: speed > 0.02 ? Math.max(0.55 * tau, 1.5 * tau / Math.max(1, speed * 1.6)) : 2.2 * tau };   // faster: quicker steps
                        stepping++;
                    }
                }
                if (l.step) {
                    l.step.t += dt / l.step.dur; const t = Math.min(1, l.step.t), e = ease(t), lift = Math.sin(Math.PI * t) * 0.05 * W;
                    const to = toWorld(m, l.step.toL), up = [Math.sin(m.phi) * lift, -Math.cos(m.phi) * lift];   // lift: up from its own ground
                    // the foot swings round its hip (angle and distance eased), never through it: a straight path past the hip spun the knee
                    const fL = toLocal(m, l.step.from), af = Math.atan2(fL[1] - l.hip[1], fL[0] - l.hip[0]), at = Math.atan2(l.step.toL[1] - l.hip[1], l.step.toL[0] - l.hip[0]);
                    const da = ((at - af + 3 * Math.PI) % (2 * Math.PI)) - Math.PI, rf = len([fL[0] - l.hip[0], fL[1] - l.hip[1]]), rt = len([l.step.toL[0] - l.hip[0], l.step.toL[1] - l.hip[1]]);
                    const ang2 = af + da * e, rr = Math.max(0.55 * l.rest, rf + (rt - rf) * e), sw = toWorld(m, [l.hip[0] + rr * Math.cos(ang2), l.hip[1] + rr * Math.sin(ang2)]);
                    l.Fw = [sw[0] + up[0], sw[1] + up[1]];
                    liftSum += Math.sin(Math.PI * t);
                    if (t >= 1) { l.Fw = to; l.step = null; }
                }
            }
            m.strain = Math.max(0, ...m.legs.filter((l) => !l.step && l.Fw).map((l) => { const q = toLocal(m, l.Fw); return len([q[0] - l.hip[0], q[1] - l.hip[1]]) / Math.max(l.L1 + l.L2, l.rest); }));
            m.gait += len(dP) / (0.14 * W) * Math.PI * 2;
            // ── torso: bob with lifted legs, crouch, lean ──
            m.bob += ((liftSum ? -0.012 * W : 0) - m.bob) * Math.min(1, dt * 14);
            const by = m.bob - (m.hop || 0) + m.duck * 0.085 * W, tilt = m.tilt - m.duck * 3, pv = [W * 0.5, H * 0.5];
            const torsoT = `translate(0 ${by.toFixed(1)}) rotate(${tilt.toFixed(2)} ${pv[0]} ${pv[1]})`;
            m.back.setAttribute('transform', torsoT); m.front.setAttribute('transform', torsoT);
            const rot = (q) => { const a = tilt * Math.PI / 180, c = Math.cos(a), s2 = Math.sin(a), x = q[0] - pv[0], y = q[1] - pv[1]; return [pv[0] + x * c - y * s2, pv[1] + x * s2 + y * c + by]; };
            // ── legs: two-bone IK in its frame ──
            for (const l of m.legs) {
                const H2 = rot(l.hip), F = turning || !l.Fw ? l.foot : toLocal(m, l.Fw); let vx = F[0] - H2[0], vy = F[1] - H2[1], dd = Math.hypot(vx, vy);
                const dmax = l.L1 + l.L2 - 0.5, dmin = Math.abs(l.L1 - l.L2) + 0.5; if (dd > dmax) { const s3 = dmax / dd; vx *= s3; vy *= s3; dd = dmax; } if (dd < dmin) { const s3 = dmin / (dd || 1); vx *= s3; vy *= s3; dd = dmin; }
                const a = Math.atan2(vy, vx), b = Math.acos(clamp((l.L1 * l.L1 + dd * dd - l.L2 * l.L2) / (2 * l.L1 * dd), -1, 1));
                const a1 = a - l.bend * b, K = [H2[0] + l.L1 * Math.cos(a1), H2[1] + l.L1 * Math.sin(a1)], Fp = [H2[0] + vx, H2[1] + vy];
                const a2 = Math.atan2(Fp[1] - K[1], Fp[0] - K[0]), deg = 180 / Math.PI;
                l.up.setAttribute('transform', `translate(${(H2[0] - l.hip[0]).toFixed(1)} ${(H2[1] - l.hip[1]).toFixed(1)}) rotate(${((a1 - l.a1) * deg).toFixed(2)} ${l.hip[0]} ${l.hip[1]})`);
                l.lo.setAttribute('transform', `translate(${(K[0] - l.knee[0]).toFixed(1)} ${(K[1] - l.knee[1]).toFixed(1)}) rotate(${((a2 - l.a2) * deg).toFixed(2)} ${l.knee[0]} ${l.knee[1]})`);
                l.kc.setAttribute('cx', K[0].toFixed(1)); l.kc.setAttribute('cy', K[1].toFixed(1));
            }
            // ── the whole creature ──
            m.creature.setAttribute('transform', `translate(${(m.p[0] + m.pivot[0]).toFixed(1)} ${(m.p[1] + m.pivot[1]).toFixed(1)}) rotate(${(m.phi * 180 / Math.PI).toFixed(2)}) scale(${fxOf(m).toFixed(3)} 1) translate(${-m.pivot[0]} ${-m.pivot[1]})`);
            // ── eyes: towards the pointer, in the eyes' own frame ──
            const ctm = m.front.getScreenCTM(), q = px == null || !ctm ? null : new DOMPoint(px, py).matrixTransform(ctm.inverse());
            const fe = Math.max(0, Math.min(1, (far * 1.3 - d) / (far * 1.3 - near * 0.5)));
            for (const e of m.eyes) {
                let tx = e.rest.x, ty = e.rest.y;
                if (q && fe > 0) { const ex = q.x - e.W.x, ey = q.y - e.W.y, L = Math.hypot(ex, ey) || 1, kk = Math.min(1, L / e.W.r), s4 = ease(fe);
                    tx = e.rest.x + (e.W.x + (ex / L) * e.reach * kk - e.rest.x) * s4; ty = e.rest.y + (e.W.y + (ey / L) * e.reach * kk - e.rest.y) * s4; }
                e.now.x += (tx - e.now.x) * 0.25; e.now.y += (ty - e.now.y) * 0.25; e.p.setAttribute('cx', e.now.x.toFixed(1)); e.p.setAttribute('cy', e.now.y.toFixed(1));
                if (Math.abs(tx - e.now.x) + Math.abs(ty - e.now.y) > 0.3) busy = true;
            }
            const restless = speed > 0.002 || len([m.target[0] - m.p[0], m.target[1] - m.p[1]]) > 0.003 * W || m.legs.some((l) => l.step) || Math.abs(m.tduck - m.duck) > 0.004 || Math.abs(m.phi) > 0.002 || Math.abs(m.bob) > 0.3 || Math.abs(fxOf(m) - 1) > 0.001;
            if (restless || d < far * 1.3 || len(m.p) > 0.003 * W) busy = true;   // away from home: stay awake to walk back
        }
        if (busy) raf = requestAnimationFrame(tick); else last = 0;
    };
    const wake = () => { if (!raf && !document.hidden) raf = requestAnimationFrame(tick); };   // hidden pages draw nothing: wait until shown
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { raf = 0; last = 0; wake(); } });
    // the header creature is the same on every page: leaving, it saves where it is and what it is doing (and where your
    // pointer was); on the next page it is restored and drawn at once, so it carries on mid-step instead of starting over
    const KEY = 'tufa-creature';
    const save = () => { const m = marks.find((x) => x.header); if (!m) return;
        try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), px, py, p: m.p, v: m.v, target: m.target, mode: m.mode, duck: m.duck, tilt: m.tilt, bob: m.bob, away: m.away,
            near: Date.now() - (performance.now() - m.lastNear), feet: m.legs.map((l) => (l.Fw ? toLocal(m, l.Fw) : null)), eyes: m.eyes.map((e) => [e.now.x, e.now.y]) })); } catch (e) {} };
    addEventListener('pagehide', save);
    if (!raf && !last) { tick(performance.now()); last = 0; }   // one frame now: sizes the header link's clickable ground
    addEventListener('resize', () => { if (!raf) { tick(performance.now()); last = 0; } });
    try {
        const st = JSON.parse(sessionStorage.getItem(KEY) || 'null'), m = marks.find((x) => x.header);
        if (st && m && Date.now() - st.t < 5000) {
            Object.assign(m, { p: st.p, v: st.v, target: st.target, mode: st.mode, duck: st.duck, tilt: st.tilt, bob: st.bob, away: st.away, dashAt: performance.now(), lastNear: performance.now() - (Date.now() - st.near) });
            m.legs.forEach((l, i) => { if (st.feet[i]) l.Fw = toWorld(m, st.feet[i]); });
            m.eyes.forEach((e, i) => { if (st.eyes[i]) { e.now.x = st.eyes[i][0]; e.now.y = st.eyes[i][1]; } });
            if (st.px != null) { px = st.px; py = st.py; }
            last = 0; tick(performance.now());   // draw it now, before the first paint
        }
    } catch (e) {}
    addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return; px = e.clientX; py = e.clientY; wake(); }, { passive: true });
    document.addEventListener('pointerleave', () => { px = py = null; wake(); });
    addEventListener('blur', () => { px = py = null; wake(); });
    addEventListener('scroll', wake, { passive: true });
    wake();
})();
