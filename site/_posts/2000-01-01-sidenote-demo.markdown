---
layout: post
title: "Sidenote Rendering Demo"
date: 2000-01-01 09:00:00 +0000
permalink: /research/sidenote-demo/
author: Tufa Labs
description: "A fixture post that exercises the custom sidenote and marginnote Liquid tags."
sidenotes: true
published: false
---

This demo keeps the main paragraph focused while moving supporting context into the margin{% sidenote sn-demo-1 %}A sidenote can include *Markdown*, [internal links]({{ '/team/' | relative_url }}), and inline code like `alpha_v1`.{% endsidenote %}. The goal is to verify that the primary reading flow still feels clean when a note holds the extra detail.

You can also drop in a shorter aside with a margin note{% marginnote mn-demo-1 %}This is an unnumbered marginal note for brief context that does not need a citation number.{% endmarginnote %}. On narrow screens it should still collapse inline cleanly instead of trying to occupy a separate rail.

The second numbered note appears a little later{% sidenote sn-demo-2 %}This note is slightly longer so you can inspect wrapping, spacing, and counter progression without needing a long article to do it.{% endsidenote %}. That keeps the fixture useful for visual checks while staying short enough to scan quickly.
