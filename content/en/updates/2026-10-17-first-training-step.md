---
title: "The first ANFIS training step is merged"
date: 2026-10-17
description: "The engine can now fit the outputs of its fuzzy rules by ridge least squares, the first half of ANFIS training. Also this week: the project's identity and this website went live."
lead: "The engine can now fit the output side of its fuzzy rules. Here is what that covers, what it does not do yet, and what else changed this week."
---

## What merged

[PR #114](https://github.com/SuperconducTED/superconducted-noise-engine/pull/114) merged on
15 October 2026. It adds the first half of ANFIS training: fitting each rule's linear output by
ridge least squares.

- **Both rule types.** The fit works on the type-1 path and on the interval type-2 path
  (Nie-Tan).
- **Checked against planted answers.** Tests build a 3 × 3 × 3 rule base with known outputs,
  and the fit recovers them on both paths.
- **Your units in, your units out.** Inputs are standardised for the fit and mapped back
  exactly to raw units.

## What it does not do yet

- **No fuzzy-set training.** The second half of ANFIS, which moves each set's centre and width,
  is the next piece of work.
- **No run on the archive.** Training needs {{% claim "states_of" %}} distinct device states;
  {{% claim "states" %}} are archived so far.

## Also this week

- **An identity.** The organisation adopted its mark and colours on 16 October 2026
  ([PR #1](https://github.com/SuperconducTED/.github/pull/1) in the organisation repository).
- **This website.** It went live the same day
  ([PR #1](https://github.com/SuperconducTED/superconducted.github.io/pull/1) in the site
  repository). Every number on it links to the register row it comes from.
