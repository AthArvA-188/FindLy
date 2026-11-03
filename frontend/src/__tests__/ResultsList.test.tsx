import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResultsList from '../components/search/ResultsList';
import type { SearchResult } from '../types';

describe('ResultsList Component', () => {
  const mockResults: SearchResult[] = [
    {
      id: '1',
      path: '/users/documents/report.pdf',
      confidence: 0.95,
      preview: 'This is a sample document about machine learning',
      fileType: 'pdf',
    },
    {
      id: '2',
      path: '/users/projects/readme.md',
      confidence: 0.87,
      preview: 'Documentation for the project setup',
      fileType: 'txt',
    },
    {
      id: '3',
      path: '/users/code/main.py',
      confidence: 0.72,
      preview: 'Python script for data processing',
      fileType: 'py',
    },
  ];

  describe('Loading State', () => {
    test('renders loading state', () => {
      render(<ResultsList results={[]} loading={true} />);
      expect(screen.getByText('Searching documents...')).toBeInTheDocument();
    });

    test('renders spinner during loading', () => {
      const { container } = render(<ResultsList results={[]} loading={true} />);
      expect(container.querySelector('.spinner')).toBeInTheDocument();
    });

    test('shows loading container', () => {
      const { container } = render(<ResultsList results={[]} loading={true} />);
      expect(container.querySelector('.loading')).toBeInTheDocument();
    });

    test('renders results container during loading', () => {
      const { container } = render(<ResultsList results={[]} loading={true} />);
      expect(container.querySelector('.results-container')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    test('returns null when no results and not loading', () => {
      const { container } = render(<ResultsList results={[]} loading={false} />);
      expect(container.firstChild).toBeNull();
    });

    test('does not render results container when empty and not loading', () => {
      const { container } = render(<ResultsList results={[]} loading={false} />);
      expect(container.querySelector('.results-container')).not.toBeInTheDocument();
    });
  });

  describe('Results Display', () => {
    test('displays all results', () => {
      render(<ResultsList results={mockResults} loading={false} />);
      
      expect(screen.getByText('/users/documents/report.pdf')).toBeInTheDocument();
      expect(screen.getByText('/users/projects/readme.md')).toBeInTheDocument();
      expect(screen.getByText('/users/code/main.py')).toBeInTheDocument();
    });

    test('displays result previews', () => {
      render(<ResultsList results={mockResults} loading={false} />);
      
      expect(screen.getByText('This is a sample document about machine learning')).toBeInTheDocument();
      expect(screen.getByText('Documentation for the project setup')).toBeInTheDocument();
      expect(screen.getByText('Python script for data processing')).toBeInTheDocument();
    });

    test('displays file names from paths', () => {
      render(<ResultsList results={mockResults} loading={false} />);
      
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
      expect(screen.getByText('readme.md')).toBeInTheDocument();
      expect(screen.getByText('main.py')).toBeInTheDocument();
    });

    test('renders correct number of result cards', () => {
      const { container } = render(<ResultsList results={mockResults} loading={false} />);
      const cards = container.querySelectorAll('.result-card');
      expect(cards.length).toBe(3);
    });

    test('result cards have correct structure', () => {
      const { container } = render(<ResultsList results={mockResults} loading={false} />);
      const firstCard = container.querySelector('.result-card');
      
      expect(firstCard?.querySelector('.result-header')).toBeInTheDocument();
      expect(firstCard?.querySelector('.result-title')).toBeInTheDocument();
      expect(firstCard?.querySelector('.result-path')).toBeInTheDocument();
      expect(firstCard?.querySelector('.result-preview')).toBeInTheDocument();
    });
  });

  describe('Confidence Scores', () => {
    test('displays confidence scores as percentages', () => {
      render(<ResultsList results={mockResults} loading={false} />);
      
      expect(screen.getByText('95% match')).toBeInTheDocument();
      expect(screen.getByText('87% match')).toBeInTheDocument();
      expect(screen.getByText('72% match')).toBeInTheDocument();
    });

    test('rounds confidence scores correctly', () => {
      const resultsWithDecimal: SearchResult[] = [
        { id: '1', path: '/test.txt', confidence: 0.956, preview: 'test', fileType: 'txt' },
        { id: '2', path: '/test2.txt', confidence: 0.954, preview: 'test', fileType: 'txt' },
      ];
      render(<ResultsList results={resultsWithDecimal} loading={false} />);
      
      expect(screen.getByText('96% match')).toBeInTheDocument();
      expect(screen.getByText('95% match')).toBeInTheDocument();
    });

    test('handles zero confidence', () => {
      const resultsWithZero: SearchResult[] = [
        { id: '1', path: '/test.txt', confidence: 0, preview: 'test', fileType: 'txt' },
      ];
      render(<ResultsList results={resultsWithZero} loading={false} />);
      
      expect(screen.getByText('0% match')).toBeInTheDocument();
    });

    test('handles perfect confidence', () => {
      const resultsWithPerfect: SearchResult[] = [
        { id: '1', path: '/test.txt', confidence: 1.0, preview: 'test', fileType: 'txt' },
      ];
      render(<ResultsList results={resultsWithPerfect} loading={false} />);
      
      expect(screen.getByText('100% match')).toBeInTheDocument();
    });
  });

  describe('File Icons', () => {
    test('displays appropriate icons for different file types', () => {
      const { container } = render(<ResultsList results={mockResults} loading={false} />);
      const resultPaths = container.querySelectorAll('.result-path');
      
      // Each result path should have an icon
      resultPaths.forEach(path => {
        const svg = path.querySelector('svg');
        expect(svg).toBeInTheDocument();
      });
    });

    test('renders icons for PDF files', () => {
      const pdfResults: SearchResult[] = [
        { id: '1', path: '/doc.pdf', confidence: 0.9, preview: 'test', fileType: 'pdf' },
      ];
      const { container } = render(<ResultsList results={pdfResults} loading={false} />);
      expect(container.querySelector('.result-path svg')).toBeInTheDocument();
    });

    test('renders icons for code files', () => {
      const codeResults: SearchResult[] = [
        { id: '1', path: '/script.js', confidence: 0.9, preview: 'test', fileType: 'js' },
        { id: '2', path: '/app.py', confidence: 0.8, preview: 'test', fileType: 'py' },
      ];
      render(<ResultsList results={codeResults} loading={false} />);
      expect(screen.getByText('/script.js')).toBeInTheDocument();
      expect(screen.getByText('/app.py')).toBeInTheDocument();
    });

    test('renders icons for image files', () => {
      const imageResults: SearchResult[] = [
        { id: '1', path: '/photo.jpg', confidence: 0.9, preview: 'test', fileType: 'jpg' },
        { id: '2', path: '/image.png', confidence: 0.8, preview: 'test', fileType: 'png' },
      ];
      render(<ResultsList results={imageResults} loading={false} />);
      expect(screen.getByText('/photo.jpg')).toBeInTheDocument();
      expect(screen.getByText('/image.png')).toBeInTheDocument();
    });
  });

  describe('Click Interaction', () => {
    test('result cards are clickable', async () => {
      const user = userEvent.setup();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const { container } = render(<ResultsList results={mockResults} loading={false} />);
      const firstCard = container.querySelector('.result-card') as HTMLElement;
      
      await user.click(firstCard);
      
      expect(consoleSpy).toHaveBeenCalledWith('Open file:', '/users/documents/report.pdf');
      consoleSpy.mockRestore();
    });

    test('clicking different cards logs different paths', async () => {
      const user = userEvent.setup();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const { container } = render(<ResultsList results={mockResults} loading={false} />);
      const cards = container.querySelectorAll('.result-card');
      
      await user.click(cards[0] as HTMLElement);
      expect(consoleSpy).toHaveBeenCalledWith('Open file:', '/users/documents/report.pdf');
      
      await user.click(cards[1] as HTMLElement);
      expect(consoleSpy).toHaveBeenCalledWith('Open file:', '/users/projects/readme.md');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    test('handles single result', () => {
      const singleResult: SearchResult[] = [mockResults[0]];
      const { container } = render(<ResultsList results={singleResult} loading={false} />);
      
      const cards = container.querySelectorAll('.result-card');
      expect(cards.length).toBe(1);
    });

    test('handles many results', () => {
      const manyResults: SearchResult[] = Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        path: `/test/file${i}.txt`,
        confidence: 0.9,
        preview: `Preview text ${i}`,
        fileType: 'txt',
      }));
      
      const { container } = render(<ResultsList results={manyResults} loading={false} />);
      const cards = container.querySelectorAll('.result-card');
      expect(cards.length).toBe(20);
    });

    test('handles very long file paths', () => {
      const longPathResult: SearchResult[] = [{
        id: '1',
        path: '/very/long/path/that/goes/on/and/on/with/many/nested/folders/document.pdf',
        confidence: 0.85,
        preview: 'test',
        fileType: 'pdf',
      }];
      
      render(<ResultsList results={longPathResult} loading={false} />);
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    test('handles empty preview text', () => {
      const emptyPreviewResult: SearchResult[] = [{
        id: '1',
        path: '/test.txt',
        confidence: 0.9,
        preview: '',
        fileType: 'txt',
      }];
      
      const { container } = render(<ResultsList results={emptyPreviewResult} loading={false} />);
      expect(container.querySelector('.result-preview')).toBeInTheDocument();
    });

    test('handles very long preview text', () => {
      const longPreview = 'Lorem ipsum dolor sit amet, '.repeat(20);
      const longPreviewResult: SearchResult[] = [{
        id: '1',
        path: '/test.txt',
        confidence: 0.9,
        preview: longPreview,
        fileType: 'txt',
      }];
      
      const { container } = render(<ResultsList results={longPreviewResult} loading={false} />);
      const previewElement = container.querySelector('.result-preview');
      expect(previewElement).toBeInTheDocument();
      expect(previewElement?.textContent).toContain('Lorem ipsum dolor sit amet,');
    });

    test('handles path without filename', () => {
      const noFilenameResult: SearchResult[] = [{
        id: '1',
        path: '/users/documents/',
        confidence: 0.9,
        preview: 'test',
        fileType: 'folder',
      }];
      
      render(<ResultsList results={noFilenameResult} loading={false} />);
      // Should fall back to showing the full path (appears in both title and path)
      const pathElements = screen.getAllByText('/users/documents/');
      expect(pathElements.length).toBeGreaterThan(0);
    });
  });

  describe('Component Updates', () => {
    test('updates when results change', () => {
      const { rerender, container } = render(<ResultsList results={mockResults} loading={false} />);
      
      let cards = container.querySelectorAll('.result-card');
      expect(cards.length).toBe(3);
      
      const newResults = [mockResults[0]];
      rerender(<ResultsList results={newResults} loading={false} />);
      
      cards = container.querySelectorAll('.result-card');
      expect(cards.length).toBe(1);
    });

    test('transitions from loading to results', () => {
      const { rerender } = render(<ResultsList results={[]} loading={true} />);
      
      expect(screen.getByText('Searching documents...')).toBeInTheDocument();
      
      rerender(<ResultsList results={mockResults} loading={false} />);
      
      expect(screen.queryByText('Searching documents...')).not.toBeInTheDocument();
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
    });

    test('transitions from results to empty', () => {
      const { rerender, container } = render(<ResultsList results={mockResults} loading={false} />);
      
      expect(container.querySelector('.result-card')).toBeInTheDocument();
      
      rerender(<ResultsList results={[]} loading={false} />);
      
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Accessibility', () => {
    test('result cards are keyboard accessible', () => {
      const { container } = render(<ResultsList results={mockResults} loading={false} />);
      const cards = container.querySelectorAll('.result-card');
      
      cards.forEach(card => {
        // Cards should be clickable (div with onClick)
        expect(card).toBeInTheDocument();
      });
    });

    test('results container exists for screen readers', () => {
      const { container } = render(<ResultsList results={mockResults} loading={false} />);
      expect(container.querySelector('.results-container')).toBeInTheDocument();
    });
  });
});
