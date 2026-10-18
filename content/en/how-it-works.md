---
title: "How it works"
kicker: "Method"
description: "How SuperconducTED turns a quantum computer's drifting calibration record into noise parameters for Qiskit Aer: the idea in plain words, then the equations."
lead: "The first four sections give you the idea in plain words. The equations follow, so you can check the mathematics against the engine's code."
toc: true
math: true
---

## The machine moves

IBM publishes calibration data for each of its quantum computers: how long each qubit keeps
its state (T1 and T2), how often each gate fails, how often a measurement is misread.

- **The numbers drift**, sometimes slowly and sometimes in jumps, as the chip and its
  refrigerator change.
- **The evidence is on the [home page](../):** real T1 calibrations of one qubit on
  `ibm_fez`, from May to October 2026.

Qiskit's `NoiseModel.from_backend` copies the latest calibration into a noise model. That model
is exact for its moment, and nothing in your simulation shows how far the machine has moved
since.

## The pipeline in seven stages

SuperconducTED sits between the calibration data and Qiskit Aer, the simulator. Each snapshot
goes through seven stages:

1. **Ingest.** A scheduled job archives the calibrations of IBM's `ibm_fez`, in public, since
   May 2026.
2. **Summarise.** Three features describe the snapshot: mean T1, mean T2 and mean readout error.
3. **Fuzzify.** Overlapping fuzzy sets ("low", "typical", "high") describe each feature. Every
   combination of sets is a rule, and each rule fires as strongly as the snapshot matches it.
4. **Combine.** Each rule proposes noise parameters as a linear function of the features; the
   engine averages the proposals, weighted by how strongly each rule fired.
5. **Squash.** The result is mapped into the range the physical parameter can take.
6. **Check eligibility.** Only gates that the snapshot reports get a noise channel.
7. **Project.** The parameters become amplitude and phase damping channels that Aer simulates.

The rule base is a Takagi-Sugeno-Kang (TSK) fuzzy system. ANFIS trains it the way a small neural
network is trained.

## Why a range

One calibration is one sample of a machine that keeps moving.

- **An interval type-2 fuzzy set** has a lower and an upper membership. The gap between them
  holds what is not known about the input.
- **An ensemble of noise models** that spans that uncertainty turns one simulation into a range
  of outcomes.
- **The aim** is a range that brackets what the hardware does across calibration cycles.

## Where it stands

> Research preview. This section reports the engine's state, not a result.

- **Working:** the calibration archive, feature extraction, the fuzzy pipeline end to end,
  channel projection, and an ensemble of Aer noise models. The suite has
  {{% claim "tests" %}} tests.
- **In progress:** training. The ridge least-squares fit of the rule outputs merged on
  15 October 2026 [PR #114](https://github.com/SuperconducTED/superconducted-noise-engine/pull/114).
  Training needs five distinct device states per trainable parameter,
  {{% claim "floor" %}} in all; {{% claim "states" %}} are archived.
- **Open:** how ensemble members differ
  [ADR-015](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md),
  how their results combine into an interval
  [ADR-016](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md),
  and type-1 or interval type-2
  [ADR-009](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md).
  Until these land, the outputs are point estimates.

Every design decision is in the engine's
[decision record](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md),
the design in its
[architecture document](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/architecture.md),
and every figure in its
[numerical-claims register](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/numerical-claims.md).

## The equations

The definitions match the engine's code (`fuzzy/membership.py`, `fuzzy/tsk.py`,
`fuzzy/defuzzification.py`, `channels/kraus.py`).

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

With three sets per feature there are \(R = 3^3 = 27\) rules and {{% claim "params" %}}
trainable parameters: 216 in the matrices \(A_r\), and 18 centres and widths
[NC-037](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/numerical-claims.md).

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

**The range.** The plan is for the range to come from the ensemble: \(N\) noise models
({{% claim "ensemble" %}} by default), each simulated, with their results combined into an
interval. How the members differ and how their results combine are the open decisions above.
