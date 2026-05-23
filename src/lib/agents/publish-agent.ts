import fs from "fs";
import path from "path";
import type { Objective, Source, Annotation, Note, Reflection } from "@/lib/types";

const PUBLISH_DIR = path.join(process.cwd(), "public", "published");

export async function publishToSenso(payload: {
  objective: Objective;
  sources: Source[];
  annotations: Annotation[];
  notes: Note[];
  reflection: Reflection | null;
  title: string;
  content: string;
}): Promise<{ public_url: string; provider: string }> {
  if (!fs.existsSync(PUBLISH_DIR)) {
    fs.mkdirSync(PUBLISH_DIR, { recursive: true });
  }

  const slug = payload.objective.id.replace(/[^a-z0-9_]/gi, "-");
  const filename = `${slug}.md`;
  const filePath = path.join(PUBLISH_DIR, filename);
  fs.writeFileSync(filePath, payload.content, "utf-8");

  const publicUrl = `/published/${filename}`;

  const sensoKey = process.env.SENSO_API_KEY;
  if (sensoKey) {
    try {
      await fetch("https://api.senso.ai/v1/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sensoKey}`,
        },
        body: JSON.stringify({
          objective: payload.objective.title,
          sources: payload.sources.map((s) => ({
            title: s.title,
            url: s.url,
            excerpts: payload.annotations
              .filter((a) => a.source_id === s.id)
              .map((a) => ({
                text: a.selected_text,
                note: payload.notes.find((n) => n.annotation_id === a.id)?.claim ?? "",
                concepts: payload.notes.find((n) => n.annotation_id === a.id)?.concepts ?? [],
                user_reflection: payload.reflection?.user_response ?? "",
              })),
          })),
          output_type: "cited_learning_post",
          content: payload.content,
        }),
      });
      return { public_url: publicUrl, provider: "senso+local" };
    } catch {
      return { public_url: publicUrl, provider: "local" };
    }
  }

  return { public_url: publicUrl, provider: "local" };
}
