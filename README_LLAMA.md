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
```bash
# Using GPT-4
python generate_document_llama.py \
  --template template.docx \
  --section "Methods" \
  --llm openai \
  --model gpt-4-turbo-preview

# Using Grok
python generate_document_llama.py \
  --template template.docx \
  --section "Methods" \
  --llm grok \
  --model grok-beta
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

