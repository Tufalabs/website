---
layout: post
title: "Duck Harness: Winning Solution for ARC-AGI-3 Milestone 1"
date: 2026-07-01 09:00:00 +1100
permalink: /research/duck-harness/
author: Harold Bessis, Jeroen Cottaar, Isaiah Pressman, Andries Smit, Michal Tešnar, Stefano Viel
description: "We open-source the duck harness, our agent for the ARC-AGI-3 challenge on Kaggle, and share a technical overview and results comparing it to other published approaches."
---

With this post, we are open-sourcing our agent harness for the ARC-AGI-3 challenge on Kaggle. We summarize the design, explain the behavior of the agent, and provide a detailed technical overview (LINK) linking the Kaggle resources needed to reproduce our results. At the same time, we also release the [code on GitHub](https://github.com/Tufalabs/duck-harness) and compare the results to other published approaches.

Accompanying this post are two episodes on the Machine Learning Street Talk Podcast (LINK): one episode covers the technical details of our harness, and another goes deeper into broader topics around ARC-AGI-3.

## ARC-AGI-3

[ARC-AGI-3](https://arcprize.org/media/ARC_AGI_3_Technical_Report.pdf) is an abstract reasoning challenge designed to highlight what humans can do that machines still cannot — general continual learning under changing conditions and unclear goals. The benchmark consists of games, represented as sequences of 64x64 grids — an example of which you can find in the image below ([source](https://arcprize.org/replay/64e24a93-5f6f-4d9d-8e12-d3abe6494cf7)). The agent selects one of the possible actions to produce subsequent frames, which eventually leads to completing the levels. The goal of the puzzle is never explicitly stated and has to be inferred, tested, and verified by the agent. The solution path also changes in every level, so the strategy must adapt over time.

<img src="{{ '/assets/posts/duck-harness/game-example.gif' | relative_url }}" alt="ARC-AGI-3 game example" width="50%" />

Humans can solve these games, while current frontier reasoning models struggle. The optimized metric is not time but action efficiency: the agent must finish each puzzle in as few actions as possible, and the final score compares this against the median human baseline. This metric disincentivizes brute-forcing, which would score close to 0%.

Here at Tufa Labs, we believe this challenge gets to the core of what human reasoning is. Therefore, we see ARC-AGI-3 as a great challenge to build agents for and are convinced that working on the challenge will lead to interesting future research.

## Large Language Models

The current top-scoring solutions on the public [leaderboard](https://arcprize.org/leaderboard/community) (evaluated with unlimited compute on public games) are based on LLM coding agents. Notably, [Symbolica's solution](https://www.symbolica.ai/blog/arc-agi-3) achieved 36.08% within the first day after the release of ARC-AGI-3, using a recursive agentic orchestration system that interacts with the game through code. Even more convincingly, the [RGB Agent](https://blog.alexisfox.dev/arcagi3) built on [OpenCode](https://opencode.ai/) was the first agent to show near-human action efficiency on the 3 preview games. Additional prompt optimization to construct [executable world models](https://arxiv.org/pdf/2605.05138) then brought performance up to 58.12%.

These promising results motivated us to construct our solution around coding/reasoning models. Similarly to the previous solutions, we encode the game as a programming problem, which lets us leverage the coding and reasoning abilities of pre-trained LLMs. Because evaluation on the semi-private/private test set on Kaggle is constrained to a single GPU, we are restricted to use small open-source models and small token throughput. Therefore, we focus on a simple harness architecture: a minimal coding harness with a Python interpreter that interacts with the game through a Read-Eval-Print Loop (REPL) with game perception through images of the grid.

## Solution Architecture

In our solution, the LLM works in a REPL where all game observations are encoded as Python variables. It can inspect these variables with tool calls, evaluate pre-built helper functions, and take actions in the game environment. The actions are executed in the ARC-AGI-3 environment, which then updates the Python sandbox with fresh variables. The model uses both image and text representations of the grid and the context is kept short by automatically evicting the oldest messages. For more detailed information, we refer to the technical write-up on Kaggle (LINK).

![Duck harness architecture]({{ '/assets/posts/duck-harness/architecture.png' | relative_url }})

## Results

The agent harness is built around [Qwen 3.6 27B FP8](https://huggingface.co/vrfai/Qwen3.6-27B-FP8). We run it on the 25 public games with 20 tries for each game. Our mean score across all public games is 1.6002 +/- 0.4475. We include the results directory on [GitHub](https://github.com/Tufalabs/duck-harness), including the automatically generated [diagnostics.html](https://github.com/Tufalabs/duck-harness/blob/main/example-run/diagnostics.html) that compares the runs in detail. The heatmap below shows the performance of the agent across games and runs, with attempts on the x-axis and games on the y-axis. The performance is rather uneven, with some games being solved consistently for over 40% of the levels, while for some not even the first level is solved.

<img src="{{ '/assets/posts/duck-harness/heatmap.png' | relative_url }}" alt="Per-game, per-run levels heatmap" width="75%" />

We also evaluate our harness with GPT 5.4 to compare the performance against the [Executable World Models](https://arxiv.org/pdf/2605.05138) agent. In the figure below, the x-axis shows the cost per game and the y-axis the ARC score. For comparability, we display the best score of two tries for each game. We can see that the two harnesses solve a similar set of games, while the duck harness is an order of magnitude cheaper on each game. This hints at the solvability of a game being dependent on model capability, while the cost is mostly dictated by the harness.

![Cost per game versus ARC score]({{ '/assets/posts/duck-harness/cost-vs-score.png' | relative_url }})

We present the duck harness for pre-trained LLMs and show first signs of life on the challenge. By representing the task as a coding problem, we can exploit the model's problem-solving abilities. However, we are ultimately limited by the constraints of the Kaggle environment. The harness can still benefit from many improvements, especially in context management and perception. With this, we are inviting the community to improve on our work. We will continue to work on the problem until the end of the competition and are looking forward to seeing you on the leaderboard!
