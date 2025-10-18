#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

/**
 * Documentation Generator for Forthic Modules
 *
 * Generates markdown documentation by parsing TypeScript source files
 * and extracting metadata from @Word and @DirectWord decorators.
 */

interface WordDoc {
  name: string;
  stackEffect: string;
  description: string;
}

interface ModuleDoc {
  name: string;
  words: WordDoc[];
  metadata?: {
    description: string;
    categories: Array<{ name: string; words: string }>;
    optionsInfo?: string;
    examples: string[];
  } | null;
}

/**
 * Parse module documentation from registerModuleDoc call
 */
function parseModuleMetadata(content: string): ModuleDoc['metadata'] | null {
  const registerMatch = content.match(/registerModuleDoc\([^,]+,\s*`([^`]+)`\)/s);
  if (!registerMatch) return null;

  const docString = registerMatch[1];
  const lines = docString.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const metadata: NonNullable<ModuleDoc['metadata']> = {
    description: '',
    categories: [],
    optionsInfo: undefined,
    examples: []
  };

  let currentSection: 'description' | 'categories' | 'options' | 'examples' = 'description';
  let optionsLines: string[] = [];

  for (const line of lines) {
    // Check for section headers
    if (line.startsWith('## Categories')) {
      currentSection = 'categories';
      continue;
    } else if (line.startsWith('## Options')) {
      currentSection = 'options';
      continue;
    } else if (line.startsWith('## Examples')) {
      currentSection = 'examples';
      continue;
    }

    // Process content based on current section
    if (currentSection === 'description') {
      if (metadata.description) {
        metadata.description += ' ' + line;
      } else {
        metadata.description = line;
      }
    } else if (currentSection === 'categories') {
      // Parse "- Category Name: WORD1, WORD2, WORD3"
      const match = line.match(/^-\s*([^:]+):\s*(.+)$/);
      if (match) {
        metadata.categories.push({
          name: match[1].trim(),
          words: match[2].trim()
        });
      }
    } else if (currentSection === 'options') {
      optionsLines.push(line);
    } else if (currentSection === 'examples') {
      metadata.examples.push(line);
    }
  }

  // Join options lines into a single string
  if (optionsLines.length > 0) {
    metadata.optionsInfo = optionsLines.join('\n');
  }

  return metadata;
}

/**
 * Parse @Word and @DirectWord decorators from TypeScript source
 */
function parseWords(content: string): WordDoc[] {
  const words: WordDoc[] = [];

  // Match @Word decorators
  const wordRegex = /@(?:Word|DirectWord)\s*\(\s*"([^"]+)"\s*,\s*"([^"]*)"\s*(?:,\s*"([^"]+)")?\s*\)/g;
  let match;

  while ((match = wordRegex.exec(content)) !== null) {
    const stackEffect = match[1];
    const description = match[2];
    const customName = match[3];

    // Find the method name by looking ahead
    const afterDecorator = content.substring(match.index + match[0].length);
    const methodMatch = afterDecorator.match(/async\s+(\w+)\s*\(/);

    if (methodMatch) {
      const methodName = methodMatch[1];
      const wordName = customName || methodName;

      words.push({
        name: wordName,
        stackEffect: stackEffect,
        description: description
      });
    }
  }

  return words;
}

/**
 * Extract module name from class definition
 */
function parseModuleName(content: string): string | null {
  const classMatch = content.match(/export\s+class\s+(\w+Module)/);
  if (!classMatch) return null;

  // Look for super("modulename") call in constructor
  const constructorMatch = content.match(/constructor\s*\([^)]*\)\s*\{[^}]*super\s*\(\s*"([^"]+)"\s*\)/s);
  if (constructorMatch) {
    return constructorMatch[1];
  }

  // Fallback: derive from class name
  const className = classMatch[1];
  return className.replace(/Module$/, '').toLowerCase();
}

/**
 * Parse a single module file
 */
function parseModuleFile(filePath: string): ModuleDoc | null {
  const content = fs.readFileSync(filePath, 'utf-8');
  const moduleName = parseModuleName(content);

  if (!moduleName) {
    console.warn(`Could not extract module name from ${filePath}`);
    return null;
  }

  const words = parseWords(content);
  const metadata = parseModuleMetadata(content);

  return {
    name: moduleName,
    words: words.sort((a, b) => a.name.localeCompare(b.name)),
    metadata: metadata
  };
}

function generateIndexMarkdown(moduleDocs: ModuleDoc[]): string {
  let markdown = '# Forthic Module Documentation\n\n';
  markdown += `Generated: ${new Date().toISOString()}\n\n`;

  const totalWords = moduleDocs.reduce((sum, mod) => sum + mod.words.length, 0);
  markdown += `**${moduleDocs.length} modules** with **${totalWords} words** total\n\n`;

  markdown += '## Modules\n\n';
  markdown += '| Module | Words | Description |\n';
  markdown += '|--------|-------|-------------|\n';

  for (const mod of moduleDocs) {
    markdown += `| [${mod.name}](./modules/${mod.name}.md) | ${mod.words.length} | `;

    // Use metadata description if available, otherwise use defaults
    if (mod.metadata?.description) {
      markdown += mod.metadata.description;
    } else {
      const descriptions: Record<string, string> = {
        'array': 'Array and collection operations',
        'boolean': 'Comparison, logic, and membership operations',
        'datetime': 'Date and time operations using Temporal API',
        'json': 'JSON parsing and serialization',
        'math': 'Mathematical operations and utilities',
        'record': 'Record (object/dictionary) manipulation',
        'string': 'String manipulation and processing'
      };
      markdown += descriptions[mod.name] || 'Module operations';
    }
    markdown += ' |\n';
  }

  markdown += '\n## Quick Links\n\n';
  for (const mod of moduleDocs) {
    markdown += `- **[${mod.name}](./modules/${mod.name}.md)**: ${mod.words.map(w => w.name).slice(0, 5).join(', ')}`;
    if (mod.words.length > 5) {
      markdown += `, ... (${mod.words.length - 5} more)`;
    }
    markdown += '\n';
  }

  return markdown;
}

function generateModuleMarkdown(moduleDoc: ModuleDoc): string {
  let markdown = `# ${moduleDoc.name} Module\n\n`;
  markdown += `[← Back to Index](../index.md)\n\n`;

  // Add module description if available
  if (moduleDoc.metadata?.description) {
    markdown += `${moduleDoc.metadata.description}\n\n`;
  }

  markdown += `**${moduleDoc.words.length} words**\n\n`;

  // Add categories section if available
  if (moduleDoc.metadata?.categories && moduleDoc.metadata.categories.length > 0) {
    markdown += '## Categories\n\n';
    for (const cat of moduleDoc.metadata.categories) {
      markdown += `- **${cat.name}**: ${cat.words}\n`;
    }
    markdown += '\n';
  }

  // Add options section if available
  if (moduleDoc.metadata?.optionsInfo) {
    markdown += '## Options\n\n';
    markdown += `${moduleDoc.metadata.optionsInfo}\n\n`;
  }

  // Add examples section if available
  if (moduleDoc.metadata?.examples && moduleDoc.metadata.examples.length > 0) {
    markdown += '## Examples\n\n';
    markdown += '```forthic\n';
    for (const example of moduleDoc.metadata.examples) {
      markdown += `${example}\n`;
    }
    markdown += '```\n\n';
  }

  markdown += '## Words\n\n';

  for (const word of moduleDoc.words) {
    markdown += `### ${word.name}\n\n`;
    markdown += `**Stack Effect:** \`${word.stackEffect}\`\n\n`;
    if (word.description) {
      markdown += `${word.description}\n\n`;
    }
    markdown += '---\n\n';
  }

  markdown += `\n[← Back to Index](../index.md)\n`;

  return markdown;
}

