export function requestsReportLink(slug: string, params: { categoryId?: string; from?: string; to?: string }): string {
  const qs = new URLSearchParams();
  if (params.categoryId) qs.set('category', params.categoryId);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  const query = qs.toString();
  return `/t/${slug}/requests${query ? `?${query}` : ''}`;
}

export function staysReportLink(slug: string, params: { hasBalance?: boolean; from?: string; to?: string }): string {
  const qs = new URLSearchParams();
  if (params.hasBalance) qs.set('hasBalance', 'true');
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  const query = qs.toString();
  return `/t/${slug}/stays${query ? `?${query}` : ''}`;
}

export function roomsReportLink(slug: string, params: { hasBalance?: boolean }): string {
  const qs = new URLSearchParams();
  if (params.hasBalance) qs.set('hasBalance', 'true');
  const query = qs.toString();
  return `/t/${slug}/rooms${query ? `?${query}` : ''}`;
}
