import { DecoratedModule } from "./word";
import { StandardInterpreter } from "../interpreter";

/**
 * Generate markdown documentation for a module
 */
export function generateModuleDocs(module: DecoratedModule): string {
  const docs = module.getWordDocs();
  let md = `# ${module.get_name()} Module\n\n`;

  if (docs.length === 0) {
    md += "*No documented words*\n";
    return md;
  }

  // Sort alphabetically
  docs.sort((a, b) => a.name.localeCompare(b.name));

  for (const doc of docs) {
    md += `## ${doc.name}\n\n`;
    md += `**Stack Effect**: \`${doc.stackEffect}\`\n\n`;
    if (doc.description) {
      md += `${doc.description}\n\n`;
    }
  }

  return md;
}

/**
 * Generate JSON documentation for multiple modules
 */
export function generateDocsJSON(modules: DecoratedModule[]): any {
  return modules.map(module => ({
    name: module.get_name(),
    words: module.getWordDocs(),
  }));
}

/**
 * Generate full stdlib documentation
 */
export function generateStdlibDocs(interp: StandardInterpreter): string {
  const moduleNames = [
    "core", "array", "record", "string", "datetime",
    "math", "boolean", "json", "utility"
  ];

  let md = "# Forthic Standard Library\n\n";

  for (const moduleName of moduleNames) {
    const module = interp.app_module.find_module(moduleName);
    if (module && module instanceof DecoratedModule) {
      md += generateModuleDocs(module);
      md += "\n---\n\n";
    }
  }

  return md;
}