async function generateDocs() {
  const moduleDocs: ModuleDoc[] = [];

  // Find all module files in src/forthic/modules
  const modulesDir = path.join(__dirname, '..', 'src', 'forthic', 'modules');
  const files = fs.readdirSync(modulesDir)
    .filter(f => f.endsWith('_module.ts'))
    .map(f => path.join(modulesDir, f));

  console.log(`Found ${files.length} module files`);

  // Parse each module file
  for (const filePath of files) {
    const moduleDoc = parseModuleFile(filePath);
    if (moduleDoc && moduleDoc.words.length > 0) {
      moduleDocs.push(moduleDoc);
      console.log(`  Parsed ${moduleDoc.name}: ${moduleDoc.words.length} words`);
    }
  }

  // Sort modules by name
  moduleDocs.sort((a, b) => a.name.localeCompare(b.name));

  return moduleDocs;
}

async function main() {
  try {
    console.log('Generating Forthic module documentation...');

    const moduleDocs = await generateDocs();

    // Ensure docs directories exist
    const docsDir = path.join(__dirname, '..', 'docs');
    const modulesDir = path.join(docsDir, 'modules');
    if (!fs.existsSync(modulesDir)) {
      fs.mkdirSync(modulesDir, { recursive: true });
    }

    // Generate and write index file
    const indexMarkdown = generateIndexMarkdown(moduleDocs);
    const indexPath = path.join(docsDir, 'index.md');
    fs.writeFileSync(indexPath, indexMarkdown, 'utf-8');
    console.log(`✓ Index generated: ${indexPath}`);

    // Generate and write individual module files
    let totalSize = indexMarkdown.length;
    for (const moduleDoc of moduleDocs) {
      const moduleMarkdown = generateModuleMarkdown(moduleDoc);
      const modulePath = path.join(modulesDir, `${moduleDoc.name}.md`);
      fs.writeFileSync(modulePath, moduleMarkdown, 'utf-8');
      totalSize += moduleMarkdown.length;
      console.log(`  ✓ ${moduleDoc.name}.md (${moduleDoc.words.length} words)`);
    }

    console.log(`\n✓ Documentation complete!`);
    console.log(`  Total files: ${moduleDocs.length + 1}`);
    console.log(`  Total size: ${(totalSize / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('Error generating documentation:', error);
    process.exit(1);
  }
}

main();
