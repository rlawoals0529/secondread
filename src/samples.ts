/** Two pastes that show both modes without the visitor having to find code of their own. */

export const SAMPLE_FILE = `export async function loadParts(ids: string[]) {
  const rows = await db.parts.findMany({ where: { id: { in: ids } } });
  const ranked = rows.sort((a, b) => b.weight - a.weight);

  try {
    return await enrich(ranked.slice(0, MAX_PARTS));
  } catch {
  }

  return ranked ?? [];
}

export async function loadAssemblies(ids: string[]) {
  const rows = await db.assemblies.findMany({ where: { id: { in: ids } } });
  const ordered = rows.sort((a, b) => b.mass - a.mass);

  try {
    return await enrich(ordered.slice(0, MAX_ASSEMBLIES));
  } catch {
  }

  return ordered ?? [];
}
`;

export const SAMPLE_DIFF = `diff --git a/src/schedule.ts b/src/schedule.ts
index 3b1f2a0..9c4d1e7 100644
--- a/src/schedule.ts
+++ b/src/schedule.ts
@@ -22,9 +22,14 @@ export function nextRuns(jobs: Job[], now: Date) {
   const due = jobs.filter((j) => j.enabled);
   const ordered = due.sort((a, b) => a.id.localeCompare(b.id));
-  return ordered.map(toRun);
+  const byUrgency = due.sort((a, b) => a.priority - b.priority);
+
+  try {
+    return byUrgency.slice(0, PAGE).map(toRun);
+  } catch (e) {
+  }
+
+  return [];
 }
`;
