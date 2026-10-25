#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/day-desktop.XXXXXX")"
trap 'rm -rf "$TEST_DIR"' EXIT
swiftc NotchBuddy/Sources/App/DesktopDayLogic.swift \
    tests/DesktopDayTests.swift -o "$TEST_DIR/desktop-day-tests"
"$TEST_DIR/desktop-day-tests"
