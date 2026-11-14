import Foundation

// MARK: - WakePhrase tests (pure functions, no concurrency)

@main
enum WakePhraseTests {

    static var failures = 0

    static func main() {
        // MARK: split — should match

        // Basic wake phrases (no command)
        checkMatch("ok Day",              WakePhrase.split("ok Day"),              cmd: "")
        checkMatch("OK Day",              WakePhrase.split("OK Day"),              cmd: "")
        checkMatch("okay Day",            WakePhrase.split("okay Day"),            cmd: "")
        checkMatch("ok kuku",                WakePhrase.split("ok kuku"),                cmd: "")
        checkMatch("ok cou cou",             WakePhrase.split("ok cou cou"),             cmd: "")
        checkMatch("hey Day",             WakePhrase.split("hey Day"),             cmd: "")
        checkMatch("Hey Day",             WakePhrase.split("Hey Day"),             cmd: "")

        // Command extracted from original text (casing/punctuation preserved)
        checkMatch("Okay, Day, ajoute GitHub",
                   WakePhrase.split("Okay, Day, ajoute GitHub"),             cmd: "ajoute GitHub")
        checkMatch("ok cuckoo add github",
                   WakePhrase.split("ok cuckoo add github"),                    cmd: "add github")
        checkMatch("ok Day ouvre figma",
                   WakePhrase.split("ok Day ouvre figma"),                   cmd: "ouvre figma")

        // Apostrophes, hyphens and accents preserved in command
        checkMatch("OK Day, mets l'album de Daft Punk",
                   WakePhrase.split("OK Day, mets l'album de Daft Punk"),   cmd: "mets l'album de Daft Punk")
        checkMatch("ok Day qu'est-ce que fait Claude ?",
                   WakePhrase.split("ok Day qu'est-ce que fait Claude ?"),  cmd: "qu'est-ce que fait Claude ?")

        // Wake anywhere in transcript (word-boundary search)
        checkMatch("euh ok Day mets de la musique",
                   WakePhrase.split("euh ok Day mets de la musique"),        cmd: "mets de la musique")
        checkMatch("la chanson dit ok Day",
                   WakePhrase.split("la chanson dit ok Day"),                cmd: "") // accepted false positive

        // LAST occurrence wins
        checkMatch("ok Day search ok Day play music",
                   WakePhrase.split("ok Day search ok Day play music"),   cmd: "play music")

        // Partial word-by-word delivery
        checkNoMatch("ok alone",             WakePhrase.split("ok"))
        checkMatch("ok Day partial",      WakePhrase.split("ok Day"),              cmd: "")
        checkMatch("ok Day with more",    WakePhrase.split("ok Day mets"),         cmd: "mets")

        // MARK: split — should NOT match
        checkNoMatch("standalone Day",    WakePhrase.split("Day"))
        checkNoMatch("standalone Day",    WakePhrase.split("Day"))
        checkNoMatch("partial Day ça va", WakePhrase.split("Day ça va"))
        checkNoMatch("Day comment",       WakePhrase.split("Day comment tu vas"))
        checkNoMatch("ok google",            WakePhrase.split("ok google"))
        checkNoMatch("hey siri",             WakePhrase.split("hey siri"))
        checkNoMatch("okkkk Day",         WakePhrase.split("okkkk Day"))
        checkNoMatch("empty",                WakePhrase.split(""))

        // Summary
        if failures == 0 { print("\n\(total)/\(total) tests passed.") }
        else { print("\n\(failures) test(s) FAILED."); exit(1) }
    }

    static var total = 0

    static func checkMatch(_ label: String, _ r: WakePhrase.SplitResult, cmd: String) {
        total += 1
        if !r.matched {
            print("✗  \(label) — expected match, got no match"); failures += 1; return
        }
        if r.command != cmd {
            print("✗  \(label) — matched ✓ but command \"\(r.command)\" ≠ \"\(cmd)\""); failures += 1; return
        }
        print("✓  \(label)")
    }

    static func checkNoMatch(_ label: String, _ r: WakePhrase.SplitResult) {
        total += 1
        if r.matched { print("✗  \(label) — expected no match, got matched (cmd: \"\(r.command)\")"); failures += 1 }
        else         { print("✓  \(label)") }
    }
}
