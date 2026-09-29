// Logs a completed sit as Mindful Minutes to Apple Health. Everything is
// best-effort: no-ops when Health is unavailable or permission is denied, so a
// refusal never breaks a session. Requires the HealthKit capability and the
// NSHealthShareUsageDescription / NSHealthUpdateUsageDescription Info.plist keys
// (see README).

import Foundation
import HealthKit

final class HealthStore {
    private let store = HKHealthStore()
    // Force-unwrap is safe: .mindfulSession is a system-defined category type.
    private let mindful = HKObjectType.categoryType(forIdentifier: .mindfulSession)!

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    // Ask once, early (on first launch of the setup screen). Read is empty — we
    // only ever write mindful minutes, never read the user's health data.
    func requestAuthorization() {
        guard isAvailable else { return }
        store.requestAuthorization(toShare: [mindful], read: []) { _, _ in }
    }

    // Save one mindful session spanning the sit. `.notApplicable` is the correct
    // value for a mindful-session sample (its duration is start..end).
    func saveMindfulMinutes(start: Date, end: Date) {
        guard isAvailable, end > start else { return }
        let sample = HKCategorySample(
            type: mindful,
            value: HKCategoryValue.notApplicable.rawValue,
            start: start,
            end: end
        )
        store.save(sample) { _, _ in }
    }
}
