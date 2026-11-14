#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/Day-desktop.XXXXXX")"
trap 'rm -rf "$TEST_DIR"' EXIT
swiftc NotchBuddy/Sources/App/DesktopDayLogic.swift \
    tests/DesktopDayTests.swift -o "$TEST_DIR/desktop-Day-tests"
"$TEST_DIR/desktop-Day-tests"
