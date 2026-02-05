import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
});

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock HTMLCanvasElement.getContext
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  scale: vi.fn(),
  fillRect: vi.fn(),
  drawImage: vi.fn(),
  fillStyle: '',
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// Mock HTMLCanvasElement.toDataURL
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock');

// Mock XMLSerializer as a proper class
class MockXMLSerializer {
  serializeToString() {
    return '<svg></svg>';
  }
}
global.XMLSerializer = MockXMLSerializer as unknown as typeof XMLSerializer;

// Mock Image as a proper class
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  width = 100;
  height = 100;

  constructor() {
    // Trigger onload asynchronously
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
}

global.Image = MockImage as unknown as typeof Image;

// Mock Blob as a proper class (will be overridden in specific tests)
class MockBlob {
  content: BlobPart[];
  options: BlobPropertyBag | undefined;
  size: number;
  type: string;

  constructor(content: BlobPart[], options?: BlobPropertyBag) {
    this.content = content;
    this.options = options;
    this.size = 100;
    this.type = options?.type || '';
  }

  text() {
    return Promise.resolve(this.content.join(''));
  }

  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(0));
  }

  slice() {
    return new MockBlob([]);
  }

  stream() {
    return new ReadableStream();
  }
}

// Store original Blob for tests that need to override it
(global as { OriginalBlob?: typeof Blob }).OriginalBlob = global.Blob;
global.Blob = MockBlob as unknown as typeof Blob;
