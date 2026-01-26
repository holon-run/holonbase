# Holonbase CLI Reference

The command-line interface for managing your Holonbase knowledge repository.

## Table of Contents

- [Core Commands](#core-commands)
- [Source Management](#source-management)
- [Deep Dive](#deep-dive)

## Core Commands

### `init`

Initialize a new Holonbase knowledge base.

```bash
holonbase init [path]
```

- Creates global KB at `HOLONBASE_HOME` (default: `~/.holonbase`).
- Initializes SQLite database.
- Automatically adds the current directory as the default `local` source.

**Note**: The `path` argument is for the working directory to add as a source. The actual knowledge base is stored globally in `HOLONBASE_HOME`.

### `sync`

Synchronize data sources with the knowledge base. This is the primary command to ingest changes.

```bash
# Sync all sources
holonbase sync

# Sync a specific source
holonbase sync --source <source_name>

# Add a message to the sync patch
holonbase sync -m "Updates from docs"
```

### `status`

Show the status of all data sources and the current view.

```bash
holonbase status
```

Displays:
- Current active View.
- Changes in each data source (Added, Modified, Deleted).
- Untracked files.

### `source`

Manage data sources.

```bash
# List all configured sources
holonbase source list

# Add a local folder source
holonbase source add <name> --path <path_to_folder>

# Remove a source
holonbase source remove <name>
```

### `log`

View the patch history of the repository or a specific object.

```bash
holonbase log [object_id]
```

### `list`

List objects in the current state view.

```bash
holonbase list [-t <type>]
```

### `show`

Show details of a specific object.

```bash
holonbase show <object_id>
```

## Deep Dive

### Object Types

Holonbase manages several types of objects:

- **concept**: Conceptual entities (e.g., "AI Alignment").
- **claim**: Statements or assertions.
- **relation**: Structural links between objects (`source_id` -> `target_id`).
- **note**: Unstructured text fragments (Markdown, Text).
- **file**: Binary files or external documents (PDF, Images).
- **extract**: Content extracted from files (e.g., text from PDF).
- **evidence**: Source references.
- **patch**: Immutable records of change.

### Manual Patching (Advanced)

While `sync` handles most file-based operations, you can manually create and commit patches for semantic objects.

1. **Create a patch file (JSON)**:

```json
{
  "op": "add",
  "agent": "user/alice",
  "target": "concept:quantum-mechanics",
  "payload": {
    "object": {
      "type": "concept",
      "content": {
        "name": "Quantum Mechanics",
        "definition": "Fundamental theory in physics..."
      }
    }
  },
  "note": "Initial definition"
}
```

2. **Commit the patch**:

```bash
# 'commit' is an alias for 'sync' when processing patch files is implemented
# Currently, manual patches can be managed via custom tooling or future 'apply' commands.
# Note: The raw 'commit' command from v0 has been migrated to 'sync'. 
```

*(Note: Direct manual patch creation via CLI is being refined. Using `sync` with file-based inputs is currently the recommended workflow).*

### Views (Workspaces)

Manage parallel states of your knowledge base.

```bash
# List views
holonbase view list

# Create a new view
holonbase view create experiment-1

# Switch views
holonbase view switch experiment-1
```

## Ingest (Sources)

Holonbase ingests content through configured sources.

- Add sources via `holonbase source add ...`
- Ingest changes via `holonbase sync`
