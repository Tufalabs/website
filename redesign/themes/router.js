// Moving between pages without leaving the page (swup, themes/vendor): the next page is fetched ahead of the click (on a
// resting pointer, or when the phone menu opens), the content under the header is swapped, and the new page builds up
// as it does on a first load, only with shorter waits. The header stays: its creature keeps walking, the nav point
// slides to the new item. Pages that run scripts of their own (the privacy policy's widget, the design pages) load in
// full; so does anything outside the site.
(() => {
    const root = document.documentElement, pages = window.tufaPage;
    pages?.view();   // this page: its parts run now
    if (!pages || !window.Swup || root.classList.contains('off-js')) return;

    // where the site starts (the logo's link: / on its own host, /<slug>/ inside another, /system/ in the preview)
    const home = new URL(document.querySelector('.logo-container')?.getAttribute('href') || '/', location.href).pathname;
    const inSite = (url) => { const p = new URL(url, location.href).pathname; return p.startsWith(home) ? p.slice(home.length) : null; };
    const FULL = /^(privacy|system)(\/|$)/;   // relative to home
    const swup = new Swup({
        containers: ['#content'],
        animationSelector: false,   // no leaving animation to wait for: the old page clears at once (is-leaving)
        ignoreVisit: (url, { el } = {}) => { const r = inSite(url); return !!el?.closest('[data-no-swup]') || r == null || FULL.test(r); },
        plugins: [
            new SwupPreloadPlugin({ preloadHoveredLinks: true, preloadInitialPage: false }),
            new SwupScrollPlugin({ animateScroll: false, doScrollingRightAway: true }),   // a new page opens at its top; back returns to where the reader was
        ],
    });
    window.tufaSwup = swup;

    swup.hooks.on('visit:start', (visit) => {
        visit.animation.animate = false;
        window.tufaNav?.close();
        root.classList.add('is-leaving');           // only the header stays until the next page is in
        root.style.setProperty('--bt', '0.35');     // moving on within the site: the build-up's waits are short
        root.style.scrollBehavior = 'auto';          // the next page opens at its top (or where the reader was) at once, not scrolled there
    });
    swup.hooks.on('visit:end', () => { root.style.scrollBehavior = ''; });
    swup.hooks.before('content:replace', () => pages.leave());   // the page's parts let go (figures stop, listeners go)
    swup.hooks.on('content:replace', (visit, { page }) => {
        root.classList.remove('is-leaving');
        // the new page's own nav says which item is active (a post marks its section)
        const nav = /<nav class="site-nav"[\s\S]*?<\/nav>/.exec(page?.html || '')?.[0] || '';
        window.tufaNav?.select(/<a href="([^"]+)" class="active"/.exec(nav)?.[1] || null);
        pages.view();
        // reached by keyboard (a click with no pointer): the reader continues in the new content, not on the old link
        if (visit.trigger.event?.detail === 0) document.getElementById('content')?.focus({ preventScroll: true });
    });
    swup.hooks.on('visit:abort', () => { root.classList.remove('is-leaving'); root.style.scrollBehavior = ''; });
    swup.hooks.on('link:self', () => { root.classList.remove('is-leaving'); window.tufaNav?.close(); });   // a link to this very page: no visit, so nothing may stay cleared
    // back and forward return to where the reader was on that page (the scroll plugin only opens new pages at the top)
    const seen = new Map(), key = () => history.state?.random;
    let shown = key();   // the history entry on screen (by the time a back visit starts, history already names the next)
    swup.hooks.on('visit:start', () => { if (shown != null) seen.set(shown, scrollY); });
    swup.hooks.on('content:replace', () => { shown = key(); });
    swup.hooks.on('content:scroll', (visit) => {
        if (!visit.history.popstate) return;
        const y = seen.get(key()); if (y != null) scrollTo({ top: y, behavior: 'instant' });
    });
})();
