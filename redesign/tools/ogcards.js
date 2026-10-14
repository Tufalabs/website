// Link-preview cards (1200×630, drawn at 2×): each page's head as the site shows it — the logo, the page name
// as the headline, the statement, the page's figure — or, for articles, title, authors and date.
// Run by tools/og.py (a headless browser on the built preview; CI does it on every deploy): every page build.py made
// (out/system/pages.json), in the identity's faces and colours as the page itself resolves them; PNGs land in
// site/assets/og/<slug>.png.
(async () => {
    const src = await fetch('/themes/figures.js').then((r) => r.text()); (0, eval)(src);
    const F = window.TufaFigures.F, S = 2, W = 1200, H = 630;
    const css = getComputedStyle(document.documentElement), DISPLAY = css.getPropertyValue('--display').trim(), SANS = css.getPropertyValue('--sans').trim(), MONO = css.getPropertyValue('--mono').trim();
    await document.fonts.load(`600 72px ${DISPLAY}`); await document.fonts.load(`400 26px ${SANS}`); await document.fonts.load(`400 15px ${MONO}`);
    document.documentElement.removeAttribute('data-theme');
    const probe = document.createElement('i'); document.body.appendChild(probe);
    const col = (v) => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };
    const C = { ink: col('--ink'), ink2: col('--ink-2'), ink3: col('--ink-3'), hair: col('--hair'), accent: col('--accent'), bg: col('--bg') };
    const logo = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = '/system/mark-ink.svg'; });
    const FIG = { '': 'descent', 'research/': 'fold', 'news/': 'scaling2', 'open-positions/': 'rlcont', 'team/': 'chip', 'mlst/': 'attnpat' };
    // figures that are sparse at rest get a little history for the card: scaling laws a finished sweep of model sizes
    const PREP = {};   // figures whose still frame is too sparse for a card get a little history here
    const BOOST = { scaling2: 2, rlcont: 2 };
    const SECTION = { '': '', research: 'Research', news: 'News', 'open-positions': 'Open Positions', team: 'Team', mlst: 'MLST', terms: 'Terms of Use', privacy: 'Privacy', imprint: 'Imprint' };
    const pages = await fetch('/system/pages.json').then((r) => r.json());   // every page the build made
    const wrap = (ctx, text, w, max) => { const words = text.split(/\s+/), lines = []; let cur = ''; for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > w && cur) { lines.push(cur); cur = wd; } else cur = t; } if (cur) lines.push(cur); if (lines.length > max) { lines.length = max; lines[max - 1] = lines[max - 1].replace(/\s*\S*$/, '') + '…'; } return lines; };
    const done = [];
    for (const path of pages) {
        const html = await fetch('/system/' + path).then((r) => r.text()), d = new DOMParser().parseFromString(html, 'text/html');
        d.querySelectorAll('.band-kicker, [aria-hidden="true"]').forEach((e) => e.remove());   // the page name the build writes above the statement is not part of it
        const isPost = !!d.querySelector('.post-title'), clean = (t) => (t || '').replace(/\s+/g, ' ').trim();
        const title = clean(d.querySelector('.post-title, .page-title')?.textContent) || 'Tufa Labs';
        const statement = clean((d.querySelector('.page-lede') || d.querySelector('.home-content > p:nth-of-type(2)') || d.querySelector('.page:not(:has(.page-lede)) > .page-content > p:first-child'))?.textContent);
        const desc = clean(d.querySelector('meta[name="description"]')?.content), author = clean(d.querySelector('.post-author')?.textContent), date = clean(d.querySelector('.post-meta time')?.textContent);
        const top = path.split('/')[0], fig = FIG[path];
        const cv = Object.assign(document.createElement('canvas'), { width: W * S, height: H * S }), ctx = cv.getContext('2d'); ctx.scale(S, S);
        ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
        // the site header: logo, name, the section on the right, the 2px rule
        const lh = 34, lw = lh * logo.width / logo.height; ctx.drawImage(logo, 56, 40, lw, lh);
        ctx.fillStyle = C.ink; ctx.font = `600 25px ${DISPLAY}`; ctx.textBaseline = 'middle'; ctx.fillText('Tufa Labs', 56 + lw + 12, 58);
        ctx.font = `400 14px ${MONO}`; ctx.fillStyle = C.ink2; ctx.textAlign = 'right'; ctx.fillText((SECTION[top] ?? '').toUpperCase(), W - 56, 58); ctx.textAlign = 'left';
        ctx.fillStyle = C.ink; ctx.fillRect(56, 98, W - 112, 2);
        // the figure, in the right columns, fading in from the left like the site's head band
        const colW = fig ? 540 : W - 112;
        if (fig) {
            const fc = Object.assign(document.createElement('canvas'), { width: W * S, height: H * S }), fx = fc.getContext('2d'); fx.scale(S, S);
            const f = F[fig], tall = !!f.tall, R = { x: 560, y: 110, w: W - 56 - 560, h: 470, fx: 640, vy0: tall ? 128 : 150, vy1: tall ? 556 : 536 };
            let sd = 4242; const rand = (k) => { let s = (sd + k * 7919) % 2147483646 + 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
            const st = f.init(R, rand); PREP[fig]?.(st, f); f.draw(fx, R, 10, C, st, true, rand);
            fx.globalCompositeOperation = 'destination-in';
            let g = fx.createLinearGradient(R.x + 20, 0, R.fx + 10, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); fx.fillStyle = g; fx.fillRect(0, 0, W, H);
            g = fx.createLinearGradient(0, 108, 0, 582); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.06, 'rgba(0,0,0,1)'); g.addColorStop(0.94, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); fx.fillStyle = g; fx.fillRect(0, 0, W, H);
            for (let k = 0; k < (BOOST[fig] || 1); k++) ctx.drawImage(fc, 0, 0, W, H);   // thin, faint figures are laid down twice so they read at card size
        }
        // the headline and the statement (pages), or title, description and byline (articles)
        ctx.textBaseline = 'alphabetic'; ctx.fillStyle = C.ink;
        const head = isPost ? title : (path === '' ? statement : title);
        let size = isPost ? 54 : path === '' ? 46 : 76; const maxL = isPost ? 3 : path === '' ? 5 : 4; ctx.font = `600 ${size}px ${DISPLAY}`;
        let lines = wrap(ctx, head, colW, maxL); while (lines.some((l) => l.endsWith('…')) && size > 34) { size -= 2; ctx.font = `600 ${size}px ${DISPLAY}`; lines = wrap(ctx, head, colW, maxL); }
        let y = isPost ? 196 : path === '' ? 186 : 230;
        ctx.letterSpacing = `${-0.02 * size}px`; lines.forEach((l) => { ctx.fillText(l, 54, y); y += size * 1.08; }); ctx.letterSpacing = '0px';
        const sub = isPost ? desc : path === '' ? '' : statement;
        if (sub) { ctx.fillStyle = C.ink2; ctx.font = `400 25px ${SANS}`; y += 18; wrap(ctx, sub, colW, isPost ? 3 : 4).forEach((l) => { ctx.fillText(l, 56, y); y += 34; }); }
        // the foot: a hairline, the address, and the byline for articles
        ctx.fillStyle = C.hair; ctx.fillRect(56, 574, W - 112, 1);
        ctx.font = `400 15px ${MONO}`; ctx.fillStyle = C.ink3; ctx.fillText(('tufalabs.ai/' + path).replace(/\/$/, ''), 56, 604);
        if (isPost) { ctx.textAlign = 'right'; const by = [author, date].filter(Boolean).join(' · '); ctx.fillText(by.length > 70 ? by.slice(0, 68) + '…' : by, W - 56, 604); ctx.textAlign = 'left'; }
        const slug = path.replace(/\/$/, '').replace(/\//g, '-') || 'home';
        const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
        const res = await fetch(`/og/${slug}.png`, { method: 'POST', body: blob });
        done.push(`${slug}:${res.status}`);
    }
    probe.remove();
    await fetch('/og/done', { method: 'POST', body: done.join(' ') });
    return done.join(' ');
})().catch((e) => fetch('/og/done', { method: 'POST', body: 'error: ' + (e && e.stack || e) }));
