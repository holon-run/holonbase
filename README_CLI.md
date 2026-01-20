# Holonbase

A version control engine for AI-driven structured knowledge systems.

## Features

- **Event Sourcing Architecture**: All knowledge changes recorded as immutable patches
- **Unified Object Model**: Everything is an object (concepts, claims, relations, notes, evidence, files, patches)
- **Content-Addressable Storage**: SHA256-based object IDs ensure integrity
- **SQL State View**: Query current knowledge state with SQL
- **Git-like CLI**: Familiar commands for version control

## Installation

```bash
npm install -g holonbase
```

## Quick Start

```bash
# Initialize a repository
holonbase init

# Create a patch file
cat > add-concept.json <<EOF
{
  "op": "add",
  "agent": "user/alice",
  "target": "concept-quantum-entanglement",
  "payload": {
    "object": {
      "type": "concept",
      "content": {
        "name": "Quantum Entanglement",
        "definition": "A quantum phenomenon where particles remain connected"
      }
    }
  },
  "confidence": 0.9,
  "note": "Added from physics textbook"
}
EOF

# Commit the patch
holonbase commit add-concept.json

# View history
holonbase log

# List objects
holonbase list

# Get object details
holonbase get concept-quantum-entanglement

# Export data
holonbase export --format jsonl
```

## Object Types

- **concept**: Conceptual entities (e.g., "AI Alignment")
- **claim**: Statements or assertions
- **relation**: Structural links between objects (e.g., "X is_a Y")
- **note**: Unstructured text fragments
- **evidence**: Source references and citations
- **file**: External file bindings (PDF, audio, web pages)
- **patch**: Change records (special type)

## CLI Commands

| Command | Description |
|---------|-------------|
| `holonbase init [path]` | Initialize a new repository |
| `holonbase commit <file>` | Commit a patch (use `-` for stdin) |
| `holonbase log [-n N]` | Show patch history |
| `holonbase show <id>` | Show object details |
| `holonbase get <id>` | Get object from current state |
| `holonbase list [-t type]` | List objects in current state |
| `holonbase export [-f format]` | Export repository data |

## Patch Operations

- **add**: Create a new object
- **update**: Modify an existing object
- **delete**: Remove an object
- **link**: Create a relation
- **merge**: Merge multiple objects

## Architecture

```
┌─────────────────────────────────────┐
│           CLI Layer                 │
├─────────────────────────────────────┤
│  Patch Manager  │  State View       │
├─────────────────────────────────────┤
│         SQLite Storage              │
│  objects | state_view | config      │
└─────────────────────────────────────┘
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in dev mode
npm run dev -- init

# Run tests
npm test
```

## License

MIT
