import React from 'react';
import type { FileType } from '../../types';

interface FileTypeFilterProps {
  selectedTypes: FileType[];
  onTypeChange: (types: FileType[]) => void;
}

const fileTypes: { type: FileType; label: string }[] = [
  { type: 'all', label: 'All Files' },
  { type: 'pdf', label: 'PDF' },
  { type: 'doc', label: 'Documents' },
  { type: 'txt', label: 'Text' },
  { type: 'image', label: 'Images' },
  { type: 'code', label: 'Code' },
];

const FileTypeFilter: React.FC<FileTypeFilterProps> = ({
  selectedTypes,
  onTypeChange,
}) => {
  const handleToggle = (type: FileType) => {
    if (type === 'all') {
      // If "All Files" is clicked, select only "all"
      onTypeChange(['all']);
    } else {
      // Remove "all" if it's selected
      let newTypes: FileType[] = selectedTypes.filter(t => t !== 'all');
      
      // Toggle the clicked type
      if (newTypes.includes(type)) {
        newTypes = newTypes.filter(t => t !== type);
      } else {
        newTypes = [...newTypes, type];
      }
      
      // If no types selected, default to "all"
      if (newTypes.length === 0) {
        newTypes = ['all'];
      }
      
      onTypeChange(newTypes);
    }
  };

  return (
    <div className="filters">
      {fileTypes.map(({ type, label }) => (
        <button
          key={type}
          className={`filter-chip ${selectedTypes.includes(type) ? 'active' : ''}`}
          onClick={() => handleToggle(type)}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

export default FileTypeFilter;
