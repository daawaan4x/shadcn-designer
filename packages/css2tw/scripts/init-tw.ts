import fs from 'fs';
import path from 'path';

const targetFile = process.argv[2];
if (!targetFile) {
  console.error("Usage: pnpm run init:tw <path/to/design/file.html>");
  process.exit(1);
}

const fullPath = path.resolve(process.cwd(), targetFile);
if (!fs.existsSync(fullPath)) {
  console.error(`File not found: ${fullPath}`);
  process.exit(1);
}

const html = fs.readFileSync(fullPath, 'utf-8');

// Extract all <style> blocks
const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
let match;
const styleBlocks = [];
while ((match = styleRegex.exec(html)) !== null) {
  styleBlocks.push(match[1]);
}

if (styleBlocks.length === 0) {
  console.error("No <style> block found in the target file.");
  process.exit(0);
}

const styles = styleBlocks.join('\n');

// Extract CSS variables: --var-name: value;
const varRegex = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
const variables: Record<string, string> = {};

let varMatch;
while ((varMatch = varRegex.exec(styles)) !== null) {
  variables[varMatch[1].trim()] = varMatch[2].trim();
}

if (Object.keys(variables).length === 0) {
  console.log("No custom CSS variables found.");
  process.exit(0);
}

// Scaffold Tailwind config
const colors: Record<string, string> = {};
const fonts: Record<string, string> = {};
const spacing: Record<string, string> = {};
const other: Record<string, string> = {};

// camelCase conversion
const toCamel = (str: string) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

for (const [key, val] of Object.entries(variables)) {
  const camelKey = toCamel(key);
  const cssVar = `var(--${key})`;
  
  if (key.includes('color') || key.includes('bg') || key.includes('text') || val.startsWith('#') || val.startsWith('hsl') || val.startsWith('rgb')) {
    colors[camelKey] = cssVar;
  } else if (key.includes('font')) {
    fonts[camelKey] = cssVar;
  } else if (key.includes('spacing') || key.includes('gap') || key.includes('padding') || key.includes('margin') || val.endsWith('px') || val.endsWith('rem')) {
    spacing[camelKey] = cssVar;
  } else {
    other[camelKey] = cssVar;
  }
}

const configObj = {
  theme: {
    extend: {
      ...(Object.keys(colors).length > 0 && { colors }),
      ...(Object.keys(fonts).length > 0 && { fontFamily: fonts }),
      ...(Object.keys(spacing).length > 0 && { spacing }),
      ...(Object.keys(other).length > 0 && { variables: other }), // Custom extension for generic vars
    }
  }
};

const scriptBlock = `<script>
  tailwind.config = ${JSON.stringify(configObj, null, 4)};
</script>`;

let rootBlock = `<style>\n  :root {\n`;
for (const [key, val] of Object.entries(variables)) {
  rootBlock += `    --${key}: ${val};\n`;
}
rootBlock += `  }\n</style>`;

console.log("\n--- Generated Tailwind Configuration Scaffolding ---\n");
console.log("<!-- Add this to your HTML <head> to prevent silent variable failures -->");
console.log(rootBlock);
console.log("\n<!-- Tailwind Configuration -->");
console.log(scriptBlock);
console.log("\n----------------------------------------------------\n");
