// The soundscape catalog for the Apple TV app, mirrored from lib/audio/soundscapes.ts
// and lib/audio/levels.ts. Three families (Nature / Music / Frequencies), 24 beds, the
// same ids/labels/files and the same MEASURED loudness (rms/peak/trim) the web uses to
// normalize each bed. Data + pure math only.
//
// V1 ships the 15 FREE beds. The 9 premium beds are kept in the data (so a later tvOS
// build can light them up behind a StoreKit entitlement) but filtered out of the
// picker for now, since the paywall/IAP isn't ported to tvOS yet.

import Foundation

struct Bed: Identifiable, Equatable {
    let id: String       // motif id (matches SoundMotif + the web)
    let label: String    // human-readable name (no em dashes in UI copy)
    let cat: String      // "nature" | "music" | "frequencies"
    let premium: Bool
    let file: String     // file name under /sounds/ on the Blob host
    let rms: Double       // measured dBFS
    let peak: Double      // measured dBFS true peak
    let trim: Double      // perceptual LUFS-vs-RMS correction (dB), 0 when absent
}

enum Config {
    // The PUBLIC Vercel Blob base that hosts the soundscape beds, e.g.
    // "https://xxxxxxxx.public.blob.vercel-storage.com". This is NEXT_PUBLIC_BLOB_BASE_URL
    // (see lib/assets.ts) — a public, non-secret value. FILL THIS IN with your store's
    // base before shipping (see native/tvos/README.md). Empty = the app runs the
    // breathing visual silently and shows a "sound unavailable" note.
    static let blobBase = ""

    static func bedURL(_ bed: Bed) -> URL? {
        let base = blobBase.replacingOccurrences(of: "/+$", with: "", options: .regularExpression)
        guard !base.isEmpty else { return nil }
        return URL(string: base + "/sounds/" + bed.file)
    }
}

enum Catalog {
    // Target loudness for a solo (no-voice) ambient bed, mirrored from lib/audio/levels.ts
    // (BED_SOLO), and the true-peak ceiling. tvOS V1 is ambient-only, so beds always play
    // "solo" (there's no voice to sit under).
    static let bedSolo: Double = -19
    static let peakCeil: Double = -1.5

    // normGain mirrored from lib/audio/levels.ts: linear gain to move a signal toward a
    // target loudness, capped so the true peak stays under the ceiling (so scaling the
    // samples by this never clips).
    static func normGain(rms: Double, peak: Double, target: Double) -> Double {
        let db = min(target - rms, peakCeil - peak)
        return pow(10, db / 20)
    }

    // Linear playback gain for a bed played solo. Applied by scaling the decoded PCM
    // samples (BedPlayer), so it can boost quiet beds past unity without clipping.
    static func gain(for bed: Bed) -> Float {
        Float(normGain(rms: bed.rms, peak: bed.peak, target: bedSolo + bed.trim))
    }

    struct Family: Identifiable { let id: String; let label: String }

    static let families: [Family] = [
        Family(id: "nature", label: "Nature"),
        Family(id: "music", label: "Music"),
        Family(id: "frequencies", label: "Frequencies"),
    ]

    static let beds: [Bed] = [
        // Nature
        Bed(id: "rain", label: "Rain", cat: "nature", premium: false, file: "Rain.flac", rms: -49.0, peak: -22.5, trim: -2),
        Bed(id: "ocean", label: "Ocean Waves", cat: "nature", premium: false, file: "Ocean.flac", rms: -35.0, peak: -12.1, trim: -1.5),
        Bed(id: "thunder", label: "Thunderstorm", cat: "nature", premium: false, file: "Thunderstorm.flac", rms: -40.9, peak: -11.3, trim: 0),
        Bed(id: "wind", label: "Wind", cat: "nature", premium: false, file: "Wind.flac", rms: -47.7, peak: -30.3, trim: -0.5),
        Bed(id: "birdsong", label: "Birdsong", cat: "nature", premium: false, file: "Birdsong.flac", rms: -52.5, peak: -30.2, trim: -1.5),
        Bed(id: "brook", label: "Babbling Brook", cat: "nature", premium: true, file: "BabblingBrook.flac", rms: -48.0, peak: -24.8, trim: -2),
        Bed(id: "campfire", label: "Campfire", cat: "nature", premium: true, file: "Campfire.flac", rms: -51.6, peak: -10.9, trim: -1.5),
        Bed(id: "windchimes", label: "Windchimes", cat: "nature", premium: true, file: "Windchimes.flac", rms: -34.9, peak: -16.2, trim: -0.5),
        // Music
        Bed(id: "pad", label: "Ambient", cat: "music", premium: false, file: "Ambient.flac", rms: -18.9, peak: -11.3, trim: 1),
        Bed(id: "piano", label: "Piano", cat: "music", premium: false, file: "Piano.flac", rms: -37.5, peak: -15.5, trim: -1),
        Bed(id: "lofi", label: "LoFi", cat: "music", premium: false, file: "LoFi.flac", rms: -19.8, peak: -10.7, trim: 0.5),
        Bed(id: "strings", label: "Warm Strings", cat: "music", premium: false, file: "WarmStrings.flac", rms: -19.7, peak: -11.3, trim: 0),
        Bed(id: "harp", label: "Harp", cat: "music", premium: false, file: "Harp.flac", rms: -25.7, peak: -11.3, trim: -1),
        Bed(id: "bowls", label: "Singing Bowls", cat: "music", premium: true, file: "SingingBowls.flac", rms: -17.7, peak: -10.8, trim: 0),
        Bed(id: "kalimba", label: "Kalimba", cat: "music", premium: true, file: "Kalimba.flac", rms: -18.4, peak: -9.9, trim: 0),
        Bed(id: "flute", label: "Flute", cat: "music", premium: true, file: "Flute.flac", rms: -20.5, peak: -11.2, trim: 0),
        // Frequencies
        Bed(id: "whitenoise", label: "White Noise", cat: "frequencies", premium: false, file: "WhiteNoise.flac", rms: -22.5, peak: -11.1, trim: -0.5),
        Bed(id: "brown", label: "Brown Noise", cat: "frequencies", premium: false, file: "BrownNoise.flac", rms: -39.1, peak: -21.1, trim: 0),
        Bed(id: "pad432", label: "432 Hz", cat: "frequencies", premium: false, file: "432Hz.flac", rms: -16.2, peak: -1.8, trim: 0),
        Bed(id: "binaural", label: "Binaural", cat: "frequencies", premium: false, file: "Binaural.flac", rms: -26.5, peak: -12.0, trim: 0),
        Bed(id: "alpha", label: "Alpha", cat: "frequencies", premium: false, file: "Alpha.flac", rms: -18.8, peak: -11.3, trim: 0),
        Bed(id: "green", label: "Green Noise", cat: "frequencies", premium: true, file: "GreenNoise.flac", rms: -15.9, peak: -8.4, trim: 0.5),
        Bed(id: "theta", label: "Theta", cat: "frequencies", premium: true, file: "Theta.flac", rms: -19.7, peak: -11.3, trim: 2),
        Bed(id: "delta", label: "Delta", cat: "frequencies", premium: true, file: "Delta.flac", rms: -16.6, peak: -8.6, trim: 1.5),
    ]

    // V1 picker: free beds only.
    static var freeBeds: [Bed] { beds.filter { !$0.premium } }

    static func freeBeds(in cat: String) -> [Bed] { freeBeds.filter { $0.cat == cat } }
}
