// Adds failed cloud operations to the local SQLite sync queue through Electron preload.
export async function enqueueFailedSync(entityType: string, operation: string, payload: any, error?: string) {
  if (!window.api?.enqueueSyncItem) return;
  await window.api.enqueueSyncItem({ entityType, operation, payload, error });
}

// Reads local queue counters for status cards and future admin dashboards.
export async function getLocalSyncStatus() {
  return window.api.getSyncStatus();
}
