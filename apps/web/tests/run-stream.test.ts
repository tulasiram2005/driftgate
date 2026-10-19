import { describe, expect, it } from "vitest";
import { consumeEvents, type RunEvent } from "../src/lib/run-stream";

function stream(parts: string[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      parts.forEach((part) => controller.enqueue(new TextEncoder().encode(part)));
      controller.close();
    },
  });
}
describe("resumable run event decoding", () => {
  it("handles fragmented CRLF events, comments and multiline data", async () => {
    const events: RunEvent[] = [];
    await consumeEvents(
      stream([
        ": heartbeat\r\nid: 4\r",
        '\nevent: result\r\ndata: {"status":\r\n',
        'data: "PASS"}\r\n\r',
        "\ndata: complete\n\n",
      ]),
      (event) => events.push(event),
    );
    expect(events).toEqual([
      { id: "4", event: "result", data: '{"status":\n"PASS"}' },
      { id: "4", event: "message", data: "complete" },
    ]);
  });
  it("does not publish incomplete events or accept null bytes in resume ids", async () => {
    const events: RunEvent[] = [];
    await consumeEvents(stream(["id: 7\nid: bad\0id\ndata: valid\n\ndata: unfinished"]), (event) =>
      events.push(event),
    );
    expect(events).toEqual([{ id: "7", event: "message", data: "valid" }]);
  });
  it("bounds untrusted stream buffers", async () => {
    await expect(
      consumeEvents(stream(["x".repeat(1024 * 1024 + 1)]), () => undefined),
    ).rejects.toThrow("size limit");
  });
});
