#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { ArrayModule } from '../src/forthic/modules/array_module';
import { BooleanModule } from '../src/forthic/modules/boolean_module';
import { DateTimeModule } from '../src/forthic/modules/datetime_module';
import { JsonModule } from '../src/forthic/modules/json_module';
import { MathModule } from '../src/forthic/modules/math_module';
import { RecordModule } from '../src/forthic/modules/record_module';
import { StringModule } from '../src/forthic/modules/string_module';

/**
 * Documentation Generator for Forthic Modules
 *
 * Generates markdown documentation for all modules by extracting
 * metadata from @Word and @DirectWord decorators.
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
    name: string;
    description: string;
    categories: Array<{ name: string; words: string }>;
    optionsInfo?: string;
    examples: string[];
  } | null;
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

    // Add brief description based on module name
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

  // Instantiate each module and extract documentation
  const modules = [
    new ArrayModule(),
    new BooleanModule(),
    new DateTimeModule(),
    new JsonModule(),
    new MathModule(),
    new RecordModule(),
    new StringModule(),
  ];

  console.log(`Found ${modules.length} modules`);

  // Extract documentation from each module
  for (const module of modules) {
    const words = module.getWordDocs() as WordDoc[];
    const metadata = module.getModuleMetadata();

    if (words.length > 0) {
      moduleDocs.push({
        name: module.get_name(),
        words: words.sort((a, b) => a.name.localeCompare(b.name)),
        metadata: metadata
      });
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
