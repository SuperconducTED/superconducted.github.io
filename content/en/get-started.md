---
title: "Get started"
kicker: "Install"
description: "Install the SuperconducTED noise engine, run its tests, poll IBM calibrations, and take part."
lead: "Install the engine and run its test suite with the commands below. You need Python 3.11 or newer and git; every block has a Copy button."
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

The suite has {{% claim "tests" %}} tests and needs no IBM account.

```bash
pytest
```

## Poll IBM calibrations

`superconducted-poll` archives calibration snapshots from an IBM backend. It needs an IBM Quantum
token.

```bash
cp .env.example .env
superconducted-poll --backend ibm_fez
```

- **Where the token goes:** in `.env`, as `IBM_QUANTUM_TOKEN`.
- **Never commit it.** git ignores `.env`; keep it that way.
- **If polling fails,** the engine's
  [README](https://github.com/SuperconducTED/superconducted-noise-engine#readme) lists the
  failure modes and their fixes.

## Read the design

- [Architecture](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/architecture.md):
  the seven-stage pipeline and how it meets Qiskit Aer.
- [Decision record](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md):
  every architectural decision, with its status.
- [Numerical-claims register](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/numerical-claims.md):
  where every figure the project states comes from.

## Take part

- **Questions and ideas:** the engine's
  [Discussions](https://github.com/SuperconducTED/superconducted-noise-engine/discussions).
- **Bugs:** its [issues](https://github.com/SuperconducTED/superconducted-noise-engine/issues).
- **A larger change:** open an issue first, so you and the team agree on the approach before the
  work starts. The code is under the MIT licence.
