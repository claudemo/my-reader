import type { Source } from "@/lib/types";
import { toW3CAnnotation } from "./annotations";
import type { Annotation } from "@/lib/types";

const baseUrl = () => process.env.SEMIONT_BASE_URL?.replace(/\/$/, "");
const token = () => process.env.SEMIONT_TOKEN;

export async function syncSourceToSemiont(source: Source): Promise<string | null> {
  const url = baseUrl();
  if (!url) return null;

  try {
    const res = await fetch(`${url}/api/resources`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      },
      body: JSON.stringify({
        title: source.title,
        content: source.text_content,
        metadata: {
          url: source.url,
          author: source.author,
          source_type: source.source_type,
          myreader_id: source.id,
        },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}

export async function syncAnnotationToSemiont(
  annotation: Annotation,
  source: Source
): Promise<string | null> {
  const url = baseUrl();
  if (!url) return null;

  const w3c = toW3CAnnotation(annotation, source, url);
  const resourceId = source.semiont_resource_id ?? source.id;

  try {
    const res = await fetch(`${url}/api/resources/${resourceId}/annotations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      },
      body: JSON.stringify(w3c),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}

export async function gatherSemiontContext(
  resourceId: string,
  selectedText: string
): Promise<string | null> {
  const url = baseUrl();
  if (!url) return null;

  try {
    const res = await fetch(`${url}/api/resources/${resourceId}/discover-context`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      },
      body: JSON.stringify({ text: selectedText }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { context?: string };
    return data.context ?? null;
  } catch {
    return null;
  }
}

export async function detectAnnotationsWithSemiont(
  resourceId: string,
  instructions: string
): Promise<Array<{ text: string; motivation: string }>> {
  const url = baseUrl();
  if (!url) return [];

  try {
    const res = await fetch(
      `${url}/api/resources/${resourceId}/detect-annotations-stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        },
        body: JSON.stringify({
          types: ["highlight", "assessment", "tagging"],
          instructions,
        }),
      }
    );
    if (!res.ok || !res.body) return [];

    const text = await res.text();
    const suggestions: Array<{ text: string; motivation: string }> = [];
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        const data = JSON.parse(line.slice(5).trim()) as {
          annotation?: { body?: Array<{ value: string }>; motivation?: string };
          selectedText?: string;
        };
        const selected =
          data.selectedText ??
          data.annotation?.body?.find((b) => b.value)?.value;
        if (selected) {
          suggestions.push({
            text: selected,
            motivation: data.annotation?.motivation ?? "highlighting",
          });
        }
      } catch {
        /* skip malformed SSE chunks */
      }
    }
    return suggestions.slice(0, 5);
  } catch {
    return [];
  }
}

export function isSemiontConfigured(): boolean {
  return Boolean(baseUrl());
}
