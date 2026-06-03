import path from "node:path";
import { pathToFileURL } from "node:url";
import { NextRequest, NextResponse } from "next/server";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("resume");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a PDF resume file." }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF resumes are supported right now." }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Resume PDF must be smaller than 5 MB." }, { status: 400 });
  }

  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const parsed = await extractPdfText(data);
    const text = cleanText(parsed.text);

    if (text.length < 80) {
      return NextResponse.json(
        {
          error:
            "Could not extract enough text from this PDF. Try a text-based resume or paste your resume manually.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      filename: file.name,
      pages: parsed.pages,
      text: text.length > 10000 ? `${text.slice(0, 10000)}...` : text,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not read this PDF. Try exporting the resume again or paste the text manually.",
      },
      { status: 422 },
    );
  }
}

async function extractPdfText(data: Uint8Array) {
  GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ).href;

  const document = await getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");

    pages.push(pageText);
  }

  return {
    pages: document.numPages,
    text: pages.join("\n\n"),
  };
}

function cleanText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
