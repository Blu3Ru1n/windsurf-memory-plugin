import { MemoryManager } from './memoryManager';
import * as path from 'path';

let memoryManager: MemoryManager;

export function activate(context: any) {
    const storagePath = context.globalStoragePath;
    memoryManager = new MemoryManager(storagePath);

    // Register command to store current context
    context.subscriptions.push(
        windsurf.commands.registerCommand('windsurf-memory.storeContext', async () => {
            const editor = windsurf.window.activeTextEditor;
            if (!editor) return;

            const document = editor.document;
            const projectId = getProjectId();
            const content = document.getText();
            
            await memoryManager.addMemory(projectId, content, {
                fileName: document.fileName,
                languageId: document.languageId,
                type: 'code'
            });

            windsurf.window.showInformationMessage('Context stored in memory');
        })
    );

    // Register command to retrieve project context
    context.subscriptions.push(
        windsurf.commands.registerCommand('windsurf-memory.getProjectContext', async () => {
            const projectId = getProjectId();
            const memories = await memoryManager.searchMemories(projectId, '', 10);
            const summary = await memoryManager.summarizeProjectContext(projectId);
            
            // Create and show memory view
            const panel = windsurf.window.createWebviewPanel(
                'projectMemory',
                'Project Memory',
                windsurf.ViewColumn.Two,
                {}
            );

            panel.webview.html = getMemoryWebviewContent(memories, summary);
        })
    );

    // Intercept LLM requests to augment with memory
    context.subscriptions.push(
        windsurf.llm.registerRequestInterceptor(async (request: any) => {
            const projectId = getProjectId();
            const projectContext = await memoryManager.summarizeProjectContext(projectId, request.prompt);
            
            // Augment the prompt with project context
            request.prompt = `Project Context:\n${projectContext}\n\nCurrent Request:\n${request.prompt}`;
            return request;
        })
    );
}

export function deactivate() {
    if (memoryManager) {
        memoryManager.close();
    }
}

function getProjectId(): string {
    // In a real implementation, you'd want to get this from the Windsurf workspace
    const workspaceFolders = windsurf.workspace.workspaceFolders;
    if (!workspaceFolders) return 'default';
    return workspaceFolders[0].uri.toString();
}

function getMemoryWebviewContent(memories: any[], summary: string): string {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    padding: 20px; 
                    max-width: 800px; 
                    margin: 0 auto;
                    line-height: 1.6;
                }
                .memory-item { 
                    border: 1px solid #ccc;
                    margin: 10px 0;
                    padding: 15px;
                    border-radius: 8px;
                    background: #fff;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .summary {
                    background: #f5f5f5;
                    padding: 20px;
                    margin-bottom: 30px;
                    border-radius: 8px;
                    border-left: 4px solid #007acc;
                }
                .memory-meta {
                    color: #666;
                    font-size: 0.9em;
                    margin-bottom: 8px;
                }
                .memory-content {
                    white-space: pre-wrap;
                    font-family: 'Consolas', monospace;
                    background: #f8f8f8;
                    padding: 10px;
                    border-radius: 4px;
                }
                h2, h3 { 
                    color: #333;
                    margin-top: 30px;
                }
            </style>
        </head>
        <body>
            <h2>Project Memory Summary</h2>
            <div class="summary">${summary}</div>
            
            <h3>Recent Memories</h3>
            ${memories.map(memory => `
                <div class="memory-item">
                    <div class="memory-meta">
                        ${new Date(memory.timestamp).toLocaleString()}
                        ${memory.metadata ? `| ${JSON.parse(memory.metadata).fileName || ''}` : ''}
                    </div>
                    <div class="memory-content">${memory.content}</div>
                </div>
            `).join('')}
        </body>
        </html>
    `;
}
