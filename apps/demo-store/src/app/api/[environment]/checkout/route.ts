import { respond, readBody, type RouteContext } from "../../../../lib/http";
import { checkoutSchema } from "../../../../lib/cart";
import { checkout } from "../../../../lib/store";
export const runtime = "nodejs";
export async function POST(request: Request, context: RouteContext) {
  return respond(context, async (environment, flags) =>
    checkout(environment, checkoutSchema.parse(await readBody(request)), flags),
  );
}
