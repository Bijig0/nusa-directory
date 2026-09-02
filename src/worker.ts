import { handle } from '@astrojs/cloudflare/handler';
import { runScheduled } from './services/cron.service';

/**
 * Worker entrypoint. `fetch` is Astro's request handler; `scheduled` runs the
 * hourly maintenance job (listing/boost/order expiry, reminders, purges).
 */
export default {
  fetch: handle,
  scheduled: (event, env, ctx) => {
    ctx.waitUntil(runScheduled(env, new Date(event.scheduledTime)));
  },
} satisfies ExportedHandler<Env>;
