import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

const DEFAULT_ELEMENT_SIZE = 1;
const DEFAULT_SCALE = 1;
const SCALE_PATTERN = /scale\(([^)]+)\)/;

class ResizeObserverStub {
  observe(): void {
    // jsdom has no layout, so there is nothing to observe.
  }

  unobserve(): void {
    // Nothing is ever observed, see observe.
  }

  disconnect(): void {
    // Nothing is ever observed, see observe.
  }
}

// React Flow reads the zoom level from the m22 entry of the viewport transform.
class DOMMatrixReadOnlyStub {
  readonly m22: number;

  constructor(transform = "") {
    const scale = SCALE_PATTERN.exec(transform)?.[1];
    this.m22 = scale === undefined ? DEFAULT_SCALE : Number.parseFloat(scale);
  }
}

function createMediaQueryList(media: string): MediaQueryList {
  return {
    matches: false,
    media,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };
}

function parseSize(size: string): number {
  const parsed = Number.parseFloat(size);
  return Number.isNaN(parsed) ? DEFAULT_ELEMENT_SIZE : parsed;
}

function defineIfMissing(
  target: object,
  property: string,
  value: unknown,
): void {
  // Vitest copies jsdom window keys onto the global, including keys whose
  // value is undefined, so a present key does not mean the API exists.
  const current: unknown = Reflect.get(target, property);
  if (current !== undefined) {
    return;
  }

  Object.defineProperty(target, property, {
    configurable: true,
    writable: true,
    value,
  });
}

afterEach(() => {
  cleanup();
});

defineIfMissing(globalThis, "ResizeObserver", ResizeObserverStub);
defineIfMissing(globalThis, "DOMMatrixReadOnly", DOMMatrixReadOnlyStub);
defineIfMissing(window, "matchMedia", createMediaQueryList);
defineIfMissing(SVGElement.prototype, "getBBox", () => ({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
}));
defineIfMissing(Element.prototype, "scrollIntoView", () => undefined);
defineIfMissing(Element.prototype, "hasPointerCapture", () => false);
defineIfMissing(Element.prototype, "setPointerCapture", () => undefined);
defineIfMissing(Element.prototype, "releasePointerCapture", () => undefined);

// jsdom always reports 0 here because it has no layout, so React Flow would
// measure every node as empty. These getters override jsdom unconditionally.
Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  get(this: HTMLElement): number {
    return parseSize(this.style.width);
  },
});
Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  get(this: HTMLElement): number {
    return parseSize(this.style.height);
  },
});
