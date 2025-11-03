# AdeenoAi - Regulatory Workflow Processing Platform

A comprehensive Retrieval-Augmented Generation (RAG) system for processing regulatory and bio/drug-related documents with AI-powered document generation, smart chunking, and a modern web interface.

## Overview

AdeenoAi helps streamline regulatory workflow processing by:
- **Intelligently extracting** data from hundreds of documents
- **Generating compliant documents** from templates using AI
- **Managing sections** with a modern web interface
- **Exporting to PDF** for final document delivery

## Features

### Backend (Python)
- **Multi-format document parsing**: Supports PDF, DOCX, TXT files
- **Smart chunking**: Handles structured documents with tables, variables, and complex formatting
- **Local Qdrant storage**: Vector database (local file or server mode)
- **Variable extraction**: Optimized for bio/drug documents with many variables and structured data
- **Template-based generation**: Generate new documents from templates using extracted data
- **Agent flow**: Intelligent extraction and generation pipeline with verification
- **Preview generation**: Preview what will be generated before actual generation

### Frontend (Next.js)
- **Modern Web Interface**: Beautiful, responsive UI for document generation
- **Section Management**: View, edit, and manage all saved sections
- **PDF Preview & Export**: Preview and export documents as PDF
- **Real-time Generation Logs**: Discreet progress tracking with important updates only
- **Template Analysis**: Automatic section detection from templates
- **Editable Tables**: Inline table editing in generated content
- **Document Verification**: Confidence scoring and validation for generated content

## Quick Start

### 1. Install Python Dependencies

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

**Note:** Python doesn't need to run as a server - Next.js calls Python scripts automatically when needed.

### 2. Install Frontend Dependencies

```bash
cd nextjs-ui
npm install
```

### 3. Run the Application

**You only need to run Next.js:**

```bash
cd nextjs-ui
npm run dev
```

**Optional: Start Qdrant server** (for better performance, otherwise uses local file mode):
```bash
docker run -p 6333:6333 qdrant/qdrant
```

**Access the application**:
Open [http://localhost:3000](http://localhost:3000)

### How It Works

- Next.js runs on port 3000 and serves the web interface
- When you interact with the UI, Next.js API routes automatically call Python scripts
- Python scripts run on-demand (no separate Python server needed)
- Everything happens through the browser - no need to manage multiple processes!

See [SETUP.md](SETUP.md) for detailed setup instructions.

## Workflow

### 1. Document Generation Workflow

1. **Upload Template**: Upload your template file (.docx, .md, or .pdf)
2. **Upload Source Documents** (Optional): Add documents to extract data from
3. **Index Documents**: Click "Index Documents" to make them searchable
4. **Select Section**: Choose which section to generate from the template
5. **Preview** (Optional): Review the generation plan before generating
6. **Generate**: AI generates content using extracted data
7. **Edit**: Edit tables and text in the generated content
8. **Save**: Save the section (automatically navigates to sections page)

### 2. Section Management

1. **View All Sections**: Access saved sections from the navigation
2. **Search**: Search sections by name or content
3. **Edit**: Click "Edit" to modify any saved section
4. **View PDF**: Preview any section as PDF
5. **Export All**: Generate a complete document PDF with all sections
6. **Delete**: Remove sections you no longer need

### 3. PDF Export

1. **Individual Section**: Click "View PDF" on any section card
2. **Complete Document**: Click "View All as PDF" to combine all sections
3. **Preview**: See exactly how your document will look
4. **Download**: Click "Save as PDF" to download

## Project Structure

### Backend Components

- `index_documents_llama.py`: Index documents using LlamaParse for better parsing
- `document_parser.py`: Document parsing utilities (PDF, DOCX, TXT)
- `chunker.py`: Smart chunking strategies for bio/drug documents
- `vector_store.py`: Qdrant integration and storage logic
- `template_parser.py`: Parses markdown templates and understands structure
- `extractor.py`: Extracts relevant data from indexed documents using RAG
- `generator.py`: Generates markdown from templates and extracted data
- `agent_flow.py`: Orchestrates the complete extraction and generation flow
- `generate_document_llama.py`: Main generation script with LlamaIndex integration
- `preview_generation.py`: Preview generation plan without actually generating
- `verification_agent.py`: Validates and scores generated content

### Frontend Structure

```
nextjs-ui/
├── app/
│   ├── dashboard/          # Main document generation page
│   ├── sections/           # Saved sections management
│   ├── pdf/                # PDF preview and export
│   └── api/                # API routes
│       ├── analyze-template/
│       ├── generate-stream/
│       ├── preview/
│       ├── save/
│       ├── sections/
│       └── generate-pdf/
├── components/
│   ├── DocumentEditor.tsx  # Editable markdown editor
│   ├── GenerationLogs.tsx # Discreet progress logs
│   ├── GenerationPreview.tsx # Generation plan preview
│   └── ...
```

## Configuration

Create a `.env` file in the project root (optional):

```env
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=bio_drug_docs
QDRANT_LOCAL_MODE=false
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
LLAMA_CLOUD_API_KEY=your_llama_key
```

For the frontend, create `nextjs-ui/.env.local`:

```env
# Optional: API keys if needed
```

## API Endpoints

### Document Generation
- `POST /api/analyze-template` - Analyzes template structure and extracts sections
- `POST /api/preview` - Preview generation plan before generating
- `POST /api/generate-stream` - Streams generation with real-time logs
- `POST /api/index-documents` - Index source documents for RAG

### Section Management
- `GET /api/sections` - List all saved sections
- `GET /api/sections/[id]` - Get a specific section
- `PUT /api/sections/[id]` - Update a section
- `DELETE /api/sections?id=...` - Delete a section
- `POST /api/save` - Save a generated section

### PDF Export
- `POST /api/generate-pdf` - Get content for PDF generation (single or all sections)

## Template Format

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

The system will automatically extract relevant data from indexed documents to fill these placeholders.

## Advanced Usage

### Command Line Interface

While the web interface is recommended, you can also use the CLI:

```bash
# Index documents
python index_documents_llama.py --docs /path/to/documents

# Generate a section
python generate_document_llama.py --template template.md --section "Methods"

# Preview generation plan
python preview_generation.py --template template.md --section "Methods"
```

### Migration

If you indexed using local file mode and want to migrate to server:

```bash
python migrate_to_server.py
```

This will copy all data from local file storage to your Qdrant server.

## Technology Stack

### Backend
- Python 3.13+
- LlamaIndex for RAG
- Qdrant for vector storage
- LlamaParse for advanced document parsing

### Frontend
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- jsPDF & html2canvas for PDF generation
- react-markdown for markdown rendering

## Development

### Running in Development

1. **Backend**: Ensure Python dependencies are installed
2. **Frontend**: 
   ```bash
   cd nextjs-ui
   npm run dev
   ```
3. **Qdrant**: Start locally or use local file mode (default)

### Building for Production

```bash
cd nextjs-ui
npm run build
npm start
```

## Troubleshooting

### Common Issues

1. **PDF Generation Fails**: Ensure all dependencies are installed (`jspdf`, `html2canvas`)
2. **Section Not Found**: Check that the section name matches exactly (case-sensitive)
3. **Generation Timeout**: Increase timeout settings or reduce document size
4. **Qdrant Connection Error**: Verify Qdrant is running or use local file mode

## License

See LICENSE file for details.

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.
