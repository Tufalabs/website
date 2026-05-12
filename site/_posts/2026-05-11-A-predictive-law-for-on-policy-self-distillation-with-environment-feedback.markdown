---
layout: post
title: "A predictive law for on-policy self-distillation with environment feedback"
date: 2026-05-11 09:00:00 +0200
permalink: /research/predictive-law-on-policy-self-distillation/
author: Tommy He, Jerome Sieber, Matteo Saponati
# byline_note: "In collaboration with others at Tufa Labs"
description: "Can you predict how well on-policy self-distillation will work before running expensive training? Yes, the initial student–self-teacher performance gap is a strong linear predictor of final performance, and this relationship holds across model families, context types, and scales."
sidenotes: true
math: true
---

<div style="text-align: center; margin: 1.5rem 0; display: flex; justify-content: center; gap: 2rem;">
  <a href="https://arxiv.org/abs/XXXX.XXXXX" target="_blank" style="text-decoration: none; color: inherit;">
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg><br>
    <span style="font-size: 0.85rem;">Paper</span>
  </a>
  <a href="https://github.com/tufalabs/XXXX" target="_blank" style="text-decoration: none; color: inherit;">
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg><br>
    <span style="font-size: 0.85rem;">Code</span>
  </a>
</div>

## Motivation

Reinforcement learning with verifiable rewards (RLVR) has become a core component of LLM post-training, enabling models to explore and refine their own reasoning through trial and error.{% sidenote ref-rlvr-1 %}[DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948) (Guo et al., 2025).{% endsidenote %}{% sidenote ref-rlvr-2 %}[OpenAI o1 System Card](https://arxiv.org/abs/2412.16720) (Jaech et al., 2024).{% endsidenote %}{% sidenote ref-rlvr-3 %}[Kimi k1.5: Scaling Reinforcement Learning with LLMs](https://arxiv.org/abs/2501.12599) (Kimi Team, 2025).{% endsidenote %} Yet most RLVR pipelines rely on binary scalar rewards: a model either solves the problem or it doesn't. This coarse signal discards a wealth of richer feedback available in real environments: runtime errors, failed unit tests, partial progress, unstructured observations, and so on. On-policy self-distillation (OPSD) has emerged as a promising alternative that converts this environmental feedback into dense, token-level supervision, bypassing the need for a stronger external teacher model.{% sidenote ref-opsd-1 %}[Reinforcement Learning via Self-Distillation](https://arxiv.org/abs/2601.20802) (Hübotter et al., 2026).{% endsidenote %}{% sidenote ref-opsd-2 %}[Self-Distilled Reasoner: On-Policy Self-Distillation for Large Language Models](https://arxiv.org/abs/2601.18734) (Zhao et al., 2026).{% endsidenote %}{% sidenote ref-opsd-3 %}[Self-Distillation Enables Continual Learning](https://arxiv.org/abs/2601.19897) (Shenfeld et al., 2026).{% endsidenote %}{% sidenote ref-opsd-4 %}[On-Policy Self-Distillation for Reasoning Compression](https://arxiv.org/abs/2603.05433) (Sang et al., 2026).{% endsidenote %}{% sidenote ref-opsd-5 %}[Expanding the Capabilities of Reinforcement Learning via Text Feedback](https://arxiv.org/abs/2602.02482) (Song et al., 2026).{% endsidenote %}{% sidenote ref-opsd-6 %}[Experiential Reinforcement Learning](https://arxiv.org/abs/2602.13949) (Shi et al., 2026).{% endsidenote %}{% sidenote ref-opsd-7 %}[On-Policy Context Distillation for Language Models](https://arxiv.org/abs/2602.12275) (Ye et al., 2026).{% endsidenote %}{% sidenote ref-opsd-8 %}[Online Experiential Learning for Language Models](https://arxiv.org/abs/2603.16856) (Ye et al., 2026).{% endsidenote %}

Despite its promise, OPSD remains difficult to deploy reliably in practice. The choice of privileged context — what extra information the self-teacher receives — has an important effect on final performance, yet no principled method exists for selecting it without running full, expensive training runs. Practitioners are left to guess which context configuration will work, with little recourse when a run fails to improve the student.

Our hypothesis is that the gap between the student and the self-teacher at initialization contains all the information needed to predict where training will land. Because the self-teacher is simply the student model conditioned on privileged context, this gap is cheap to measure upfront, before any training. We hypothesize that this makes it a practical screening tool for OPSD configurations, applicable across model families and scales.

<div class="research-callout research-callout--question" markdown="1">
<div class="research-callout__label">Research Question</div>

**Can the initial student–self-teacher gap predict final OPSD performance before training begins?**
</div>

In our recent paper, we show that the initial student–self-teacher gap is indeed a strong, linear predictor of final student performance in OPSD. This relationship that holds consistently across privileged context types, model families (Qwen3 and Olmo3), and model scales ranging from 0.6B to 14B parameters. By measuring a single scalar quantity before training, practitioners can anticipate the outcome of a given OPSD configuration, screen multiple privileged context designs without costly post-training runs, and detect configurations whose performance ceiling is too low to be worth pursuing.
