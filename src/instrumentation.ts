export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { initScheduler } = await import("@/server/sync/scheduler");
  initScheduler();
  const { initLegacyExportSchedule } = await import("@/server/lib/legacy-export");
  initLegacyExportSchedule();
  const { initFolderImportSchedule } = await import("@/server/lib/folder-import");
  initFolderImportSchedule();
  const { startBot } = await import("@/server/bot");
  startBot();
}
