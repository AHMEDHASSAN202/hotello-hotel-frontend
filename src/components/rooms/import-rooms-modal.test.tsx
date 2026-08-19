import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import en from '../../../messages/en';

/**
 * Epic 11, Story 11.7 — Excel import preview/confirm. Mirrors the
 * add-rooms-modal harness (11.3): mocked api/apiUpload, real English
 * messages, no jest-dom matchers.
 */

const apiMock = vi.hoisted(() => ({ api: vi.fn(), apiUpload: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: apiMock.api,
  apiUpload: apiMock.apiUpload,
  apiBlob: vi.fn(),
  saveBlob: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(
      public readonly status: number,
      message: string,
      public readonly details?: unknown,
      public readonly code?: string,
    ) {
      super(message);
    }
  },
}));

import { ApiError } from '@/lib/api';
import type { BulkPreview } from '@/lib/types';
import { ImportRoomsModal } from './import-rooms-modal';

function renderModal(
  overrides: Partial<{ onImported: () => void; onClose: () => void }> = {},
) {
  const onImported = overrides.onImported ?? vi.fn();
  const onClose = overrides.onClose ?? vi.fn();
  const utils = render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <ImportRoomsModal open onClose={onClose} onImported={onImported} />
    </NextIntlClientProvider>,
  );
  return { ...utils, onImported, onClose };
}

function makeFile(name = 'rooms.xlsx') {
  return new File(['dummy-bytes'], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function selectFile(file = makeFile()) {
  fireEvent.change(screen.getByLabelText(/Drag a file here/), {
    target: { files: [file] },
  });
}

async function selectAndPreview(preview: BulkPreview) {
  apiMock.apiUpload.mockResolvedValueOnce(preview);
  selectFile();
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  await screen.findByRole('button', { name: /Skip invalid rows/ });
}

beforeEach(() => {
  apiMock.api.mockReset();
  apiMock.apiUpload.mockReset();
});

describe('ImportRoomsModal (11.7)', () => {
  it('AC4 — preview renders per-row issues as "Row {row} · {field}: {message}"', async () => {
    const preview: BulkPreview = {
      rows: [
        {
          row: 1,
          roomNumber: '101',
          floor: null,
          roomTypeId: 't1',
          status: 'active',
          duplicate: false,
          issues: [],
        },
        {
          row: 3,
          roomNumber: '103',
          floor: null,
          roomTypeId: null,
          status: 'active',
          duplicate: false,
          issues: [{ row: 3, field: 'roomNumber', code: 'DUPLICATE_IN_HOTEL' }],
        },
      ],
      validCount: 1,
      duplicateCount: 0,
      invalidCount: 1,
      remaining: 10,
    };
    renderModal();
    await selectAndPreview(preview);

    expect(
      screen.getByText(
        'Row 3 · Room number: This room number already exists in your hotel.',
      ),
    ).toBeTruthy();
  });

  it('AC2/AC4 — confirm posts only valid rows with skippedCount and source "import"', async () => {
    const preview: BulkPreview = {
      rows: [
        {
          row: 1,
          roomNumber: '101',
          floor: null,
          roomTypeId: 't1',
          status: 'active',
          duplicate: false,
          issues: [],
        },
        {
          row: 2,
          roomNumber: '102',
          floor: 2,
          roomTypeId: 't1',
          status: 'active',
          duplicate: true,
          issues: [],
        },
        {
          row: 3,
          roomNumber: '',
          floor: null,
          roomTypeId: null,
          status: 'active',
          duplicate: false,
          issues: [{ row: 3, field: 'roomNumber', code: 'REQUIRED' }],
        },
        {
          row: 4,
          roomNumber: '104',
          floor: null,
          roomTypeId: 't1',
          status: 'out_of_service',
          duplicate: false,
          issues: [],
        },
      ],
      validCount: 2,
      duplicateCount: 1,
      invalidCount: 1,
      remaining: 20,
    };
    const { onImported } = renderModal();
    await selectAndPreview(preview);

    const confirmButton = screen.getByRole('button', {
      name: 'Skip invalid rows and import 2 rooms',
    });
    apiMock.api.mockResolvedValueOnce({ created: 2, skipped: 2 });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(onImported).toHaveBeenCalled());

    const bulkCall = apiMock.api.mock.calls.find(
      ([path]) => path === '/tenant/rooms/bulk',
    );
    expect(bulkCall).toBeTruthy();
    const body = JSON.parse(bulkCall![1].body as string);
    expect(body.source).toBe('import');
    expect(body.skipDuplicates).toBe(true);
    expect(body.skippedCount).toBe(2);
    expect(body.rooms).toEqual([
      { row: 1, roomNumber: '101', floor: null, roomTypeId: 't1', status: 'active' },
      {
        row: 4,
        roomNumber: '104',
        floor: null,
        roomTypeId: 't1',
        status: 'out_of_service',
      },
    ]);
  });

  it('AC4 — zero valid rows disables the confirm button', async () => {
    const preview: BulkPreview = {
      rows: [
        {
          row: 1,
          roomNumber: '101',
          floor: null,
          roomTypeId: null,
          status: 'active',
          duplicate: false,
          issues: [{ row: 1, field: 'roomTypeId', code: 'UNKNOWN_TYPE' }],
        },
      ],
      validCount: 0,
      duplicateCount: 0,
      invalidCount: 1,
      remaining: 10,
    };
    renderModal();
    await selectAndPreview(preview);

    const confirmButton = screen.getByRole('button', {
      name: /Skip invalid rows/,
    });
    expect(confirmButton.hasAttribute('disabled')).toBe(true);
  });

  it('IMPORT_FILE_INVALID from upload renders the translated message and returns to a retry-upload state', async () => {
    renderModal();
    apiMock.apiUpload.mockRejectedValueOnce(
      new ApiError(400, 'raw message', undefined, 'IMPORT_FILE_INVALID'),
    );
    selectFile();
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    expect(
      await screen.findByText(
        "This file doesn't match the expected format. Download the template and try again.",
      ),
    ).toBeTruthy();

    // Retry-upload state: the file input is enabled and empty again, and the
    // Preview button is disabled until a new file is chosen.
    const retryInput = screen.getByLabelText(
      /Drag a file here/,
    ) as HTMLInputElement;
    expect(retryInput.disabled).toBe(false);
    expect(retryInput.value).toBe('');
    expect(
      screen.getByRole('button', { name: 'Preview' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('client-side extension pre-check rejects a non-.xlsx file without calling apiUpload', async () => {
    renderModal();
    selectFile(makeFile('rooms.csv'));

    expect(
      await screen.findByText(
        "This file doesn't match the expected format. Download the template and try again.",
      ),
    ).toBeTruthy();
    expect(apiMock.apiUpload).not.toHaveBeenCalled();
  });
});
