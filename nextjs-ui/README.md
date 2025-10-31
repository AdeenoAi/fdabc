# Document Generator UI

Next.js frontend for the Bio/Drug Document RAG system.

## Features

- 📤 Upload template and source documents
- 📋 Select section to generate from template
- 🤖 AI-powered document generation
- ✏️ Edit generated content with table editing support
- 💾 Save edited documents

## Setup

1. **Install dependencies:**
```bash
cd nextjs-ui
npm install
```

2. **Set up environment variables:**
Create `.env.local`:
```
OPENAI_API_KEY=your_openai_key
LLAMA_CLOUD_API_KEY=your_llama_key
```

3. **Run development server:**
```bash
npm run dev
```

4. **Access the UI:**
Open [http://localhost:3000](http://localhost:3000)

## Usage

1. **Upload Template**: Upload your template file (.docx or .md)
2. **Upload Documents** (Optional): Add source documents for data extraction
3. **Select Section**: Choose which section to generate from the template
4. **Generate**: Click "Generate Section" to create content using AI
5. **Edit**: Edit tables and text in the generated content
6. **Save**: Save the final document

## API Routes

- `/api/analyze-template` - Analyzes template structure
- `/api/generate` - Generates section content
- `/api/save` - Saves edited content

## Components

- `FileUpload` - Handles file uploads
- `SectionSelector` - Shows available sections
- `DocumentEditor` - Editable markdown editor with table support
- `EditableTable` - Inline table editing component

