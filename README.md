# Bio/Drug Document RAG System

A Retrieval-Augmented Generation (RAG) system for processing hundreds of bio/drug-related documents with smart chunking, local Qdrant vector storage, and template-based document generation.

## Features

- **Multi-format document parsing**: Supports PDF, DOCX, TXT files
- **Smart chunking**: Handles structured documents with tables, variables, and complex formatting
- **Local Qdrant storage**: Vector database (local file or server mode)
- **Variable extraction**: Optimized for bio/drug documents with many variables and structured data
- **Template-based generation**: Generate new documents from templates using extracted data
- **Agent flow**: Intelligent extraction and generation pipeline

## Setup

1. Install dependencies:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2. (Optional) Install Qdrant server (Docker recommended):
```bash
docker run -p 6333:6333 qdrant/qdrant
```

Or use local file mode (default - no server needed)

3. Index your documents:
```bash
python index_documents.py --docs /path/to/documents
```

4. Query your documents:
```bash
python query.py "What is the mechanism of action of drug X?"
```

## Usage

### Basic Operations

```bash
# Index documents
python index_documents.py --docs /path/to/documents

# Query the indexed documents
python query.py "your search query" --top-k 5

# Filter by file
python query.py "your query" --file DocA.docx
```

### Template-Based Document Generation

Generate documents from templates using extracted data:

```bash
# Interactive mode (asks for section)
python generate_document.py --template template_example.md

# Generate specific section
python generate_document.py --template template_example.md --section "Methods"

# Generate all sections
python generate_document.py --template template_example.md --all

# Generate with custom style
python generate_document.py --template template_example.md --section "Methods" --style detailed

# Save to file
python generate_document.py --template template_example.md --section "Methods" --output methods.md
```

### How It Works

1. **Template Analysis**: The system parses your markdown template to understand structure and required fields
2. **Section Selection**: You choose which section to generate (e.g., "Methods", "Results")
3. **Data Extraction**: RAG searches indexed documents for relevant information
4. **Generation**: System fills template placeholders with extracted data
5. **Output**: Generates markdown document based on template structure

### Template Format

Templates use markdown with placeholder fields:

```markdown
## Methods

### Materials
- Material: {material_name}
- Quantity: {quantity}

### Procedure
{procedure_steps}

### Variables
| Parameter | Value |
|-----------|-------|
| {param_1} | {value_1} |
```

Placeholders can be:
- `{field_name}` - Simple placeholder
- `{{field_name}}` - Double brace placeholder

If placeholders aren't filled, the system will use extracted content directly.

## Project Structure

### Core Components
- `index_documents.py`: Main script for parsing and indexing documents
- `document_parser.py`: Document parsing utilities (PDF, DOCX, TXT)
- `chunker.py`: Smart chunking strategies for bio/drug documents
- `vector_store.py`: Qdrant integration and storage logic
- `query.py`: Query interface for the RAG system

### Template & Generation Components
- `template_parser.py`: Parses markdown templates and understands structure
- `extractor.py`: Extracts relevant data from indexed documents using RAG
- `generator.py`: Generates markdown from templates and extracted data
- `agent_flow.py`: Orchestrates the complete extraction and generation flow
- `generate_document.py`: CLI for template-based document generation

### Configuration
- `config.py`: Configuration settings

## Configuration

Create a `.env` file (optional):
```
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=bio_drug_docs
QDRANT_LOCAL_MODE=false
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

## Example Workflow

1. **Index documents**:
```bash
python index_documents.py --docs /Users/armin/Downloads/CaseStudy_1/docs
```

2. **Create a template** (see `template_example.md`)

3. **Generate a section**:
```bash
python generate_document.py --template template_example.md --section "Methods"
```

4. **Use interactive mode**:
```bash
python generate_document.py --template template_example.md
# Then follow prompts to select section
```

## Migration

If you indexed using local file mode and want to migrate to server:

```bash
python migrate_to_server.py
```

This will copy all data from local file storage to your Qdrant server.
