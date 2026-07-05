import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const maxResumePdfBytes = 4 * 1024 * 1024;

class ServerDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: number[] | string) {
    if (Array.isArray(init)) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = [
        init[0] ?? 1,
        init[1] ?? 0,
        init[2] ?? 0,
        init[3] ?? 1,
        init[4] ?? 0,
        init[5] ?? 0,
      ];
    }
  }

  multiplySelf() {
    return this;
  }

  preMultiplySelf() {
    return this;
  }

  translateSelf() {
    return this;
  }

  scaleSelf() {
    return this;
  }

  rotateSelf() {
    return this;
  }

  invertSelf() {
    return this;
  }

  transformPoint(point?: { x?: number; y?: number; z?: number; w?: number }) {
    return {
      x: point?.x ?? 0,
      y: point?.y ?? 0,
      z: point?.z ?? 0,
      w: point?.w ?? 1,
    };
  }
}

function ensurePdfJsServerGlobals() {
  const globalScope = globalThis as Record<string, unknown>;

  globalScope["DOMMatrix"] ??= ServerDOMMatrix;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("resume");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a PDF resume file." }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF resumes are supported right now." }, { status: 400 });
  }

  if (file.size > maxResumePdfBytes) {
    return NextResponse.json({ error: "Resume PDF must be smaller than 4 MB." }, { status: 400 });
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
  } catch (error) {
    console.error("Resume PDF extraction failed", error);

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
  ensurePdfJsServerGlobals();
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const document = await getDocument({
    data,
    disableWorker: true,
    isEvalSupported: false,
    useWorkerFetch: false,
  } as Parameters<typeof getDocument>[0] & { disableWorker: boolean }).promise;
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
