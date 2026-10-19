import { respond, readBody, type RouteContext } from "../../../../lib/http";
import { cartSchema } from "../../../../lib/cart";
import { quote } from "../../../../lib/store";
export const runtime = "nodejs";
export async function POST(request: Request, context: RouteContext) {
  return respond(context, async (environment, flags) =>
    quote(environment, cartSchema.parse(await readBody(request)), flags),
  );
}
