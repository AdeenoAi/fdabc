# LlamaIndex + LlamaParse + LLM Setup Guide

This system uses LlamaIndex for agent flow, LlamaParse for superior document parsing (especially tables), and GPT-4/Grok for intelligent generation.

## Features

- **LlamaParse**: Superior table extraction from PDFs and DOCX
- **LlamaIndex**: Advanced RAG with query engine
- **GPT-4/Grok**: Intelligent LLM generation with table preservation
- **Markdown Tables**: Properly preserved and formatted tables in output

## Setup

1. **Install dependencies**:
```bash
pip install -r requirements.txt
```

2. **Set up API keys** in `.env` file:
```bash
# Required for LlamaParse
LLAMA_CLOUD_API_KEY=your_llama_cloud_key

# Required for OpenAI (GPT-4 + embeddings)
OPENAI_API_KEY=your_openai_key

# Optional: For Grok instead of GPT-4
XAI_API_KEY=your_xai_key

# LLM Provider Selection (default: openai)
# Options: "openai" or "grok"
LLM_PROVIDER=openai

# LLM Model Name (default: gpt-4o)
# Options for OpenAI: "gpt-4o", "gpt-4-turbo-preview", "gpt-4", "gpt-3.5-turbo"
# Options for Grok: "grok-beta"
LLM_MODEL=gpt-4o
```

Get LlamaParse API key: https://cloud.llamaindex.ai/

3. **Index documents with LlamaParse**:
```bash
python index_documents_llama.py --docs /path/to/documents
```

This will:
- Parse documents with LlamaParse (excellent table extraction)
- Index into Qdrant using LlamaIndex
- Preserve table structure in markdown format

4. **Generate documents**:

You can set default LLM provider and model in `.env` (see step 2), or override via command line:

```bash
# Using GPT-4 (uses .env defaults if set, otherwise defaults to openai/gpt-4o)
python generate_document_llama.py \
  --template template.docx \
  --section "Methods"

# Override to use Grok via command line
python generate_document_llama.py \
  --template template.docx \
  --section "Methods" \
  --llm grok \
  --model grok-beta

# Or set in .env to make Grok the default:
# LLM_PROVIDER=grok
# LLM_MODEL=grok-beta
```

## Key Differences from Basic Version

### Better Table Extraction
- LlamaParse extracts tables with high accuracy
- Tables preserved in markdown format
- Maintains structure and alignment

### Intelligent Generation
- LLM understands context and structure
- Generates coherent sections with proper formatting
- Preserves tables and numerical data

### Advanced RAG
- LlamaIndex query engine with better retrieval
- Context-aware generation
- Source attribution

## Usage Examples

### Index with LlamaParse
```bash
python index_documents_llama.py \
  --docs /Users/armin/Downloads/CaseStudy_1/docs \
  --collection bio_drug_docs
```

### Generate Section
```bash
python generate_document_llama.py \
  --template /Users/armin/Downloads/CaseStudy_1/DocG1.docx \
  --section "APFS Assembly Process Qualification Data" \
  --top-k 15 \
  --output output.md
```

### Interactive Mode
```bash
python generate_document_llama.py \
  --template template.docx
# Then select section from list
```

## Output Quality

- **Tables**: Properly formatted markdown tables with all data
- **Structure**: Maintains document hierarchy and formatting
- **Data**: All numerical values and parameters included
- **Context**: Coherent, well-structured sections

## Troubleshooting

**LlamaParse not working**: Ensure `LLAMA_CLOUD_API_KEY` is set

**No tables in output**: 
- Check that documents were indexed with LlamaParse
- Increase `--top-k` to retrieve more context
- Verify source documents contain tables

**LLM errors**: 
- Check API keys (OPENAI_API_KEY or XAI_API_KEY)
- Verify model names are correct
- Check API quota/limits

