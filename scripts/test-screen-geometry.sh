#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/day-geometry.XXXXXX")"
trap 'rm -rf "$TEST_DIR"' EXIT
swiftc NotchBuddy/Sources/DayKit/IslandScreenGeometry.swift \
    tests/IslandScreenGeometryTests.swift -o "$TEST_DIR/geometry-tests"
"$TEST_DIR/geometry-tests"
