# Windsurf Memory Plugin

This plugin extends Windsurf's built-in LLM capabilities by adding persistent, project-specific memory. It enables a pseudo-infinite context window by maintaining and intelligently retrieving relevant context for each project.

## Features

- **Persistent Memory**: Stores project-specific context across sessions
- **Automatic Context Integration**: Automatically augments LLM prompts with relevant project context
- **Memory Management**: SQLite-based storage for efficient retrieval and persistence
- **Project-Specific Context**: Maintains separate memory for each project
- **Memory Visualization**: Web view to explore and understand stored context

## Commands

- `windsurf-memory.storeContext`: Manually store current editor content in memory
- `windsurf-memory.getProjectContext`: View project memory and context summary

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to compile TypeScript
4. Copy the compiled files to your Windsurf extensions directory

## Usage

The plugin works automatically by intercepting LLM requests and augmenting them with relevant project context. You can also manually store context or view the memory contents using the provided commands.

## Development

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Run tests
npm test
```

## Architecture

- `memoryManager.ts`: Core memory management system using SQLite
- `extension.ts`: Main plugin integration with Windsurf

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
