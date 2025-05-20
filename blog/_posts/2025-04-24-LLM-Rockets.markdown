---
layout: post
title: "LLMs for Engineering: Teaching Models to Design High Powered Rockets"
date: 2025-4-24 09:50:53 +1100
categories: research ai
author: Toby Simonds
description: "We demonstrate that while current SOTA language models struggle with iterative self-improvement in rocket engineering challenges, augmenting them with reinforcement learning unlocks superhuman design capabilities that could revolutionize physical engineering domains. "
external_link: "https://arxiv.org/abs/2504.19394"

---

## Introduction

For RL to work, we need sufficiently many questions at the correct difficulty level. The
issue is that most difficult problems are very sparse and lack training data. Traditional methods to get around this have involved  


LADDER
solves this by getting the LLM to generate synthetic easier variants of the initial question
in a treelike structure, allowing the model to use RL to bootstrap itself toward solving
harder problems

