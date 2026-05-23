import Link from "next/link";
import { ExportMarkdownButton } from "@/components/export/ExportMarkdownButton";

export type SideTab = "objective" | "map" | "notes" | "trace";

interface WorkspaceShellProps {
  objectiveTitle: string;
  workspaceId?: string;
  sideTab: SideTab;
  onSideTabChange: (tab: SideTab) => void;
  main: React.ReactNode;
  sidePanel: React.ReactNode;
}

const SIDE_TABS: { id: SideTab; label: string; hint: string }[] = [
  { id: "objective", label: "Objectives", hint: "Your learning goals" },
  { id: "map", label: "Map", hint: "Generate map for selected objective" },
  { id: "notes", label: "Notes", hint: "Highlights for selected objective" },
  { id: "trace", label: "Trace", hint: "Agent activity for this reading" },
];

export function WorkspaceShell({
  objectiveTitle,
  workspaceId,
  sideTab,
  onSideTabChange,
  main,
  sidePanel,
}: WorkspaceShellProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-stone-100">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="shrink-0 font-semibold text-stone-900">
            MyReader
          </Link>
          <span className="hidden text-stone-300 sm:inline">/</span>
          <p className="truncate text-sm text-stone-600">{objectiveTitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {workspaceId && (
            <ExportMarkdownButton workspaceId={workspaceId} scope="full" compact />
          )}
          {workspaceId && (
            <Link
              href={`/objectives/${workspaceId}/trace`}
              className="hidden text-xs text-stone-500 hover:text-stone-800 sm:inline"
            >
              Full trace
            </Link>
          )}
          <Link
            href="/objectives/new"
            className="shrink-0 text-sm text-stone-600 hover:text-stone-900"
          >
            New reading
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-hidden">{main}</main>

        <aside className="flex w-72 shrink-0 flex-col border-l border-stone-200 bg-white xl:w-80">
          <div className="flex border-b border-stone-200">
            {SIDE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSideTabChange(tab.id)}
                title={tab.hint}
                className={`flex-1 px-2 py-3 text-[11px] font-medium xl:text-xs ${
                  sideTab === tab.id
                    ? "border-b-2 border-amber-700 text-amber-950"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{sidePanel}</div>
        </aside>
      </div>
    </div>
  );
}
