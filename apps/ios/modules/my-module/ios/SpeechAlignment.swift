import Foundation
import Speech
import AVFoundation
import ExpoModulesCore

// All state is owned by the main queue. Decode generated files, never microphone input.
final class SpeechAlignment {
  private final class Job {
    let id: String
    let url: URL
    let text: String
    let promise: Promise
    var directory: URL?
    var chunks: [URL] = []
    var chunk = 0
    var words: [[String: Any]] = []
    var task: SFSpeechRecognitionTask?
    var recognizer: SFSpeechRecognizer?
    var timeout: DispatchWorkItem?
    init(_ id: String, _ url: URL, _ text: String, _ promise: Promise) {
      self.id = id; self.url = url; self.text = text; self.promise = promise
    }
  }
  private var pending: [Job] = []
  private var current: Job?

  func permission(_ promise: Promise) {
    SFSpeechRecognizer.requestAuthorization { status in
      DispatchQueue.main.async {
        promise.resolve(status == .authorized && SFSpeechRecognizer(locale: Locale(identifier: "zh-CN"))?.supportsOnDeviceRecognition == true)
      }
    }
  }
  func align(_ id: String, _ url: URL, _ text: String, _ promise: Promise) {
    guard url.isFileURL, text.utf16.count <= 2000,
          SFSpeechRecognizer.authorizationStatus() == .authorized else {
      promise.resolve(["words": [], "status": "permission"]); return
    }
    pending.append(Job(id, url, text, promise)); next()
  }
  func cancel(_ id: String) {
    for job in pending.filter({ $0.id == id }) { job.promise.resolve(["words": [], "status": "cancelled"]) }
    pending.removeAll { $0.id == id }
    if let job = current, job.id == id { finish(job, "cancelled") }
  }
  func cancelAll() {
    for job in pending { job.promise.resolve(["words": [], "status": "cancelled"]) }
    pending.removeAll()
    if let job = current { finish(job, "cancelled") }
  }
  private func next() {
    guard current == nil, !pending.isEmpty else { return }
    let job = pending.removeFirst(); current = job
    do {
      let audio = try AVAudioFile(forReading: job.url)
      let sampleRate = audio.processingFormat.sampleRate
      guard sampleRate > 0, audio.length > 0, Double(audio.length) / sampleRate <= 240 else {
        finish(job, "invalid-audio"); return
      }
      let dir = FileManager.default.temporaryDirectory.appendingPathComponent("tingye-alignment-" + UUID().uuidString)
      try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      job.directory = dir
      // Keep each recognition request below the speech service's one-minute limit.
      let size = AVAudioFrameCount(sampleRate * 45)
      while audio.framePosition < audio.length {
        let length = AVAudioFrameCount(min(Int64(size), audio.length - audio.framePosition))
        guard let buffer = AVAudioPCMBuffer(pcmFormat: audio.processingFormat, frameCapacity: length) else {
          finish(job, "invalid-audio"); return
        }
        try audio.read(into: buffer, frameCount: length)
        let url = dir.appendingPathComponent("chunk-\(job.chunks.count).wav")
        let output = try AVAudioFile(forWriting: url, settings: audio.processingFormat.settings)
        try output.write(from: buffer)
        job.chunks.append(url)
      }
      recognize(job)
    } catch { finish(job, "invalid-audio") }
  }
  private func recognize(_ job: Job) {
    guard current === job else { return }
    guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "zh-CN")),
          recognizer.supportsOnDeviceRecognition, recognizer.isAvailable else {
      finish(job, "unavailable"); return
    }
    job.recognizer = recognizer
    let chunk = job.chunk
    let request = SFSpeechURLRecognitionRequest(url: job.chunks[chunk])
    request.requiresOnDeviceRecognition = true
    request.shouldReportPartialResults = false
    request.taskHint = .dictation
    request.contextualStrings = Array(job.text.components(separatedBy: CharacterSet(charactersIn: "。！？\n")).filter { !$0.isEmpty }.prefix(80))
    let timeout = DispatchWorkItem { [weak self, weak job] in
      guard let self, let job, self.current === job, job.chunk == chunk else { return }
      self.finish(job, "timeout")
    }
    job.timeout = timeout
    DispatchQueue.main.asyncAfter(deadline: .now() + 25, execute: timeout)
    job.task = recognizer.recognitionTask(with: request) { [weak self, weak job] result, error in
      DispatchQueue.main.async {
        guard let self, let job, self.current === job, job.chunk == chunk else { return }
        if let result, result.isFinal {
          job.timeout?.cancel(); job.timeout = nil; job.task = nil
          for segment in result.bestTranscription.segments where segment.duration > 0 {
            job.words.append(["text": segment.substring, "startTime": Double(chunk) * 45 + segment.timestamp,
                              "endTime": Double(chunk) * 45 + segment.timestamp + segment.duration])
          }
          job.chunk += 1
          if job.chunk == job.chunks.count { self.finish(job, "aligned") }
          else { self.recognize(job) }
        } else if error != nil { self.finish(job, "unavailable") }
      }
    }
  }
  private func finish(_ job: Job, _ status: String) {
    guard current === job else { return }
    current = nil
    job.timeout?.cancel(); job.task?.cancel(); job.task = nil; job.recognizer = nil
    if let directory = job.directory { try? FileManager.default.removeItem(at: directory) }
    job.promise.resolve(["words": status == "aligned" ? job.words : [], "status": status])
    DispatchQueue.main.async { [weak self] in self?.next() }
  }
}
