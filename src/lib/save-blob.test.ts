// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Final-review fix (Epic 11 whole-branch review, finding 1) — `saveBlob` must
 * avoid the documented cross-browser download failure modes: Firefox ignores
 * `.click()` on an anchor that isn't attached to the DOM, and Safari/Firefox
 * can abort the download if the object URL is revoked before it starts. This
 * runs under jsdom (see the `@vitest-environment` docblock above) since the
 * rest of `src/lib` runs under the faster `node` environment by default.
 */

import { saveBlob } from './api';

describe('saveBlob', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('appends the anchor to the DOM before clicking, then removes it', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    let attachedAtClickTime = false;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        // Captured synchronously, inside the click handler — Firefox's real
        // constraint is that the element is attached AT CLICK TIME, not
        // afterward (saveBlob removes it again right after).
        attachedAtClickTime = document.contains(this);
      });

    saveBlob(new Blob(['data']), 'cards.pdf');

    expect(appendSpy).toHaveBeenCalledTimes(1);
    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.tagName).toBe('A');
    expect(anchor.download).toBe('cards.pdf');
    expect(attachedAtClickTime).toBe(true);

    clickSpy.mockRestore();
    appendSpy.mockRestore();
  });

  it('removes the anchor from the DOM synchronously after clicking', () => {
    let anchorRef: HTMLAnchorElement | null = null;
    const appendSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => {
        anchorRef = node as HTMLAnchorElement;
        return Node.prototype.appendChild.call(document.body, node);
      });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    saveBlob(new Blob(['data']), 'cards.pdf');

    expect(anchorRef).not.toBeNull();
    expect(document.body.contains(anchorRef)).toBe(false);

    appendSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('defers revokeObjectURL instead of calling it synchronously', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    saveBlob(new Blob(['data']), 'cards.pdf');

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(999);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    vi.restoreAllMocks();
  });
});
