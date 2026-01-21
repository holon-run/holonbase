# Holonbase

> A trusted version control engine for AI-driven structured knowledge systems.

Holonbase turns scattered files and data into a unified, queryable knowledge graph. It uses an **Event Sourcing** architecture to track changes across multiple data sources (Local filesystem, Git, etc.) and constructs a structured knowledge base containing Concepts, Claims, and Relations.

## 🌟 Features

- **Multi-Source Architecture**: Aggregate data from Local folders, Git repositories, and more into a single knowledge base.
- **Event Sourcing**: All changes are recorded as immutable **Patches**, ensuring full auditability and traceability.
- **Structured Knowledge**: Automatically converts files into structured objects (`note`, `file`, `concept`, `claim`, `relation`).
- **Content Addressing**: Objects are identified by SHA256 hashes, ensuring data integrity.
- **Smart Processing**: Automatic metadata extraction and content processing for various file types.
- **SQL-Based State**: Query your knowledge graph using standard SQL via the state view.

## 🚀 Installation

```bash
npm install -g holonbase
```

## 🏁 Quick Start

### 1. Initialize a Repository

Initialize a new Holonbase repository in your current directory. This automatically sets up the current folder as the default 'local' data source.

```bash
holonbase init
```

### 2. Add Data Sources

Connect additional data sources (e.g., a documentation folder).

```bash
holonbase source add docs --path ./docs
```

### 3. Synchronize

Scan all data sources, detect changes, and synchronize them to the knowledge base.

```bash
holonbase sync
```

### 4. Check Status

View the status of your data sources and any pending changes.

```bash
holonbase status
```

### 5. Query and Explore

List objects in your knowledge base.

```bash
# List all notes
holonbase list -t note

# View history of a specific object
holonbase log <object_id>
```

## 🏗 Architecture

Holonbase uses a layered architecture to separate data ingestion from knowledge management:

```
┌─────────────────────────────────────────────────────┐
│  Data Sources (Local, Git, Cloud, etc.)             │
└────┬───────────────────────────────────────────┬────┘
     │ Source Adapters                           │
     ▼                                           ▼
┌─────────────────────────────────────────────────────┐
│  Holonbase Engine                                    │
│  ┌─────────────────────────────────────────────────┐│
│  │  Sync Engine & Content Processor                 ││
│  │  (Change Detection, Metadata Extraction)         ││
│  └─────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────┐│
│  │  Event Ledger (Immutable Patches)                ││
│  └─────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────┐│
│  │  State View (Queryable Knowledge Graph)          ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## 🛠 Development

### Prerequisites

- Node.js >= 18.0.0
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/holon-run/holonbase.git
cd holonbase

# Install dependencies
npm install

# Build the project
npm run build

# Link for local global command
npm link
```

### Testing

```bash
npm test
```

## 📄 Documentation

- [CLI Reference](README_CLI.md)
- [Design Document](docs/DESIGN.md)
- [Multi-Source Architecture](docs/MULTI_SOURCE_DESIGN.md)

## 📄 License

MIT
