import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join, relative, resolve } from 'path';

interface BdgConfig {
  ignorePaths: string[];
}

interface DiffResult {
  onlyInFirst: string[];
  onlyInSecond: string[];
  inBoth: string[];
}

/**
 * Loads configuration from a config file
 */
function loadConfig(): BdgConfig {
  // Empty config (no defaults)
  const emptyConfig: BdgConfig = {
    ignorePaths: [],
  };

  // Look only for .bdgrc.json
  const configPath = resolve(process.cwd(), '.bdgrc.json');

  if (existsSync(configPath)) {
    try {
      const configContent = readFileSync(configPath, 'utf8');
      const parsedConfig = JSON.parse(configContent);
      if (typeof parsedConfig.ignorePaths === 'object' && Array.isArray(parsedConfig.ignorePaths)) {
        return parsedConfig;
      } else {
        console.warn(`Invalid config format in .bdgrc.json, using empty ignore list.`);
      }
    } catch (error) {
      console.error(`Error loading config from .bdgrc.json:`, error);
    }
  } else {
    console.warn(`.bdgrc.json not found, using empty ignore list.`);
  }

  return emptyConfig;
}

/**
 * Collects all paths in a directory, relative to the base directory
 */
function collectPaths(baseDir: string, currentDir: string, ignorePatterns: RegExp[]): string[] {
  const entries = readdirSync(currentDir);
  const paths: string[] = [];

  for (const entry of entries) {
    const fullPath = join(currentDir, entry);
    const relativePath = relative(baseDir, fullPath);

    if (ignorePatterns.some(pattern => pattern.test(relativePath))) {
      continue;
    }

    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      paths.push(...collectPaths(baseDir, fullPath, ignorePatterns));
    } else {
      paths.push(relativePath);
    }
  }

  return paths;
}

/**
 * Compares two directory structures and returns the differences
 */
function compareDirectories(
  dir1: string,
  dir2: string,
  ignorePatterns: (string | RegExp)[] = []
): DiffResult {
  // Convert string patterns to RegExp
  const regexPatterns = ignorePatterns.map(pattern =>
    pattern instanceof RegExp ? pattern : new RegExp(pattern)
  );

  const paths1 = collectPaths(dir1, dir1, regexPatterns).sort();
  const paths2 = collectPaths(dir2, dir2, regexPatterns).sort();

  const onlyInFirst = paths1.filter(path => !paths2.includes(path));
  const onlyInSecond = paths2.filter(path => !paths1.includes(path));
  const inBoth = paths1.filter(path => paths2.includes(path));

  return {
    onlyInFirst: onlyInFirst.map(path => join(dir1, path)),
    onlyInSecond: onlyInSecond.map(path => join(dir2, path)),
    inBoth: inBoth.map(path => join(dir1, path)),
  };
}

/**
 * Displays the differences between two directories
 */
function printDifferences(dir1: string, dir2: string, diff: DiffResult): void {
  console.log('Directory Structure Comparison:');
  console.log('===============================');

  if (diff.onlyInFirst.length === 0 && diff.onlyInSecond.length === 0) {
    console.log('✅ Directories are identical');
    return;
  }

  if (diff.onlyInFirst.length > 0) {
    console.log(`\nOnly in "${resolve(dir1)}":`);
    diff.onlyInFirst.forEach(path => console.log(` - ${path}`));
  }

  if (diff.onlyInSecond.length > 0) {
    console.log(`\nOnly in "${resolve(dir2)}":`);
    diff.onlyInSecond.forEach(path => console.log(` - ${path}`));
  }

  console.log(`\nFound ${diff.inBoth.length} identical paths, ${diff.onlyInFirst.length + diff.onlyInSecond.length} differences`);
}

/**
 * Displays the common files and directories between two directories
 */
function printCommonItems(dir1: string, dir2: string, diff: DiffResult): void {
  console.log('Common Directory Structure:');
  console.log('==========================');

  if (diff.inBoth.length === 0) {
    console.log('❌ No common files or directories found');
    return;
  }

  console.log(`\nFiles and directories in both "${resolve(dir1)}" and "${resolve(dir2)}":`);
  diff.inBoth.forEach(path => console.log(` - ${path}`));

  console.log(`\nFound ${diff.inBoth.length} common paths`);
}

/**
 * Converts string patterns to RegExp objects
 */
function patternsToRegExp(patterns: string[]): RegExp[] {
  return patterns.map(pattern => new RegExp(pattern));
}

// Update the example usage at the bottom of the file:
const config = loadConfig();
const ignorePatterns = patternsToRegExp(config.ignorePaths);

const dir1 = resolve('../oc-esim-service');
const dir2 = resolve('../oc-catalogue-service');

const diff = compareDirectories(dir1, dir2, ignorePatterns);
printCommonItems(dir1, dir2, diff);

export { compareDirectories, printDifferences, printCommonItems, loadConfig };
