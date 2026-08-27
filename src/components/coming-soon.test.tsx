import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import en from '../../messages/en';

/**
 * Direct URL visits to unbuilt module routes land on the designed coming-soon
 * page (module title + what-it-will-do intro + way back), never a 404.
 */

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'sunrise' }),
}));

import TransportationPage from '../app/t/[slug]/(dashboard)/transportation/page';
import AnalyticsPage from '../app/t/[slug]/(dashboard)/analytics/page';

function renderPage(Page: () => JSX.Element) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <Page />
    </NextIntlClientProvider>,
  );
}

describe('coming-soon module routes', () => {
  it('the transportation route renders the module title and coming-soon copy', () => {
    renderPage(TransportationPage);
    expect(
      screen.getByRole('heading', { name: 'Transportation' }),
    ).toBeTruthy();
    expect(screen.getByText('Coming soon')).toBeTruthy();
    const back = screen.getByRole('link', { name: 'Back to overview' });
    expect(back.getAttribute('href')).toBe('/t/sunrise');
  });

  it('the analytics route renders its own module title', () => {
    renderPage(AnalyticsPage);
    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeTruthy();
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });
});
