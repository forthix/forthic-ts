#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { StandardInterpreter } from '../src/forthic/interpreter';
import { IntentionalStopError } from '../src/forthic/errors';

/**
 * Forthic CLI - Run Forthic scripts or start interactive REPL
 *
 * Usage:
 *   forthic <file>              - Run forthic file as script
 *   forthic --repl [file]       - Start REPL (optionally load file first)
 */

interface CLIOptions {
  mode: 'script' | 'repl';
  filePath?: string;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return { mode: 'repl' };
  }

  if (args[0] === '--repl' || args[0] === '-r') {
    return {
      mode: 'repl',
      filePath: args[1]
    };
  }

  if (args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  return {
    mode: 'script',
    filePath: args[0]
  };
}

function showHelp() {
  console.log(`
Forthic CLI - Stack-based, concatenative language for composable transformations

Usage:
  forthic <file>              Run forthic file as script
  forthic --repl [file]       Start REPL (optionally load file first)
  forthic --help              Show this help message

Examples:
  forthic examples/hello.forthic           # Run script
  forthic --repl                           # Start blank REPL
  forthic --repl examples/hello.forthic    # Load file into REPL

REPL Commands:
  .stack      Show current stack contents
  .reset      Reset interpreter and clear stack
  .exit       Exit REPL (or use Ctrl+C)

More info: https://github.com/forthix/forthic-ts
`);
}

async function runScript(filePath: string) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }

    // Read file content
    const content = fs.readFileSync(filePath, 'utf-8');

    // Create interpreter
    const interp = new StandardInterpreter();

    // Execute code
    await interp.run(content);

    // Print stack contents if non-empty
    const stack = interp.get_stack().get_items();
    if (stack.length > 0) {
      console.log();
      showStack(interp);
    }

  } catch (error) {
    console.error(`\nError: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function startREPL(filePath?: string) {
  const interp = new StandardInterpreter();

  console.log('Forthic REPL v0.1.0');
  console.log('Type .exit to quit\n');

  // Load file if provided
  if (filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`Warning: File not found: ${filePath}\n`);
      } else {
        const content = fs.readFileSync(filePath, 'utf-8');
        await interp.run(content);
        console.log(`Loaded: ${filePath}`);
        showStack(interp);
        console.log();
      }
    } catch (error) {
      console.error(`Error loading file: ${error.message}\n`);
    }
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'forthic> '
  });

  rl.prompt();

  rl.on('line', async (line: string) => {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      rl.prompt();
      return;
    }

    // Handle REPL commands (but allow .s and .S to pass through to Forthic)
    if (trimmed.startsWith('.') && trimmed !== '.s' && trimmed !== '.S') {
      await handleReplCommand(trimmed, interp, rl);
      rl.prompt();
      return;
    }

    // Execute Forthic code
    try {
      await interp.run(trimmed);
    } catch (error) {
      // Don't show error for intentional stops (.s, .S)
      if (!(error instanceof IntentionalStopError)) {
        console.error(`Error: ${error.message}`);
      }
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nGoodbye!');
    process.exit(0);
  });
}

async function handleReplCommand(command: string, interp: StandardInterpreter, rl: readline.Interface) {
  const parts = command.split(/\s+/);
  const cmd = parts[0];

  switch (cmd) {
    case '.stack':
      showStack(interp);
      break;

    case '.reset':
      interp.reset();
      console.log('Interpreter reset');
      break;

    case '.exit':
      rl.close();
      break;

    default:
      console.log(`Unknown command: ${cmd}`);
  }
}

function showStack(interp: StandardInterpreter) {
  const stack = interp.get_stack().get_items();
  if (stack.length === 0) {
    console.log('Stack: (empty)');
  } else {
    console.log('Stack (top first):');
    // Show stack in reverse order (top first)
    for (let i = stack.length - 1; i >= 0; i--) {
      console.log(`  [${i}]: ${formatValue(stack[i])}`);
    }
  }
}

function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === 'string') {
    return `"${value}"`;
  }

  if (Array.isArray(value)) {
    return '[' + value.map(formatValue).join(', ') + ']';
  }

  if (typeof value === 'object' && value.constructor === Object) {
    const entries = Object.entries(value)
      .map(([k, v]) => `"${k}": ${formatValue(v)}`)
      .join(', ');
    return '{' + entries + '}';
  }

  return String(value);
}

// Main execution
async function main() {
  const options = parseArgs();

  if (options.mode === 'script') {
    if (!options.filePath) {
      console.error('Error: No file specified');
      showHelp();
      process.exit(1);
    }
    await runScript(options.filePath);
  } else {
    await startREPL(options.filePath);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
