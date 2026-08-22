import Foundation
import Speech
import AVFoundation
import Capacitor

@objc(SpeechPlugin)
public class SpeechPlugin: CAPPlugin {

    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var audioEngine = AVAudioEngine()
    private var isListening = false

    @objc public override func requestPermissions(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { status in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                let speechGranted = status == .authorized
                print("[SpeechPlugin] Speech: \(speechGranted), Mic: \(granted)")
                call.resolve(["speech": speechGranted, "microphone": granted])
            }
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        guard !isListening else { call.reject("Already listening"); return }

        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            guard status == .authorized else {
                call.reject("Speech recognition not authorized")
                return
            }
            self?.startListening(call: call)
        }
    }

    private func startListening(call: CAPPluginCall) {
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
        guard recognizer?.isAvailable == true else {
            call.reject("Speech recognizer not available")
            return
        }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
            guard let recognitionRequest else { call.reject("Request failed"); return }
            recognitionRequest.shouldReportPartialResults = false

            let inputNode = audioEngine.inputNode
            let recordingFormat = inputNode.outputFormat(forBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
                self?.recognitionRequest?.append(buffer)
            }

            audioEngine.prepare()
            try audioEngine.start()
            isListening = true

            // Notify JS that listening has started
            notifyListeners("listeningStarted", data: [:])
            print("[SpeechPlugin] Listening started")

            recognitionTask = recognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
                guard let self else { return }
                if let result, result.isFinal {
                    let transcript = result.bestTranscription.formattedString
                    print("[SpeechPlugin] Result: \(transcript)")
                    self.stopListening()
                    call.resolve(["transcript": transcript])
                } else if let error {
                    print("[SpeechPlugin] Error: \(error)")
                    self.stopListening()
                    call.reject(error.localizedDescription)
                }
            }

            // Auto-stop after 8 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in
                self?.recognitionRequest?.endAudio()
            }

        } catch {
            call.reject("Audio engine failed: \(error.localizedDescription)")
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        stopListening()
        call.resolve()
    }

    private func stopListening() {
        recognitionRequest?.endAudio()
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask = nil
        isListening = false
        notifyListeners("listeningStopped", data: [:])

        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
