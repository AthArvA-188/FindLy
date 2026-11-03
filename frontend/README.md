# Document Search Application

A minimal, beautiful React + Vite application for searching documents using natural language or image-based queries. Built with TypeScript and fully tested with Jest.

## Features

### 🔍 Dual Search Modes
- **Text Search**: Enter natural language queries to find documents
- **Image Search**: Upload images (PNG, JPG, JPEG, WebP) with drag-and-drop support

### 📁 Directory Management
- Side panel showing indexed and non-indexed directories
- Visual indicators:
  - **Purple background**: Indexed directories with last indexed date
  - **Dark background**: Non-indexed directories

### 🎯 Smart Filtering
- Filter results by file type:
  - All Files
  - PDF
  - Documents (DOC, DOCX)
  - Text
  - Images
  - Code

### 📊 Results Display
- File path with confidence scores
- Content preview snippets
- File type icons
- Click-to-open functionality (ready for backend integration)

### 🎨 Design
- Minimal, clean UI inspired by React Bits
- Custom color scheme:
  - Primary: `#151515`
  - Secondary: `#301B3F`
  - Tertiary: `#3C415C`
  - Text: `#B4A5A5`
- Animated background with floating elements
- Smooth transitions and hover effects
- Glass-morphism effects with backdrop blur

## Tech Stack

- **React 19** with TypeScript
- **Vite** for blazing fast development
- **Jest** + **React Testing Library** for comprehensive testing
- **Lucide React** for beautiful icons
- Modern CSS with animations

## Getting Started

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Testing

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm test:watch
```

Generate coverage report:

```bash
npm test:coverage
```

### Build

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── SidePanel.tsx          # Directory status panel
│   ├── SearchBar.tsx          # Search input with image upload
│   ├── FileTypeFilter.tsx     # File type filter chips
│   └── ResultsList.tsx        # Search results display
├── __tests__/
│   ├── App.test.tsx
│   ├── SidePanel.test.tsx
│   ├── SearchBar.test.tsx
│   ├── FileTypeFilter.test.tsx
│   └── ResultsList.test.tsx
├── types.ts                   # TypeScript type definitions
├── App.tsx                    # Main application component
├── App.css                    # Application styles
├── index.css                  # Global styles
└── main.tsx                   # Application entry point
```

## Testing

The application includes comprehensive test coverage:

- ✅ 37 tests across 5 test suites
- ✅ Component rendering and behavior
- ✅ User interactions (clicks, typing, file uploads)
- ✅ Drag-and-drop functionality
- ✅ State management
- ✅ Filter functionality

## Backend Integration

The application is ready for backend integration. Update the following areas:

### 1. Directory Fetching
In `App.tsx`, replace the mock data with an API call:

```typescript
useEffect(() => {
  fetch('/api/directories')
    .then(res => res.json())
    .then(data => setDirectories(data));
}, []);
```

### 2. Search API
In `App.tsx` `handleSearch` function, replace the mock with:

```typescript
const formData = new FormData();
if (query) formData.append('query', query);
if (imageFile) formData.append('image', imageFile);

const response = await fetch('/api/search', {
  method: 'POST',
  body: formData,
});
const results = await response.json();
setResults(results);
```

### 3. File Opening
In `ResultsList.tsx`, implement the file opening logic:

```typescript
onClick={() => {
  fetch(`/api/open-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: result.path }),
  });
}}
```

## Color Palette

- **Primary Background**: `#151515` / `rgb(21, 21, 21)`
- **Secondary Background**: `#301B3F` / `rgb(48, 27, 63)`
- **Tertiary Background**: `#3C415C` / `rgb(60, 65, 92)`
- **Text Color**: `#B4A5A5` / `rgb(180, 165, 165)`
- **Accent Purple**: `#8B7AA8`

## Browser Support

- Modern browsers with ES2022 support
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

MIT

---

Built with ❤️ using React + Vite + TypeScript
