import * as fs from 'fs';
import * as path from 'path';
import { MemoryManager } from '../memoryManager';
import { MemoryMetadata } from '../types';

// Mock windsurf global object
(global as any).windsurf = {
    llm: {
        complete: jest.fn().mockImplementation(async ({ prompt }) => ({
            text: `Summary of: ${prompt.substring(0, 20)}...`
        })),
        embed: jest.fn().mockImplementation(async (text) => {
            // Return similar embeddings for similar words
            if (text.toLowerCase().includes('typescript')) {
                return new Array(384).fill(0).map((_, i) => Math.sin(i));
            } else if (text.toLowerCase().includes('javascript')) {
                return new Array(384).fill(0).map((_, i) => Math.sin(i + 0.5));
            } else {
                return new Array(384).fill(0).map((_, i) => Math.cos(i));
            }
        })
    }
};

describe('MemoryManager', () => {
    let memoryManager: MemoryManager;
    const tempDir = path.join(__dirname, 'temp-test-dir');

    beforeEach(async () => {
        // Create temporary directory for tests
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        memoryManager = new MemoryManager(tempDir);
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait for DB initialization
    });

    afterEach(async () => {
        await memoryManager.close();
        // Clean up temporary directory
        if (fs.existsSync(tempDir)) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait for DB to close
            fs.rmSync(tempDir, { recursive: true });
        }
    });

    it('should add and retrieve memories with summaries and embeddings', async () => {
        const projectId = 'test-project';
        const content = 'Test memory content';
        const metadata: MemoryMetadata = { type: 'code' };

        const id = await memoryManager.addMemory(projectId, content, metadata);
        expect(id).toBeDefined();

        const memories = await memoryManager.searchMemories(projectId, '');
        expect(memories).toHaveLength(1);
        expect(memories[0].content).toBe(content);
        expect(memories[0].summary).toContain('Summary of:');
        expect(JSON.parse(memories[0].metadata as string)).toEqual(metadata);
    });

    it('should handle LLM failures gracefully', async () => {
        const mockError = new Error('LLM API failed');
        const llm = (global as any).windsurf.llm;
        llm.complete.mockRejectedValueOnce(mockError);
        llm.embed.mockRejectedValueOnce(mockError);

        const projectId = 'test-project';
        const content = 'Test memory content';

        const id = await memoryManager.addMemory(projectId, content);
        expect(id).toBeDefined();

        const memories = await memoryManager.searchMemories(projectId, '');
        expect(memories).toHaveLength(1);
        expect(memories[0].content).toBe(content);
        expect(memories[0].summary).toBe('');
    });

    it('should prune old memories when limit is exceeded', async () => {
        const projectId = 'test-project';
        const memoryLimit = 1000;

        // Add more memories than the limit
        for (let i = 0; i < memoryLimit + 5; i++) {
            await memoryManager.addMemory(projectId, `Memory ${i}`);
        }

        const memories = await memoryManager.searchMemories(projectId, '');
        expect(memories.length).toBeLessThanOrEqual(memoryLimit);
    });

    it('should perform semantic search when possible', async () => {
        const projectId = 'test-project';
        await memoryManager.addMemory(projectId, 'TypeScript is great');
        await memoryManager.addMemory(projectId, 'Python is awesome');
        await memoryManager.addMemory(projectId, 'JavaScript is cool');

        const memories = await memoryManager.searchMemories(projectId, 'typescript programming');
        expect(memories[0].content).toBe('TypeScript is great');
    });

    it('should generate context-aware summaries', async () => {
        const projectId = 'test-project';
        await memoryManager.addMemory(projectId, 'TypeScript feature A');
        await memoryManager.addMemory(projectId, 'TypeScript feature B');
        await memoryManager.addMemory(projectId, 'Python feature X');

        const summary = await memoryManager.summarizeProjectContext(projectId, 'typescript');
        expect(summary).toContain('Summary of:');
    });
});
