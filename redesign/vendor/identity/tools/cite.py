"""The citation format (company.json → citation), as text and as BibTeX: the one implementation the docs, the guidelines
and the website use, so a Tufa Labs publication is cited the same way everywhere.

    from cite import cite
    text, bibtex = cite("Synthetic pretraining for very small reasoning models", ["Matteo Saponati"], "2026-04-24", "https://…")
"""
import json, pathlib, re, datetime

C = json.loads((pathlib.Path(__file__).resolve().parent.parent / "company.json").read_text())["citation"]
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def _split(name):
    """"Matteo Saponati" → ("Matteo", "Saponati"); "Simonds, Toby" → ("Toby", "Simonds"); a group name stays whole."""
    name = re.sub(r"\*+$", "", name.strip())   # contribution marks (Name*) are not part of the name
    if "," in name: last, first = [x.strip() for x in name.split(",", 1)]; return first, last
    parts = name.split()
    return (" ".join(parts[:-1]), parts[-1]) if len(parts) > 1 else ("", name)


def _join(names):
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def cite(title, authors, date, url):
    """title: str; authors: names in reading order; date: ISO date (YYYY-MM-DD); url: the publication's address."""
    title = title.strip().rstrip(".")
    d = datetime.date.fromisoformat(date[:10])
    people = [_split(a) for a in authors if a.strip()]
    text_authors = _join([f"{last}, {first[0]}." if first else last for first, last in people])
    text = C["text"].format(authors=text_authors.rstrip("."), title=title, venue=C["venue"], month=MONTHS[d.month - 1], year=d.year, url=url).strip()
    key = re.sub(r"\W", "", (people[0][1] if people else "tufa").lower()) + str(d.year) + (re.findall(r"[a-z0-9]+", title.lower()) or ["work"])[0]
    fields = {"title": title, "author": " and ".join(f"{last}, {first}" if first else last for first, last in people),
              "journal": C["venue"], "year": str(d.year), "month": MONTHS[d.month - 1].lower()[:3], "url": url}
    w = max(len(k) for k in C["bibtex_fields"])
    bib = f"@article{{{key},\n" + ",\n".join(f"  {k.ljust(w)} = {{{fields[k]}}}" for k in C["bibtex_fields"]) + "\n}"
    return text, bib


REF = re.compile(r"^\[(?P<title>[^\]]+)\]\((?P<url>[^)]+)\) \((?P<authors>[^()]+?), (?P<year>\d{4})\)(?P<rest>[^\n]*)$")


def reference(title, url, authors, year, note=""):
    """Another work as our texts cite it (a margin note): [Title](url) (Last, Year). — one author by surname, two joined
    with &, three or more as the first et al.; an organisation by its name."""
    people = [a for a in authors if a.strip()]
    last = [p if len(p.split()) == 1 or p.endswith(("Team", "AI", "Inc.", "Labs")) else _split(p)[1] for p in people]
    who = last[0] if len(last) == 1 else f"{last[0]} & {last[1]}" if len(last) == 2 else f"{last[0]} et al."
    return f"[{title}]({url}) ({who}, {year})" + (f", {note}" if note else "") + "."


def check_reference(md):
    """Problems with a margin note that cites another work (Markdown), against the format: [] if it holds."""
    m = REF.match(md.strip())
    if not m: return ["not [Title](url) (Authors, Year)."]
    out = []
    a = m["authors"]
    if " and " in a: out.append("two authors are joined with &, not and")
    if a.count(",") or a.count("&") > 1: out.append("three or more authors: the first, et al.")
    if not m["rest"].endswith("."): out.append("ends with a full stop")
    return out


if __name__ == "__main__":
    t, b = cite("Synthetic pretraining for very small reasoning models.", ["Matteo Saponati"], "2026-04-24", "https://tufalabs.ai/research/enhancing-reasoning-small-language-models/")
    print(t); print(b)
    print(cite("Duck Harness", ["Harold Bessis", "Jeroen Cottaar", "Isaiah Pressman"], "2026-07-01", "https://tufalabs.ai/research/duck-harness/")[0])
