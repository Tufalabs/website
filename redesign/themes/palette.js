// Preview bar for the rule-based system: grid overlay (G),
// and the rules page values.
(() => {
    const root = document.documentElement;
    const store = (k, v) => { try { v === undefined ? (v = localStorage.getItem(k)) : localStorage.setItem(k, v); } catch (e) { v = null; } return v; };
    function controls() {
        const bar = document.getElementById('theme-switch') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'theme-switch' });
        const wrap = document.createElement('span');
        wrap.style.cssText = 'display:inline-flex;gap:4px;align-items:center';
        const g = document.createElement('button');
        g.textContent = 'grid (G)';
        g.style.cssText = 'font:inherit;color:#fff;background:#333;border:0;padding:2px 6px;margin-left:6px;cursor:pointer';
        g.onclick = () => root.classList.toggle('show-grid');
        wrap.appendChild(g);
        const rules = document.createElement('a');
        rules.textContent = 'rules'; rules.href = bar.dataset.rules || (document.querySelector('.logo-container')?.getAttribute('href') || '/') + 'system/';
        rules.style.cssText = 'color:#fff;margin-left:6px';
        wrap.appendChild(rules);
        const figs = document.createElement('a');
        figs.textContent = 'figures'; figs.href = rules.href.replace(/system\/$/, 'system/figures/').replace(/rules\/index\.html$/, 'figures/index.html');
        figs.style.cssText = 'color:#fff;margin-left:6px';
        wrap.appendChild(figs);
        const idn = document.createElement('a');
        idn.textContent = 'identity'; idn.href = rules.href.replace(/system\/$/, 'system/identity/').replace(/rules\/index\.html$/, 'identity/index.html');
        idn.style.cssText = 'color:#fff;margin-left:6px';
        wrap.appendChild(idn);
        // the site keeps still when the system asks for reduced motion; say so, since it looks like a bug
        const rm = document.createElement('span');
        rm.style.cssText = 'margin-left:8px;color:#ff0';
        const showRm = () => { const m = matchMedia('(prefers-reduced-motion: reduce)').matches; rm.textContent = m ? 'reduced motion is on (system setting): animations paused' : ''; rm.style.display = m ? '' : 'none'; };
        showRm(); matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', showRm);
        wrap.appendChild(rm);
        bar.appendChild(wrap);
        const style = document.createElement('style');
        style.textContent = '[data-pick][aria-pressed="true"]{opacity:1!important;text-decoration:underline;text-underline-offset:3px}';
        document.head.appendChild(style);
    }

    // sRGB via canvas, so any CSS colour (oklch included) can be measured
    const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
    function rgb(css) { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); }
    function lum([r, g, b]) { const f = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
    function contrast(a, b) { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); }
    const hex = (c) => '#' + rgb(c).map((v) => v.toString(16).padStart(2, '0')).join('');

    function renderRules() {
        const cs = getComputedStyle(root);
        document.querySelectorAll('[data-swatch]').forEach((el) => {
            const token = el.dataset.swatch, value = cs.getPropertyValue(token).trim();
            el.querySelector('.swatch-chip').style.background = `var(${token})`;
            el.querySelector('.swatch-hex').textContent = hex(value);
            const ratio = contrast(value, cs.getPropertyValue('--bg').trim());
            el.querySelector('.swatch-ratio').textContent = `${ratio.toFixed(2)}:1 on ground`;
        });
        document.querySelectorAll('[data-spec]').forEach((el) => {
            const s = getComputedStyle(el.querySelector('.spec-sample'));
            el.querySelector('.spec-value').textContent = `${parseFloat(s.fontSize).toFixed(1)}px / ${parseFloat(s.lineHeight)}px`;
        });
        const h = document.querySelector('[data-hue]');
        if (h) h.textContent = cs.getPropertyValue('--h').trim() + '°';
    }

    function init() {
        controls();
        ['data-design', 'data-tint', 'data-head'].forEach((a) => root.removeAttribute(a));
        try { ['tufa-design', 'tufa-tint', 'tufa-head'].forEach((k) => localStorage.removeItem(k)); } catch (e) { /* storage blocked */ }
        renderRules();
        addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'g' && !e.metaKey && !e.ctrlKey && !/input|textarea/i.test(e.target.tagName)) root.classList.toggle('show-grid');
        });
        document.fonts?.ready.then(renderRules);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
