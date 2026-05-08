import { NextRequest, NextResponse } from "next/server";

function normalizeRemoteImageUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);

    if (url.hostname === "drive.google.com") {
      const filePathMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
      const fileId = filePathMatch?.[1] ?? url.searchParams.get("id");

      if (fileId) {
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
      }
    }

    if (url.hostname.endsWith("dropbox.com")) {
      url.searchParams.set("raw", "1");
      url.searchParams.delete("dl");
      return url.toString();
    }

    if (url.hostname === "github.com" && url.pathname.includes("/blob/")) {
      return url.toString().replace("github.com/", "raw.githubusercontent.com/").replace("/blob/", "/");
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ message: "url is required" }, { status: 400 });
  }

  const normalizedUrl = normalizeRemoteImageUrl(rawUrl);

  try {
    const remoteResponse = await fetch(normalizedUrl, {
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "PitchEvaluatorImageProxy/1.0",
      },
      cache: "no-store",
    });

    if (!remoteResponse.ok) {
      return NextResponse.json(
        { message: `Failed to fetch remote image (${remoteResponse.status})` },
        { status: 502 },
      );
    }

    const contentType = remoteResponse.headers.get("content-type") ?? "application/octet-stream";

    return new NextResponse(remoteResponse.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Failed to load remote image" },
      { status: 502 },
    );
  }
}
