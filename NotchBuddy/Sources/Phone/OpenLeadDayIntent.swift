import AppIntents
import Foundation

/// Opens Day on the Day that needs you most (Control Center button).
/// Compiled into the app and the widgets extension.
struct OpenLeadDayIntent: AppIntent {
    static let title: LocalizedStringResource = "Open the agent that needs you"

    func perform() async throws -> some IntentResult & OpensIntent {
        let url = SharedSessions.load().first.map { SharedSession.url(for: $0.id) } ?? URL(string: "day://home")!
        return .result(opensIntent: OpenURLIntent(url))
    }
}
