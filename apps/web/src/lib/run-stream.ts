export type RunEvent = { id: string; event: string; data: string };

// A network chunk can end anywhere, including between CR and LF or inside JSON.
export async function consumeEvents(
  stream: ReadableStream<Uint8Array>,
  receive: (event: RunEvent) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let current: RunEvent = { id: "", event: "message", data: "" };
  let data: string[] = [];
  const line = (value: string) => {
    if (!value) {
      if (data.length) receive({ ...current, data: data.join("\n") });
      current = { id: current.id, event: "message", data: "" };
      data = [];
      return;
    }
    if (value.startsWith(":")) return;
    const separator = value.indexOf(":");
    const field = separator < 0 ? value : value.slice(0, separator);
    let content = separator < 0 ? "" : value.slice(separator + 1);
    if (content.startsWith(" ")) content = content.slice(1);
    if (field === "data") data.push(content);
    else if (field === "event") current.event = content;
    else if (field === "id" && !content.includes("\0")) current.id = content;
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 1024 * 1024) throw new Error("Live update exceeded the size limit.");
      let end: number;
      while ((end = buffer.indexOf("\n")) !== -1) {
        line(buffer.slice(0, end).replace(/\r$/, ""));
        buffer = buffer.slice(end + 1);
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
