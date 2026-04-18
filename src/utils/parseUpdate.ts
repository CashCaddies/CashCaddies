export function parseUpdate(raw: string) {
  const lines = raw.trim().split("\n");

  const title = lines.find((l) => l.startsWith("Title:"))?.replace("Title:", "").trim() || "Update";
  const tag = lines.find((l) => l.startsWith("Tag:"))?.replace("Tag:", "").trim() || "UPDATE";
  const time = lines.find((l) => l.startsWith("Time:"))?.replace("Time:", "").trim() || "Now";

  const contentStart = lines.findIndex((l) => l.trim() === "");
  const content = lines.slice(contentStart + 1).join("\n");

  return {
    id: Date.now(),
    title,
    tag,
    time,
    content,
  };
}
