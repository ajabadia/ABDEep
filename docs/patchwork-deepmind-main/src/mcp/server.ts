#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { toolDefinitions } from './tools.js';
import {
  handleDescribeNrpn,
  handleDescribeParam,
  handleDescribeFxType,
  handleSetParam,
  handleSetParams,
  handleSnapshotState,
  handleSendNrpn,
  handlePatchEditBuffer,
} from './handlers.js';
import { listResources, readResource } from './resources.js';

const SERVER_NAME = 'patchwork-deepmind';
const SERVER_VERSION = '0.1.0';

function createServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: toolDefinitions };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: listResources() };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      const content = await readResource(request.params.uri);
      return {
        contents: [content],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'text/plain',
            text: `Error: ${message}`,
          },
        ],
      };
    }
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: unknown;

      switch (name) {
        case 'describe_nrpn':
          result = await handleDescribeNrpn(args as { query?: string });
          break;
        case 'describe_param':
          result = await handleDescribeParam(args as { param: string });
          break;
        case 'set_param':
          result = await handleSetParam(args as { param: string; value: number; synthId?: string });
          break;
        case 'set_params':
          result = await handleSetParams(
            args as { params: Array<{ param: string; value: number }>; synthId?: string }
          );
          break;
        case 'snapshot_state':
          result = await handleSnapshotState(args as { synthId?: string });
          break;
        case 'send_nrpn':
          result = await handleSendNrpn(args as { nrpn: number; value: number; synthId?: string });
          break;
        case 'describe_fx_type':
          result = await handleDescribeFxType(args as { type?: string | number });
          break;
        case 'patch_edit_buffer':
          result = await handlePatchEditBuffer(
            args as { patches: Array<{ offset: number; value: number }>; synthId?: string }
          );
          break;
        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Important: MCP servers should not write to stdout.
  console.warn('[patchwork-deepmind] Server started');
}

main().catch((error) => {
  console.error('[patchwork-deepmind] Fatal error:', error);
  process.exit(1);
});
