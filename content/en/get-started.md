---
title: "Get started"
description: "Install the SuperconducTED noise engine, run its tests, poll IBM calibrations, and take part."
lead: "Install the engine, run its tests, and see how to take part. You need Python 3.11 or newer and git."
toc: true
---

## Install

```bash
git clone https://github.com/SuperconducTED/superconducted-noise-engine.git
cd superconducted-noise-engine
python -m venv .venv
```

Activate the environment: on Windows `.venv\Scripts\activate`, on macOS and Linux
`source .venv/bin/activate`. Then install the pinned dependencies and the engine itself:

```bash
pip install -r requirements.txt -r requirements-dev.txt
pip install -e . --no-deps
```

## Run the tests

```bash
pytest
```

## Poll IBM calibrations

The `superconducted-poll` command archives calibration snapshots from an IBM backend. It needs an
IBM Quantum token.

```bash
cp .env.example .env
superconducted-poll --backend ibm_fez
```

Put your token in `.env` as `IBM_QUANTUM_TOKEN`. The `.env` file is ignored by git: never commit
a real token. The engine's
[README](https://github.com/SuperconducTED/superconducted-noise-engine#readme) lists the
polling failure modes and their fixes.

## Read the design

- [Architecture](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/architecture.md):
  the seven-stage pipeline and how it meets Qiskit Aer.
- [Decision record](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md):
  every architectural decision, with its status.
- [Numerical-claims register](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/numerical-claims.md):
  where every figure the project states comes from.
- [How it works](../how-it-works/): the idea and the equations, on this site.

## Take part

Questions and ideas go to the engine's
[Discussions](https://github.com/SuperconducTED/superconducted-noise-engine/discussions), bugs
to its [issues](https://github.com/SuperconducTED/superconducted-noise-engine/issues). For a
larger change, open an issue first so the approach can be agreed before the work starts. The
code is under the MIT licence.
