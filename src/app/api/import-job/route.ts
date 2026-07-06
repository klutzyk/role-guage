import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import * as cheerio from "cheerio";
import { NextRequest, NextResponse } from "next/server";
import { maxImportedHtmlChars, maxPageUrlChars } from "@/lib/request-limits";
import { enforceRateLimit } from "@/lib/rate-limit";

const blockedHosts = ["linkedin.com", "www.linkedin.com"];
const blockedHostSuffixes = [".localhost", ".local", ".internal"];
const blockedHostnames = new Set([
  "localhost",
  "metadata.google.internal",
]);

class UnsafeFetchUrlError extends Error {}

export async function POST(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, {
    key: "api:import-job",
    limit: 20,
    windowMs: 60_000,
  });

  if (rateLimited) return rateLimited;

  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  const url = body?.url?.trim() ?? "";

  if (!url) {
    return NextResponse.json({ error: "Job URL is required." }, { status: 400 });
  }

  if (url.length > maxPageUrlChars) {
    return NextResponse.json({ error: "Job URL is too long." }, { status: 400 });
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
    const response = await fetchValidatedJobPage(parsedUrl);

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

    const contentLength = Number(response.headers.get("content-length") ?? 0);

    if (Number.isFinite(contentLength) && contentLength > maxImportedHtmlChars) {
      return NextResponse.json(
        { error: "This job page is too large to import. Copy the job description into the box below." },
        { status: 422 },
      );
    }

    const html = await response.text();

    if (html.length > maxImportedHtmlChars) {
      return NextResponse.json(
        { error: "This job page is too large to import. Copy the job description into the box below." },
        { status: 422 },
      );
    }

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
  } catch (error) {
    if (error instanceof UnsafeFetchUrlError) {
      return NextResponse.json(
        { error: "This URL cannot be imported. Copy the job description into the box below." },
        { status: 422 },
      );
    }

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

async function fetchValidatedJobPage(url: URL, redirectCount = 0): Promise<Response> {
  const unsafeReason = await getUnsafeFetchReason(url);

  if (unsafeReason) throw new UnsafeFetchUrlError(unsafeReason);

  const response = await fetch(url, {
    headers: {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-AU,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Referer: `${url.origin}/`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });

  if (isRedirectStatus(response.status)) {
    if (redirectCount >= 3) {
      throw new UnsafeFetchUrlError("Too many redirects.");
    }

    const location = response.headers.get("location");

    if (!location) throw new UnsafeFetchUrlError("Redirect did not include a location.");

    return fetchValidatedJobPage(new URL(location, url), redirectCount + 1);
  }

  return response;
}

async function getUnsafeFetchReason(url: URL) {
  const hostname = normalizeHostname(url.hostname);

  if (url.username || url.password) {
    return "URLs with embedded credentials are not supported.";
  }

  if (url.port && url.port !== "80" && url.port !== "443") {
    return "Only standard web ports are supported.";
  }

  if (blockedHostnames.has(hostname) || blockedHostSuffixes.some((suffix) => hostname.endsWith(suffix))) {
    return "Local hostnames are not supported.";
  }

  if (blockedHosts.includes(hostname) || hostname.endsWith(".linkedin.com")) {
    return "This host blocks automated extraction.";
  }

  const addresses = await resolveHostAddresses(hostname);

  if (!addresses.length) return "Host could not be resolved.";

  if (addresses.some(isPrivateOrReservedIp)) {
    return "Private or reserved network addresses are not supported.";
  }

  return "";
}

async function resolveHostAddresses(hostname: string) {
  if (isIP(hostname)) return [hostname];

  try {
    const records = await lookup(hostname, { all: true, verbatim: false });

    return records.map((record) => record.address);
  } catch {
    return [];
  }
}

function isPrivateOrReservedIp(address: string) {
  const normalized = address.toLowerCase();

  if (normalized.startsWith("::ffff:")) {
    return isPrivateOrReservedIp(normalized.slice(7));
  }

  if (isIP(normalized) === 6) {
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80") ||
      normalized.startsWith("ff") ||
      normalized.startsWith("2001:db8")
    );
  }

  if (isIP(normalized) !== 4) return true;

  const parts = normalized.split(".").map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b, c] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "");
}

function isRedirectStatus(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
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
