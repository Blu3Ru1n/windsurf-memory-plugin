// Mock the windsurf API
const mockShowInformationMessage = jest.fn();
const mockRegisterCommand = jest.fn();
const mockWebview = { html: '' };
const mockCreateWebviewPanel = jest.fn(() => ({ webview: mockWebview }));
const mockRegisterRequestInterceptor = jest.fn();

// Mock ViewColumn enum
enum ViewColumn {
    One = 1,
    Two = 2,
    Three = 3
}

const mockWindsurf = {
    window: {
        showInformationMessage: mockShowInformationMessage,
        createWebviewPanel: mockCreateWebviewPanel,
        activeTextEditor: {
            document: {
                getText: jest.fn(),
                fileName: 'test.ts',
                languageId: 'typescript'
            }
        }
    },
    commands: {
        registerCommand: mockRegisterCommand
    },
    workspace: {
        workspaceFolders: [{
            uri: {
                toString: () => 'test-workspace'
            }
        }]
    },
    llm: {
        registerRequestInterceptor: mockRegisterRequestInterceptor
    },
    ViewColumn: ViewColumn
};

// Mock the MemoryManager
const mockClose = jest.fn();
const mockMemoryManager = {
    addMemory: jest.fn().mockResolvedValue('test-id'),
    searchMemories: jest.fn().mockResolvedValue([]),
    summarizeProjectContext: jest.fn().mockResolvedValue('test context'),
    close: mockClose
};

jest.mock('../memoryManager', () => ({
    MemoryManager: jest.fn(() => mockMemoryManager)
}));

import { activate, deactivate } from '../extension';

describe('Extension', () => {
    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        (global as any).windsurf = mockWindsurf;
    });

    test('should activate and register commands', () => {
        const context = {
            subscriptions: [],
            globalStoragePath: '/test/path'
        };

        activate(context);

        // Verify command registration
        expect(mockRegisterCommand).toHaveBeenCalledWith(
            'windsurf-memory.storeContext',
            expect.any(Function)
        );
        expect(mockRegisterCommand).toHaveBeenCalledWith(
            'windsurf-memory.getProjectContext',
            expect.any(Function)
        );
        expect(mockRegisterRequestInterceptor).toHaveBeenCalled();
    });

    test('should store context when command is executed', async () => {
        const context = {
            subscriptions: [],
            globalStoragePath: '/test/path'
        };

        activate(context);

        // Get the store context command handler
        const storeContextHandler = mockRegisterCommand.mock.calls.find(
            call => call[0] === 'windsurf-memory.storeContext'
        )[1];

        // Execute the handler
        await storeContextHandler();

        // Verify information message was shown
        expect(mockShowInformationMessage).toHaveBeenCalledWith(
            'Context stored in memory'
        );
    });

    test('should show project context when command is executed', async () => {
        const context = {
            subscriptions: [],
            globalStoragePath: '/test/path'
        };

        activate(context);

        // Get the get project context command handler
        const getContextHandler = mockRegisterCommand.mock.calls.find(
            call => call[0] === 'windsurf-memory.getProjectContext'
        )[1];

        // Execute the handler
        await getContextHandler();

        // Verify webview panel was created
        expect(mockCreateWebviewPanel).toHaveBeenCalledWith(
            'projectMemory',
            'Project Memory',
            mockWindsurf.ViewColumn.Two,
            {}
        );
    });

    test('should augment LLM requests with context', async () => {
        const context = {
            subscriptions: [],
            globalStoragePath: '/test/path'
        };

        activate(context);

        // Get the interceptor handler
        const interceptorHandler = mockRegisterRequestInterceptor.mock.calls[0][0];

        // Test the interceptor
        const request = {
            prompt: 'test prompt'
        };

        const augmentedRequest = await interceptorHandler(request);
        expect(augmentedRequest.prompt).toContain('Project Context:');
        expect(augmentedRequest.prompt).toContain('test prompt');
    });

    test('should properly deactivate', () => {
        deactivate();
        expect(mockClose).toHaveBeenCalled();
    });
});
