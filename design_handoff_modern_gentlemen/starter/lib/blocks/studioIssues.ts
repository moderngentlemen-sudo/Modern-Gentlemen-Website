import type { StudioIssue } from "./studioPublishing";

export function groupStudioIssues(issues: StudioIssue[]) {
  const groups = new Map<
    string,
    StudioIssue & { views: string[]; nodeId?: number; sectionIndex?: number }
  >();
  for (const issue of issues) {
    const match = /^(desktop|tablet|mobile)\.sections\.(\d+)(?:\.nodes\.(\d+))?$/.exec(issue.path);
    const key = `${issue.path.replace(/^(desktop|tablet|mobile)\./, "")}:${issue.message}`;
    const existing = groups.get(key);
    if (existing) {
      if (match && !existing.views.includes(match[1])) existing.views.push(match[1]);
    } else
      groups.set(key, {
        ...issue,
        views: match ? [match[1]] : [],
        ...(match ? { sectionIndex: Number(match[2]) } : {}),
        ...(match?.[3] ? { nodeId: Number(match[3]) } : {}),
      });
  }
  return [...groups.values()];
}
