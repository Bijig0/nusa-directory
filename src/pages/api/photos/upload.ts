import type { APIRoute } from 'astro';
import { uploadPhoto } from '../../../services/photo.service';
import { MAX_UPLOAD_BYTES } from '../../../domain/images';

export const prerender = false;

/**
 * Multipart upload: fields `listingId` and `file`. Bypasses Actions so the body
 * size can be checked before buffering and the response stays small.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const { user, deps, isAdmin } = locals;
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'forbidden' }, { status: 403 });
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 4096) return Response.json({ error: 'too_large' }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const listingId = form?.get('listingId');
  const file = form?.get('file');
  if (typeof listingId !== 'string' || !(file instanceof File)) return Response.json({ error: 'bad_request' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await uploadPhoto(deps, user, listingId, bytes, isAdmin);
  if (!result.ok) {
    const status = result.error === 'forbidden' ? 403 : result.error === 'not_found' ? 404 : result.error === 'too_large' ? 413 : 422;
    return Response.json({ error: result.error }, { status });
  }
  const p = result.value;
  return Response.json({ id: p.id, position: p.position, width: p.width, height: p.height, url: `/img/${listingId}/${p.id}/card.jpg` });
};
