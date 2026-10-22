import type { NextRequest } from "next/server";

// APP_URL wins when set; otherwise use the URL the request came in on, so
// Vercel preview deployments work without per-deploy configuration.
export const appUrl = (req: NextRequest) => process.env.APP_URL || req.nextUrl.origin;
