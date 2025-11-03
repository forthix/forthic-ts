/**
 * TypeScript-specific File System Module
 * Provides file system operations only available in TypeScript/Node.js runtime
 */
import { DecoratedModule, ForthicWord, registerModuleDoc } from "../../decorators/word.js";
import * as fs from 'fs';
import * as path from 'path';

export class FsModule extends DecoratedModule {
  static {
    registerModuleDoc(FsModule, `
TypeScript-specific file system operations for Node.js runtime.

## Categories
- Read: READ-FILE, READ-FILE-LINES
- Write: WRITE-FILE, APPEND-FILE
- Check: FILE-EXISTS?, DIR-EXISTS?
- Path: JOIN-PATH, BASENAME, DIRNAME

## Examples
"/tmp/test.txt" "Hello World" WRITE-FILE
"/tmp/test.txt" READ-FILE
"/tmp" "/test.txt" JOIN-PATH
`);
  }

  constructor() {
    super("fs");
  }

  @ForthicWord("( path:string -- exists:boolean )", "Check if file exists", "FILE-EXISTS?")
  async FILE_EXISTS_Q(filePath: string) {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch {
      return false;
    }
  }

  @ForthicWord("( path:string -- exists:boolean )", "Check if directory exists", "DIR-EXISTS?")
  async DIR_EXISTS_Q(dirPath: string) {
    try {
      return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
    } catch {
      return false;
    }
  }

  @ForthicWord("( path:string -- content:string )", "Read file contents as string", "READ-FILE")
  async READ_FILE(filePath: string) {
    return fs.readFileSync(filePath, 'utf-8');
  }

  @ForthicWord("( path:string -- lines:string[] )", "Read file as array of lines", "READ-FILE-LINES")
  async READ_FILE_LINES(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n');
  }

  @ForthicWord("( path:string content:string -- )", "Write content to file", "WRITE-FILE")
  async WRITE_FILE(filePath: string, content: string) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return undefined;
  }

  @ForthicWord("( path:string content:string -- )", "Append content to file", "APPEND-FILE")
  async APPEND_FILE(filePath: string, content: string) {
    fs.appendFileSync(filePath, content, 'utf-8');
    return undefined;
  }

  @ForthicWord("( parts:string[] -- path:string )", "Join path components", "JOIN-PATH")
  async JOIN_PATH(...parts: string[]) {
    return path.join(...parts);
  }

  @ForthicWord("( path:string -- basename:string )", "Get basename of path")
  async BASENAME(filePath: string) {
    return path.basename(filePath);
  }

  @ForthicWord("( path:string -- dirname:string )", "Get directory name of path")
  async DIRNAME(filePath: string) {
    return path.dirname(filePath);
  }
}
