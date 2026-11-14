#!/usr/bin/swift
// ClaudeHookRemovalTests.swift — standalone test script for the Claude Code
// hook install/uninstall removal logic in HookServer.swift.
// Run from repo root:
//   swift NotchBuddy/Tests/ClaudeHookRemovalTests.swift
//
// Covers #854: install and uninstall must remove only Day's own nb-hook
// entries, never whole groups that merely mention "Day"/"NotchBuddy".
// Keep in sync with HookServer.swift (removeNbHookEntries + the per-event
// cleanup in buildHooksData / uninstallClaudeHooks).

import Foundation

var passed = 0
var failed = 0

func check(_ name: String, _ groups: [[String: Any]],
           contains: [String] = [], notContains: [String] = [],
           expectEmpty: Bool = false) {
    var ok = expectEmpty ? groups.isEmpty : true
    if !expectEmpty {
        let data = (try? JSONSerialization.data(withJSONObject: groups, options: [.sortedKeys])) ?? Data()
        let json = String(data: data, encoding: .utf8) ?? ""
        for needle in contains where !json.contains(needle) { ok = false }
        for needle in notContains where json.contains(needle) { ok = false }
    }
    if ok { passed += 1; print("PASS  \(name)") }
    else { failed += 1; print("FAIL  \(name)") }
}

// ── Copy of removeNbHookEntries from HookServer.swift ─────────────────────────
// Keep in sync with HookServer.swift removeNbHookEntries(from:).
func removeNbHookEntries(from groups: [[String: Any]]) -> [[String: Any]] {
    groups.compactMap { group -> [String: Any]? in
        // Legacy flat entry — command at group level
        if let cmd = group["command"] as? String, cmd.contains("nb-hook") { return nil }
        // Group format — filter inner hooks
        if var innerHooks = group["hooks"] as? [[String: Any]] {
            innerHooks.removeAll { ($0["command"] as? String)?.contains("nb-hook") == true }
            if innerHooks.isEmpty { return nil }
            var updated = group
            updated["hooks"] = innerHooks
            return updated
        }
        return group
    }
}

// ── Mirror of the per-event cleanup the Claude paths run ──────────────────────
// buildHooksData removes Day's own previous entries, then appends a fresh one.
let nbCmd = "\"$HOME/Library/Application Support/NotchBuddy/nb-hook\""

func installEvent(_ existing: [[String: Any]], timeout: Int) -> [[String: Any]] {
    var cleaned = removeNbHookEntries(from: existing)
    cleaned.append(["hooks": [["type": "command", "command": nbCmd, "timeout": timeout]]])
    return cleaned
}

// 1. Install keeps a user group whose command only mentions "Day"
let userLint = ["matcher": "Bash",
                "hooks": [["type": "command", "command": "~/dev/Day/scripts/lint.sh", "timeout": 5]]] as [String: Any]
let DayGroup = ["hooks": [["type": "command", "command": nbCmd, "timeout": 10]]] as [String: Any]
check("1. install keeps the user's ~/dev/Day lint group",
      installEvent([userLint, DayGroup], timeout: 10),
      contains: ["~/dev/Day/scripts/lint.sh", "Bash"])

// 2. Install replaces Day's own previous group without duplicating it
let installedTwice = installEvent(installEvent([DayGroup], timeout: 10), timeout: 10)
let nbPlainCount = installedTwice.flatMap { ($0["hooks"] as? [[String: Any]]) ?? [] }
    .filter { ($0["command"] as? String) == nbCmd }.count
if nbPlainCount == 1 { passed += 1; print("PASS  2. reinstall leaves exactly one plain nb-hook entry") }
else { failed += 1; print("FAIL  2. reinstall leaves exactly one plain nb-hook entry (found \(nbPlainCount))") }

// 3. Uninstall keeps a user hook that merely mentions "Day"
let mixed = [["matcher": "n",
              "hooks": [["type": "command", "command": "echo Day", "timeout": 5],
                        ["type": "command", "command": nbCmd, "timeout": 10]]] as [String: Any]]
check("3. uninstall keeps \"echo Day\", drops only the nb-hook entry",
      removeNbHookEntries(from: mixed),
      contains: ["echo Day"],
      notContains: ["nb-hook"])

// 4. Uninstall drops a group that held only Day's hook
check("4. uninstall drops Day-only groups entirely",
      removeNbHookEntries(from: [DayGroup]),
      expectEmpty: true)

// 5. Uninstall keeps a user hook whose path mentions NotchBuddy but not nb-hook
let nbish = [["hooks": [["type": "command", "command": "/opt/NotchBuddy/something-else", "timeout": 5]]] as [String: Any]
check("5. uninstall keeps a /opt/NotchBuddy path that is not our hook",
      removeNbHookEntries(from: nbish),
      contains: ["/opt/NotchBuddy/something-else"])

// 6. Legacy flat entries with nb-hook are removed; others are kept
let legacy = [["command": nbCmd] as [String: Any],
              ["command": "~/bin/own.sh"] as [String: Any]]
check("6. legacy flat entries: only the nb-hook one goes",
      removeNbHookEntries(from: legacy),
      contains: ["own.sh"],
      notContains: ["nb-hook"])

print("")
print("Results: \(passed) passed, \(failed) failed")
exit(failed > 0 ? 1 : 0)
