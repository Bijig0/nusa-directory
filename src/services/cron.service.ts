/** Placeholder until phase 5 wires the real maintenance job. */
export const runScheduled = async (_env: Env, now: Date): Promise<void> => {
  console.log(`[cron] tick at ${now.toISOString()}`);
};
