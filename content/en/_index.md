---
title: "SuperconducTED"
description: "A student research project at TED University building a noise engine for Qiskit Aer that learns from a quantum computer's calibration history and reports noise as a range."
# Home copy. Layout: layouts/home.html. {claim:KEY} prints a register-backed figure with its
# proof chip (data/facts.yaml, data/claims.yaml); never type a register number by hand.
hero:
  eyebrow: "Research preview · TED University, Ankara"
  title_before: "Put a"
  title_range: "range"
  title_after: "on your quantum noise model."
  sub: "A noise model built from one calibration is a single draw from a chip whose noise keeps moving. **SuperconducTED is building a noise engine for Qiskit Aer** that learns how far that noise spreads across the whole calibration history, so your simulation can report a range."
  primary:
    label: "See how the engine works"
    url: "how-it-works/"
  secondary:
    label: "Install it and run the tests"
    url: "get-started/"
  note: "Work in progress: the pipeline runs end to end, while training and the range output are still being built. Unless a measured result is cited, this site describes the aim."
problem:
  kicker: "01 / The problem"
  title: "Why one calibration misleads your simulation"
  intro: "Three steps take you from the hardware to your results. The chart above is the evidence for the first."
  steps:
    - title: "The chip drifts"
      text: "T1, T2 and error rates change from one calibration to the next. Our archive holds {claim:states} distinct device states of IBM's ibm_fez since May 2026."
    - title: "Your model freezes one moment"
      text: "`NoiseModel.from_backend` copies the latest calibration into a fixed noise model. It is exact for that moment and is never updated."
    - title: "Your results inherit the gap"
      text: "Run the circuit a week later and the model still uses last week's numbers. Nothing in the output tells you how far off it is."
approach:
  kicker: "02 / The approach"
  title: "A noise engine that learns from every calibration"
  intro: "SuperconducTED sits between IBM's calibration data and Qiskit Aer, the simulator."
  points:
    - title: "Learns how calibrations map to noise"
      text: "A fuzzy rule base turns three features of each snapshot (mean T1, mean T2, mean readout error) into noise parameters; ANFIS training, now in progress, fits it to the archive."
    - title: "Keeps its reasoning readable"
      text: "Each rule covers one region of calibration space, such as low T1 with high readout error, so you can inspect what it learned. The rule base has {claim:params} trainable parameters."
    - title: "Reports a range"
      text: "The plan: an ensemble of noise models ({claim:ensemble} by default) turns one simulation into an interval of outcomes."
  link:
    label: "Read the method and the equations"
    url: "how-it-works/"
status:
  kicker: "03 / Where it stands"
  title: "The engine in October 2026"
  intro: "Each claim carries its evidence. Open a chip to see the record behind it."
  working:
    title: "Working"
    items:
      - "**The calibration archive** of ibm_fez, polled since May 2026, with feature extraction."
      - "**The fuzzy pipeline, end to end:** from a snapshot to Aer noise channels."
      - "**{claim:tests} tests** in the engine's suite."
  progress:
    title: "In progress"
    items:
      - "**ANFIS training.** The least-squares fit of the rule outputs merged on 15 October 2026 [PR #114](https://github.com/SuperconducTED/superconducted-noise-engine/pull/114). Training the fuzzy sets comes next."
      - "**Training data:** {claim:states} of the {claim:states_of} device states that training needs."
  open:
    title: "Open decisions"
    items:
      - "How ensemble members differ [ADR-015](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md) and combine into an interval [ADR-016](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md)."
      - "Type-1 or interval type-2 rules [ADR-009](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md)."
  note: "Until those decisions land, the engine's outputs are point estimates."
faq:
  kicker: "04 / Questions"
  title: "Before you try it"
  items:
    - q: "Can I use it in my research today?"
      a: "You can install it and run the full pipeline and its test suite. Its outputs are still point estimates, so don't cite them as results until training and the range output land. The [Updates](updates/) page will say when."
    - q: "Do I need an IBM Quantum account?"
      a: "Not to install the engine or run its tests. You need an IBM Quantum token only to poll live calibrations yourself. The archive the engine trains on is in the engine's public repository."
    - q: "Isn't rebuilding the model after each calibration enough?"
      a: "A fresh model is a good single estimate, and we don't claim it is wrong on average. What it can't tell you is how far the hardware may sit from it. IBM recalibrates parts of a chip whenever its monitoring detects drift ([IBM's calibration guide](https://quantum.cloud.ibm.com/docs/en/guides/calibration-jobs)), and a single routine T1 measurement predicts a qubit's long-run average only weakly ([Carroll et al. 2022](https://doi.org/10.1038/s41534-022-00643-y)). The engine is designed to learn that spread from the calibration history and report it as a range. We plan to judge the range by how often it covers repeated runs on the hardware, with the fresh model as the baseline."
    - q: "Why fuzzy logic?"
      a: "A fuzzy rule base stays readable: each rule names the calibration conditions it covers. Interval type-2 fuzzy sets can also carry the uncertainty of their own inputs, which is what a range needs. ANFIS trains the rules the way a small neural network is trained."
    - q: "Is this an IBM project?"
      a: "No. SuperconducTED is an independent student project at TED University in Ankara. It uses IBM's published calibration data and the open-source Qiskit Aer simulator."
    - q: "How do I cite it?"
      a: "Use **Cite this repository** on the [engine's GitHub page](https://github.com/SuperconducTED/superconducted-noise-engine). It reads the project's citation file, which lists the authors."
updates:
  kicker: "05 / Updates"
  title: "Follow the build"
final:
  kicker: "Next step"
  title: "Run the engine on your own machine"
  text: "You need Python 3.11 or newer and git. Install it, run the tests, then read the design."
  primary:
    label: "Install the engine"
    url: "get-started/"
  secondary_label: "Ask a question on GitHub"
---
