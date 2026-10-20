import Foundation
import Capacitor
import Speech
import AVFoundation

// On-device speech input for the voiced onboarding (Phase 2). One call to listen() =
// one short spoken utterance -> a transcript, recognized ON DEVICE
// (requiresOnDeviceRecognition when supported) so nothing leaves the phone, matching
// relaxed's no-backend / on-device stance. Best-effort: any permission denial or error
// rejects the call, and the web side (lib/speech.ts) falls back to typing.
//
// The web layer reaches this as Capacitor.Plugins.SpeechInput. Registered in
// MainViewController.swift (capacitorDidLoad), like the Premium / WatchBridge plugins.
//
// Requires two Info.plist usage strings (the app won't get mic/speech permission
// without them): NSMicrophoneUsageDescription and NSSpeechRecognitionUsageDescription.
// See native/ios-plugin/README.md.
@objc(SpeechInputPlugin)
public class SpeechInputPlugin: CAPPlugin {

    private let audioEngine = AVAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var pending: CAPPluginCall?
    private var autoStop: DispatchWorkItem?

    @objc func listen(_ call: CAPPluginCall) {
        let locale = call.getString("locale") ?? "en-US"
        // Speech-recognition authorization, then microphone authorization, then start.
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            guard status == .authorized else {
                call.reject("Speech recognition not authorized")
                return
            }
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                guard granted else {
                    call.reject("Microphone not authorized")
                    return
                }
                DispatchQueue.main.async { self?.start(call, locale: locale) }
            }
        }
    }

    private func start(_ call: CAPPluginCall, locale: String) {
        stopAll()

        guard let rec = SFSpeechRecognizer(locale: Locale(identifier: locale)), rec.isAvailable else {
            call.reject("Recognizer unavailable")
            return
        }
        recognizer = rec

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = false
        if rec.supportsOnDeviceRecognition { req.requiresOnDeviceRecognition = true }
        request = req
        pending = call

        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            finish(transcript: "", error: "Audio session error: \(error.localizedDescription)")
            return
        }

        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.request?.append(buffer)
        }
        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            finish(transcript: "", error: "Audio engine error: \(error.localizedDescription)")
            return
        }

        task = rec.recognitionTask(with: req) { [weak self] result, error in
            guard let self = self else { return }
            if let result = result, result.isFinal {
                self.finish(transcript: result.bestTranscription.formattedString, error: nil)
            } else if error != nil {
                // Resolve with whatever we have rather than surfacing an error; the UI
                // treats "" as "didn't catch it" and offers the typed path.
                self.finish(transcript: result?.bestTranscription.formattedString ?? "", error: nil)
            }
        }

        // Stop capturing after a short window so a single answer resolves promptly; the
        // recognizer then emits its final result.
        let work = DispatchWorkItem { [weak self] in self?.endAudio() }
        autoStop = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 6.0, execute: work)
    }

    // Stop capturing audio; the recognizer then delivers its final transcription.
    private func endAudio() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        request?.endAudio()
    }

    private func finish(transcript: String, error: String?) {
        let call = pending
        pending = nil
        stopAll()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        if let error = error {
            call?.reject(error)
        } else {
            call?.resolve(["transcript": transcript])
        }
    }

    private func stopAll() {
        autoStop?.cancel()
        autoStop = nil
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        task?.cancel()
        task = nil
        request = nil
    }
}
