---
layout: post
title: "Self Rewarding Self Improving"
date: 2025-5-12 09:50:53 +1100
categories: research ai
author: Toby Simonds
description: "We demonstrate that large language models can autonomously improve by judging their own solutions without reference answers, creating a complete self-learning loop that enhances performance beyond existing benchmarks. "
external_link: "https://arxiv.org/abs/2505.08827"

---

## Introduction

For RL to work, we need sufficiently many questions at the correct difficulty level. The
issue is that most difficult problems are very sparse and lack training data. Traditional methods to get around this have involved  


LADDER
solves this by getting the LLM to generate synthetic easier variants of the initial question
in a treelike structure, allowing the model to use RL to bootstrap itself toward solving
harder problems

