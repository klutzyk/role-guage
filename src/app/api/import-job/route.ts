import * as cheerio from "cheerio";
import { NextRequest, NextResponse } from "next/server";

const blockedHosts = ["linkedin.com", "www.linkedin.com"];

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  const url = body?.url?.trim() ?? "";

  if (!url) {
    return NextResponse.json({ error: "Job URL is required." }, { status: 400 });
  }

  const parsedUrl = parseHttpUrl(url);

  if (!parsedUrl) {
    return NextResponse.json({ error: "Enter a valid http or https job URL." }, { status: 400 });
  }

  if (blockedHosts.includes(parsedUrl.hostname.toLowerCase())) {
    return NextResponse.json(
      {
        error:
          "This job board blocks automated extraction. Copy the job description from the page and paste it into the job description box below.",
      },
      { status: 422 },
    );
  }

  try {
    const response = await fetch(parsedUrl, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Referer: `${parsedUrl.origin}/`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      if (response.status === 403) {
        return NextResponse.json(
          {
            error:
              "This job board blocked the server import request. Copy the job description from the page and paste it into the job description box below.",
          },
          { status: 422 },
        );
      }

      return NextResponse.json(
        { error: `Could not fetch this job page. Status: ${response.status}.` },
        { status: 422 },
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("text/html")) {
      return NextResponse.json(
        { error: "This URL did not return an HTML job page." },
        { status: 422 },
      );
    }

    const html = await response.text();
    const extracted = extractJobPosting(html);

    if (extracted.description.length < 120) {
      return NextResponse.json(
        {
          error:
            "Could not find enough job description text on this page. Copy the job description from the page and paste it into the job description box below.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      title: extracted.title,
      company: extracted.company,
      location: extracted.location,
      description: extracted.description,
      sourceUrl: parsedUrl.toString(),
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not import this job URL. Some job boards block automated extraction, so paste the job description into the box below.",
      },
      { status: 422 },
    );
  }
}

function parseHttpUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    return ["http:", "https:"].includes(parsedUrl.protocol) ? parsedUrl : null;
  } catch {
    return null;
  }
}

function extractJobPosting(html: string) {
  const $ = cheerio.load(html);
  const jsonLdPosting = extractFromJsonLd($);

  if (jsonLdPosting.description) {
    return jsonLdPosting;
  }

  $("script, style, nav, header, footer, noscript, svg").remove();

  const title =
    cleanText($("meta[property='og:title']").attr("content")) ||
    cleanText($("h1").first().text()) ||
    cleanText($("title").text());

  const company =
    cleanText($("[data-testid*='company'], [class*='company'], [class*='employer']").first().text()) ||
    "";

  const location =
    cleanText($("[data-testid*='location'], [class*='location']").first().text()) || "";

  const mainText = cleanText(
    $("main, article, [role='main'], body")
      .first()
      .text()
      .replace(/\s+/g, " "),
  );

  return {
    title,
    company,
    location,
    description: trimDescription(mainText),
  };
}

function extractFromJsonLd($: cheerio.CheerioAPI) {
  let posting = { title: "", company: "", location: "", description: "" };

  $("script[type='application/ld+json']").each((_, element) => {
    if (posting.description) return;

    try {
      const raw = $(element).contents().text();
      const data = JSON.parse(raw) as unknown;
      const jobPosting = findJobPosting(data);

      if (jobPosting) {
        posting = {
          title: cleanText(jobPosting.title),
          company: cleanText(jobPosting.hiringOrganization?.name),
          location: cleanText(formatLocation(jobPosting.jobLocation)),
          description: trimDescription(cleanText(stripHtml(jobPosting.description ?? ""))),
        };
      }
    } catch {
      // Ignore invalid JSON-LD blocks and continue with fallback extraction.
    }
  });

  return posting;
}

function findJobPosting(data: unknown): JobPostingLike | null {
  if (!data || typeof data !== "object") return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }

  const record = data as Record<string, unknown>;
  const type = record["@type"];

  if (
    type === "JobPosting" ||
    (Array.isArray(type) && type.some((item) => String(item).toLowerCase() === "jobposting"))
  ) {
    return record as JobPostingLike;
  }

  if (record["@graph"]) {
    return findJobPosting(record["@graph"]);
  }

  return null;
}

type JobPostingLike = {
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string };
  jobLocation?: unknown;
};

function formatLocation(location: unknown): string {
  if (!location) return "";

  if (Array.isArray(location)) {
    return location.map(formatLocation).filter(Boolean).join(", ");
  }

  if (typeof location !== "object") return String(location);

  const address = (location as { address?: unknown }).address;

  if (!address || typeof address !== "object") return "";

  const parts = [
    (address as { addressLocality?: string }).addressLocality,
    (address as { addressRegion?: string }).addressRegion,
    (address as { addressCountry?: string }).addressCountry,
  ];

  return parts.filter(Boolean).join(", ");
}

function stripHtml(value: string) {
  return cheerio.load(value).text();
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function trimDescription(value: string) {
  const cleaned = cleanText(value);
  return cleaned.length > 8000 ? `${cleaned.slice(0, 8000)}...` : cleaned;
}
