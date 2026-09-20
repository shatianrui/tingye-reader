package expo.modules.tingyedocuments

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.net.Uri
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import com.tom_roush.pdfbox.io.MemoryUsageSetting
import java.io.File

class TingyeDocumentsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TingyeDocuments")
    AsyncFunction("readPDFPages") { uriString: String ->
      val context = appContext.reactContext ?: error("应用尚未准备好，请重试。")
      val uri = Uri.parse(uriString)
      require(uri.scheme == "file" || uri.scheme == "content") { "请选择本机 PDF 文件。" }
      PDFBoxResourceLoader.init(context.applicationContext)
      val input = if (uri.scheme == "file") {
        val file = File(requireNotNull(uri.path)).canonicalFile
        val cache = context.cacheDir.canonicalFile
        require(file.path.startsWith(cache.path + File.separator)) { "请通过文件选择器重新导入 PDF。" }
        require(file.length() <= 40L * 1024 * 1024) { "PDF 超过 40 MB，请拆分后导入。" }
        file.inputStream()
      } else {
        context.contentResolver.openInputStream(uri) ?: error("无法读取所选 PDF。")
      }
      input.use { stream ->
        PDDocument.load(stream, MemoryUsageSetting.setupMixed(16L * 1024 * 1024).setTempDir(context.cacheDir)).use { document ->
          require(!document.isEncrypted && document.currentAccessPermission.canExtractContent()) { "暂不支持加密或禁止复制的 PDF。" }
          require(document.numberOfPages <= 3000) { "PDF 页数过多，请拆分后导入。" }
          val text = StringBuilder()
          val pages = mutableListOf<String>()
          val stripper = PDFTextStripper()
          for (page in 1..document.numberOfPages) {
            stripper.startPage = page
            stripper.endPage = page
            val content = stripper.getText(document)
            pages.add(content)
            text.append(content).append('\n')
            require(text.length <= 4_000_000) { "正文超过 400 万字，请拆分后导入。" }
          }
          pages
        }
      }
    }
  }
}
