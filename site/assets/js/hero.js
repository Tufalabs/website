// Page heads: one figure per page, each drawn from a paper. It rests as a still frame; touching it
// (click, drag, or pointing for attention) brings it to life, and only then does the accent appear.
// A small caption names the paper. Hidden on phones. Built per page (router.js), stopped when the page is left.
(window.__tufaPages ||= []).push(() => {
    if (!window.TufaFigures) return;
    if (document.documentElement.matches('.off-js, .off-figure')) return;   // bisect switches (?off=js, ?off=figure)
    const FIGURE = { home: 'descent', research: 'fold', news: 'scaling2', jobs: 'rlcont', team: 'chip', mlst: 'attnpat' };
    const PAPER = {
        scaling2: { cite: 'Scaling laws · Hoffmann et al. 2022', title: 'Training Compute-Optimal Large Language Models', href: 'https://arxiv.org/abs/2203.15556', hint: 'Drag the rows: each step you pass is a training run' },
        rlcont: { cite: 'REINFORCE · Williams 1992', title: 'Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning', href: 'https://doi.org/10.1007/BF00992696', hint: 'Click to train · drag the goal, walls, pits · double click: new arena' },
        scaling: { cite: 'Chinchilla · Hoffmann et al. 2022', title: 'Training Compute-Optimal Large Language Models', href: 'https://arxiv.org/abs/2203.15556', hint: 'Drag the point or slide an axis' },
        rlenv: { cite: 'REINFORCE · Williams 1992', title: 'Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning', href: 'https://doi.org/10.1007/BF00992696', hint: 'Click to train, click a cell to move the goal' },
        attnpat: { cite: 'Sparse attention · Child et al. 2019', title: 'Generating Long Sequences with Sparse Transformers', href: 'https://arxiv.org/abs/1904.10509', hint: 'Click: next pattern, watch it train · hover a row' },
        tfm: { cite: 'Transformer · Vaswani et al. 2017', title: 'Attention Is All You Need', href: 'https://arxiv.org/abs/1706.03762', hint: 'Click for a pass, hover a token, drag to orbit' },
        chip: { cite: 'Blackwell Ultra · NVIDIA 2025', title: 'Inside NVIDIA Blackwell Ultra: The Chip Powering the AI Factory Era', href: 'https://developer.nvidia.com/blog/inside-nvidia-blackwell-ultra-the-chip-powering-the-ai-factory-era/', hint: 'Click a part to zoom in, double click to return' },
        kvcache: { cite: 'PagedAttention · Kwon et al. 2023', title: 'Efficient Memory Management for Large Language Model Serving with PagedAttention', href: 'https://arxiv.org/abs/2309.06180', hint: 'Drag the corner for context and batch, click the chip to generate' },
        gpu: { cite: 'GPU architecture · NVIDIA 2024', title: 'NVIDIA Blackwell Architecture Technical Brief', href: 'https://resources.nvidia.com/en-us-blackwell-architecture', hint: 'Drag C’s corner to resize, click the chip to run, hover an SM' },
        resnet: { cite: 'ResNet · He et al. 2016', title: 'Deep Residual Learning for Image Recognition', href: 'https://arxiv.org/abs/1512.03385', hint: 'Drag to orbit, hover a block, click for a pass' },
        backprop2: { cite: 'Backpropagation · Rumelhart, Hinton & Williams 1986', title: 'Learning representations by back-propagating errors', href: 'https://doi.org/10.1038/323533a0', hint: 'Click the network for one step, the field to add a point' },
        diffusion: { cite: 'Diffusion · Ho et al. 2020', title: 'Denoising Diffusion Probabilistic Models', href: 'https://arxiv.org/abs/2006.11239', hint: 'Click for another distribution, or draw one' },
        grokking: { cite: 'Grokking · Power et al. 2022', title: 'Grokking: Generalization Beyond Overfitting on Small Algorithmic Datasets', href: 'https://arxiv.org/abs/2201.02177', hint: 'Move up and down for weight decay, drag across to train' },
        conv: { cite: 'AlexNet · Krizhevsky et al. 2012', title: 'ImageNet Classification with Deep Convolutional Neural Networks', href: 'https://doi.org/10.1145/3065386', hint: 'Click for the next filter, draw on the image' },
        lens2: { cite: 'Logit lens · nostalgebraist 2020', title: 'interpreting GPT: the logit lens', href: 'https://www.lesswrong.com/posts/AcKRB8wDpdaN6v6ru/interpreting-gpt-the-logit-lens', hint: 'Drag the arrow tip, or drag across to move through layers' },
        passk: { cite: 'RL and reasoning · Yue et al. 2025', title: 'Does Reinforcement Learning Really Incentivize Reasoning Capacity in LLMs Beyond the Base Model?', href: 'https://arxiv.org/abs/2504.13837', hint: 'Drag to train with RL, click for another problem' },
        rlsparse: { cite: 'RL subnetworks · Mukherjee et al. 2025', title: 'Reinforcement Learning Finetunes Small Subnetworks in Large Language Models', href: 'https://arxiv.org/abs/2505.11711', hint: 'Click for another RL seed, drag to scrub training' },
        lens: { cite: 'Logit lens · nostalgebraist 2020', title: 'interpreting GPT: the logit lens', href: 'https://www.lesswrong.com/posts/AcKRB8wDpdaN6v6ru/interpreting-gpt-the-logit-lens', hint: 'Point at a word to decode it layer by layer' },
        backprop: { cite: 'Lottery tickets · Frankle & Carbin 2019', title: 'The Lottery Ticket Hypothesis: Finding Sparse, Trainable Neural Networks', href: 'https://arxiv.org/abs/1803.03635', hint: 'Click the network to prune, the field to add a point' },
        fold: { cite: 'Folding · Montúfar et al. 2014', title: 'On the Number of Linear Regions of Deep Neural Networks', href: 'https://arxiv.org/abs/1402.1869', hint: 'Left: click for data, drag to paint · right: play, drag to scrub' },
        springs: { cite: 'KL-regularized RL · Rafailov et al. 2023', title: 'Direct Preference Optimization: Your Language Model is Secretly a Reward Model', href: 'https://arxiv.org/abs/2305.18290', hint: 'Click an answer to reward it, move up and down to set β' },
        attn3b: { cite: 'Attention · Vaswani et al. 2017', title: 'Attention Is All You Need', href: 'https://arxiv.org/abs/1706.03762', hint: 'Point at a token or use the arrow keys' },
        epicycles: { cite: 'Fourier series · 3Blue1Brown 2019', title: 'But what is a Fourier series? From heat flow to drawing with circles', href: 'https://www.youtube.com/watch?v=r6sGWTCMz2k', hint: 'Draw a closed shape, drag the scale for more circles' },
        arc3: { cite: 'ARC-AGI-3 · ARC Prize 2025', title: 'ARC-AGI-3: Interactive Reasoning Benchmark', href: 'https://arcprize.org/arc-agi/3/', hint: 'Arrow keys or click to move' },
        arc: { cite: 'ARC · Chollet 2019', title: 'On the Measure of Intelligence', href: 'https://arxiv.org/abs/1911.01547', hint: 'Click cells to solve the test' },
        descent: { cite: 'Adam · Kingma & Ba 2014', title: 'Adam: A Method for Stochastic Optimization', href: 'https://arxiv.org/abs/1412.6980', hint: 'Drag the start or a valley, hover a path for its optimizer' },
        klpolicy: { cite: 'DPO · Rafailov et al. 2023', title: 'Direct Preference Optimization: Your Language Model is Secretly a Reward Model', href: 'https://arxiv.org/abs/2305.18290', hint: 'Move to set β, click an answer to reward it' },
        chinchilla: { cite: 'Chinchilla · Hoffmann et al. 2022', title: 'Training Compute-Optimal Large Language Models', href: 'https://arxiv.org/abs/2203.15556', hint: 'Move to set a budget, click to race' },
        grpo: { cite: 'GRPO · Shao et al. 2024', title: 'DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models', href: 'https://arxiv.org/abs/2402.03300', hint: 'Click an answer to flip its reward' },
        flowmatch: { cite: 'Flow matching · Lipman et al. 2022', title: 'Flow Matching for Generative Modeling', href: 'https://arxiv.org/abs/2210.02747', hint: 'Scrub t, or draw a target' },
        heads: { cite: 'Attention · Vaswani et al. 2017', title: 'Attention Is All You Need', href: 'https://arxiv.org/abs/1706.03762', hint: 'Point or use the arrow keys to browse the tokens' },
        attention: { cite: 'Attention · Vaswani et al. 2017', title: 'Attention Is All You Need', href: 'https://arxiv.org/abs/1706.03762', hint: 'Point at a token' },
        life: { cite: 'Game of Life · Gardner 1970', title: 'Mathematical Games: The fantastic combinations of John Conway’s new solitaire game “life”', href: 'https://doi.org/10.1038/scientificamerican1070-120', hint: 'Click to run, drag to draw' },
    };
    const page = (() => {
        if (document.querySelector('.notfound-page')) return 'notfound';   // a figure no other page uses, a different one each time
        const active = document.querySelector('.site-nav a.active')?.textContent.trim().toLowerCase();
        return { home: 'home', research: 'research', news: 'news', 'open positions': 'jobs', team: 'team', mlst: 'mlst' }[active];
    })();
    const unused = () => { const used = new Set(Object.values(FIGURE)), pool = Object.keys(PAPER).filter((k) => !used.has(k) && window.TufaFigures.F[k]); return pool[Math.floor(Math.random() * pool.length)]; };
    const name = new URLSearchParams(location.search).get('figure') || (page === 'notfound' ? unused() : FIGURE[page]);
    if (!name || matchMedia('(max-width: 900px)').matches) return;   // phones show no figure (CSS hides it): don't build or run one
    const band = document.querySelector('.home-content > p:nth-of-type(2)')
        || document.querySelector('.page-header:has(.page-lede)')
        || document.querySelector('.page:not(:has(.page-lede)) > .page-content > p:first-child');
    if (!band) return;
    band.classList.add('has-hero');
    const grid = band.matches('.page-header') ? band : band.parentElement;
    const cv = document.createElement('canvas');
    cv.className = 'hero-canvas';
    cv.setAttribute('aria-hidden', 'true');
    band.appendChild(cv);
    const paper = PAPER[name];
    let region = null;
    // the hit area covers the visible part of the figure (columns 8–12); the canvas itself stays inert
    const hit = document.createElement('div'), cap = document.createElement('p');
    hit.className = 'hero-hit'; hit.setAttribute('aria-hidden', 'true');
    cap.className = 'hero-caption';
    if (paper) {
        // under the figure: a [1] that opens into the reference in place, then the hint (shown on a resting hover)
        const authors = paper.cite.split(' · ')[1];
        cap.innerHTML = `<button type="button" class="cite-mark" aria-expanded="false" aria-label="Figure reference">[1]</button>`
            + `<span class="cite-full">Figure after ${authors}, <a href="${paper.href}" target="_blank" rel="noopener noreferrer">${paper.title}</a>.</span>`
            + `<span class="cite-hint">${paper.hint}</span>`;
        const mark = cap.querySelector('.cite-mark');
        mark.addEventListener('click', () => { const open = cap.classList.toggle('is-open'); mark.setAttribute('aria-expanded', open); });
        band.append(hit, cap);
    }
    const place = () => {
        if (!region || !paper) return;
        hit.style.left = `${region.left}px`; hit.style.width = `${region.w}px`; hit.style.height = `${region.H}px`;
        cap.style.left = '0px'; cap.style.width = `${region.left + region.w}px`;   /* the hint may run left past the figure, under the statement */
    };
    // figures take columns 8–12 beside the statement (columns 1–7); field figures start in column 7 and
    // fade in across the gutter, fully visible from column 8
    const fig = TufaFigures.mount(cv, name, (W, H, f) => {
        const col = (W - 11 * 24) / 12, c8 = 7 * (col + 24), c7 = 6 * (col + 24);
        region = { left: c8, w: W - c8, H }; place();
        return f.bleed
            ? (f.tall ? { x: c7, y: 0, w: W - c7, h: H, fx: c8, fadeFrom: c7 + col * 0.5, fadeTo: c8 + 16, vy0: 14, vy1: H - 30 }   // tall figures use the band's full height, no top/bottom fade
               : { x: c7, y: 0, w: W - c7, h: H, fx: c8, fadeFrom: c7 + col * 0.5, fadeTo: c8 + 16, fadeY: [0, H, 48], vy0: 44, vy1: H - 56 })
            : { x: c8, y: 28, w: W - c8, h: H - 64 };
    }, { size: () => ({ width: grid.clientWidth, height: band.offsetHeight }), staticUntilTouched: !!paper });
    if (!fig) return;
    if (!paper) return () => fig.destroy();

    const local = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    const live = () => band.classList.add('hero-live');
    hit.addEventListener('pointerdown', (e) => {
        fig.touch(); live(); clearTimeout(hintTimer); band.classList.add('hero-hint');   // using the figure shows how to use it
        hit.setPointerCapture?.(e.pointerId);
        fig.pointer('down', ...local(e), 1);
    });
    hit.addEventListener('pointermove', (e) => {
        // pointing alone is enough for attention; the others react to clicks and drags
        if (['attention', 'heads', 'attn3b', 'lens'].includes(name)) { fig.touch(); live(); }
        if (fig.touched || ['grpo', 'klpolicy', 'chinchilla', 'arc', 'arc3', 'descent', 'flowmatch', 'fold', 'springs', 'attn3b', 'epicycles', 'backprop', 'lens', 'rlsparse', 'lens2', 'passk', 'diffusion', 'grokking', 'conv', 'backprop2', 'resnet', 'gpu', 'kvcache', 'chip', 'tfm', 'scaling', 'rlenv', 'attnpat', 'rlcont', 'scaling2'].includes(name)) fig.pointer('move', ...local(e), e.buttons);   // hover shows what is clickable
    });
    // the hint shows once the pointer has rested on the figure for a moment, and goes when it leaves
    let hintTimer = 0;
    hit.addEventListener('pointerenter', () => fig.pointer('enter', -1, -1, 0));
    hit.addEventListener('pointerenter', () => { clearTimeout(hintTimer); hintTimer = setTimeout(() => band.classList.add('hero-hint'), 700); });
    hit.addEventListener('pointerleave', () => { clearTimeout(hintTimer); band.classList.remove('hero-hint'); fig.pointer('leave', -1, -1, 0); });
    // keys: while the pointer rests on the figure (or just after using it), arrows and WASD go to it
    let over = false, lastUse = 0;
    hit.addEventListener('pointerenter', () => (over = true));
    hit.addEventListener('pointerleave', () => (over = false));
    hit.addEventListener('pointerdown', () => (lastUse = performance.now()));
    const DIRS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1], d: [1, 0], a: [-1, 0], s: [0, 1], w: [0, -1] };
    const onKey = (e) => {
        const d = DIRS[e.key] || DIRS[e.key.toLowerCase?.()];
        if (!d || e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return;
        if (!over && performance.now() - lastUse > 8000) return;
        e.preventDefault(); fig.touch(); live(); lastUse = performance.now();
        fig.pointer('key', d, 0, 0);
    };
    if (['arc3', 'heads', 'attn3b', 'lens', 'lens2'].includes(name)) addEventListener('keydown', onKey);
    hit.addEventListener('pointerup', (e) => { hit.releasePointerCapture?.(e.pointerId); if (fig.touched) fig.pointer('up', ...local(e), 0); });
    return () => { fig.destroy(); clearTimeout(hintTimer); removeEventListener('keydown', onKey); };   // the page is left
});
