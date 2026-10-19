import { respond, type RouteContext } from "../../../../lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: RouteContext) {
  return respond(context, async (environment, flags) => ({ environment, flags }));
}
