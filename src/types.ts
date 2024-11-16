export interface MemoryMetadata {
    type?: 'code' | 'documentation' | 'conversation';
    fileName?: string;
    languageId?: string;
    [key: string]: any;
}

export interface MemoryEntry {
    id: string;
    projectId: string;
    content: string;
    summary: string;
    metadata: string;
    timestamp: number;
    embedding: number[];
}

export interface LLMResponse {
    text: string;
}

export interface WindsurfLLM {
    complete(options: {
        prompt: string;
        maxTokens?: number;
        temperature?: number;
    }): Promise<LLMResponse>;
    
    embed(text: string): Promise<number[]>;
    
    registerRequestInterceptor(
        interceptor: (request: any) => Promise<any>
    ): void;
}
