import * as sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { MemoryMetadata, MemoryEntry } from './types';

interface MemoryWithScore {
    memory: MemoryEntry;
    score: number;
}

export class MemoryManager {
    private db: Database | null = null;
    private readonly dbPath: string;
    private readonly memoryLimit = 1000;

    constructor(storagePath: string) {
        this.dbPath = path.join(storagePath, 'memory.db');
        this.initializeDatabase();
    }

    private async initializeDatabase() {
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                projectId TEXT NOT NULL,
                content TEXT NOT NULL,
                summary TEXT,
                metadata TEXT,
                timestamp INTEGER NOT NULL,
                embedding TEXT,
                UNIQUE(projectId, timestamp)
            )
        `);

        // Create indices for better performance
        await this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_project_timestamp ON memories(projectId, timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_project_content ON memories(projectId, content);
        `);
    }

    async close() {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }

    async addMemory(projectId: string, content: string, metadata?: MemoryMetadata): Promise<string> {
        if (!this.db) throw new Error('Database not initialized');

        const id = uuidv4();
        const timestamp = Date.now();

        // Generate summary and embedding
        const summary = await this.generateSummary(content, metadata?.type);
        const embedding = await this.generateEmbedding(content);

        // Store memory
        await this.db.run(
            `INSERT INTO memories (id, projectId, content, summary, metadata, timestamp, embedding)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                projectId,
                content,
                summary,
                metadata ? JSON.stringify(metadata) : '{}',
                timestamp,
                JSON.stringify(embedding)
            ]
        );

        // Prune old memories if needed
        await this.pruneOldMemories(projectId);

        return id;
    }

    private async generateSummary(content: string, type?: string): Promise<string> {
        try {
            const prompt = `Summarize the following ${type || 'content'} in a concise way:

${content}

Summary:`;

            const response = await windsurf.llm.complete({
                prompt,
                maxTokens: 100,
                temperature: 0.3
            });

            return response.text.trim();
        } catch (error) {
            console.error('Error generating summary:', error);
            return ''; // Return empty string if summarization fails
        }
    }

    private async generateEmbedding(text: string): Promise<number[]> {
        try {
            const embedding = await windsurf.llm.embed(text);
            return embedding;
        } catch (error) {
            console.error('Error generating embedding:', error);
            return new Array(384).fill(0); // Return zero embedding if generation fails
        }
    }

    async searchMemories(projectId: string, query: string, limit: number = 10): Promise<MemoryEntry[]> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            // Generate query embedding
            const queryEmbedding = await this.generateEmbedding(query);

            // Get all memories for the project
            const memories = await this.db.all<MemoryEntry[]>(
                `SELECT * FROM memories WHERE projectId = ? ORDER BY timestamp DESC LIMIT ?`,
                [projectId, limit]
            );

            if (!query) return memories;

            // Calculate cosine similarity with query embedding
            const memoriesWithScore: MemoryWithScore[] = memories.map(memory => {
                const memoryEmbedding = JSON.parse(memory.embedding as unknown as string);
                const similarity = this.cosineSimilarity(queryEmbedding, memoryEmbedding);
                return { memory, score: similarity };
            });

            // Sort by similarity score
            memoriesWithScore.sort((a: MemoryWithScore, b: MemoryWithScore) => b.score - a.score);

            return memoriesWithScore.map((m: MemoryWithScore) => m.memory);
        } catch (error) {
            console.error('Error searching memories:', error);
            // Fall back to text-based search
            return this.db.all<MemoryEntry[]>(
                `SELECT * FROM memories 
                 WHERE projectId = ? AND content LIKE ? 
                 ORDER BY timestamp DESC LIMIT ?`,
                [projectId, `%${query}%`, limit]
            );
        }
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }

    private async pruneOldMemories(projectId: string) {
        if (!this.db) throw new Error('Database not initialized');

        const count = await this.db.get<{ count: number }>(
            'SELECT COUNT(*) as count FROM memories WHERE projectId = ?',
            [projectId]
        );

        if (count && count.count > this.memoryLimit) {
            const toDelete = count.count - this.memoryLimit;
            await this.db.run(
                `DELETE FROM memories 
                 WHERE projectId = ? AND id IN (
                     SELECT id FROM memories 
                     WHERE projectId = ? 
                     ORDER BY timestamp ASC 
                     LIMIT ?
                 )`,
                [projectId, projectId, toDelete]
            );
        }
    }

    async summarizeProjectContext(projectId: string, relevantToQuery?: string): Promise<string> {
        try {
            // Get relevant memories
            const memories = relevantToQuery 
                ? await this.searchMemories(projectId, relevantToQuery, 5)
                : await this.searchMemories(projectId, '', 5);

            if (memories.length === 0) return '';

            // Create a prompt for context summarization
            const prompt = `Summarize the following project context in a way that would be helpful for an AI assistant:

${memories.map(m => `--- Memory from ${new Date(m.timestamp).toISOString()} ---
${m.summary || m.content}`).join('\n\n')}

Concise summary of the key points:`;

            // Use Windsurf's LLM for summarization
            const response = await windsurf.llm.complete({
                prompt,
                maxTokens: 200,
                temperature: 0.3
            });

            return response.text.trim();
        } catch (error) {
            console.error('Error summarizing project context:', error);
            const memories = await this.searchMemories(projectId, '', 5);
            // Fall back to basic concatenation if summarization fails
            return memories.map(m => m.summary || m.content).join('\n\n');
        }
    }
}
