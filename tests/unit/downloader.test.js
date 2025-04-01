import { downloadFile } from '../../src/utils/downloader';

describe('Downloader Utility', () => {
    beforeEach(() => {
        // Setup any necessary mocks or initial state
    });

    afterEach(() => {
        // Clean up after each test
    });

    test('should download a file successfully', async () => {
        const url = 'https://example.com/file.txt';
        const filename = 'file.txt';

        // Mock the download function
        const mockDownload = jest.fn();
        global.chrome.downloads.download = mockDownload;

        await downloadFile(url, filename);

        expect(mockDownload).toHaveBeenCalledWith({
            url: url,
            filename: filename,
            saveAs: false
        });
    });

    test('should handle download errors', async () => {
        const url = 'https://example.com/file.txt';
        const filename = 'file.txt';

        // Mock the download function to simulate an error
        global.chrome.downloads.download = jest.fn((options, callback) => {
            callback({ error: 'Download failed' });
        });

        await expect(downloadFile(url, filename)).rejects.toThrow('Download failed');
    });
});