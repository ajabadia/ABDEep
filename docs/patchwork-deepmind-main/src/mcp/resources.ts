import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type McpResource = {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
};

type FileBackedResource = McpResource & { fileRelativePath: string };

function getRepoRootDir(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  // Works from both `src/mcp` (tests) and `dist/mcp` (runtime).
  return path.resolve(moduleDir, '../..');
}

const RESOURCES: FileBackedResource[] = [
  {
    uri: 'deepmind12://capabilities/param-description',
    name: 'deepmind_param_description',
    title: 'DeepMind 12 Parameter Description Capability',
    description: 'Explains how to query parameter ranges and enum values via the describe_param tool.',
    mimeType: 'text/markdown',
    fileRelativePath: 'references/deepmind_param_description.md',
  },
  {
    uri: 'deepmind12://references/deepmind_sysex',
    name: 'deepmind_sysex',
    title: 'DeepMind 12 SysEx Reference',
    description: 'SysEx reference material (markdown).',
    mimeType: 'text/markdown',
    fileRelativePath: 'references/deepmind_sysex.md',
  },
  {
    uri: 'deepmind12://references/deepmind_fx',
    name: 'deepmind_fx',
    title: 'DeepMind 12 FX Reference',
    description: 'DeepMind 12 FX type, parameter, and typed-prefix reference (markdown).',
    mimeType: 'text/markdown',
    fileRelativePath: 'references/deepmind_fx.md',
  },
];

export function listResources(): McpResource[] {
  return RESOURCES.map(({ fileRelativePath: _fileRelativePath, ...resource }) => resource);
}

export async function readResource(uri: string): Promise<{ uri: string; mimeType?: string; text: string }> {
  const resource = RESOURCES.find((r) => r.uri === uri);
  if (!resource) {
    throw new Error(`Unknown resource URI: ${uri}`);
  }

  const repoRootDir = getRepoRootDir();
  const absolutePath = path.resolve(repoRootDir, resource.fileRelativePath);
  const text = await readFile(absolutePath, 'utf8');

  return { uri: resource.uri, mimeType: resource.mimeType, text };
}
