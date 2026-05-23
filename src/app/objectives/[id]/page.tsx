"use client";

import { use, useCallback, useEffect, useState } from "react";
import { WorkspaceShell, type SideTab } from "@/components/WorkspaceShell";
import { SidePanelObjective } from "@/components/side/SidePanelObjective";
import { SidePanelExcerpts } from "@/components/side/SidePanelExcerpts";
import { ReadingMapPanel } from "@/components/panels/ReadingMapPanel";
import { PdfReader } from "@/components/pdf/PdfReader";
import { ReaderUploadState } from "@/components/pdf/ReaderUploadState";
import { AgentTraceSidebar, AgentTraceView } from "@/components/trace/AgentTraceView";
import type { LearningObjective } from "@/lib/types/learning-objective";

interface WorkspaceData {
  objective: {
    id: string;
    title: string;
    description: string;
    output_intent: string;
    trace_id: string;
  };
  learning_objectives: LearningObjective[];
  sources: Array<{ id: string; title: string; url: string; semiont_resource_id: string | null }>;
  annotations: Array<{
    id: string;
    source_id: string;
    selected_text: string;
    start_offset: number;
    end_offset: number;
    page_index?: number | null;
    semiont_annotation_id: string | null;
    user_comment: string | null;
    created_at: string;
    learning_objective_id?: string | null;
  }>;
  excerpt_cards: Array<{
    id: string;
    annotation_id: string;
    key_claim: string;
    relevance_to_objective: string;
    evidence_role: string;
    concepts: string[];
  }>;
  notes: Array<{ id: string; annotation_id: string; claim: string; explanation: string }>;
}

interface SourceDetail {
  id: string;
  title: string;
  pages: string[];
  source_type: string;
  file_path: string | null;
}

