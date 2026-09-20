import ExpoModulesCore
import PDFKit

public class TingyeDocumentsModule: Module {
  private let alignment = SpeechAlignment()
  public func definition() -> ModuleDefinition {
    Name("TingyeDocuments")
    AsyncFunction("requestSpeechAlignment") { (promise: Promise) in
      self.alignment.permission(promise)
    }.runOnQueue(.main)
    AsyncFunction("alignSpeech") { (id: String, uri: URL, text: String, promise: Promise) in
      self.alignment.align(id, uri, text, promise)
    }.runOnQueue(.main)
    AsyncFunction("cancelSpeechAlignment") { (id: String) in
      self.alignment.cancel(id)
    }.runOnQueue(.main)
    OnDestroy { DispatchQueue.main.async { self.alignment.cancelAll() } }
    AsyncFunction("readPDFPages") { (uri: URL) -> [String] in
      guard uri.isFileURL, let document = PDFDocument(url: uri), !document.isLocked else {
        throw NSError(domain: "TingyeDocuments", code: 1, userInfo: [NSLocalizedDescriptionKey: "无法打开 PDF，请确认文件未加密。"])
      }
      guard document.pageCount > 0, document.pageCount <= 2000 else {
        throw NSError(domain: "TingyeDocuments", code: 2, userInfo: [NSLocalizedDescriptionKey: "PDF 页数无效或超过 2000 页，请拆分导入。"])
      }
      var pages: [String] = []
      var total = 0
      for index in 0..<document.pageCount {
        let text = document.page(at: index)?.string ?? ""
        total += text.utf16.count
        guard total <= 4_000_000 else {
          throw NSError(domain: "TingyeDocuments", code: 3, userInfo: [NSLocalizedDescriptionKey: "正文超过 400 万字，请拆分导入。"])
        }
        // Empty text still represents a real page, rendered from the original PDF.
        pages.append(text)
      }
      return pages
    }
    AsyncFunction("readPDF") { (uri: URL) -> String in
      guard uri.isFileURL, let document = PDFDocument(url: uri), !document.isLocked else {
        throw NSError(domain: "TingyeDocuments", code: 1, userInfo: [NSLocalizedDescriptionKey: "无法打开 PDF，请确认文件未加密。"])
      }
      guard document.pageCount <= 2000 else {
        throw NSError(domain: "TingyeDocuments", code: 2, userInfo: [NSLocalizedDescriptionKey: "PDF 页数过多，请拆分导入。"])
      }
      var text = ""
      for i in 0..<document.pageCount {
        text += (document.page(at: i)?.string ?? "") + "\n"
        if text.count > 4_000_000 {
          throw NSError(domain: "TingyeDocuments", code: 3, userInfo: [NSLocalizedDescriptionKey: "正文超过 400 万字，请拆分导入。"])
        }
      }
      guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        throw NSError(domain: "TingyeDocuments", code: 4, userInfo: [NSLocalizedDescriptionKey: "此 PDF 没有可提取的文字，请先对扫描文件进行 OCR。"])
      }
      return text
    }
  }
}
