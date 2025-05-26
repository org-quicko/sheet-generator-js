import * as fs from 'fs';
import path from 'path';

export class FileUtil {
    /**
     * Writes content to a file at the specified path, creating directories if needed.
     * @param filePath - The full path where the file should be written
     * @param content - The content to write to the file
     */
    public static write(filePath: string, content: string): void {
        // Validate input parameters
        if (typeof filePath !== 'string' || filePath.trim() === '') {
            throw new TypeError('Invalid file path: must be a non-empty string');
        }
        if (typeof content !== 'string') {
            throw new TypeError('Content must be a string');
        }

        // Normalize and resolve the file path
        const normalizedPath = path.normalize(filePath);
        const absolutePath = path.isAbsolute(normalizedPath)
            ? normalizedPath
            : path.resolve(process.cwd(), normalizedPath);

        const directory = path.dirname(absolutePath);

        try {
            // Create directory recursively with secure permissions
            fs.mkdirSync(directory, {
                recursive: true,
            });

            // Write file with atomic write support
            fs.writeFileSync(absolutePath, content, {
                encoding: 'utf-8',
                flag: 'w', // overwrite existing
            });
        } catch (error) {
            // Handle specific error scenarios
            const errorMessage = (error as NodeJS.ErrnoException).code
                ? `File system error (${(error as NodeJS.ErrnoException).code}): ${(error as Error).message}`
                : (error as Error).message;

            throw new Error(`Failed to write to file "${absolutePath}": ${errorMessage}`);
        }
    }

    /**
     * Creates a directory if it doesn't already exist.
     * @param dirPath - The path to the directory to create
     */
    public static mkdir(dirPath: string): void {
        if (fs.existsSync(dirPath)) return;

        fs.mkdirSync(dirPath, { recursive: true });
    }

    /**
     * Reads all files in a directory that match the given filters.
     * @param folderPath - The path to the directory to read
     * @param filters - Array of filter functions to apply to filenames
     * @returns Array of filenames that pass all filters
     */
    public static filterFiles(folderPath: string, filters: ((file: string) => boolean)[]): string[] {
        return fs.readdirSync(folderPath).filter(file => filters.every(filter => filter(file)));
    }

    /**
     * Recursively get all files in a directory and its subdirectories
     * @param dirPath - The directory path to search
     * @returns Array of file paths
     */
    public static getAllFiles(dirPath: string): string[] {
        if (!fs.existsSync(dirPath)) {
            return [];
        }

        const files: string[] = [];
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                files.push(...this.getAllFiles(fullPath));
            } else {
                files.push(fullPath);
            }
        }

        return files;
    }

    /**
     * Returns the name of the file without the extension
     * @param filePath - The path to the file
     * @returns The name of the file without the extension
     */
    public static fileName(filePath: string): string {
        return path.basename(filePath, path.extname(filePath));
    }

    /**
     * Returns the extension of the file
     * @param filePath - The path to the file
     * @returns The extension of the file
     */
    public static extension(filePath: string): string {
        return path.extname(filePath);
    }

}