export default function ObjectiveWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: workspaceId } = use(params);
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [sourceDetail, setSourceDetail] = useState<SourceDetail | null>(null);
  const [sideTab, setSideTab] = useState<SideTab>("objective");
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [activeLearningObjectiveId, setActiveLearningObjectiveId] = useState<string | null>(null);
  const [activeNotes, setActiveNotes] = useState<{
    cards: WorkspaceData["excerpt_cards"];
    notes: WorkspaceData["notes"];
    annotations: WorkspaceData["annotations"];
  }>({ cards: [], notes: [], annotations: [] });
  const [traceFilterId, setTraceFilterId] = useState<string | null>(null);
  const [sourceVersion, setSourceVersion] = useState(0);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    const res = await fetch(`/api/objectives/${workspaceId}`);
    if (!res.ok) return;
    const json = (await res.json()) as WorkspaceData;
    setData(json);

    if (json.learning_objectives.length > 0 && !activeLearningObjectiveId) {
      setActiveLearningObjectiveId(json.learning_objectives[0].id);
    }

    if (json.sources.length > 0 && !activeSourceId) {
      setActiveSourceId(json.sources[0].id);
    }
  }, [workspaceId, activeLearningObjectiveId, activeSourceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const refreshNotes = useCallback(async () => {
    if (!workspaceId || !activeLearningObjectiveId) {
      setActiveNotes({ cards: [], notes: [], annotations: [] });
      return;
    }
    const res = await fetch(`/api/objectives/${workspaceId}`);
    if (!res.ok) return;
    const json = (await res.json()) as WorkspaceData;
    const annIds = new Set(
      json.annotations
        .filter((a) => a.learning_objective_id === activeLearningObjectiveId)
        .map((a) => a.id)
    );
    setActiveNotes({
      annotations: json.annotations.filter((a) => a.learning_objective_id === activeLearningObjectiveId),
      cards: json.excerpt_cards.filter((c) => annIds.has(c.annotation_id)),
      notes: json.notes.filter((n) => annIds.has(n.annotation_id)),
    });
  }, [workspaceId, activeLearningObjectiveId]);

  useEffect(() => {
    refreshNotes();
  }, [refreshNotes, data]);

  const loadSource = useCallback(async (sourceId: string) => {
    const res = await fetch(`/api/sources/${sourceId}`);
    const s = await res.json();
    setSourceDetail({
      id: s.id,
      title: s.title,
      pages: s.pages ?? [s.text_content],
      source_type: s.source_type,
      file_path: s.file_path ?? null,
    });
  }, []);

  useEffect(() => {
    if (!activeSourceId) return;
    loadSource(activeSourceId);
  }, [activeSourceId, loadSource]);

  async function regenerateMapForObjective(learningObjectiveId: string, userObjective: string) {
    const res = await fetch(`/api/reading-map/${learningObjectiveId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_objective: userObjective.trim() }),
    });
    if (!res.ok) return false;
    setSourceVersion((value) => value + 1);
    setSideTab("map");
    return true;
  }

  async function onUploaded({ sourceId }: { sourceId: string; objectiveId: string }) {
    setActiveSourceId(sourceId);
    await refresh();
    await loadSource(sourceId);
    setSourceVersion((value) => value + 1);

    const res = await fetch(`/api/objectives/${workspaceId}`);
    if (!res.ok) return;
    const json = (await res.json()) as WorkspaceData;
    const loId = activeLearningObjectiveId ?? json.learning_objectives[0]?.id ?? null;
    const lo = json.learning_objectives.find((item) => item.id === loId);
    if (loId && lo?.description?.trim()) {
      await regenerateMapForObjective(loId, lo.description);
    } else {
      setSideTab("map");
    }
  }

  async function onExcerptSaved() {
    setSideTab("notes");
    await refresh();
    await refreshNotes();
  }

  async function addObjective() {
    if (!workspaceId) return;
    const userObjective = window.prompt("What do you want to learn from this reading?");
    if (!userObjective?.trim()) return;

    const res = await fetch("/api/learning-objectives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: workspaceId,
        user_objective: userObjective.trim(),
      }),
    });
    const json = await res.json();
    if (!res.ok) return;
    setActiveLearningObjectiveId(json.learning_objective.id);
    setSideTab("map");
    await refresh();
  }

  async function deleteObjective(id: string) {
    if (!window.confirm("Remove this objective and its map/notes?")) return;
    await fetch(`/api/learning-objectives/${id}`, { method: "DELETE" });
    if (activeLearningObjectiveId === id) setActiveLearningObjectiveId(null);
    await refresh();
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-stone-500">
        Loading workspace…
      </div>
    );
  }

  const primaryBook = data.sources[0]?.title ?? null;
  const hasBook = data.sources.length > 0;
  const activeLo = data.learning_objectives.find((o) => o.id === activeLearningObjectiveId);
  const headerTitle = primaryBook ?? "Reading";

  const readerHighlights =
    data?.annotations
      .filter(
        (a) =>
          a.source_id === activeSourceId &&
          a.learning_objective_id === activeLearningObjectiveId
      )
      .map((a) => ({
        id: a.id,
        start_offset: a.start_offset,
        end_offset: a.end_offset,
        page_index: a.page_index ?? null,
        selected_text: a.selected_text,
      })) ?? [];

  const mainContent =
    sideTab === "trace" ? (
      <AgentTraceView
        workspaceId={workspaceId}
        learningObjectiveId={traceFilterId}
        learningObjectives={data.learning_objectives}
      />
    ) : sourceDetail && activeSourceId ? (
      <PdfReader
        workspaceId={workspaceId}
        learningObjectiveId={activeLearningObjectiveId}
        sourceId={activeSourceId}
        title={sourceDetail.title}
        pages={sourceDetail.pages}
        sourceType={sourceDetail.source_type}
        hasFile={Boolean(sourceDetail.file_path)}
        savedHighlights={readerHighlights}
        sources={data.sources}
        onSourceChange={setActiveSourceId}
        onExcerptSaved={onExcerptSaved}
      />
    ) : !hasBook ? (
      <ReaderUploadState workspaceId={workspaceId} onUploaded={onUploaded} />
    ) : (
      <div className="flex h-full items-center justify-center text-sm text-stone-500">
        Loading document…
      </div>
    );

  let sidePanel: React.ReactNode;
  if (sideTab === "objective") {
    sidePanel = (
      <SidePanelObjective
        objectives={data.learning_objectives}
        activeId={activeLearningObjectiveId}
        onSelect={(id) => {
          setActiveLearningObjectiveId(id);
          setSideTab("map");
        }}
        onAdd={addObjective}
        onDelete={deleteObjective}
        hasBook={hasBook}
      />
    );
  } else if (sideTab === "map") {
    sidePanel = (
      <ReadingMapPanel
        workspaceId={workspaceId}
        learningObjectiveId={activeLearningObjectiveId}
        initialObjective={activeLo?.description ?? ""}
        hasBook={hasBook}
        sourceVersion={sourceVersion}
        onUploaded={onUploaded}
        onObjectiveSaved={refresh}
      />
    );
  } else if (sideTab === "notes") {
    sidePanel = (
      <SidePanelExcerpts
        workspaceId={workspaceId}
        learningObjectiveId={activeLearningObjectiveId}
        cards={activeNotes.cards}
        notes={activeNotes.notes}
        annotations={activeNotes.annotations}
      />
    );
  } else {
    sidePanel = (
      <AgentTraceSidebar
        traceId={data.objective.trace_id}
        summary={null}
        learningObjectives={data.learning_objectives}
        filterId={traceFilterId}
        onFilterChange={setTraceFilterId}
      />
    );
  }

  return (
    <WorkspaceShell
      objectiveTitle={headerTitle}
      workspaceId={workspaceId}
      sideTab={sideTab}
      onSideTabChange={setSideTab}
      main={mainContent}
      sidePanel={sidePanel}
    />
  );
}
