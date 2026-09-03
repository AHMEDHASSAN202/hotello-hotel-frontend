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

  // Analytics used to be covered here too, but Task F2a shipped its real
  // page (Story 22.1) and flipped `MODULE_PAGES.analytics.built` to true —
  // `modules.test.ts` now asserts analytics does NOT render ComingSoon, so
  // an analytics-specific case here would just duplicate/contradict that.
});
