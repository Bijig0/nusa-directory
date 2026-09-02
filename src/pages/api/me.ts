import type { APIRoute } from 'astro';
import { readPrincipal } from '../../services/principal.service';
import { walletBalance } from '../../services/device.service';
import { revealedListingIds, favoriteListingIds } from '../../infra/db/repos/wallets';

export const prerender = false;

/** Per-viewer state that must never be baked into cached HTML. */
export const GET: APIRoute = async ({ locals, cookies }) => {
  const p = await readPrincipal(locals, cookies);
  const [balance, revealed, favorites] = p.walletId
    ? await Promise.all([walletBalance(locals.deps, p.walletId), revealedListingIds(locals.deps.db, p.walletId), favoriteListingIds(locals.deps.db, p.walletId)])
    : [0, [], []];
  return Response.json(
    {
      user: p.user ? { id: p.user.id, name: p.user.displayName } : null,
      isAdmin: p.isAdmin,
      balance,
      freeRevealAvailable: !p.device || p.device.freeRevealUsedAt === null,
      revealedListingIds: revealed,
      favoriteIds: favorites,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
};
