import { respond, type RouteContext } from "../../../../../lib/http";
import { getProduct } from "../../../../../lib/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: RouteContext) {
  return respond(context, async (environment, flags, slug) => ({
    product: await getProduct(environment, slug ?? "", flags),
    flags,
  }));
}
