import { createFileRoute } from "@tanstack/react-router";
import { isAllowedResolveHost as isAllowed } from "@/lib/url-allowlist";
import { decodeGoogleNewsLink, googleNewsId } from "@/lib/google-news.server";

export const Route = createFileRoute("/api/public/resolve")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const target = url.searchParams.get("url");
        if (!target) return new Response("Bad request", { status: 400 });

        let parsedTarget: URL;
        try {
          parsedTarget = new URL(target);
        } catch {
          return new Response("Invalid URL", { status: 400 });
        }
        if (parsedTarget.protocol !== "https:" && parsedTarget.protocol !== "http:") {
          return new Response("Invalid protocol", { status: 400 });
        }
        if (!isAllowed(parsedTarget.hostname)) {
          return new Response("Forbidden host", { status: 403 });
        }

        if (googleNewsId(parsedTarget.toString())) {
          const decoded = await decodeGoogleNewsLink(parsedTarget.toString());
          if (decoded && isAllowed(new URL(decoded).hostname)) {
            return new Response(null, {
              status: 302,
              headers: { Location: decoded, "Cache-Control": "public, max-age=3600" },
            });
          }
        }

        try {
          const res = await fetch(parsedTarget.toString(), {
            redirect: "follow",
            headers: { "User-Agent": "Mozilla/5.0 BillBreaker" },
          });
          const finalUrl = res.url || parsedTarget.toString();
          // Re-validate the post-redirect host before issuing the 302.
          let finalParsed: URL;
          try {
            finalParsed = new URL(finalUrl);
          } catch {
            return new Response("Resolved to invalid URL", { status: 502 });
          }
          if (!isAllowed(finalParsed.hostname)) {
            return new Response("Resolved to disallowed host", { status: 403 });
          }
          return new Response(null, {
            status: 302,
            headers: {
              Location: finalParsed.toString(),
              "Cache-Control": "public, max-age=3600",
            },
          });
        } catch {
          return new Response("Resolution failed", { status: 502 });
        }
      },
    },
  },
});
