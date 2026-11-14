import Foundation

// Standalone checks for DaydoroEngine. Not part of the app target.
//   swiftc -parse-as-library -o /tmp/Daydoro-engine-tests \
//     NotchBuddy/Sources/App/DaydoroEngine.swift NotchBuddy/Tests/DaydoroEngineTests.swift \
//     && /tmp/Daydoro-engine-tests

@main
struct DaydoroEngineTests {
    static func main() {
        var failed = 0
        func check(_ label: String, _ ok: Bool, _ detail: String = "") {
            if ok {
                print("  ✓ \(label)")
            } else {
                failed += 1
                print("  ✗ \(label) \(detail)")
            }
        }

        let work = 25.0 * 60
        let rest = 5.0 * 60
        let config = DaydoroConfig(work: work, rest: rest)
        let t0 = Date(timeIntervalSince1970: 1_700_000_000)

        // Defaults and clamps. Work and rest are each every minute from 1 through 60.
        check("defaults", DaydoroSettings.defaultWork == 25 && DaydoroSettings.defaultRest == 5)
        check("clamp work", DaydoroSettings.clampWork(0) == 1 && DaydoroSettings.clampWork(999) == 60)
        check("work is 1 through 60", (1...60).allSatisfy { DaydoroSettings.clampWork($0) == $0 }
              && DaydoroSettings.clampWork(61) == 60 && DaydoroSettings.clampWork(180) == 60)
        check("clamp rest", DaydoroSettings.clampRest(0) == 1 && DaydoroSettings.clampRest(90) == 60)
        check("rest is 1 through 60", (1...60).allSatisfy { DaydoroSettings.clampRest($0) == $0 }
              && DaydoroSettings.clampRest(61) == 60)
        check("clock", DaydoroEngine.clock(1500) == "25:00" && DaydoroEngine.clock(90) == "01:30"
              && DaydoroEngine.clock(0) == "00:00" && DaydoroEngine.clock(6000) == "100:00")

        // A phase runs until its deadline, then the next phase is announced once.
        var (snap, events) = DaydoroEngine.start(config: config, now: t0)
        check("start is work", snap.phase == .work && snap.deadline == t0.addingTimeInterval(work))
        check("start event", events == [.workStarts])
        (snap, events) = DaydoroEngine.tick(snap, config: config, now: t0.addingTimeInterval(work - 1))
        check("work runs until its deadline", events.isEmpty && snap.phase == .work
              && DaydoroEngine.remaining(snap, now: t0.addingTimeInterval(work - 1)) == 1)
        (snap, events) = DaydoroEngine.tick(snap, config: config, now: t0.addingTimeInterval(work))
        check("rest starts once", events == [.restStarts] && snap.phase == .rest
              && snap.deadline == t0.addingTimeInterval(work + rest))
        (snap, events) = DaydoroEngine.tick(snap, config: config, now: t0.addingTimeInterval(work + rest - 1))
        check("rest runs until its deadline", events.isEmpty && snap.phase == .rest
              && DaydoroEngine.remaining(snap, now: t0.addingTimeInterval(work + rest - 1)) == 1)
        (snap, events) = DaydoroEngine.tick(snap, config: config, now: t0.addingTimeInterval(work + rest))
        check("work starts once", events == [.workStarts] && snap.phase == .work)
        check("second work deadline", snap.deadline == t0.addingTimeInterval(work + rest + work))

        // A full hour, one tick a second: work, rest, work. Nothing in between.
        (snap, events) = DaydoroEngine.start(config: config, now: t0)
        for sec in 1...1800 {
            let (next, fired) = DaydoroEngine.tick(snap, config: config, now: t0.addingTimeInterval(TimeInterval(sec)))
            snap = next
            events.append(contentsOf: fired)
        }
        check("hour of events", events == [.workStarts, .restStarts, .workStarts], "\(events)")
        check("back on work", snap.phase == .work)
        check("hour lands on the second work", snap.deadline == t0.addingTimeInterval(work + rest + work),
              "\(snap.deadline?.timeIntervalSince(t0) ?? -1)")

        // Stop, then start, is a full work phase again.
        snap = DaydoroEngine.stop()
        check("stopped", snap.phase == .idle && snap.deadline == nil)
        let again = t0.addingTimeInterval(9999)
        (snap, events) = DaydoroEngine.start(config: config, now: again)
        check("restart from full work", snap.deadline == again.addingTimeInterval(work) && events == [.workStarts])

        // Pause freezes the remaining time. The clock does not move, and resume does not announce again.
        (snap, _) = DaydoroEngine.start(config: config, now: t0)
        (snap, events) = DaydoroEngine.tick(snap, config: config, now: t0.addingTimeInterval(24 * 60))
        check("quiet before the deadline", events.isEmpty && snap.phase == .work)
        let left = DaydoroEngine.remaining(snap, now: t0.addingTimeInterval(24 * 60))
        snap = DaydoroEngine.pause(snap, now: t0.addingTimeInterval(24 * 60))
        check("paused holds a minute", snap.paused && snap.pausedRemaining == 60 && left == 60)
        let (quiet, none) = DaydoroEngine.tick(snap, config: config, now: t0.addingTimeInterval(30 * 60))
        check("paused does not advance", quiet == snap && none.isEmpty)
        let later = t0.addingTimeInterval(40 * 60)
        snap = DaydoroEngine.resume(snap, now: later)
        check("resume keeps the minute", snap.deadline == later.addingTimeInterval(60) && snap.phase == .work)
        (snap, events) = DaydoroEngine.tick(snap, config: config, now: later.addingTimeInterval(10))
        check("resume does not announce again", events.isEmpty && snap.phase == .work)
        (snap, events) = DaydoroEngine.tick(snap, config: config, now: later.addingTimeInterval(60))
        check("paused minute still ends in rest", events == [.restStarts] && snap.phase == .rest)

        // Asleep across the boundary: land on the original schedule, one event.
        (snap, _) = DaydoroEngine.start(config: config, now: t0)
        let slept = t0.addingTimeInterval(40 * 60)
        (snap, events) = DaydoroEngine.tick(snap, config: config, now: slept)
        check("slept into second work", snap.phase == .work && events == [.workStarts], "\(events) \(snap.phase)")
        check("slept deadline", snap.deadline == t0.addingTimeInterval(25 * 60 + 5 * 60 + 25 * 60))
        check("slept remaining", DaydoroEngine.remaining(snap, now: slept) == 15 * 60)

        // Asleep near the end of rest: still rest, announced once, no extra event.
        (snap, _) = DaydoroEngine.start(config: config, now: t0)
        let nearRestEnd = t0.addingTimeInterval(25 * 60 + 5 * 60 - 30)
        (snap, events) = DaydoroEngine.tick(snap, config: config, now: nearRestEnd)
        check("slept into rest", events == [.restStarts], "\(events)")
        check("rest still running", snap.phase == .rest && DaydoroEngine.remaining(snap, now: nearRestEnd) == 30)

        // Lengths are minutes in UserDefaults: unset means the defaults, a saved value is clamped to 1…60.
        let ud = UserDefaults.standard
        func clearMinutes() {
            for key in [DaydoroSettings.workKey, DaydoroSettings.restKey] {
                ud.removeObject(forKey: key)
            }
        }
        clearMinutes()
        check("minutes unset", DaydoroSettings.workMinutes == 25 && DaydoroSettings.restMinutes == 5)
        ud.set(40, forKey: DaydoroSettings.workKey)
        ud.set(12, forKey: DaydoroSettings.restKey)
        check("saved minutes", DaydoroSettings.workMinutes == 40 && DaydoroSettings.restMinutes == 12)
        ud.set(180, forKey: DaydoroSettings.workKey)
        ud.set(0, forKey: DaydoroSettings.restKey)
        check("saved minutes clamp", DaydoroSettings.workMinutes == 60 && DaydoroSettings.restMinutes == 1)
        clearMinutes()
        check("pill id", DaydoroSettings.pillId == "integration_Daydoro")

        if failed > 0 {
            print("\(failed) failed")
            exit(1)
        }
        print("All Daydoro engine checks passed")
    }
}
