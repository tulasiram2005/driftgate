import { z } from "zod";
import { StoreError } from "./errors";
import { getFlags, parseEnvironment, type BugFlag, type Environment } from "./flags";

export type RouteContext = { params: Promise<{ environment: string; slug?: string }> };
export async function respond(
  context: RouteContext,
  action: (environment: Environment, flags: BugFlag[], slug?: string) => Promise<unknown>,
) {
  try {
    const params = await context.params;
    const environment = parseEnvironment(params.environment);
    const data = await action(environment, getFlags(environment), params.slug);
    return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof StoreError;
    const invalid = error instanceof z.ZodError;
    return Response.json(
      {
        error: {
          code: known ? error.code : invalid ? "INVALID_REQUEST" : "STORE_UNAVAILABLE",
          message: known
            ? error.message
            : invalid
              ? "Request does not match the cart contract."
              : "The demo store is temporarily unavailable.",
        },
      },
      {
        status: known ? error.status : invalid ? 400 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
export async function readBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase().endsWith("/json"))
    throw new StoreError(400, "INVALID_CONTENT_TYPE", "Send an application/json body.");
  const reader = request.body?.getReader();
  if (!reader) throw new StoreError(400, "INVALID_JSON", "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 16384) {
        await reader.cancel();
        throw new StoreError(400, "BODY_TOO_LARGE", "Cart body exceeds 16 KiB.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof StoreError) throw error;
    throw new StoreError(400, "INVALID_JSON", "Send valid JSON.");
  } finally {
    reader.releaseLock();
  }
}
