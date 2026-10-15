"""The identity page: identity.html with the marks inlined and print measures (mm) scaled to each sheet."""
import re, pathlib
ROOT = pathlib.Path(__file__).parent.parent

def inner(svg):
    return re.sub(r'^.*?<svg[^>]*>|</svg>\s*$', '', svg, flags=re.S).strip()

def render():
    mark = (ROOT / "vendor/identity/mark/mark.svg").read_text()
    cols = "".join(f'<i class="c" style="left:calc(var(--mm) * {15 + k * (180 + 5) / 12:.2f});width:calc(var(--mm) * {(180 - 11 * 5) / 12:.2f})"></i>' for k in range(12))
    body = ("<p>We are a small, independent research group working on fundamental AI research, with enough compute to run the experiments we care about.</p>"
            "<p>This letter is set in Inter at 9.5 pt on a 5 mm line. Its head repeats the head of every page of the website: the mark and the name, a rule, and the label column to the left.</p>"
            "<p>Kind regards,<br>Name Surname</p>")
    html = (ROOT / "identity.html").read_text()
    bez, (nseg, nanc, ncor, nkink) = bezier_view()
    html = html.replace("{{BEZIER}}", bez).replace("{{BEZ_SEG}}", str(nseg)).replace("{{BEZ_CORNER}}", str(ncor)).replace("{{BEZ_KINK}}", str(nkink))
    mark_inline = re.sub(r'<svg ', '<svg aria-hidden="true" ', mark.strip(), count=1)
    n = iter(range(1000))   # each inline copy gets its own clip id
    html = (re.sub(r"\{\{MARK\}\}", lambda m: (lambda k: mark_inline.replace("tufa-eye-l", f"tufa-eye-l{k}").replace("tufa-eye-r", f"tufa-eye-r{k}"))(next(n)), html).replace("{{COLS}}", cols).replace("{{BODY}}", body))
    # print measures in style attributes: N mm → N × the sheet's millimetre (--mm, a share of the sheet's width)
    html = re.sub(r'style="[^"]*"', lambda m: re.sub(r'(?<![\w.])(\d+(?:\.\d+)?)mm\b', r'calc(var(--mm) * \1)', m.group(0)), html)
    return html


def header_mark():
    svg = (ROOT / "vendor/identity/mark/mark.svg").read_text()
    svg = re.sub(r"<!--.*?-->\s*", "", svg, flags=re.S).strip()
    svg = svg.replace("tufa-eye-l", "tufa-eye-lh").replace("tufa-eye-r", "tufa-eye-rh")   # its own clip ids
    return svg.replace("<svg ", '<svg class="logo-image" id="logo-image" role="img" aria-label="Tufa Labs logo" ', 1)

def bezier_view():
    """The body's construction: every cubic segment of the m-body path, its anchors (the master's own vertices), its
    handles, corners as squares, and kinks (smooth anchors whose two handles disagree in direction) ringed."""
    import math
    svg = (ROOT / "vendor/identity/mark/mark.svg").read_text()
    ds = re.findall(r'class="m-(?:body|leg)[^"]*"[^>]*\sd="([^"]+)"', svg)   # every part, in drawing order
    d = " ".join(ds)
    tok = re.findall(r"[MCZ]|-?[\d.]+", d)
    subs, cur, i = [], None, 0
    while i < len(tok):
        t = tok[i]
        if t == "M": cur = {"start": (float(tok[i + 1]), float(tok[i + 2])), "segs": []}; subs.append(cur); i += 3
        elif t == "C":
            i += 1
            while i + 5 < len(tok) + 1 and i < len(tok) and tok[i] not in "MCZ":
                v = list(map(float, tok[i:i + 6])); cur["segs"].append(((v[0], v[1]), (v[2], v[3]), (v[4], v[5]))); i += 6
        else: i += 1
    lines, ctrls, anchors, corners, kinks, n_seg = [], [], [], [], [], 0
    f = lambda p: f"{p[0]:.1f} {p[1]:.1f}"
    for s in subs:
        segs = s["segs"]; p = s["start"]; n = len(segs); n_seg += n
        ends = [s["start"]] + [g[2] for g in segs]
        for k, (c1, c2, q) in enumerate(segs):
            lines.append(f"M{f(p)}L{f(c1)}M{f(q)}L{f(c2)}"); ctrls += [c1, c2]; p = q
        for k in range(n):   # at the anchor ending segment k: incoming handle (from c2) vs outgoing (to the next c1)
            a = segs[k][2]; cin = segs[k][1]; cout = segs[(k + 1) % n][0]
            vin = (a[0] - cin[0], a[1] - cin[1]); vout = (cout[0] - a[0], cout[1] - a[1])
            li, lo = math.hypot(*vin), math.hypot(*vout)
            ang = 0 if li < 1e-6 or lo < 1e-6 else math.degrees(math.acos(max(-1, min(1, (vin[0] * vout[0] + vin[1] * vout[1]) / (li * lo)))))
            # a corner: one handle lies along the straight chord to its neighbour (how the smoother marks kept corners)
            if ang > 30: corners.append(a)
            elif ang > 6: kinks.append(a)
            else: anchors.append(a)
    dots = lambda pts, r: "".join(f'<circle cx="{p[0]:.1f}" cy="{p[1]:.1f}" r="{r}"/>' for p in pts)
    sq = "".join(f'<rect x="{p[0] - 9:.1f}" y="{p[1] - 9:.1f}" width="18" height="18"/>' for p in corners)
    rings = "".join(f'<circle cx="{p[0]:.1f}" cy="{p[1]:.1f}" r="22"/>' for p in kinks)
    stats = (n_seg, len(anchors) + len(corners) + len(kinks), len(corners), len(kinks))
    eyes = "".join(f'<circle cx="{c[0]}" cy="{c[1]}" r="{c[2]}"/>' for c in re.findall(r'<circle class="m-(?:rim|ring|white|pupil)" cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"', svg))
    eyes += "".join(f'<ellipse cx="{c[0]}" cy="{c[1]}" rx="{c[2]}" ry="{c[3]}"/>' for c in re.findall(r'<ellipse class="m-rim" cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)" ry="([\d.]+)"', svg))
    return (f'<svg viewBox="-20 -20 1173 1156" aria-hidden="true" class="id-bez-svg">' +
            "".join(f'<path class="bz-fill" d="{x}"/>' for x in ds) +
            f'<path class="bz-handle" d="{"".join(lines)}"/>' +
            "".join(f'<path class="bz-curve" d="{x}"/>' for x in ds) +
            f'<g class="bz-eye">{eyes}</g>'
            f'<g class="bz-ctrl">{dots(ctrls, 7)}</g><g class="bz-anchor">{dots(anchors, 9)}</g><g class="bz-corner">{sq}</g><g class="bz-kink">{rings}</g>'
            f'</svg>'), stats
