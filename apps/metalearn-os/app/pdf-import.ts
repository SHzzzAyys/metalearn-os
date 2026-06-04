"use client";

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
}

let pdfWorkerConfigured = false;

export async function extractPdfTextFromFile(file: File): Promise<PdfExtractionResult> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new Error("请选择 PDF 文件。");

  const pdfjs = await import("pdfjs-dist");
  if (!pdfWorkerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
    pdfWorkerConfigured = true;
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false
  });

  try {
    const document = await loadingTask.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText) pages.push(pageText);
    }

    const text = pages.join("\n\n").trim();
    if (text.length < 40) {
      throw new Error("这个 PDF 没有足够的可读取文本层。当前版本不做扫描件 OCR，请换成可复制文本的 PDF，或手工粘贴文本。");
    }

    return { text, pageCount: document.numPages };
  } finally {
    await loadingTask.destroy();
  }
}
