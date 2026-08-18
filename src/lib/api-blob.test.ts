import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Epic 11 (Task 12) — `apiBlob` powers PDF/xlsx downloads (room cards, QR
 * poster, Excel export/template). It must share the same auth/refresh/error
 * plumbing as `api()`/`apiUpload()` — mocked here via `tokenStore` so the
 * single-flight refresh-once-then-retry path is deterministic under node env.
 */

const tokenStore = vi.hoisted(() => ({
  access: vi.fn(() => 'access-token'),
  refresh: vi.fn(() => 'refresh-token'),
  set: vi.fn(),
  clear: vi.fn(),
}));

vi.mock('./auth', () => ({ tokenStore }));

import { apiBlob, ApiError } from './api';

function okResponse(headers: Record<string, string>, blob: Blob) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(headers),
    blob: () => Promise.resolve(blob),
    json: () => Promise.resolve({}),
  } as unknown as Response;
}

function errorResponse(status: number, body: unknown) {
  return {
    ok: false,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
    blob: () => Promise.resolve(new Blob()),
  } as unknown as Response;
}

describe('apiBlob (11.12)', () => {
  beforeEach(() => {
    tokenStore.access.mockReturnValue('access-token');
    tokenStore.refresh.mockReturnValue('refresh-token');
    tokenStore.set.mockReset();
    tokenStore.clear.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('AC1 — resolves the blob and the filename parsed from Content-Disposition', async () => {
    const blob = new Blob(['pdf-bytes']);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      okResponse({ 'Content-Disposition': 'attachment; filename="cards.pdf"' }, blob),
    );

    const result = await apiBlob('/tenant/rooms/pdf/cards');

    expect(result.blob).toBe(blob);
    expect(result.filename).toBe('cards.pdf');
  });

  it('AC1 — filename is null when no Content-Disposition header is present', async () => {
    const blob = new Blob(['bytes']);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okResponse({}, blob));

    const result = await apiBlob('/tenant/rooms/qr.png');

    expect(result.filename).toBeNull();
  });

  it('AC2 — a 401 triggers exactly one silent refresh, then retries and succeeds', async () => {
    const blob = new Blob(['bytes']);
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(errorResponse(401, {}))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ accessToken: 'new-a', refreshToken: 'new-r' }),
      } as unknown as Response)
      .mockResolvedValueOnce(
        okResponse({ 'Content-Disposition': 'attachment; filename="rooms.xlsx"' }, blob),
      );

    const result = await apiBlob('/tenant/rooms/export.xlsx');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(tokenStore.set).toHaveBeenCalledWith('new-a', 'new-r');
    expect(result.filename).toBe('rooms.xlsx');
  });

  it('AC3 — a non-OK response parses the JSON error body into ApiError', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      errorResponse(404, { message: 'Room not found', code: 'ROOM_NOT_FOUND' }),
    );

    await expect(apiBlob('/tenant/rooms/missing/pdf')).rejects.toMatchObject({
      status: 404,
      message: 'Room not found',
      code: 'ROOM_NOT_FOUND',
    });
    await expect(apiBlob('/tenant/rooms/missing/pdf')).rejects.toBeInstanceOf(ApiError);
  });
});
