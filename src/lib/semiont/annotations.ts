import type { Annotation, Source, W3CAnnotation } from "@/lib/types";

export function toW3CAnnotation(
  annotation: Annotation,
  source: Source,
  semiontBaseUrl?: string
): W3CAnnotation {
  const base = semiontBaseUrl ?? "urn:myreader:resource";
  return {
    "@context": "http://www.w3.org/ns/anno.jsonld",
    id: `urn:myreader:annotation:${annotation.id}`,
    type: "Annotation",
    motivation: "highlighting",
    body: [
      { type: "TextualBody", purpose: "commenting", value: annotation.user_comment ?? "" },
      { type: "TextualBody", purpose: "tagging", value: annotation.annotation_type },
    ],
    target: {
      source: `${base}/${source.semiont_resource_id ?? source.id}`,
      selector: {
        type: "TextPositionSelector",
        start: annotation.start_offset,
        end: annotation.end_offset,
      },
    },
  };
}

export function splitIntoSections(text: string): string[] {
  const byHeading = text.split(/\n(?=#{1,3}\s)/);
  if (byHeading.length > 1) return byHeading.filter(Boolean);

  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 80);
  if (paragraphs.length > 1) {
    const sections: string[] = [];
    let chunk = "";
    for (const p of paragraphs) {
      chunk += (chunk ? "\n\n" : "") + p;
      if (chunk.length > 1200) {
        sections.push(chunk);
        chunk = "";
      }
    }
    if (chunk) sections.push(chunk);
    return sections.length ? sections : [text];
  }
  return [text];
}
