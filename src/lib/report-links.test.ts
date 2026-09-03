import { describe, expect, it } from 'vitest';
import { requestsReportLink, roomsReportLink, staysReportLink } from './report-links';

/** Task F1b, Part 7 — pure URL builders for report drill-through links. */
describe('requestsReportLink', () => {
  it('with all params', () => {
    expect(requestsReportLink('sunrise', { categoryId: 'cat-1', from: '2026-01-01', to: '2026-01-31' })).toBe(
      '/t/sunrise/requests?category=cat-1&from=2026-01-01&to=2026-01-31',
    );
  });

  it('with no params — bare path, no ?', () => {
    expect(requestsReportLink('sunrise', {})).toBe('/t/sunrise/requests');
  });
});

describe('staysReportLink', () => {
  it('with all params', () => {
    expect(staysReportLink('sunrise', { hasBalance: true, from: '2026-01-01', to: '2026-01-31' })).toBe(
      '/t/sunrise/stays?hasBalance=true&from=2026-01-01&to=2026-01-31',
    );
  });

  it('with no params — bare path, no ?', () => {
    expect(staysReportLink('sunrise', {})).toBe('/t/sunrise/stays');
  });

  it('hasBalance:false omits the query param entirely', () => {
    expect(staysReportLink('sunrise', { hasBalance: false })).toBe('/t/sunrise/stays');
  });
});

describe('roomsReportLink', () => {
  it('with all params', () => {
    expect(roomsReportLink('sunrise', { hasBalance: true })).toBe('/t/sunrise/rooms?hasBalance=true');
  });

  it('with no params — bare path, no ?', () => {
    expect(roomsReportLink('sunrise', {})).toBe('/t/sunrise/rooms');
  });
});
