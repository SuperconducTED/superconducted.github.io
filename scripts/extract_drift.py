"""Extract the Home page demo series from the noise engine's calibration archive.

Usage:
    python -I scripts/extract_drift.py --repo <noise engine clone> --ref <calibration-data commit>
        [--out data/drift.json]

Reads git objects only (`git cat-file --batch`), never a checkout, so the result depends on the
commit alone. In a partial clone, missing blobs are fetched on demand by git.

What it computes (the rules are also written into the output):
  1. Documents: one per distinct device state, from health/state-index.tsv at the ref (the
     qubit_digest column). Documents that repeat a state carry identical qubit blocks and add
     nothing.
  2. Measurements: every T1 record of every qubit in those documents, keyed by the record's own
     measurement date, so one point is one T1 calibration of one qubit.
  3. Qubit: among qubits with a T1 record in at least 90 % of the documents, the one whose
     coefficient of variation (sample standard deviation over mean of its T1 values) is the lower
     median; ties go to the lower qubit index. Neither the calmest nor the wildest qubit.
  4. Band (an illustration, not engine output): at each point, the 10th and 90th percentiles of
     that qubit's T1 values in the trailing 7 days (t - 7 d, t], linear interpolation between
     order statistics; no band where the window holds fewer than 5 values.

Values are rounded to 0.01 microseconds and the JSON is written with sorted keys and LF line
endings, so the same ref always gives the same bytes.
"""
import argparse
import json
import math
import os
import statistics
import subprocess
from datetime import datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIN_COVERAGE = 0.90
WINDOW = timedelta(days=7)
QUANTILES = (0.10, 0.90)
MIN_WINDOW = 5
UNIT_TO_US = {"us": 1.0, "µs": 1.0, "ms": 1e3, "s": 1e6, "ns": 1e-3}


def git(repo, *args):
    return subprocess.run(["git", "-C", repo, *args], check=True, capture_output=True).stdout


def read_blobs(repo, specs):
    """Yield (spec, bytes) for each '<rev>:<path>' in specs, through one cat-file process."""
    proc = subprocess.Popen(["git", "-C", repo, "cat-file", "--batch"],
                            stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    try:
        for spec in specs:
            proc.stdin.write((spec + "\n").encode())
            proc.stdin.flush()
            header = proc.stdout.readline().decode().split()
            if len(header) < 3 or header[1] != "blob":
                raise RuntimeError(f"not a blob: {spec}: {header}")
            size = int(header[2])
            data = proc.stdout.read(size)
            proc.stdout.read(1)  # the LF after each object
            yield spec, data
    finally:
        proc.stdin.close()
        proc.wait()


def quantile(sorted_values, p):
    """Linear interpolation between order statistics (numpy's default, Hyndman-Fan type 7)."""
    h = (len(sorted_values) - 1) * p
    lo = math.floor(h)
    hi = min(lo + 1, len(sorted_values) - 1)
    return sorted_values[lo] + (h - lo) * (sorted_values[hi] - sorted_values[lo])


def parse_date(text):
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--repo", required=True)
    ap.add_argument("--ref", required=True)
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "drift.json"))
    a = ap.parse_args()

    ref = git(a.repo, "rev-parse", "--verify", a.ref + "^{commit}").decode().strip()
    index = git(a.repo, "show", f"{ref}:health/state-index.tsv").decode().splitlines()
    head = index[0].split("\t")
    col = {name: i for i, name in enumerate(head)}
    by_digest = {}
    for line in index[1:]:
        row = line.split("\t")
        by_digest.setdefault(row[col["qubit_digest"]], row[col["snapshot_filename"]])
    files = {p.rsplit("/", 1)[1]: p for p in
             git(a.repo, "ls-tree", "-r", "--name-only", ref, "--", "snapshots/").decode().split()}
    specs = [f"{ref}:{files[name]}" for name in sorted(by_digest.values())]

    t1 = {}  # qubit -> {measurement date: value in microseconds}
    present = {}  # qubit -> number of documents with a T1 record
    backend = None
    for _, data in read_blobs(a.repo, specs):
        doc = json.loads(data)
        backend = backend or doc.get("backend")
        for q, params in enumerate(doc["properties"]["qubits"]):
            for p in params:
                if p.get("name") == "T1" and p.get("value") is not None:
                    present[q] = present.get(q, 0) + 1
                    t1.setdefault(q, {})[p["date"]] = p["value"] * UNIT_TO_US[p["unit"]]

    n_docs = len(specs)
    eligible = sorted(q for q, n in present.items() if n >= MIN_COVERAGE * n_docs and len(t1[q]) >= 2)
    cvs = sorted((statistics.stdev(t1[q].values()) / statistics.mean(t1[q].values()), q) for q in eligible)
    cv, qubit = cvs[(len(cvs) - 1) // 2]

    series = sorted((parse_date(d), v) for d, v in t1[qubit].items())
    points = []
    for i, (t, v) in enumerate(series):
        window = sorted(w for s, w in series[: i + 1] if s > t - WINDOW)
        if len(window) >= MIN_WINDOW:
            lo, hi = (round(quantile(window, p), 2) for p in QUANTILES)
        else:
            lo = hi = None
        points.append([t.strftime("%Y-%m-%dT%H:%M:%SZ"), round(v, 2), lo, hi])

    out = {
        "generated_by": "scripts/extract_drift.py",
        "source": {
            "repo": "SuperconducTED/superconducted-noise-engine",
            "branch": "calibration-data",
            "ref": ref,
            "backend": backend,
            "documents": n_docs,
        },
        "quantity": "T1",
        "unit": "us",
        "qubit": qubit,
        "selection": {
            "rule": "lower median coefficient of variation among qubits with T1 in >= 90% of documents",
            "eligible_qubits": len(eligible),
            "cv": round(cv, 4),
            "cv_range": [round(cvs[0][0], 4), round(cvs[-1][0], 4)],
        },
        "band": {
            "illustration": True,
            "quantiles": list(QUANTILES),
            "window_days": WINDOW.days,
            "min_values": MIN_WINDOW,
        },
        "points": points,
    }
    with open(a.out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, sort_keys=True, separators=(",", ":"))
        f.write("\n")
    print(f"ref {ref[:12]}: {n_docs} documents, {len(eligible)} eligible qubits, "
          f"qubit {qubit} (CV {cv:.4f}), {len(points)} T1 measurements -> {os.path.relpath(a.out, ROOT)}")


if __name__ == "__main__":
    main()
