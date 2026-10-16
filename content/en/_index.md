---
title: "SuperconducTED"
lead: "Quantum computers drift. Their noise is measured again many times a day, but a simulator built from one calibration keeps using that one snapshot. SuperconducTED is a student research project building a noise engine for Qiskit Aer that learns from the calibration history and answers with a range."
steps:
  - title: "The hardware drifts"
    text: "A qubit's T1, T2 and error rates are measured again many times a day, and they move from one calibration to the next, as the chart above shows."
  - title: "A snapshot freezes it"
    text: "Qiskit's `NoiseModel.from_backend` builds a noise model from one calibration. The model is exact for that moment and quietly wrong once the machine moves on."
  - title: "The engine answers with a range"
    text: "SuperconducTED learns how calibration features relate to noise, and aims to give simulations a range that brackets what the hardware does, not one crisp number."
---
