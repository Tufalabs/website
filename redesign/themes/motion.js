// Motion layer: scroll reveals, heading decode, figure count-up, nav scramble. No-ops under reduced motion.
(() => {
    const root = document.documentElement;
    const reduced = () => root.classList.contains('no-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();
    const GLYPHS = '01<>/[]#*+=-_ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    function decode(el, { duration = 420, mode = 'scramble' } = {}) {
        const text = el.textContent;
        if (!text.trim() || el.children.length) return;
        el.setAttribute('aria-label', text);
        if (mode === 'type') el.style.minHeight = `${el.offsetHeight}px`;
        const start = performance.now();
        const tick = (now) => {
            const p = Math.min(1, (now - start) / duration);
            const fixed = Math.floor(p * text.length);
            let out = text.slice(0, fixed);
            if (mode === 'scramble') {
                for (let i = fixed; i < text.length; i++) out += /\s/.test(text[i]) ? text[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
            }
            el.textContent = out;
            if (p < 1) requestAnimationFrame(tick);
            else { el.textContent = text; el.removeAttribute('aria-label'); el.style.minHeight = ''; }
        };
        requestAnimationFrame(tick);
    }

    function countUp(td, duration = 650) {
        const nodes = [];
        const walker = document.createTreeWalker(td, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => n.parentElement.closest('sup, .per-cluster-note') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
        });
        while (walker.nextNode()) if (/\b\d/.test(walker.currentNode.data)) nodes.push(walker.currentNode);
        const items = nodes.map((n) => ({ n, src: n.data }));
        if (!items.length) return;
        const start = performance.now();
        const ease = (t) => 1 - Math.pow(1 - t, 3);
        const tick = (now) => {
            const p = Math.min(1, (now - start) / duration);
            for (const { n, src } of items) {
                n.data = p < 1 ? src.replace(/\b\d+(?:\.\d+)?\b/g, (m) => {
                    const dp = (m.split('.')[1] || '').length;
                    return (parseFloat(m) * ease(p)).toFixed(dp);
                }) : src;
            }
            if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    function init() {
        if (reduced()) { root.classList.add('motion-done'); return; }
        root.classList.add('motion-ready');

        // headings decode on load
        const mode = cssVar('--decode') || 'scramble';
        if (mode !== 'none') {
            document.querySelectorAll('.page-title, .post-title').forEach((el) => decode(el, { mode }));
            const statement = document.querySelector('.home-content > p:nth-of-type(2)');
            if (statement && cssVar('--decode-statement') === '1') decode(statement, { mode, duration: 700 });
        }

        // nav scramble on hover
        document.querySelectorAll('.site-nav a').forEach((a) => {
            let busy = false;
            a.addEventListener('mouseenter', () => {
                if (busy) return; busy = true;
                decode(a, { duration: 220 });
                setTimeout(() => (busy = false), 260);
            });
        });

        // scroll reveals with a short stagger for whatever enters together
        const targets = document.querySelectorAll(
            '.home-content > :not(p:nth-of-type(2)):not(:empty), .page > .page-content > :not(.post-list):not(.team-list), .post-item, .team-member, .post-content > *'
        );
        let batch = 0, batchTimer;
        const io = new IntersectionObserver((entries) => {
            for (const e of entries) {
                if (!e.isIntersecting) continue;
                const el = e.target;
                el.style.setProperty('--d', `${Math.min(batch++, 8) * 45}ms`);
                el.classList.add('in');
                io.unobserve(el);
                const table = el.matches('.compute-table-wrap') ? el : null;
                if (table) setTimeout(() => table.querySelectorAll('td:not(:first-child)').forEach((td) => countUp(td)), 150);
            }
            clearTimeout(batchTimer);
            batchTimer = setTimeout(() => (batch = 0), 120);
        }, { rootMargin: '0px 0px -8% 0px' });
        targets.forEach((el) => { el.classList.add('reveal'); io.observe(el); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
