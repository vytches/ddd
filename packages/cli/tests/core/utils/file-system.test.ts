import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { FileSystem } from '../../../src/core/utils/file-system';
import { CLIError } from '../../../src/types';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  promises: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    copyFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
  },
}));

// Mock path module
vi.mock('path', () => ({
  dirname: vi.fn(),
  resolve: vi.fn(),
  relative: vi.fn(),
  join: vi.fn(),
  extname: vi.fn(),
  basename: vi.fn(),
}));

describe('FileSystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exists method', () => {
    it('should return true when file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = FileSystem.exists('/path/to/file.txt');

      expect(result).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/file.txt');
    });

    it('should return false when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = FileSystem.exists('/path/to/nonexistent.txt');

      expect(result).toBe(false);
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/nonexistent.txt');
    });

    it('should return false when fs.existsSync throws', () => {
      vi.mocked(fs.existsSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = FileSystem.exists('/path/to/file.txt');

      expect(result).toBe(false);
    });
  });

  describe('isDirectory method', () => {
    it('should return true when path is a directory', () => {
      const mockStats = { isDirectory: vi.fn().mockReturnValue(true) };
      vi.mocked(fs.statSync).mockReturnValue(mockStats as any);

      const result = FileSystem.isDirectory('/path/to/directory');

      expect(result).toBe(true);
      expect(fs.statSync).toHaveBeenCalledWith('/path/to/directory');
    });

    it('should return false when path is not a directory', () => {
      const mockStats = { isDirectory: vi.fn().mockReturnValue(false) };
      vi.mocked(fs.statSync).mockReturnValue(mockStats as any);

      const result = FileSystem.isDirectory('/path/to/file.txt');

      expect(result).toBe(false);
    });

    it('should return false when fs.statSync throws', () => {
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const result = FileSystem.isDirectory('/path/to/nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('isFile method', () => {
    it('should return true when path is a file', () => {
      const mockStats = { isFile: vi.fn().mockReturnValue(true) };
      vi.mocked(fs.statSync).mockReturnValue(mockStats as any);

      const result = FileSystem.isFile('/path/to/file.txt');

      expect(result).toBe(true);
      expect(fs.statSync).toHaveBeenCalledWith('/path/to/file.txt');
    });

    it('should return false when path is not a file', () => {
      const mockStats = { isFile: vi.fn().mockReturnValue(false) };
      vi.mocked(fs.statSync).mockReturnValue(mockStats as any);

      const result = FileSystem.isFile('/path/to/directory');

      expect(result).toBe(false);
    });

    it('should return false when fs.statSync throws', () => {
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const result = FileSystem.isFile('/path/to/nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('createDirectory method', () => {
    it('should create directory successfully', async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);

      await FileSystem.createDirectory('/path/to/directory');

      expect(fs.promises.mkdir).toHaveBeenCalledWith('/path/to/directory', { recursive: true });
    });

    it('should throw CLIError when mkdir fails', async () => {
      const originalError = new Error('Permission denied');
      vi.mocked(fs.promises.mkdir).mockRejectedValue(originalError);

      const [error] = await safeRun(
        async () => await FileSystem.createDirectory('/path/to/directory')
      );

      expect(error).toBeInstanceOf(CLIError);
      expect(error?.message).toBe(
        'Failed to create directory /path/to/directory: Permission denied'
      );
    });

    it('should handle non-Error rejection', async () => {
      vi.mocked(fs.promises.mkdir).mockRejectedValue('String error');

      const [error] = await safeRun(
        async () => await FileSystem.createDirectory('/path/to/directory')
      );

      expect(error).toBeInstanceOf(CLIError);
      expect(error?.message).toBe('Failed to create directory /path/to/directory: String error');
    });
  });

  describe('readFile method', () => {
    it('should read file successfully', async () => {
      const fileContent = 'file content';
      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);

      const result = await FileSystem.readFile('/path/to/file.txt');

      expect(result).toBe(fileContent);
      expect(fs.promises.readFile).toHaveBeenCalledWith('/path/to/file.txt', 'utf-8');
    });

    it('should throw CLIError when readFile fails', async () => {
      const originalError = new Error('File not found');
      vi.mocked(fs.promises.readFile).mockRejectedValue(originalError);

      const [error] = await safeRun(async () => await FileSystem.readFile('/path/to/file.txt'));

      expect(error).toBeInstanceOf(CLIError);
      expect(error?.message).toBe('Failed to read file /path/to/file.txt: File not found');
    });
  });

  describe('writeFile method', () => {
    it('should write file successfully', async () => {
      vi.mocked(path.dirname).mockReturnValue('/path/to');
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await FileSystem.writeFile('/path/to/file.txt', 'content');

      expect(path.dirname).toHaveBeenCalledWith('/path/to/file.txt');
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/path/to', { recursive: true });
      expect(fs.promises.writeFile).toHaveBeenCalledWith('/path/to/file.txt', 'content', 'utf-8');
    });

    it('should throw CLIError when writeFile fails', async () => {
      vi.mocked(path.dirname).mockReturnValue('/path/to');
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      const originalError = new Error('Write failed');
      vi.mocked(fs.promises.writeFile).mockRejectedValue(originalError);

      const [error] = await safeRun(
        async () => await FileSystem.writeFile('/path/to/file.txt', 'content')
      );

      expect(error).toBeInstanceOf(CLIError);
      expect(error?.message).toBe('Failed to write file /path/to/file.txt: Write failed');
    });
  });

  describe('copyFile method', () => {
    it('should copy file successfully', async () => {
      vi.mocked(path.dirname).mockReturnValue('/dest/path');
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.copyFile).mockResolvedValue(undefined);

      await FileSystem.copyFile('/source/file.txt', '/dest/path/file.txt');

      expect(path.dirname).toHaveBeenCalledWith('/dest/path/file.txt');
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/dest/path', { recursive: true });
      expect(fs.promises.copyFile).toHaveBeenCalledWith('/source/file.txt', '/dest/path/file.txt');
    });

    it('should throw CLIError when copyFile fails', async () => {
      vi.mocked(path.dirname).mockReturnValue('/dest/path');
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      const originalError = new Error('Copy failed');
      vi.mocked(fs.promises.copyFile).mockRejectedValue(originalError);

      const [error] = await safeRun(
        async () => await FileSystem.copyFile('/source/file.txt', '/dest/path/file.txt')
      );

      expect(error).toBeInstanceOf(CLIError);
      expect(error?.message).toBe(
        'Failed to copy file from /source/file.txt to /dest/path/file.txt: Copy failed'
      );
    });
  });

  describe('listDirectory method', () => {
    it('should list directory contents successfully', async () => {
      const files = ['file1.txt', 'file2.txt', 'subdir'] as unknown as fs.Dirent<
        Buffer<ArrayBufferLike>
      >[];
      vi.mocked(fs.promises.readdir).mockResolvedValue(files);

      const result = await FileSystem.listDirectory('/path/to/directory');

      expect(result).toEqual(files);
      expect(fs.promises.readdir).toHaveBeenCalledWith('/path/to/directory');
    });

    it('should throw CLIError when readdir fails', async () => {
      const originalError = new Error('Directory not found');
      vi.mocked(fs.promises.readdir).mockRejectedValue(originalError);

      const [error] = await safeRun(
        async () => await FileSystem.listDirectory('/path/to/directory')
      );

      expect(error).toBeInstanceOf(CLIError);
      expect(error?.message).toBe(
        'Failed to list directory /path/to/directory: Directory not found'
      );
    });
  });

  describe('getStats method', () => {
    it('should get file stats successfully', async () => {
      const mockStats = { size: 1024, mtime: new Date() };
      vi.mocked(fs.promises.stat).mockResolvedValue(mockStats as any);

      const result = await FileSystem.getStats('/path/to/file.txt');

      expect(result).toBe(mockStats);
      expect(fs.promises.stat).toHaveBeenCalledWith('/path/to/file.txt');
    });

    it('should throw CLIError when stat fails', async () => {
      const originalError = new Error('File not found');
      vi.mocked(fs.promises.stat).mockRejectedValue(originalError);

      const [error] = await safeRun(async () => await FileSystem.getStats('/path/to/file.txt'));

      expect(error).toBeInstanceOf(CLIError);
      expect(error?.message).toBe('Failed to get stats for /path/to/file.txt: File not found');
    });
  });

  describe('findFiles method', () => {
    it('should find files matching pattern', async () => {
      const mockItems = ['file1.txt', 'file2.js', 'subdir'] as unknown as fs.Dirent<
        Buffer<ArrayBufferLike>
      >[];
      const mockStats = [
        { isDirectory: () => false },
        { isDirectory: () => false },
        { isDirectory: () => true },
      ];

      // Mock the first readdir call for /test
      vi.mocked(fs.promises.readdir)
        .mockResolvedValueOnce(mockItems)
        .mockResolvedValueOnce([] as any); // Empty subdirectory

      vi.mocked(fs.promises.stat)
        .mockResolvedValueOnce(mockStats[0] as any)
        .mockResolvedValueOnce(mockStats[1] as any)
        .mockResolvedValueOnce(mockStats[2] as any);

      // Mock path.join to return proper paths
      vi.mocked(path.join).mockImplementation((base: string, file: string) => `${base}/${file}`);

      const pattern = /\.txt$/;
      const result = await FileSystem.findFiles('/test', pattern);

      expect(result).toEqual(['/test/file1.txt']);
    });

    it('should recursively search subdirectories', async () => {
      const mockItems = ['file1.txt'] as unknown as fs.Dirent<Buffer<ArrayBufferLike>>[];
      const mockStats = [{ isDirectory: () => false }];

      vi.mocked(fs.promises.readdir).mockResolvedValue(mockItems);
      vi.mocked(fs.promises.stat).mockResolvedValue(mockStats[0] as any);
      vi.mocked(path.join).mockReturnValue('/test/subdir/file1.txt');

      const pattern = /\.txt$/;
      const result = await FileSystem.findFiles('/test/subdir', pattern);

      expect(result).toEqual(['/test/subdir/file1.txt']);
    });

    it('should throw CLIError when findFiles fails', async () => {
      const originalError = new Error('Permission denied');
      vi.mocked(fs.promises.readdir).mockRejectedValue(originalError);

      const [error] = await safeRun(async () => await FileSystem.findFiles('/test', /\.txt$/));

      expect(error).toBeInstanceOf(CLIError);
      expect(error?.message).toBe(
        'Failed to find files in /test: Failed to list directory /test: Permission denied'
      );
    });
  });

  describe('path utility methods', () => {
    describe('resolvePath', () => {
      it('should resolve absolute path', () => {
        vi.mocked(path.resolve).mockReturnValue('/absolute/path/to/file.txt');

        const result = FileSystem.resolvePath('relative/path/to/file.txt');

        expect(result).toBe('/absolute/path/to/file.txt');
        expect(path.resolve).toHaveBeenCalledWith('relative/path/to/file.txt');
      });
    });

    describe('relativePath', () => {
      it('should get relative path between two paths', () => {
        vi.mocked(path.relative).mockReturnValue('../other/file.txt');

        const result = FileSystem.relativePath('/from/path', '/other/file.txt');

        expect(result).toBe('../other/file.txt');
        expect(path.relative).toHaveBeenCalledWith('/from/path', '/other/file.txt');
      });
    });

    describe('joinPath', () => {
      it('should join multiple path segments', () => {
        vi.mocked(path.join).mockReturnValue('/path/to/file.txt');

        const result = FileSystem.joinPath('/path', 'to', 'file.txt');

        expect(result).toBe('/path/to/file.txt');
        expect(path.join).toHaveBeenCalledWith('/path', 'to', 'file.txt');
      });

      it('should handle empty path segments', () => {
        vi.mocked(path.join).mockReturnValue('/path/file.txt');

        const result = FileSystem.joinPath('/path', '', 'file.txt');

        expect(result).toBe('/path/file.txt');
        expect(path.join).toHaveBeenCalledWith('/path', '', 'file.txt');
      });
    });

    describe('getExtension', () => {
      it('should get file extension', () => {
        vi.mocked(path.extname).mockReturnValue('.txt');

        const result = FileSystem.getExtension('/path/to/file.txt');

        expect(result).toBe('.txt');
        expect(path.extname).toHaveBeenCalledWith('/path/to/file.txt');
      });

      it('should handle files without extension', () => {
        vi.mocked(path.extname).mockReturnValue('');

        const result = FileSystem.getExtension('/path/to/file');

        expect(result).toBe('');
      });
    });

    describe('getBaseName', () => {
      it('should get file name without extension', () => {
        vi.mocked(path.basename).mockReturnValue('file');
        vi.mocked(path.extname).mockReturnValue('.txt');

        const result = FileSystem.getBaseName('/path/to/file.txt');

        expect(result).toBe('file');
        expect(path.basename).toHaveBeenCalledWith('/path/to/file.txt', '.txt');
      });

      it('should handle files without extension', () => {
        vi.mocked(path.basename).mockReturnValue('file');
        vi.mocked(path.extname).mockReturnValue('');

        const result = FileSystem.getBaseName('/path/to/file');

        expect(result).toBe('file');
      });
    });

    describe('getDirectoryName', () => {
      it('should get directory name', () => {
        vi.mocked(path.dirname).mockReturnValue('/path/to');

        const result = FileSystem.getDirectoryName('/path/to/file.txt');

        expect(result).toBe('/path/to');
        expect(path.dirname).toHaveBeenCalledWith('/path/to/file.txt');
      });
    });
  });
});
