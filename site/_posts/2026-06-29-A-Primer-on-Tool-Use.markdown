---
layout: post
title: "A Primer on Tool Use"
date: 2026-06-29 09:00:00 +0200
permalink: /research/primer-on-tool-use/
author: Tufa Labs
description: "A literature-ordered primer on how tool use is trained into language models—from self-supervised call insertion and supervised fine-tuning on synthetic trajectories to reinforcement learning with verifiable rewards."
sidenotes: true
math: true
---

<style>
.post-content table td, .post-content table th { white-space: normal; }

.tooltrain-pipeline { display:flex; flex-wrap:wrap; align-items:stretch; justify-content:center; gap:0.5rem; margin:2rem 0 0.4rem; }
.ttp-stage { display:flex; flex-direction:column; justify-content:center; gap:0.25rem; border-radius:12px; padding:0.85rem 1rem; min-width:9rem; max-width:13rem; text-align:center; border:1px solid rgba(0,0,0,0.08); }
.ttp-stage strong { font-size:0.95rem; color:#1F4E79; }
.ttp-stage span { font-size:0.78rem; color:#6B7280; line-height:1.3; }
.ttp-stage--sft { background:#f1f1f2; }
.ttp-stage--pref { background:rgba(31,78,121,0.10); }
.ttp-stage--rl { background:rgba(181,101,29,0.16); }
.ttp-arrow { align-self:center; color:#6B7280; font-size:1.4rem; }
.ttp-loop { text-align:center; color:#6B7280; font-size:0.82rem; margin:0.2rem 0 2rem; }

.tooltrain-fig { margin:2rem auto; }
.tooltrain-fig .ttm-row { display:flex; flex-wrap:wrap; justify-content:center; gap:4px; margin-bottom:1rem; }
.ttm-cell { flex:1 1 7rem; min-width:6rem; border-radius:8px; padding:0.7rem 0.5rem; text-align:center; font-size:0.82rem; line-height:1.35; }
.ttm-cell em { font-style:italic; }
.ttm-emit { background:rgba(31,78,121,0.12); border:1px solid rgba(31,78,121,0.55); color:#1F4E79; }
.ttm-inj { background:rgba(178,58,72,0.13); border:1px dashed #B23A48; color:#B23A48; }
.ttm-legend { display:flex; flex-direction:column; gap:0.4rem; align-items:flex-start; font-size:0.8rem; color:#6B7280; max-width:92%; margin:0 auto; }
.ttm-legend .ttm-swatch { display:inline-block; width:0.8rem; height:0.8rem; border-radius:3px; margin-right:0.4rem; vertical-align:middle; }
.ttm-swatch--emit { background:rgba(31,78,121,0.12); border:1px solid rgba(31,78,121,0.55); }
.ttm-swatch--inj { background:rgba(178,58,72,0.13); border:1px dashed #B23A48; }
</style>

*How tool use is **instilled** into a model—from self-supervised call insertion and supervised fine-tuning on synthetic trajectories to reinforcement learning with verifiable rewards—with the literature ordered by citation count and prioritized by the methods that proved durable.*

A pretrained language model is a closed system: its only output is a distribution over a vocabulary, and prompting alone makes it an unreliable tool user—it selects the wrong function, malforms arguments, and cannot recover when a call fails. Making a model *good* at tools is therefore a training problem. The defining fact of that problem is structural: a tool's return is computed by an external runtime and injected into the context, so the model must learn to *condition* on tokens it did not generate. Those tokens are off-policy, which is what forces every training recipe below to treat them specially. The field has converged on a pipeline—self-supervised or supervised *cold-start* to install the call format and the think–act–observe rhythm, then reinforcement learning with verifiable rewards (RLVR) to push past the imitation ceiling.{% sidenote DeepSeek-R1 %}DeepSeek-AI. "DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning." [arXiv:2501.12948](https://arxiv.org/abs/2501.12948) (2025).{% endsidenote %} This primer develops that pipeline, ordering the literature by citation count and prioritizing the papers and posts that introduced methods which became, or are becoming, standard. Where a heavily cited paper does not contribute a tool-training method (e.g. Tree of Thoughts, RAG, vanilla chain-of-thought, HuggingGPT), it is deliberately omitted.

<div class="tooltrain-pipeline">
  <div class="ttp-stage ttp-stage--sft">
    <strong>Cold-start SFT</strong>
    <span>call format + think–act–observe</span>
  </div>
  <span class="ttp-arrow">&rarr;</span>
  <div class="ttp-stage ttp-stage--pref">
    <strong>Preference</strong>
    <span>DPO on when/which-tool choices</span>
  </div>
  <span class="ttp-arrow">&rarr;</span>
  <div class="ttp-stage ttp-stage--rl">
    <strong>RL with verifiable rewards</strong>
    <span>outcome / format / correctness</span>
  </div>
</div>
<div class="ttp-loop">&#8635;&nbsp; iterate: synthesize &rarr; verify &rarr; retrain</div>

## A Map of the Literature

The table below ranks the work this primer treats by citation count. The intent is to make the prioritization explicit: discussion weight tracks influence, tempered by whether a paper actually introduced a method that trains tool use. Counts are Semantic Scholar figures retrieved mid-2026 and are approximate—they drift upward weekly, and the 2025 reinforcement-learning-for-tool-use papers are still early on their citation curves, so their rank understates their methodological centrality. A "≈" marks an order-of-magnitude estimate.

| Work | Year | Cites | Why it matters for *training* tool use |
| --- | --- | ---: | --- |
| DeepSeek-R1 | 2025 | 5,274 | RLVR recipe; pure-RL reasoning; the template every tool-RL paper extends |
| ReAct | 2022 | 5,250 | think–act–observe trajectories—the format SFT teaches |
| DPO | 2023 | 4,811 | preference optimization without a reward model; shapes when/which-tool choices |
| Toolformer | 2023 | 2,495 | self-supervised: keep a call if it lowers downstream loss |
| GRPO / DeepSeekMath | 2024 | ≈2,000 | critic-free group-relative RL; the workhorse of tool-RL |
| SWE-bench | 2024 | ≈1,500 | executable, test-verified training/eval environment |
| Let's Verify Step by Step | 2023 | ≈1,200 | process supervision; verifiers as training signal |
| ToolLLM / ToolBench | 2023 | 1,030 | instruction-tuning at 16k-API scale; DFSDT trajectory synthesis |
| Gorilla | 2023 | ≈1,000 | retriever-aware fine-tuning; combats API drift |
| STaR | 2022 | ≈700 | bootstrap rationales by keeping correct ones (RFT precursor) |
| Math-Shepherd | 2024 | ≈450 | automatic per-step reward labels for PRMs |
| ToRA | 2024 | ≈400 | tool-integrated reasoning SFT for math |
| PPO | 2017 | (classic) | the actor–critic baseline all variants modify |
| CodeAct | 2024 | 292 | code as the unified action space to train on |
| DAPO | 2025 | ≈300 | long-trajectory GRPO fixes (clip-higher, dynamic sampling) |
| Search-R1 | 2025 | ≈250 | RLVR for search; "retrieved-token masking" |
| APIGen / xLAM | 2024 | ≈200 | verifiable synthesis of function-calling data |
| τ-bench | 2024 | ≈200 | tool–agent–user evaluation under policies |
| ToolRL | 2025 | ≈120 | systematic reward design for tool use |
| ReTool | 2025 | ≈120 | code-interpreter RL; emergent self-correction |
| ToolACE | 2024 | ≈110 | self-evolving API pool + dual verification |
| GSPO | 2025 | ≈90 | sequence-level ratios; stabilizes MoE RL |
| ToRL | 2025 | ≈80 | tool-integrated RL straight from a base model |
| ARTIST | 2025 | ≈70 | agentic RL; learns when/which tool, no step labels |
| SimpleTIR | 2025 | ≈50 | void-turn filtering for stable multi-turn RL |
| ARPO | 2025 | ≈40 | branch rollouts at post-tool entropy spikes |

Newer RL-for-tool-use papers rank low only because their citation curves are young. Two high-quality engineering write-ups recur as references rather than papers: Anthropic's *Building Effective Agents*, which argues for the simplest workflow that works before reaching for an autonomous loop,{% sidenote anthropic-agents %}Anthropic. ["Building Effective Agents"](https://www.anthropic.com/engineering/building-effective-agents) (2024).{% endsidenote %} and the *Model Context Protocol*, which standardizes the tool interface a trained model calls.{% sidenote MCP %}Anthropic. ["Introducing the Model Context Protocol"](https://www.anthropic.com/news/model-context-protocol) (2024).{% endsidenote %}

## What the Model Must Learn

A *tool* is an external function the model invokes mid-generation, advertised by a name, a natural-language description, and a typed JSON schema $$\sigma:\mathcal{A}_\tau\to\mathcal{O}_\tau$$ that the call must satisfy. Training has to install four competencies, not one: *when* to call (versus answering directly or abstaining), *which* tool to select, *how* to format valid arguments, and how to *condition* on the returned observation to continue. The trajectory the model learns to produce interleaves emitted units $u_t$ (reasoning and call tokens) with injected observations $\mathbf{o}_i=\tau_i(\mathbf{a}_i)$, and the likelihood factorizes over *emitted units only*:

$$
p_\theta(u_{1:T}\mid x)=\prod_{t}\pi_\theta\!\big(u_t\mid x,u_{<t},\mathbf{o}_{<t}\big),\qquad \mathbf{o}_i=\tau_i(\mathbf{a}_i),
$$

where observation tokens enter as fixed conditioning, never as factors. This single asymmetry—made concrete in the masking diagram below—is why both the supervised loss and the RL update must mask the injected tokens, and it is the thread connecting every method here.

## Foundational Paradigms: Making a Call the Training Target

The first wave (2022–2024) established *what* to train a model to emit: not a final string, but a structured call, embedded in a reasoning trajectory. These are the most-cited works in the area and the substrate everything later assumes.

**ReAct (≈5,250).**{% sidenote ReAct %}S. Yao et al. "ReAct: Synergizing Reasoning and Acting in Language Models." [arXiv:2210.03629](https://arxiv.org/abs/2210.03629), ICLR 2023.{% endsidenote %} The most-cited paradigm interleaves reasoning traces with actions: thoughts guide which tool to call, observations update the thoughts. Its lasting contribution to *training* is the trajectory format itself—the think–act–observe transcript that supervised fine-tuning later imitates and that RL later optimizes. ReAct also showed the cheapest data trick in the field: prompt a large model to produce successful trajectories, then fine-tune a smaller one on them.

**Toolformer (≈2,495).**{% sidenote Toolformer %}T. Schick et al. "Toolformer: Language Models Can Teach Themselves to Use Tools." [arXiv:2302.04761](https://arxiv.org/abs/2302.04761), NeurIPS 2023.{% endsidenote %} The cleanest self-supervised signal for *when* a tool helps. A candidate API call inserted before position $i$ is kept only if conditioning on its executed result lowers the loss on subsequent tokens by a margin $\eta$, i.e. $L_i^{+}-L_i^{-}<-\eta$. No human labels, no reward model: usefulness is measured directly as perplexity reduction. This keep-if-the-loss-drops criterion remains the conceptual definition of a worthwhile call.

**ToolLLM / ToolBench (≈1,030) and Gorilla (≈1,000).**{% sidenote ToolLLM %}Y. Qin et al. "ToolLLM: Facilitating LLMs to Master 16000+ Real-world APIs." [arXiv:2307.16789](https://arxiv.org/abs/2307.16789), ICLR 2024.{% endsidenote %}{% sidenote Gorilla %}S. G. Patil et al. "Gorilla: Large Language Model Connected with Massive APIs." [arXiv:2305.15334](https://arxiv.org/abs/2305.15334) (2023).{% endsidenote %} The move from a handful of tools to realistic scale. ToolLLM builds an instruction-tuning dataset over 16k real APIs by prompting a teacher model and searching call sequences with a depth-first decision tree (DFSDT), then trains on the successful traces; it also pairs the model with an API retriever so *selection* scales. Gorilla fine-tunes with retriever-awareness so the model stays correct as documentation changes—the first serious treatment of API drift as a training concern.

**CodeAct (≈292).**{% sidenote CodeAct %}X. Wang et al. "Executable Code Actions Elicit Better LLM Agents" (CodeAct). [arXiv:2402.01030](https://arxiv.org/abs/2402.01030), ICML 2024.{% endsidenote %} Consolidates the action space into executable Python rather than one-off JSON: a single action can compose tools, loop, branch, and self-debug from interpreter errors. Across 17 models this lifted success by up to 20%. For training, its contribution is the `CodeActInstruct` dataset and the demonstration that code-shaped actions are both more expressive and denser in pretraining, which makes them easier to learn.

## Supervised Fine-Tuning and the Data Problem

Given trajectories, SFT maximizes the conditional log-likelihood under the factorization above *with the tool-return tokens masked out of the loss*, so the model learns to condition on observations rather than to generate them:

$$
\mathcal{L}_{\text{SFT}}(\theta)=-\sum_i\sum_t \mathbb{1}\big[u_t^{(i)}\text{ model-emitted}\big]\,\log\pi_\theta\!\big(u_t^{(i)}\mid x^{(i)},u_{<t}^{(i)},\mathbf{o}_{<t}^{(i)}\big).
$$

The binding constraint is data: real human–tool logs are rare, and synthetic trajectories require instantiating a configured environment per task and running multi-turn rollouts. The field's answer is a progression of synthesis pipelines of increasing fidelity. ToolLLM supplies teacher-distilled traces with tree search; *APIGen* passes every generated sample through format, execution, and semantic checks, yielding the data behind the xLAM "large action models," with which a 7B model surpasses several GPT-4 variants on the Berkeley Function-Calling Leaderboard;{% sidenote APIGen %}Z. Liu et al. "APIGen: Automated Pipeline for Verifiable and Diverse Function-Calling Datasets" (xLAM). [arXiv:2406.18518](https://arxiv.org/abs/2406.18518), NeurIPS 2024.{% endsidenote %} *ToolACE* evolves a diverse API pool and filters dialogues with combined rule- and model-based verification.{% sidenote ToolACE %}W. Liu et al. "ToolACE: Winning the Points of LLM Function Calling." [arXiv:2409.00920](https://arxiv.org/abs/2409.00920) (2024).{% endsidenote %} Two competencies beyond format are trained explicitly: tool-integrated *reasoning* interleaved with calls (ToRA for math,{% sidenote ToRA %}Z. Gou et al. "ToRA: A Tool-Integrated Reasoning Agent for Mathematical Problem Solving." [arXiv:2309.17452](https://arxiv.org/abs/2309.17452), ICLR 2024.{% endsidenote %} CodeActInstruct for code), and *abstention*—deciding *not* to call—taught by augmenting data with irrelevant-tool and "no-call" examples. A common bridge to RL is rejection-sampling fine-tuning (RFT/STaR): sample many trajectories, keep those that pass an automatic check, and fine-tune on them.{% sidenote STaR %}E. Zelikman et al. "STaR: Bootstrapping Reasoning with Reasoning." [arXiv:2203.14465](https://arxiv.org/abs/2203.14465), NeurIPS 2022.{% endsidenote %}

| Pipeline | Synthesis method | Result |
| --- | --- | --- |
| ToolBench (ToolLLM) | teacher + DFSDT search over 16k APIs | multi-tool trajectories; API retriever |
| APIGen → xLAM | synthesize + format/execution/semantic checks | 7B beats GPT-4 variants on BFCL |
| ToolACE | self-evolving API pool + dual verification | ToolACE-8B ≈91% on BFCL-v1 |
| ToRA | tool-integrated reasoning traces (math) | strong GSM8K/MATH at small scale |

SFT is efficient for format but inherits the demonstrations' ceiling: it cannot teach recovery from mistakes the demonstrator never made, suffers exposure bias, and is brittle to unseen schemas and API drift. That ceiling is what motivates reinforcement learning.

## The Reinforcement-Learning Turn

RL optimizes *outcomes* rather than imitation, in a partially observed setting where the agent acts from a history, the environment returns an observation, and a reward scores the trajectory. The dominant signal is *verifiable rewards* (RLVR): an automatic checker—tests pass, answer matches, environment reaches a target—which is cheap and hard to hack. DeepSeek-R1 (≈5,274){% sidenoteref DeepSeek-R1 %} is the template: it showed that reasoning behaviors can be incentivized by RL alone, and its cold-start-then-RL pipeline is the one every tool-RL paper now extends.

**Algorithms.** The policy-gradient methods share one shape—maximize an advantage-weighted log-likelihood—and differ in how they estimate the advantage and constrain the step. *PPO*{% sidenote PPO %}J. Schulman et al. "Proximal Policy Optimization Algorithms." [arXiv:1707.06347](https://arxiv.org/abs/1707.06347) (2017).{% endsidenote %} is the actor–critic baseline with a learned value network. *GRPO* (DeepSeekMath, ≈2,000){% sidenote GRPO %}Z. Shao et al. "DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models" (GRPO). [arXiv:2402.03300](https://arxiv.org/abs/2402.03300) (2024).{% endsidenote %} removes the critic, sampling a group of $G$ responses per prompt and using their reward statistics as the baseline:

$$
\hat A_i=\frac{r_i-\operatorname{mean}(r_{1:G})}{\operatorname{std}(r_{1:G})},\qquad
\mathcal{J}_{\text{GRPO}}=\mathbb{E}\!\left[\tfrac{1}{G}\textstyle\sum_i \tfrac{1}{|o_i|}\sum_t \min\!\big(r_{i,t}\hat A_i,\ \operatorname{clip}(r_{i,t},1{\pm}\epsilon)\hat A_i\big)-\beta\,\mathbb{D}_{\text{KL}}\right],
$$

with the group-relative advantage shared across all tokens of a response. GRPO is the default for tool-RL but carries pathologies the next variants target: *DAPO*{% sidenote DAPO %}Q. Yu et al. "DAPO: An Open-Source LLM Reinforcement Learning System at Scale." [arXiv:2503.14476](https://arxiv.org/abs/2503.14476) (2025).{% endsidenote %} decouples the clip ($\epsilon_{\text{high}}>\epsilon_{\text{low}}$) to avert entropy collapse, aggregates loss at the token level, and discards zero-advantage groups; *GSPO*{% sidenote GSPO %}C. Zheng et al. "Group Sequence Policy Optimization (GSPO)." [arXiv:2507.18071](https://arxiv.org/abs/2507.18071) (2025).{% endsidenote %} swaps per-token ratios for a length-normalized *sequence* ratio, removing the high-variance terms that destabilize mixture-of-experts RL; *RLOO* keeps an unbiased leave-one-out REINFORCE baseline. When the signal is a *preference* rather than a verifiable reward, *DPO* (≈4,811){% sidenote DPO %}R. Rafailov et al. "Direct Preference Optimization: Your Language Model is Secretly a Reward Model." [arXiv:2305.18290](https://arxiv.org/abs/2305.18290), NeurIPS 2023.{% endsidenote %} optimizes the policy directly against a reference on chosen/rejected pairs, with no reward model—handy for shaping when-/which-tool choices that lack a crisp verifier.

## Reinforcement Learning *for* Tool Use

Applying RLVR to tools surfaces the training problem that the factorization predicts. Because tool returns are external, off-policy tokens, they must be *masked* from both the loss and the importance ratio; Search-R1 names this "retrieved-token masking."{% sidenote SearchR1 %}B. Jin et al. "Search-R1: Training LLMs to Reason and Leverage Search Engines with Reinforcement Learning." [arXiv:2503.09516](https://arxiv.org/abs/2503.09516) (2025).{% endsidenote %} Left unmasked, their injection causes a distribution shift that, compounded over turns, drives the policy toward low-probability tokens and produces catastrophic gradient-norm explosions and reward collapse—the central obstacle to multi-turn tool-integrated reasoning.

<figure class="post-figure tooltrain-fig">
  <div class="ttm-row">
    <div class="ttm-cell ttm-emit">prompt<br><em>x</em></div>
    <div class="ttm-cell ttm-emit">reasoning<br><em>u&lt;t</em></div>
    <div class="ttm-cell ttm-emit">call<br><em>c = (τ, a)</em></div>
    <div class="ttm-cell ttm-inj">observation<br><em>o = τ(a)</em></div>
    <div class="ttm-cell ttm-emit">reasoning<br><em>u&gt;t</em></div>
    <div class="ttm-cell ttm-emit">answer<br><em>y</em></div>
  </div>
  <div class="ttm-legend">
    <span><span class="ttm-swatch ttm-swatch--emit"></span> model-emitted (on-policy): enters the product over π<sub>θ</sub></span>
    <span><span class="ttm-swatch ttm-swatch--inj"></span> injected by environment (off-policy): masked from loss &amp; importance ratio</span>
  </div>
  <figcaption><strong>The one fact that dictates how tool use is trained.</strong> Emitted units (blue) are sampled from the policy and enter the product in the factorization above; the observation (red, dashed) is computed by the environment, not sampled. Because those tokens are off-policy, they must be masked from both the SFT loss and the RL importance ratio. Leaving them in drives the distribution shift and gradient-norm explosions that destabilize multi-turn training.</figcaption>
</figure>

**The recipes.** A cluster of 2025 papers established RLVR for tools across two tool families. *Search-R1*{% sidenoteref SearchR1 %} trains a model to interleave reasoning with live search under masked retrieval and an outcome-only reward, improving 41% over RAG. *ReTool*{% sidenote ReTool %}J. Feng et al. "ReTool: Reinforcement Learning for Strategic Tool Use in LLMs." [arXiv:2504.11536](https://arxiv.org/abs/2504.11536) (2025).{% endsidenote %} and *ToRL*{% sidenote ToRL %}X. Li et al. "ToRL: Scaling Tool-Integrated RL." [arXiv:2503.23383](https://arxiv.org/abs/2503.23383) (2025).{% endsidenote %} do the same for a code interpreter—ReTool from a cold-start SFT, ToRL straight from a base model—with ReTool reporting emergent code self-correction. *SimpleTIR*{% sidenote SimpleTIR %}Z. Xue et al. "SimpleTIR: End-to-End Reinforcement Learning for Multi-Turn Tool-Integrated Reasoning." [arXiv:2509.02479](https://arxiv.org/abs/2509.02479) (2025).{% endsidenote %} diagnoses the multi-turn instability directly and stabilizes "zero" RL from base by filtering trajectories with "void turns" (yielding neither a code block nor an answer) out of the policy update while keeping them in advantage estimation to stay unbiased. *ARTIST*{% sidenote ARTIST %}J. Singh et al. "Agentic Reasoning and Tool Integration for LLMs via Reinforcement Learning" (ARTIST). [arXiv:2505.01441](https://arxiv.org/abs/2505.01441) (2025).{% endsidenote %} learns when and which tool to call with no step-level supervision, and *ARPO*{% sidenote ARPO %}Lu et al. "Agentic Reinforced Policy Optimization (ARPO)." [arXiv:2507.19849](https://arxiv.org/abs/2507.19849) (2025).{% endsidenote %} exploits a useful empirical regularity—token entropy spikes right after a tool returns—by branching rollouts at those high-uncertainty points to explore tool-use decisions.

| System | Tool | Algorithm | Training contribution |
| --- | --- | --- | --- |
| Search-R1 | search engine | GRPO/PPO, masked retrieval | masking of injected tokens; outcome-only reward suffices |
| ReTool | code interpreter | SFT → GRPO | emergent self-correction from interpreter errors |
| ToRL | code interpreter | GRPO from base | tool-integrated RL without an SFT stage |
| ToolRL | functions | GRPO + reward study | format + correctness + outcome reward decomposition |
| ARTIST | functions/search | GRPO | learns when/which tool, no step labels |
| SimpleTIR | code interpreter | GRPO + void-turn filter | stabilizes multi-turn "zero" RL |
| ARPO | functions/search | entropy-branched GRPO | branches at post-tool uncertainty |

**Reward design and credit assignment.** Outcome-only rewards are sparse for multi-step tool use, so practitioners decompose them. *ToolRL*{% sidenote ToolRL %}C. Qu et al. "ToolRL: Reward is All Tool Learning Needs." [arXiv:2504.13958](https://arxiv.org/abs/2504.13958) (2025).{% endsidenote %}—the first systematic study of reward design for general tool use—finds a fine-grained split into a *format* reward (well-formed calls), a *correctness* reward (right tool, right parameters), and the final *outcome* more stable than outcome alone, with recurring penalties for malformed calls and redundant ones. Denser still is process supervision: an *outcome reward model* scores a whole trajectory, whereas a *process reward model* (PRM) scores each step. *Let's Verify Step by Step*{% sidenote LetsVerify %}H. Lightman et al. "Let's Verify Step by Step." [arXiv:2305.20050](https://arxiv.org/abs/2305.20050) (2023).{% endsidenote %} showed process supervision beats outcome supervision on hard math, and *Math-Shepherd*{% sidenote MathShepherd %}P. Wang et al. "Math-Shepherd: Verify and Reinforce LLMs Step-by-Step without Human Annotations." [arXiv:2312.08935](https://arxiv.org/abs/2312.08935), ACL 2024.{% endsidenote %} removed its need for human labels by estimating, via rollouts, the probability that a step leads to a correct answer. The same verifier asymmetry that motivates RLVR—checking is far cheaper than generating—is what makes these signals cheap to produce: under repeated sampling even a low per-attempt success rate yields high coverage ($\text{pass@}n=1-(1-p)^n$), so a verifier that keeps the passing sample converts sampling into accuracy.

**Multi-turn credit and the long horizon.** A single trajectory-level reward in the GRPO objective treats the whole episode as one bandit arm, so a fatal early call is credited like the steps around it. Turn-level reward design assigns advantage per decision—rewarding an informative call, penalizing a redundant one—and measurably improves multi-turn tool use. The pressure comes from compounding error: with $N$ steps each succeeding with probability $p$, success decays as $p^{N}$, so the levers a training recipe must install are *error correction*—observable failure plus retry raises the effective per-step rate to $1-(1-p)^r$—and *decomposition* into checkpointed, verifiable sub-tasks. Infrastructure matters here: multi-turn rollouts span dozens of calls and tens of thousands of tokens, so frameworks such as *verl* decouple rollout generation from gradient steps and provide the tool-execution sandboxes the loop needs.{% sidenote verl %}G. Sheng et al. "HybridFlow: A Flexible and Efficient RLHF Framework" (verl). [arXiv:2409.19256](https://arxiv.org/abs/2409.19256) (2024).{% endsidenote %}

## What You Train Against: Environments and Evaluation

RL needs executable environments and verifiers, and the quality of the training signal is bounded by them. *SWE-bench*{% sidenote SWEbench %}C. Jimenez et al. "SWE-bench: Can Language Models Resolve Real-World GitHub Issues?" [arXiv:2310.06770](https://arxiv.org/abs/2310.06770), ICLR 2024.{% endsidenote %} resolves real GitHub issues against the repository's own tests, giving a hard, execution-verified reward—now a standard target for tool-using coding agents. *τ-bench*{% sidenote taubench %}S. Yao et al. "τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains." [arXiv:2406.12045](https://arxiv.org/abs/2406.12045) (2024).{% endsidenote %} measures tool–agent–user interaction under policy constraints, and the Berkeley Function-Calling Leaderboard scores serial, parallel, multi-turn, and abstention behavior with an AST metric that needs no execution.{% sidenote BFCL %}S. G. Patil et al. "The Berkeley Function-Calling Leaderboard (BFCL)." ICML 2025.{% endsidenote %} Two cautions carry directly into training: execution-verified rewards are gameable—a non-trivial fraction of "solved" SWE-bench instances pass by exploiting the harness rather than fixing the bug—and, per SWE-agent, the exact command set and feedback format the model is trained against (the agent–computer interface) can matter as much as the model itself.

## Open Problems in Training Tool Use

**Data scarcity remains the binding constraint.** Verifiable, multi-turn, environment-grounded trajectories are expensive; synthesis pipelines close part of the gap, but coverage of rare tools, long horizons, and recovery behavior is still thin.

**Multi-turn RL is unstable.** The injected-token distribution shift, entropy and advantage collapse, KL drift, and reward hacking of the checker all bite hardest in the regime that matters most. Masking, void-turn filtering, decoupled clipping, and turn-level credit are partial fixes, not a settled recipe.

**Calibrating *when* to call is unsolved.** Reward terms penalize redundancy and irrelevance-augmented data teaches abstention, but the underlying decision—a value-of-information trade-off where a call is worth its latency and tokens only if it is expected to improve the answer enough—is still learned imperfectly. Toolformer's keep-if-the-loss-drops criterion is the one crisp instance of this calculus.

**Drift and gameable evaluation.** Real APIs change after training, so frozen tool knowledge goes stale; and the execution-verified benchmarks used to measure progress are themselves gameable, so reported competence can overstate the trained skill.

## Closing

Making a model good at tools is, end to end, a data-and-credit-assignment problem organized around one structural fact: the model must learn to act on tokens it did not generate. The field's answer is a pipeline—install the call format with self-supervised or supervised cold-start (Toolformer, ReAct, ToolLLM, CodeAct), synthesize and verify trajectories to beat the scarcity of real logs (APIGen, ToolACE, ToRA), then optimize outcomes with verifiable rewards while masking the injected tokens and decomposing the reward (DeepSeek-R1's recipe via GRPO, specialized by Search-R1, ReTool, ToolRL, SimpleTIR). Citation counts still concentrate in the foundational and RL-machinery papers, but the methods that will define the next year of tool-use training are the young, lightly cited 2025 recipes at the bottom of the map.

---

## Citation

Please cite this work as:

Tufa Labs, "A Primer on Tool Use," Tufa Labs Research, Jun 2026.

```bibtex
@article{tufalabs2026tooluseprimer,
  author = {Tufa Labs},
  title = {A Primer on Tool Use},
  journal = {Tufa Labs Research},
  year = {2026},
  note = {https://tufalabs.ai/research/primer-on-tool-use/},
}
```
