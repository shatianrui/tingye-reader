import ExpoModulesCore
import PDFKit

public class TingyeDocumentsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TingyeDocuments")
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
