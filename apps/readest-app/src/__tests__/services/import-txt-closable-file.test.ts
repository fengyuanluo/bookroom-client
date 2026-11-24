import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Book } from '@/types/book';
import type { ClosableFile } from '@/utils/file';

const mockOpen = vi.hoisted(() => vi.fn());
const mockPartialMD5 = vi.hoisted(() => vi.fn());

vi.mock('@/utils/md5', async () => {
  const actual = await vi.importActual<typeof import('@/utils/md5')>('@/utils/md5');
  return { ...actual, partialMD5: mockPartialMD5 };
});

vi.mock('@/libs/document', async () => {
  const actual = await vi.importActual<typeof import('@/libs/document')>('@/libs/document');
  class MockDocumentLoader {
    open() {
      return mockOpen();
    }
  }
  return { ...actual, DocumentLoader: MockDocumentLoader };
});

vi.mock('@/utils/svg', () => ({ svg2png: vi.fn() }));
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }));
vi.mock('@/libs/storage', () => ({
  downloadFile: vi.fn(),
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  createProgressHandler: vi.fn(),
  batchGetDownloadUrls: vi.fn(),
}));

import { BaseAppService } from '@/services/appService';

class TestAppService extends BaseAppService {
  protected fs = {
    openFile: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    copyFile: vi.fn(),
    removeFile: vi.fn(),
    readDir: vi.fn(),
    createDir: vi.fn(),
    removeDir: vi.fn(),
    exists: vi.fn(),
    stats: vi.fn(),
    resolvePath: vi.fn(),
    getURL: vi.fn(),
    getBlobURL: vi.fn().mockResolvedValue(''),
    getImageURL: vi.fn(),
    getPrefix: vi.fn(),
  };

  protected resolvePath() {
    return { baseDir: 0, basePrefix: async () => '', fp: '', base: 'Books' as const };
  }

  async init() {}
  async setCustomRootDir() {}
  async selectDirectory() {
    return '';
  }
  async selectFiles() {
    return [];
  }
  async saveFile() {
    return false;
  }
  async saveImageToGallery() {
    return false;
  }
  async ask() {
    return false;
  }
  async openDatabase() {
    return {} as ReturnType<BaseAppService['openDatabase']>;
  }
  async createWindow() {}
  async getCacheDir() {
    return '';
  }
  async clearWebviewCache() {}
  async showNotification() {}

  getFs() {
    return this.fs;
  }
}

const TEST_METADATA = {
  title: 'Test Book',
  author: 'Test Author',
  language: 'en',
  identifier: 'txt-id-1',
};

/**
 * Folder/desktop TXT import opens a ClosableFile and stores the source TXT
 * as-is (ADR 0011) — conversion happens on every open, in `DocumentLoader`.
 * The finally block must still close the *source* handle, otherwise every TXT
 * import leaks the opened RemoteFile/NativeFile (same cleanup contract as
 * #5387's destroy/close finally).
 */
describe('importBook TXT ClosableFile lifecycle', () => {
  let service: TestAppService;
  let mockClose: ReturnType<typeof vi.fn>;

  const makeSourceTxt = (name = 'novel.txt'): ClosableFile => {
    mockClose = vi.fn(async () => undefined);
    const file = new File(['chapter one\n\nhello'], name, {
      type: 'text/plain',
    }) as ClosableFile;
    file.close = mockClose as ClosableFile['close'];
    file.open = (async () => file) as ClosableFile['open'];
    return file;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TestAppService();
    const fs = service.getFs();
    fs.exists.mockResolvedValue(false);
    fs.createDir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);
    fs.copyFile.mockResolvedValue(undefined);
    fs.removeDir.mockResolvedValue(undefined);
    fs.readFile.mockResolvedValue('{}');
    mockPartialMD5.mockResolvedValue('hash-txt-abc');

    mockOpen.mockResolvedValue({
      book: {
        metadata: TEST_METADATA,
        getCover: vi.fn().mockResolvedValue(null),
        destroy: vi.fn(),
      },
      format: 'TXT',
    });
  });

  it('stores the original TXT and closes the source ClosableFile', async () => {
    const source = makeSourceTxt();
    service.getFs().openFile.mockResolvedValue(source);
    const books: Book[] = [];

    const result = await service.importBook('/library/novel.txt', books);

    expect(result).not.toBeNull();
    // ADR 0011: the TXT is kept as-is, not converted at import time.
    expect(service.getFs().copyFile).toHaveBeenCalledWith(
      '/library/novel.txt',
      'None',
      expect.stringMatching(/\.txt$/),
      'Books',
    );
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
  // Issue #5959: once the pickers stop dropping "novel.txt (1)", the importer
  // has to recognise it as a TXT too, or it reaches the document loader as an
  // unknown binary and fails with "Unsupported or corrupted book file".
  it('accepts a TXT whose duplicate-download marker landed after the extension', async () => {
    // `fs.openFile` reports the on-disk name, marker and all.
    const source = makeSourceTxt('novel.txt (1)');
    service.getFs().openFile.mockResolvedValue(source);

    const result = await service.importBook('/library/novel.txt (1)', []);

    expect(result).not.toBeNull();
    expect(result!.originalFilename).toBe('novel.txt (1)');
    expect(result!.title).not.toContain('.txt');
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
