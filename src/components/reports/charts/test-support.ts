/**
 * jsdom has no layout engine, so Recharts' `ResponsiveContainer` — which
 * measures itself via `ResizeObserver` + `getBoundingClientRect` — always
 * sees a 0×0 box and renders nothing. Call this once per chart test file to
 * give it a stable non-zero size so the chart body (lines/bars/sectors)
 * actually renders for assertions.
 *
 * Recharts' `<Legend>` measures its OWN wrapper the same way (also via
 * `getBoundingClientRect`) to reserve space for itself inside the chart. A
 * blanket "every element is 500x300" stub makes the legend appear to need
 * the whole chart's height, leaving 0px for the actual plot area — so the
 * legend wrapper gets a small fixed size instead, matching a real single-row
 * legend's footprint.
 */
export function mockResponsiveContainerSize(width = 500, height = 300) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver ??= ResizeObserverStub;

  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: function (this: HTMLElement) {
      const isLegend = this.classList?.contains('recharts-legend-wrapper');
      const w = isLegend ? Math.min(width, 200) : width;
      const h = isLegend ? 24 : height;
      return {
        width: w,
        height: h,
        top: 0,
        left: 0,
        right: w,
        bottom: h,
        x: 0,
        y: 0,
        toJSON() {},
      };
    },
  });
}
