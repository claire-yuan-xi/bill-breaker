import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "./integrations/supabase/auth-attacher";
import { applySecurityHeaders } from "./lib/security-headers";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  if (result instanceof Response) return applySecurityHeaders(result);
  const maybe = result as unknown as { response?: Response };
  if (maybe?.response instanceof Response) applySecurityHeaders(maybe.response);
  return result;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware, errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
