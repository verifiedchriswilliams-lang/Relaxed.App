// The ambient bed player for the Apple TV app.
//
// There's no voice pipeline in V1 (that's tvOS v2), so this is deliberately simple: it
// downloads the selected soundscape bed from the Blob host, decodes it into a PCM
// buffer, scales the samples by the bed's measured loudness gain (so beds sit at an
// even perceived level, the same normalization the web applies), and loops the buffer
// seamlessly through AVAudioEngine. Download + decode happen off the main actor; only
// the engine start/stop touches it on the main thread.
//
// Why AVAudioEngine (not AVPlayer): the measured gains BOOST the quiet nature beds well
// past unity, which AVPlayer's 0...1 volume can't do. Scaling the float PCM samples can,
// and normGain caps the gain so the peak stays under the ceiling, so it never clips.

import Foundation
import AVFoundation

@MainActor
final class BedPlayer: ObservableObject {
    @Published var loaded = false
    @Published var failed = false

    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private var loadTask: Task<Void, Never>?

    init() {
        engine.attach(player)
    }

    func configureSession() {
        let s = AVAudioSession.sharedInstance()
        try? s.setCategory(.playback, mode: .default)
        try? s.setActive(true)
    }

    // Load a bed and start looping it. Safe to call repeatedly (it stops any prior bed).
    func play(bed: Bed) {
        stop()
        loaded = false
        failed = false
        guard let url = Config.bedURL(bed) else { failed = true; return }
        let gain = Catalog.gain(for: bed)
        loadTask = Task { [weak self] in
            do {
                let buf = try await BedPlayer.loadBuffer(url: url, gain: gain)
                if Task.isCancelled { return }
                guard let self else { return }
                self.start(with: buf)
            } catch {
                guard let self, !Task.isCancelled else { return }
                self.failed = true
            }
        }
    }

    func pause() { player.pause() }

    func resume() {
        if !engine.isRunning { try? engine.start() }
        player.play()
    }

    func stop() {
        loadTask?.cancel()
        loadTask = nil
        if player.isPlaying { player.stop() }
        engine.stop()
        loaded = false
    }

    // MARK: - Engine (main actor)

    private func start(with buffer: AVAudioPCMBuffer) {
        engine.connect(player, to: engine.mainMixerNode, format: buffer.format)
        do {
            try engine.start()
            player.scheduleBuffer(buffer, at: nil, options: [.loops], completionHandler: nil)
            player.play()
            loaded = true
        } catch {
            failed = true
        }
    }

    // MARK: - Download + decode (off the main actor)

    nonisolated private static func loadBuffer(url: URL, gain: Float) async throws -> AVAudioPCMBuffer {
        let (tmp, _) = try await URLSession.shared.download(from: url)
        // AVAudioFile reads a local file; keep the extension so the decoder is picked.
        let ext = url.pathExtension.isEmpty ? "flac" : url.pathExtension
        let dest = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension(ext)
        try? FileManager.default.removeItem(at: dest)
        try FileManager.default.moveItem(at: tmp, to: dest)
        defer { try? FileManager.default.removeItem(at: dest) }

        let file = try AVAudioFile(forReading: dest)
        let format = file.processingFormat
        let frames = AVAudioFrameCount(file.length)
        guard frames > 0, let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames) else {
            throw NSError(domain: "relaxed.bed", code: 1, userInfo: [NSLocalizedDescriptionKey: "empty bed"])
        }
        try file.read(into: buffer)
        buffer.frameLength = frames

        // Apply the measured loudness gain by scaling the float PCM in place. normGain
        // caps the gain so the peak stays under the ceiling, so this never clips.
        if gain != 1, let channels = buffer.floatChannelData {
            let n = Int(buffer.frameLength)
            for c in 0..<Int(format.channelCount) {
                let p = channels[c]
                for i in 0..<n { p[i] *= gain }
            }
        }
        return buffer
    }
}
