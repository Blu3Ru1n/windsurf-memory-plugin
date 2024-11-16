declare global {
    const windsurf: {
        window: {
            showInformationMessage: (message: string) => void;
            createWebviewPanel: (viewType: string, title: string, column: ViewColumn, options: any) => {
                webview: {
                    html: string;
                }
            };
            activeTextEditor?: {
                document: {
                    getText: () => string;
                    fileName: string;
                    languageId: string;
                }
            };
        };
        commands: {
            registerCommand: (command: string, callback: (...args: any[]) => any) => void;
        };
        workspace: {
            workspaceFolders?: Array<{
                uri: {
                    toString: () => string;
                }
            }>;
        };
        llm: {
            registerRequestInterceptor: (interceptor: (request: any) => Promise<any>) => void;
            complete: (options: {
                prompt: string;
                maxTokens?: number;
                temperature?: number;
                stop?: string[];
                model?: string;
            }) => Promise<{
                text: string;
                usage?: {
                    promptTokens: number;
                    completionTokens: number;
                    totalTokens: number;
                }
            }>;
            embed: (text: string, options?: {
                model?: string;
                batchSize?: number;
            }) => Promise<number[]>;
        };
        ViewColumn: {
            One: 1;
            Two: 2;
            Three: 3;
        };
    };

    enum ViewColumn {
        One = 1,
        Two = 2,
        Three = 3
    }
}

export {};
