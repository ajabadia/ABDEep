export const toolDefinitions = [
  {
    name: 'describe_nrpn',
    description:
      'List known DeepMind 12 NRPN parameters with names, ranges, and notes (for LLM reasoning; use send_nrpn to set values). See resource deepmind12://references/deepmind_nrpn for the full table.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Optional substring filter over name/notes (case-insensitive).',
        },
      },
      required: [],
    },
  },
  {
    name: 'describe_param',
    description:
      'Describe a DeepMind parameter by name: NRPN address (when known), raw/normalized ranges, and enum labels (when available). For FX params, see resource deepmind12://references/deepmind_fx.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        param: {
          type: 'string',
          description:
            'Parameter name (accepts aliases). Examples: filter.cutoff, vcf.cutoff, modMatrix.1.source, fx.routing',
        },
      },
      required: ['param'],
    },
  },
  {
    name: 'set_param',
    description:
      'Set a DeepMind parameter by structured name. Provide exactly one of: value (normalized 0..1), rawValue (raw integer), or label (enum string like "Loop").',
    inputSchema: {
      type: 'object' as const,
      properties: {
        synthId: { type: 'string', description: 'Optional synth instance ID (e.g., deepmind12-layer1)' },
        param: { type: 'string', description: 'Parameter name (e.g., filter.cutoff, env.amp.attack, vcf.cutoff)' },
        value: { type: 'number', minimum: 0, maximum: 1, description: 'Normalized 0..1' },
        rawValue: { type: 'number', description: 'Raw integer value (e.g., 3). Sent directly as NRPN value.' },
        label: {
          type: 'string',
          description: 'Enum label (e.g., "Loop", "LFO1"). Only for enum params. Case-insensitive.',
        },
      },
      required: ['param'],
    },
  },
  {
    name: 'set_params',
    description:
      'Set multiple DeepMind parameters efficiently in one call (batched NRPN). Each entry accepts value, rawValue, or label — same as set_param.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        synthId: { type: 'string', description: 'Optional synth instance ID (e.g., deepmind12-layer1)' },
        params: {
          type: 'array' as const,
          description: 'Array of parameter updates',
          items: {
            type: 'object' as const,
            properties: {
              param: { type: 'string' },
              value: { type: 'number', minimum: 0, maximum: 1, description: 'Normalized 0..1' },
              rawValue: { type: 'number', description: 'Raw integer value' },
              label: { type: 'string', description: 'Enum label (case-insensitive)' },
            },
            required: ['param'],
          },
        },
      },
      required: ['params'],
    },
  },
  {
    name: 'snapshot_state',
    description:
      'Read current synth state via edit-buffer SysEx dump, returning a rich decoded parameter object (plus raw edit-buffer bytes). Use includeSysex=true only when you need the large base64 SysEx payload for debugging.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        synthId: { type: 'string', description: 'Optional synth instance ID (e.g., deepmind12-layer1)' },
        includeSysex: {
          type: 'boolean',
          description: 'Include base64 SysEx/payload fields (large). Default: false.',
        },
        includeBytes: {
          type: 'boolean',
          description: 'Include raw edit-buffer bytes as an array of integers. Default: true.',
        },
      },
      required: [],
    },
  },
  {
    name: 'send_nrpn',
    description: 'Send raw NRPN message to DeepMind 12. Use this to programmatically change parameters by NRPN number during discovery.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        synthId: { type: 'string', description: 'Optional synth instance ID (e.g., deepmind12-layer1)' },
        nrpn: { type: 'number', description: 'NRPN parameter number (0-240)', minimum: 0, maximum: 240 },
        value: { type: 'number', description: 'Parameter value (typically 0-255)', minimum: 0, maximum: 255 },
      },
      required: ['nrpn', 'value'],
    },
  },
  {
    name: 'describe_fx_type',
    description:
      'Describe the parameters of a DeepMind FX effect type by name or internal type number. With no argument, lists all 35 available effect types and their internal values. With a type, returns the full param schema: settable names (fxN.<effect>.<key>), display units, min/max, enum labels, and mod-destination flags. Use this to plan FX configuration without loading the effect first.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        type: {
          description:
            'Effect type name (e.g. "Chorus", "T-RayDelay", "HallRev") or internal type number (e.g. 10, 21, 1). Omit to list all available types.',
          oneOf: [{ type: 'string' }, { type: 'number' }],
        },
      },
      required: [],
    },
  },
  {
    name: 'patch_edit_buffer',
    description:
      'Read the current edit buffer via sysex, apply one or more byte-level patches, and write the full buffer back. Bypasses NRPN — use this when set_param fails for certain parameters (e.g., FX params). Each patch is an offset + raw value (0–255).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        synthId: { type: 'string', description: 'Optional synth instance ID' },
        patches: {
          type: 'array' as const,
          description: 'Array of byte patches to apply',
          items: {
            type: 'object' as const,
            properties: {
              offset: { type: 'number', description: 'Decoded edit-buffer byte offset (0–241)' },
              value: { type: 'number', description: 'Raw byte value (0–255)', minimum: 0, maximum: 255 },
            },
            required: ['offset', 'value'],
          },
        },
      },
      required: ['patches'],
    },
  },
];
