---
title: "How it works"
description: "How SuperconducTED aims to turn a quantum computer's drifting calibration record into a noise range for Qiskit Aer: the idea in plain words, then the equations."
lead: "A quantum computer's noise is measured again many times a day, and it keeps moving. This page explains, first in plain words and then in equations, how SuperconducTED aims to turn that moving record into a range a simulation can use."
toc: true
math: true
---

## A moving machine

IBM measures the noise of each of its quantum computers many times a day: how long each qubit
keeps its state (T1 and T2), how often a gate goes wrong, how often a measurement is misread.
These numbers are not fixed. They drift as the chip and its refrigerator change, sometimes
slowly, sometimes in jumps.

Simulators need those numbers. In Qiskit, `NoiseModel.from_backend` builds a noise model from
the machine's latest calibration. That model is exact for the moment it was taken and quietly
wrong as soon as the machine moves on, and nothing in the simulation says how wrong.

## What the engine does

SuperconducTED sits between the calibration data and Qiskit Aer, the simulator. Every
calibration snapshot goes through seven stages:

1. **Ingest.** The snapshot is archived. Since May 2026 a scheduled job has collected the
   calibrations of one IBM machine, `ibm_fez`, into a public archive.
2. **Summarise.** Three features describe the snapshot: the mean T1, the mean T2 and the mean
   readout error across the chip.
3. **Fuzzify and fire rules.** Each feature is described by overlapping fuzzy sets, such as
   "low", "typical" and "high". Every combination of sets is a rule, and each rule fires as
   strongly as the snapshot matches it.
4. **Combine.** Each rule proposes noise parameters as a linear function of the features; the
   engine averages the proposals, weighted by how strongly each rule fired.
5. **Squash.** The result is mapped into the range a physical parameter can take.
6. **Check eligibility.** Only gates that the snapshot actually reports get a noise channel.
7. **Project.** The parameters become a quantum channel (amplitude and phase damping) that Aer
   can simulate.

The rule base is a Takagi-Sugeno-Kang (TSK) fuzzy system. Training, now in progress, learns its
sets and rules from the archive with ANFIS, a method that trains a fuzzy system the way a small
neural network is trained.

## Why a range

One calibration is one sample of a machine that keeps moving. A fuzzy system can carry the
uncertainty of its own inputs: an interval type-2 fuzzy set has a lower and an upper membership,
and the space between them holds what is not known. Run as an ensemble of noise models that
spans that uncertainty, a simulation returns a range of outcomes instead of one number. The aim
is a range that brackets what the real hardware does across calibration cycles, which a single
frozen model cannot do.

## Where it stands

> SuperconducTED is a research preview. What follows is the state of the engine, not a result.

- **Working today:** the calibration archive, feature extraction, the fuzzy pipeline from end to
  end, channel projection, and an ensemble of Aer noise models.
- **In progress:** training the rule base on the archive. Training needs enough distinct device
  states: at least five per trainable parameter, 1,170 in all (register row NC-045).
- **Open:** how the ensemble's members are made to differ (ADR-015), how their results are
  combined into an interval (ADR-016), and whether the type-1 or the interval type-2 path is used
  (ADR-009). Until these are settled, the engine's outputs are point estimates.

Every design decision is recorded in the engine's
[decision record](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md),
the design in its
[architecture document](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/architecture.md),
and every figure in its
[numerical-claims register](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/numerical-claims.md).

## The equations

For readers who want the mathematics. The definitions are the ones in the engine's code
(`fuzzy/membership.py`, `fuzzy/tsk.py`, `fuzzy/defuzzification.py`, `channels/kraus.py`).

**Features.** A snapshot gives \(x = (x_1, x_2, x_3)\): the mean T1, the mean T2 and the mean
readout error.

**Membership.** Each rule \(r\) has one Gaussian set per feature, with a centre \(c\) and a
width \(\sigma\) that training learns:

$$
\mu_{r,i}(x_i) = \exp\left(-\frac{1}{2}\left(\frac{x_i - c_{r,i}}{\sigma_{r,i}}\right)^{2}\right)
$$

**Firing strength.** The product of the rule's memberships:

$$
w_r(x) = \prod_{i=1}^{3} \mu_{r,i}(x_i)
$$

**Rule output.** First-order TSK: each rule proposes the two noise parameters as a linear
function of the features,

$$
y_r(x) = A_r \begin{bmatrix} x \\ 1 \end{bmatrix}, \qquad A_r \in \mathbb{R}^{2 \times 4}
$$

**Combination.** The average of the proposals over the \(R\) rules, weighted by firing
strength:

$$
y(x) = \frac{\sum_{r=1}^{R} w_r(x)\, y_r(x)}{\sum_{r=1}^{R} w_r(x)}
$$

With three sets per feature there are \(R = 3^3 = 27\) rules and 234 trainable parameters: 216
in the matrices \(A_r\), and 18 centres and widths (register rows NC-037 and NC-045).

**Channel.** Squashing turns \(y\) into an amplitude-damping parameter \(\gamma\) and a
phase-damping parameter \(\lambda\), both in \([0, 1]\). Each eligible gate then gets amplitude
damping, with Kraus operators

$$
K_0 = \begin{bmatrix} 1 & 0 \\ 0 & \sqrt{1-\gamma} \end{bmatrix}, \qquad
K_1 = \begin{bmatrix} 0 & \sqrt{\gamma} \\ 0 & 0 \end{bmatrix},
$$

composed with phase damping of parameter \(\lambda\).

**The type-2 path.** An interval Gaussian set has two widths,
\(\sigma^{\mathrm{low}} < \sigma^{\mathrm{high}}\), so each membership becomes an interval and
each rule fires with a lower strength \(\underline{w}_r\) and an upper strength
\(\overline{w}_r\). The engine's Nie-Tan defuzzifier averages the two weighted averages:

$$
y(x) = \frac{1}{2}\left(
\frac{\sum_{r} \underline{w}_r(x)\, y_r(x)}{\sum_{r} \underline{w}_r(x)} +
\frac{\sum_{r} \overline{w}_r(x)\, y_r(x)}{\sum_{r} \overline{w}_r(x)}
\right)
$$

**The range.** The range the engine reports is planned to come from the ensemble: \(N\) noise
models (32 by default, register row NC-018), each simulated, with their results combined into an
interval. How the members differ and how their results are combined are the open decisions
above.
