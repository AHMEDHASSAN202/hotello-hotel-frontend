import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';
import type { PeriodSelection } from '@/lib/use-period-selection';

/**
 * Task F3, Part 1 — the shared export button used by every report page
 * (Story 22.5). Export is a READ, so this must stay enabled/available even
 * under a read-only (expired-trial) subscription — same precedent as the
 * rooms-page export button — hence no `readOnly` prop anywhere here.
 */

const apiMock = vi.hoisted(() => ({ apiBlob: vi.fn(), saveBlob: vi.fn() }));
vi.mock('@/lib/api', () => ({
  apiBlob: apiMock.apiBlob,
  saveBlob: apiMock.saveBlob,
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

import { ExportButton } from './export-button';

function renderButton(props: Partial<Parameters<typeof ExportButton>[0]> = {}) {
  const period: PeriodSelection = props.period ?? { preset: 'last7' };
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <ExportButton report="guests" period={period} {...props} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  apiMock.apiBlob.mockReset();
  apiMock.saveBlob.mockReset();
});

describe('ExportButton (Story 22.5)', () => {
  it('renders the default translated "Export" label', () => {
    renderButton();
    expect(screen.getByRole('button', { name: en.reports.export })).toBeTruthy();
  });

  it('renders a custom label when provided (the CSV raw-data variant)', () => {
    renderButton({ label: en.reports.exportRawData });
    expect(screen.getByRole('button', { name: en.reports.exportRawData })).toBeTruthy();
    expect(screen.queryByRole('button', { name: en.reports.export })).toBeNull();
  });

  it('clicking calls apiBlob with the report path and preset query string for a fixed preset', async () => {
    apiMock.apiBlob.mockResolvedValueOnce({ blob: new Blob(['x']), filename: 'sunrise-guests-2026-01-01-2026-01-07.xlsx' });
    renderButton({ report: 'guests', period: { preset: 'last7' } });
    fireEvent.click(screen.getByRole('button', { name: en.reports.export }));
    await vi.waitFor(() =>
      expect(apiMock.apiBlob).toHaveBeenCalledWith('/tenant/reports/guests/export?preset=last7'),
    );
  });

  it('clicking with a custom period includes from/to in the query string', async () => {
    apiMock.apiBlob.mockResolvedValueOnce({ blob: new Blob(['x']), filename: 'f.xlsx' });
    renderButton({
      report: 'leakage',
      period: { preset: 'custom', from: '2026-01-01', to: '2026-01-10' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.reports.export }));
    await vi.waitFor(() =>
      expect(apiMock.apiBlob).toHaveBeenCalledWith(
        '/tenant/reports/leakage/export?preset=custom&from=2026-01-01&to=2026-01-10',
      ),
    );
  });

  it('a successful export calls saveBlob with the returned blob and filename', async () => {
    const blob = new Blob(['data']);
    apiMock.apiBlob.mockResolvedValueOnce({ blob, filename: 'sunrise-guests-2026-01-01-2026-01-07.xlsx' });
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: en.reports.export }));
    await vi.waitFor(() =>
      expect(apiMock.saveBlob).toHaveBeenCalledWith(blob, 'sunrise-guests-2026-01-01-2026-01-07.xlsx'),
    );
  });

  it('a REPORT_EXPORT_ROW_LIMIT error shows the translated row-limit message with the actual limit', async () => {
    const { ApiError } = await import('@/lib/api');
    apiMock.apiBlob.mockRejectedValueOnce(
      new ApiError(400, 'Narrow the period', { code: 'REPORT_EXPORT_ROW_LIMIT', message: 'Narrow the period', limit: 10000 }, 'REPORT_EXPORT_ROW_LIMIT'),
    );
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: en.reports.export }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      en.reports.exportRowLimit.replace('{limit}', '10000'),
    );
  });

  it('a generic ApiError shows the generic translated export-error message', async () => {
    const { ApiError } = await import('@/lib/api');
    apiMock.apiBlob.mockRejectedValueOnce(new ApiError(403, 'Forbidden', undefined, 'REPORTS_REVENUE_FORBIDDEN'));
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: en.reports.export }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('a non-ApiError failure shows the generic translated export-error message', async () => {
    apiMock.apiBlob.mockRejectedValueOnce(new Error('network down'));
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: en.reports.export }));
    expect(await screen.findByText(en.reports.exportError)).toBeTruthy();
  });

  it('shows a loading state (disabled button) while the export is in flight', async () => {
    let resolvePromise!: (v: unknown) => void;
    apiMock.apiBlob.mockReturnValueOnce(new Promise((resolve) => (resolvePromise = resolve)));
    renderButton();
    const button = screen.getByRole('button', { name: en.reports.export });
    fireEvent.click(button);
    expect(button.hasAttribute('disabled')).toBe(true);
    resolvePromise({ blob: new Blob(['x']), filename: 'f.xlsx' });
    await vi.waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
  });
});
