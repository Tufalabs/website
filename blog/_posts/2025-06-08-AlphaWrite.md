---
layout: post
title:  "AlphaWrite: Inference time compute Scaling for Writting"
date:   2025-06-6 09:50:53 +1100
categories: jekyll update
author: Toby Simonds
description: "We introduce AlphaWrite, an inference-time scaling method for creative writing that uses evolutionary generation and ELO-based ranking to improve story quality."
---


Large language models have demonstrated remarkable improvements in performance through increased inference-time compute on quantitative reasoning tasks, particularly in mathematics and coding. However, the creative domain—where outputs are inherently highly subjective and difficult to evaluate—has seen limited exploration of systematic approaches to scale inference-time compute effectively. 

In this work, we introduce Alpha Writing, a novel framework for scaling inference-time compute in creative text generation. Inspired by AlphaEvolve and other evolutionary algorithms, our approach combines iterative story generation with ELO-based evaluation to systematically improve narrative quality. Rather than relying on single-shot generation or simple resampling, Alpha Writing creates a dynamic ecosystem where stories compete, evolve, and improve through multiple generations.

Our method addresses a critical gap in the field: while we can easily scale compute for tasks with clear correctness criteria, creative domains have lacked principled approaches for leveraging additional inference resources. By treating story generation as an evolutionary process guided by pairwise preferences, we demonstrate that creative output quality can be systematically improved through increased compute allocation.

# Methodology

![TTL Bar Chart](/blog/assets/images/AlphaWriteProcess.png)

## Overview

Alpha Writing employs an evolutionary approach to improve story quality through iterative generation and selection. The process consists of three main stages: (1) diverse initial story generation, (2) pairwise comparison using ELO rankings, and (3) evolutionary refinement of top-performing stories. (2) and (3) are repeated for multiple generations to progressively enhance narrative quality.

## Initial Story Generation

To establish a diverse starting population, we generate a large corpus of initial stories with systematic variation. Each story is generated with two randomized parameters:

- **Author style**: The model is prompted to write in the style of different authors
- **Theme**: Each generation focuses on a different narrative theme

This approach ensures broad exploration of the creative space and prevents early convergence on a single narrative style or structure.

## Judging and ELO Ranking

Stories are evaluated through pairwise comparisons using an LLM judge. The judge is provided with:

- A detailed evaluation rubric focusing on narrative quality metrics
- Two stories to compare
- Instructions to select the superior story

The rubric improves consistency in judgments by providing clear evaluation criteria. Based on these pairwise comparisons, we update ELO ratings for each story, creating a dynamic ranking system that captures relative quality differences.

## Story Evolution

After establishing rankings, we:

1. Select the top-performing stories from the current generation
2. Prompt the LLM to generate variations and improvements of these stories
3. Retain original high-performers while replacing lower-ranked stories
4. Re-rank the new population through additional pairwise comparisons

This process repeats for multiple generations, allowing successful narrative elements to propagate while introducing controlled variation.

## Evaluation Protocol

Evaluating creative output presents significant challenges due to subjective preferences and high variance in story content. Our evaluation approach includes:

- **Model selection**: Focus on smaller models where improvements are more pronounced
- **Story length**: Restrict to stories under 500 words to enable consistent comparison
- **Prompt design**: Use open-ended prompts to allow models to demonstrate narrative crafting abilities
- **Data collection**: 120 preference comparisons per experiment to establish statistical significance

Initial generations often exhibited fundamental narrative issues including poor story arcs and structural problems, making improvements through evolution particularly noticeable. We compare performance against initial model-generated stories and stories improved through repeated prompting.

We acknowledge that our evaluation methodology, while establishing statistically significant improvements, would benefit from more comprehensive data collection. We simply seek top demonstrate a stastically significant siginal that this method works - quantifiying the actual improvement is difficulty 

### Results

For evaluation we used LLama 4 Scout and generated 60 initial stories, selected the top 10 performers, and created 3 variants of each. This evolution process was repeated for 5 generations

![TTL Bar Chart](/blog/assets/images/AlphaWriteBenchmark.png)

Alpha Writing demonstrates substantial improvements in story quality when evaluated through pairwise human preferences. Testing with Llama 4 Scout revealed:

- **76% preference rate** over initial story generations
- **62% preference rate** over sequential prompting baseline

These results indicate that the evolutionary approach significantly outperforms both single-shot generation and traditional inference-time scaling methods for creative writing tasks.

### Conclusion

Alpha Writing demonstrates that creative tasks can benefit from systematic inference-time compute scaling through evolutionary approaches. Our results show consistent improvements over both baseline generation and sequential prompting methods, suggesting that the apparent intractability of scaling compute for creative domains may be addressable through appropriate algorithmic frameworks.