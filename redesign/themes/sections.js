var tauMs = (v) => { v = String(v).trim(); const n = parseFloat(v); return isNaN(n) ? 120 : /ms$/.test(v) || !/s$/.test(v) ? n : n * 1000; };   // the beat in ms ("120ms", or ".12s" after minifying)
// Section navigation for long pages (desktop):
//  - the current section's title sticks under the header (CSS sticky); the next title slides up over it;
//  - an index of short lines, one per section, sits left of that title; hovering a line shows its
//    title, clicking jumps there; J and K step through sections;
//  - each section starts with a full-width hairline.
// Built per page (router.js runs it for every page it brings in) and torn down when the page is left;
// window.tufaSections() rebuilds it for the page as it is now (the privacy policy, once its widget has rendered).
(() => {
let teardown = null;
const build = () => {
    teardown?.(); teardown = null;
    if (document.documentElement.classList.contains('off-js')) return;   // bisect switch (?off=js)
    const narrow = matchMedia('(max-width: 900px)');
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('no-motion');
    const lineProbe = Object.assign(document.createElement('i'), { style: 'position:absolute;visibility:hidden;width:var(--line)' }); document.body.appendChild(lineProbe);
    let GAP = lineProbe.offsetWidth || 24; // one line between a pinned title and the title pushing it (ℓ, read live)
    const header = document.querySelector('.site-header');
    const rails = [];

    for (const container of document.querySelectorAll('.home-content, .page > .page-content, .post-content')) {
        const heads = [...container.children].filter((el) => el.tagName === 'H2' && !el.classList.contains('post-list-heading'));
        if (heads.length < 2) continue;
        container.classList.add('has-rail');
        const wrap = document.createElement('div');
        wrap.className = 'rail-wrap';
        wrap.innerHTML = '<nav class="rail" aria-label="Sections" data-no-swup><ol></ol></nav>';   // its links are its own (the router keeps out: two scrolls would fight)
        const r = { container, heads, wrap, nav: wrap.firstChild, items: [], current: -1 };
        // a post's way back (← Research, ← News) pins above the index once its own place in the head has scrolled away
        const back = container.classList.contains('post-content') && document.querySelector('.post-back');
        if (back) {
            const a = back.cloneNode(true); a.className = 'rail-back'; a.setAttribute('aria-hidden', 'true'); a.tabIndex = -1;   // the head's link stays the one for keyboards and readers
            wrap.prepend(a); container.classList.add('has-back');
        }
        heads.forEach((h, i) => {
            if (!h.id) h.id = h.textContent.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            const li = document.createElement('li');
            li.className = 'rail-item';
            li.style.setProperty('--i', i);
            li.innerHTML = `<a href="#${h.id}"><span class="rail-tick" aria-hidden="true"></span><span class="rail-text"></span></a>`;
            li.querySelector('.rail-text').textContent = h.textContent.trim();
            li.querySelector('a').addEventListener('click', (e) => { e.preventDefault(); e.currentTarget.blur(); jump(r, i); });
            wrap.querySelector('ol').appendChild(li);
            r.items.push(li);
        });
        container.appendChild(wrap);
        r.lines = heads.map((_, i) => {
            const line = document.createElement('div');
            line.className = i === 0 ? 'section-line is-first' : 'section-line';
            line.setAttribute('aria-hidden', 'true');
            container.appendChild(line);
            return line;
        });
        rails.push(r);
    }
    if (!rails.length) { lineProbe.remove(); return; }

    const extra = () => (document.querySelector('.has-rail.has-back') ? GAP : 0);   // the way back takes the first line under the header
    const pinLine = () => header.getBoundingClientRect().bottom + GAP + extra();

    function jump(r, i) {
        // natural (unstuck) position: offsetTop of a stuck title reports where it is pinned
        const top = r.container.getBoundingClientRect().top + scrollY + r.natural[i] - pinLine() + 1;
        scrollTo({ top, behavior: reduced() ? 'auto' : 'smooth' });
    }

    // pinned titles are CSS sticky; later titles stack above earlier ones and cover them as they arrive
    rails.forEach((r) => r.heads.forEach((h, i) => (h.style.zIndex = String(10 + i))));

    function measure() {
        for (const r of rails) {
            r.natural = r.heads.map((h) => (h.style.position = 'static', h.offsetTop));
            r.heads.forEach((h) => (h.style.position = ''));
            r.heights = r.heads.map((h) => h.offsetHeight);
            r.wrap.style.top = `${r.natural[0] - (r.container.classList.contains('has-back') ? GAP : 0)}px`;
            r.lines.forEach((l, i) => (l.style.top = `${r.natural[i] - GAP}px`));
        }
        layout();
    }

    function layout() {
        for (const r of rails) {
            const box = r.container.getBoundingClientRect();
            const pin = pinLine();
            const tops = r.natural.map((n) => box.top + n);
            let current = -1;
            tops.forEach((t, i) => { if (t <= pin) current = i; });
            const desktop = !narrow.matches;
            r.container.classList.toggle('rail-on', desktop && current >= 0);
            r.heads.forEach((h, i) => {
                h.classList.toggle('is-pinned', desktop && i === current);
                h.classList.toggle('is-past', desktop && i < current); // still stuck underneath; kept hidden
            });
            r.items.forEach((li, i) => {
                li.classList.toggle('is-past', i < current);
                li.classList.toggle('is-current', i === current);
                li.classList.toggle('is-future', i > current);
            });
            // one title at a time: the pinned title fades out over the last line before the next title reaches it
            r.heads.forEach((h, i) => {
                if (!desktop || i !== current || i + 1 >= tops.length) { h.style.opacity = ''; return; }
                const gap = tops[i + 1] - pin;                                  // where the next title is, below the pin line
                const o = Math.max(0, Math.min(1, (gap - 1.5 * GAP) / (GAP / 2)));   // gone before the next hairline reaches it
                h.style.opacity = o < 1 ? String(o) : '';                          // inline only while fading, so hovering the index can still hide it
            });
            // the index points stretch along the slide while it moves (the slide is a move: dur-2, the one curve)
            if (r.current >= 0 && current >= 0 && current !== r.current && !document.documentElement.classList.contains('no-motion') && desktop) {   // a small movement: it stays under reduced motion
                const css = getComputedStyle(document.documentElement), dur = 2 * tauMs(css.getPropertyValue('--tau')), k = Math.min(2.2, 1.5 + 0.3 * (Math.abs(current - r.current) - 1));
                r.items.forEach((li) => li.querySelector('.rail-tick').animate?.([{ transform: 'scaleY(1)' }, { transform: `scaleY(${k})`, offset: 0.5 }, { transform: 'scaleY(1)' }], { duration: dur, easing: css.getPropertyValue('--ease').trim() || 'ease-in-out' }));
            }
            r.current = current;
            // slide the index so the current line sits level with the pinned title
            r.nav.style.setProperty('--shift', Math.max(0, current));
        }
    }

    const onKey = (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return;
        const k = e.key.toLowerCase();
        if (k !== 'j' && k !== 'k') return;
        const r = rails[0];
        jump(r, k === 'j' ? Math.min(r.heads.length - 1, r.current + 1) : Math.max(0, r.current - 1));
    };
    let raf = 0, gone = false;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); };
    const onResize = () => { GAP = lineProbe.offsetWidth || 24; measure(); };
    const later = () => { if (!gone) measure(); };
    addEventListener('keydown', onKey);
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onResize);
    narrow.addEventListener?.('change', later);
    addEventListener('load', later);
    document.fonts?.ready.then(later);
    // the content changes height after load (maths typeset, images, sidenotes making room): the lines follow
    const ro = new ResizeObserver(later); rails.forEach((r) => ro.observe(r.container));
    measure();
    teardown = () => {   // leaving the page: the listeners go; the rails go with the page's content
        gone = true; cancelAnimationFrame(raf);
        removeEventListener('keydown', onKey); removeEventListener('scroll', onScroll); removeEventListener('resize', onResize);
        narrow.removeEventListener?.('change', later); removeEventListener('load', later); lineProbe.remove(); ro.disconnect();
    };
};
window.tufaSections = build;
(window.__tufaPages ||= []).push(() => { build(); return () => { teardown?.(); teardown = null; }; });
})();
