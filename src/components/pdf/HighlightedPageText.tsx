import { Fragment, type ReactNode } from "react";

export interface PageHighlight {
  id: string;
  start: number;
  end: number;
}

function renderMarkedText(text: string, highlights: PageHighlight[]): ReactNode {
  if (!highlights.length) return text;

  const spans = [...highlights]
    .filter((h) => h.end > h.start && h.start < text.length)
    .sort((a, b) => a.start - b.start);

  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const span of spans) {
    const start = Math.max(0, span.start);
    const end = Math.min(text.length, span.end);
    if (end <= start || start < cursor) continue;

    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }

    nodes.push(
      <mark
        key={span.id}
        className="rounded-sm bg-amber-200/90 px-0.5 text-stone-900 ring-1 ring-amber-300/80"
        data-highlight-id={span.id}
      >
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function clipHighlights(highlights: PageHighlight[], start: number, end: number): PageHighlight[] {
  return highlights
    .filter((highlight) => highlight.end > start && highlight.start < end)
    .map((highlight) => ({
      ...highlight,
      start: Math.max(0, highlight.start - start),
      end: Math.min(end - start, highlight.end - start),
    }));
}

export function HighlightedPageText({
  text,
  highlights,
}: {
  text: string;
  highlights: PageHighlight[];
}) {
  if (!text.trim()) {
    return <p className="text-stone-400">No extractable text on this page.</p>;
  }

  const paragraphs = text.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);

  if (paragraphs.length <= 1) {
    return (
      <div className="whitespace-pre-wrap text-base leading-7 text-stone-800">
        {renderMarkedText(text, highlights)}
      </div>
    );
  }

  let cursor = 0;

  return (
    <div className="whitespace-pre-wrap text-base leading-7 text-stone-800">
      {paragraphs.map((paragraph, index) => {
        const start = cursor;
        const end = start + paragraph.length;
        cursor = end + (index < paragraphs.length - 1 ? 2 : 0);

        return (
          <Fragment key={`${index}-${paragraph.slice(0, 24)}`}>
            {index > 0 ? "\n\n" : null}
            {renderMarkedText(paragraph, clipHighlights(highlights, start, end))}
          </Fragment>
        );
      })}
    </div>
  );
}
