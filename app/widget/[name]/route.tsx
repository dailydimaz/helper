import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }): Promise<NextResponse> {
  const { name } = await params;
  if (!/^sdk-?[a-z0-9_\-]*\.js$/i.test(name)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "public", name);

  try {
    const fileContents = await fs.readFile(filePath, "utf8");

    return new NextResponse(fileContents, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "public, max-age=300, s-maxage=86400",
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error reading file ${name}:`, error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
