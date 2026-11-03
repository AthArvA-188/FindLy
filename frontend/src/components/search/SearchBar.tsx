import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';
import AnimatedSearchButton from './AnimatedSearchButton';

interface SearchBarProps {
  onSearch: (query: string, imageFile: File | null) => void;
  loading: boolean;
  hasResults: boolean;
  hasPendingChange?: boolean;
  hasIndexedFiles?: boolean;
  onTriggerIndexHint?: () => void;
}

const exampleQueries = [
  'Find my database systems notes',
  'Show PDF files about machine learning',
  'Find code files related to login',
  'Search my documents for internship resume',
  'Show images of receipts',
];

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, loading, hasResults, hasPendingChange = false, hasIndexedFiles = true, onTriggerIndexHint }) => {
  const [query, setQuery] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayText, setDisplayText] = useState('');
  const [exampleIndex, setExampleIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentExample = useMemo(() => exampleQueries[exampleIndex], [exampleIndex]);
  const handleImageSelect = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if(value.trim() !== ''){
      setDisplayText('');
    }
  };

  const handleSearchClick = () => {
    // Block search if no files indexed - onSearch will handle triggering hint
    if (!hasIndexedFiles) {
      if (onTriggerIndexHint) {
        onTriggerIndexHint();
      }
      return;
    }
    
    if (query.trim() || imageFile) {
      onSearch(query, imageFile);
    }
  };

  // Global Enter key handler - ONLY triggers search, never changes filter state
  useEffect(() => {
    const handleGlobalEnter = (e: KeyboardEvent) => {
      // Only handle Enter key
      if (e.key !== 'Enter') return;
      
      // Don't trigger if we're typing in a textarea or if a modal is open
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') return;
      
      // Block search if no files indexed
      if (!hasIndexedFiles) {
        e.preventDefault();
        if (onTriggerIndexHint) {
          onTriggerIndexHint();
        }
        return;
      }
      
      // Trigger search if we have a query or image
      if (query.trim() || imageFile) {
        e.preventDefault();
        onSearch(query, imageFile);
      }
    };

    window.addEventListener('keydown', handleGlobalEnter);
    return () => window.removeEventListener('keydown', handleGlobalEnter);
  }, [query, imageFile, onSearch, hasIndexedFiles, onTriggerIndexHint]);

  useEffect(() => {
    if (loading) return;
    if (query.trim() !== '') return;

    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && displayText.length < currentExample.length) {
      timeout = setTimeout(() => {
        setDisplayText(currentExample.slice(0, displayText.length + 1));
      }, 80);
    } else if (!isDeleting && displayText.length === currentExample.length) {
      timeout = setTimeout(() => {
        setIsDeleting(true);
      }, 1400);
    } else if (isDeleting && displayText.length > 0) {
      timeout = setTimeout(() => {
        setDisplayText(currentExample.slice(0, displayText.length - 1));
      }, 40);
    } else {
      timeout = setTimeout(() => {
        setIsDeleting(false);
        setExampleIndex((prev) => (prev + 1) % exampleQueries.length);
      }, 200);
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentExample, query, loading]);

  return (
    <div className={`search-container ${hasResults || loading ? 'header' : 'centered'}`}>
      <div className="search-wrapper">
        <input
          type="text"
          className="search-bar"
          placeholder={query ? 'Find...' : displayText || 'Find...'}
          value={query}
          onChange={handleInputChange}
          disabled={loading}
        />
        
        {imageFile ? (
          <div className="image-preview-badge" onClick={clearImage}>
            <button className="clear-image-btn" type="button">
              <X size={18} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="image-upload-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            title="Upload image"
          >
            <ImageIcon size={22} />
          </button>
        )}
        <AnimatedSearchButton 
          isSearching={loading || hasPendingChange}
          onClick={handleSearchClick}
          disabled={loading || (!query.trim() && !imageFile) || !hasIndexedFiles}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleFileInputChange}
        />
      </div>
    </div>
  );
};

export default SearchBar;
