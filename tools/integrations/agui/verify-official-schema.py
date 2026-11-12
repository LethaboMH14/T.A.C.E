#!/usr/bin/env python3
"""Offline AG-UI 1.0 conformance check using pinned upstream JSON Schema 2020-12.

Validates only AG-UI event envelope and interrupt payload shapes, not T.A.C.E
authentication, server authorization, UI rendering, model accuracy or tool safety.
"""
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

SCHEMA = Path(__file__).parent / "vendor" / "ag-ui-1.0.schema.json"


def main():
    source = json.load(sys.stdin)
    with SCHEMA.open(encoding="utf-8") as file:
        schema = json.load(file)
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    events = source.get("positive", [])
    if len(events) != 3:
        raise AssertionError(f"Expected three real event envelopes, found {len(events)}")
    for index, event in enumerate(events):
        errors = list(validator.iter_errors(event))
        if errors:
            raise AssertionError(
                f"Positive event {index}: "
                + "; ".join(str(e.message) for e in errors[:3])
            )
    negatives = source.get("negative", [])
    if len(negatives) != 4:
        raise AssertionError("Expected four negative protocol fixtures")
    for negative in negatives:
        if validator.is_valid(negative["event"]):
            raise AssertionError(
                f"Expected upstream schema to reject {negative['label']}"
            )
    print(
        f"AG-UI 1.0 upstream schema conformance: {len(events)} valid event envelopes; "
        f"{len(negatives)} invalid cases rejected"
    )
    print("No live CopilotKit/OpenDots/OpenBot or agent execution was performed.")


if __name__ == "__main__":
    main()
