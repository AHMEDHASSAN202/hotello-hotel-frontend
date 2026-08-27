import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import en from '../../messages/en';
import type { FnbWindow } from '@/lib/types';
import { HoursEditor, MAX_HOURS_WINDOWS } from './hours-editor';

function Harness({ initial = [] as FnbWindow[] }) {
  const [windows, setWindows] = useState<FnbWindow[]>(initial);
  return (
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <HoursEditor
        value={windows}
        onChange={setWindows}
        namespace="hotelInfo.entryModal"
      />
    </NextIntlClientProvider>
  );
}

describe('HoursEditor (extracted 16.2 windows editor)', () => {
  it('adds a seeded window and removes it again', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText(en.hotelInfo.entryModal.addWindow));
    expect(screen.getAllByDisplayValue('07:00')).toHaveLength(1);
    await user.click(screen.getByText(en.hotelInfo.entryModal.removeWindow));
    expect(screen.queryByDisplayValue('07:00')).toBeNull();
  });

  it('hides the add button at the 4-window cap and labels both inputs', () => {
    const four = Array.from({ length: MAX_HOURS_WINDOWS }, (_, i) => ({
      start: `0${i}:00`,
      end: `0${i}:30`,
    }));
    render(<Harness initial={four} />);
    expect(screen.queryByText(en.hotelInfo.entryModal.addWindow)).toBeNull();
    // a11y: start AND end inputs carry aria-labels (gap fixed on extraction)
    const labelled = screen.getAllByLabelText(
      new RegExp(en.hotelInfo.entryModal.windowsLabel),
    );
    expect(labelled.length).toBe(MAX_HOURS_WINDOWS * 2);
  });
});
