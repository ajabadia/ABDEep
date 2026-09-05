import json
import re

# Load the C++ ParametersSpec_Synth.cpp to extract param info
with open('D:/desarrollos/ABDSynths/ABDEep/Source/Core/ParametersSpec_Synth.cpp', 'r') as f:
    cpp_content = f.read()

# Extract all param entries from the C++ file
import re
pattern = r'\{\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*([0-9.-]+)f?,\s*([0-9.-]+)f?,\s*([0-9.-]+)f?,\s*(-?\d+),\s*(-?\d+),\s*\{([^}]*)\}\s*\}'
matches = re.findall(pattern, cpp_content, re.MULTILINE | re.DOTALL)

cpp_params = {}
for m in matches:
    param_id = m[0]
    name = m[1]
    block = m[2]
    param_type = m[3]
    min_val = float(m[4])
    max_val = float(m[5])
    default_val = float(m[6])
    midi_cc = int(m[7])
    byte_offset = int(m[8])
    options_str = m[9].strip()
    options = []
    if options_str:
        options = [opt.strip().strip('"') for opt in options_str.split(',')]
    cpp_params[param_id] = {
        'name': name,
        'block': block,
        'type': param_type,
        'min': min_val,
        'max': max_val,
        'default': default_val,
        'midi_cc': midi_cc,
        'byte_offset': byte_offset,
        'options': options
    }

print(f'Total C++ params from ParametersSpec_Synth.cpp: {len(cpp_params)}')

# Load bridge-param-maps.js to extract PARAM_TO_BYTE_OFFSET and ENUM_BYTES
with open('D:/desarrollos/ABDSynths/ABDEep/WebUI/js/bridge-param-maps.js', 'r') as f:
    js_content = f.read()

# Extract PARAM_TO_BYTE_OFFSET
param_to_byte_offset = {}
enum_bytes = {}

# Find PARAM_TO_BYTE_OFFSET
param_offset_match = re.search(r'const PARAM_TO_BYTE_OFFSET = \{([\s\S]*?)\};', js_content)
if param_offset_match:
    param_offset_str = param_offset_match.group(1)
    for line in param_offset_str.split('\n'):
        line = line.strip()
        if ':' in line and not line.startswith('//'):
            parts = line.split(':')
            if len(parts) == 2:
                key = parts[0].strip().strip('"')
                val = parts[1].strip().rstrip(',')
                try:
                    param_to_byte_offset[key] = int(val)
                except:
                    pass

# Find ENUM_BYTES
enum_bytes_match = re.search(r'const ENUM_BYTES = \{([\s\S]*?)\};', js_content)
if enum_bytes_match:
    enum_bytes_str = enum_bytes_match.group(1)
    for line in enum_bytes_str.split('\n'):
        line = line.strip()
        if ':' in line and not line.startswith('//'):
            parts = line.split(':')
            if len(parts) == 2:
                key = parts[0].strip()
                val = parts[1].strip().rstrip(',')
                try:
                    enum_bytes[int(key)] = int(val)
                except:
                    pass

print(f'Total C++ params from ParametersSpec_Synth.cpp: {len(cpp_params)}')
print(f'Total JS PARAM_TO_BYTE_OFFSET: {len(param_to_byte_offset)}')
print(f'Total JS ENUM_BYTES: {len(enum_bytes)}')

# Check for missing mappings
print('\n=== C++ params missing in JS PARAM_TO_BYTE_OFFSET ===')
missing_in_js = []
for pid, p in cpp_params.items():
    if pid not in param_to_byte_offset:
        if p['byte_offset'] >= 0 and p['byte_offset'] < 300:  # Only physical/extended
            missing_in_js.append((pid, p['byte_offset'], p['type']))

if missing_in_js:
    for pid, offset, ptype in missing_in_js:
        print(f'  MISSING: {pid} (offset={offset}, type={ptype})')
else:
    print('  None missing')

# Check for enum params in C++ that are missing from ENUM_BYTES
print('\n=== C++ enum params missing from JS ENUM_BYTES ===')
for pid, p in cpp_params.items():
    if p['type'] == 'enum' and pid in param_to_byte_offset:
        offset = param_to_byte_offset[pid]
        if offset < 242:  # Only physical params
            if offset not in enum_bytes:
                print(f'  MISSING ENUM: {pid} (offset={offset}, options={p["options"]})')

print('\n=== JS params not in C++ (orphaned) ===')
orphaned = []
for pid in param_to_byte_offset:
    if pid not in cpp_params:
        orphaned.append(pid)
if orphaned:
    for pid in orphaned[:20]:
        print(f'  ORPHANED: {pid}')
    if len(orphaned) > 20:
        print(f'  ... and {len(orphaned) - 20} more')
else:
    print('  None')

# Check for byteOffset >= 242 params that should be virtual/extended
print('\n=== Physical params (offset < 242) in C++ without JS mapping ===')
for pid, p in cpp_params.items():
    if p['byte_offset'] >= 0 and p['byte_offset'] < 242:
        if pid not in param_to_byte_offset:
            print(f'  NO JS MAP: {pid} (offset={p["byte_offset"]}, type={p["type"]})')

print('\n=== C++ params with byteOffset >= 242 (extended/virtual) ===')
extended_count = 0
for pid, p in cpp_params.items():
    if p['byte_offset'] >= 242:
        extended_count += 1
        in_js = 'YES' if pid in param_to_byte_offset else 'NO'
        print(f'  {pid}: offset={p["byte_offset"]}, type={p["type"]}, in_js={in_js}')
print(f'Total extended/virtual: {extended_count}')

# Check for missing MIDI CC mappings
print('\n=== C++ params with midi_cc >= 0 but missing in JS PARAM_TO_CC ===')
# Extract PARAM_TO_CC
param_to_cc_match = re.search(r'const PARAM_TO_CC = \{([\s\S]*?)\};', js_content)
param_to_cc = {}
if param_to_cc_match:
    param_to_cc_str = param_to_cc_match.group(1)
    for line in param_to_cc_str.split('\n'):
        line = line.strip()
        if ':' in line and not line.startswith('//'):
            parts = line.split(':')
            if len(parts) == 2:
                key = parts[0].strip().strip('"')
                val = parts[1].strip().rstrip(',')
                try:
                    param_to_cc[key] = int(val)
                except:
                    pass

print(f'Total JS PARAM_TO_CC: {len(param_to_cc)}')
missing_cc = []
for pid, p in cpp_params.items():
    if p['midi_cc'] >= 0:
        if pid not in param_to_cc:
            missing_cc.append((pid, p['midi_cc']))

if missing_cc:
    for pid, cc in missing_cc:
        print(f'  MISSING CC: {pid} (CC={cc})')
else:
    print('  All MIDI CC params have JS mapping')