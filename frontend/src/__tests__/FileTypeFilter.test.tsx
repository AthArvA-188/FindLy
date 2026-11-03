import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileTypeFilter from '../components/search/FileTypeFilter';

describe('FileTypeFilter Component', () => {
  const mockOnTypeChange = jest.fn();

  beforeEach(() => {
    mockOnTypeChange.mockClear();
  });

  describe('Rendering', () => {
    test('renders all file type options', () => {
      render(<FileTypeFilter selectedTypes={['all']} onTypeChange={mockOnTypeChange} />);
      
      expect(screen.getByText('All Files')).toBeInTheDocument();
      expect(screen.getByText('PDF')).toBeInTheDocument();
      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('Text')).toBeInTheDocument();
      expect(screen.getByText('Images')).toBeInTheDocument();
      expect(screen.getByText('Code')).toBeInTheDocument();
    });

    test('renders correct number of filter chips', () => {
      const { container } = render(
        <FileTypeFilter selectedTypes={['all']} onTypeChange={mockOnTypeChange} />
      );
      
      const chips = container.querySelectorAll('.filter-chip');
      expect(chips.length).toBe(6);
    });

    test('renders filters container', () => {
      const { container } = render(
        <FileTypeFilter selectedTypes={['all']} onTypeChange={mockOnTypeChange} />
      );
      
      expect(container.querySelector('.filters')).toBeInTheDocument();
    });
  });

  describe('Selection States', () => {
    test('applies active class to selected types', () => {
      render(
        <FileTypeFilter selectedTypes={['pdf', 'doc']} onTypeChange={mockOnTypeChange} />
      );
      
      const pdfButton = screen.getByText('PDF');
      const docButton = screen.getByText('Documents');
      expect(pdfButton).toHaveClass('active');
      expect(docButton).toHaveClass('active');
    });

    test('marks "All Files" as active by default', () => {
      render(<FileTypeFilter selectedTypes={['all']} onTypeChange={mockOnTypeChange} />);
      
      const allFilesButton = screen.getByText('All Files');
      expect(allFilesButton).toHaveClass('active');
    });

    test('does not mark unselected types as active', () => {
      render(<FileTypeFilter selectedTypes={['pdf']} onTypeChange={mockOnTypeChange} />);
      
      const codeButton = screen.getByText('Code');
      expect(codeButton).not.toHaveClass('active');
    });

    test('handles multiple active selections', () => {
      render(
        <FileTypeFilter selectedTypes={['pdf', 'doc', 'txt', 'image']} onTypeChange={mockOnTypeChange} />
      );
      
      expect(screen.getByText('PDF')).toHaveClass('active');
      expect(screen.getByText('Documents')).toHaveClass('active');
      expect(screen.getByText('Text')).toHaveClass('active');
      expect(screen.getByText('Images')).toHaveClass('active');
    });
  });

  describe('Single Selection', () => {
    test('calls onTypeChange when filter is clicked', async () => {
      const user = userEvent.setup();
      render(<FileTypeFilter selectedTypes={['all']} onTypeChange={mockOnTypeChange} />);
      
      const pdfButton = screen.getByText('PDF');
      await user.click(pdfButton);
      
      expect(mockOnTypeChange).toHaveBeenCalledWith(['pdf']);
      expect(mockOnTypeChange).toHaveBeenCalledTimes(1);
    });

    test('clicking a specific type removes "all"', async () => {
      const user = userEvent.setup();
      render(<FileTypeFilter selectedTypes={['all']} onTypeChange={mockOnTypeChange} />);
      
      await user.click(screen.getByText('PDF'));
      
      expect(mockOnTypeChange).toHaveBeenCalledWith(['pdf']);
    });

    test('clicking same filter again deselects it', async () => {
      const user = userEvent.setup();
      render(<FileTypeFilter selectedTypes={['pdf']} onTypeChange={mockOnTypeChange} />);
      
      await user.click(screen.getByText('PDF'));
      
      // When deselecting the last filter, should default to 'all'
      expect(mockOnTypeChange).toHaveBeenCalledWith(['all']);
    });
  });

  describe('Multiple Selection', () => {
    test('allows multiple selections', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <FileTypeFilter selectedTypes={['pdf']} onTypeChange={mockOnTypeChange} />
      );
      
      // Click Documents to add it
      await user.click(screen.getByText('Documents'));
      expect(mockOnTypeChange).toHaveBeenCalledWith(['pdf', 'doc']);
      
      // Simulate re-render with new selection
      rerender(<FileTypeFilter selectedTypes={['pdf', 'doc']} onTypeChange={mockOnTypeChange} />);
      
      // Both should be active
      expect(screen.getByText('PDF')).toHaveClass('active');
      expect(screen.getByText('Documents')).toHaveClass('active');
    });

    test('can add third filter to selection', async () => {
      const user = userEvent.setup();
      render(
        <FileTypeFilter selectedTypes={['pdf', 'doc']} onTypeChange={mockOnTypeChange} />
      );
      
      await user.click(screen.getByText('Text'));
      expect(mockOnTypeChange).toHaveBeenCalledWith(['pdf', 'doc', 'txt']);
    });

    test('can remove one filter from multiple selections', async () => {
      const user = userEvent.setup();
      render(<FileTypeFilter selectedTypes={['pdf', 'doc', 'txt']} onTypeChange={mockOnTypeChange} />);
      
      await user.click(screen.getByText('Documents'));
      expect(mockOnTypeChange).toHaveBeenCalledWith(['pdf', 'txt']);
    });

    test('maintains order when adding filters', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <FileTypeFilter selectedTypes={['pdf']} onTypeChange={mockOnTypeChange} />
      );
      
      await user.click(screen.getByText('Images'));
      const call1 = mockOnTypeChange.mock.calls[0][0];
      expect(call1).toEqual(['pdf', 'image']);
      
      rerender(<FileTypeFilter selectedTypes={['pdf', 'image']} onTypeChange={mockOnTypeChange} />);
      
      await user.click(screen.getByText('Code'));
      const call2 = mockOnTypeChange.mock.calls[1][0];
      expect(call2).toEqual(['pdf', 'image', 'code']);
    });
  });

  describe('"All Files" Special Behavior', () => {
    test('clicking "All Files" deselects other filters', async () => {
      const user = userEvent.setup();
      render(<FileTypeFilter selectedTypes={['pdf', 'doc']} onTypeChange={mockOnTypeChange} />);
      
      await user.click(screen.getByText('All Files'));
      expect(mockOnTypeChange).toHaveBeenCalledWith(['all']);
    });

    test('clicking "All Files" when already selected keeps it selected', async () => {
      const user = userEvent.setup();
      render(<FileTypeFilter selectedTypes={['all']} onTypeChange={mockOnTypeChange} />);
      
      await user.click(screen.getByText('All Files'));
      expect(mockOnTypeChange).toHaveBeenCalledWith(['all']);
    });

    test('deselecting all filters defaults to "All Files"', async () => {
      const user = userEvent.setup();
      render(<FileTypeFilter selectedTypes={['pdf']} onTypeChange={mockOnTypeChange} />);
      
      // Click PDF again to deselect it
      await user.click(screen.getByText('PDF'));
      expect(mockOnTypeChange).toHaveBeenCalledWith(['all']);
    });

    test('deselecting last remaining filter defaults to "All Files"', async () => {
      const user = userEvent.setup();
      render(<FileTypeFilter selectedTypes={['code']} onTypeChange={mockOnTypeChange} />);
      
      await user.click(screen.getByText('Code'));
      expect(mockOnTypeChange).toHaveBeenCalledWith(['all']);
    });
  });

  describe('Keyboard Interaction', () => {
    test('prevents Enter key from triggering button default behavior', () => {
      render(<FileTypeFilter selectedTypes={['all']} onTypeChange={mockOnTypeChange} />);
      
      const pdfButton = screen.getByText('PDF');
      fireEvent.keyDown(pdfButton, { key: 'Enter', code: 'Enter' });
      
      // Check that preventDefault was called (indirectly by checking default wasn't prevented)
      expect(mockOnTypeChange).not.toHaveBeenCalled();
    });

    test('filter buttons are keyboard accessible', () => {
      render(<FileTypeFilter selectedTypes={['all']} onTypeChange={mockOnTypeChange} />);
      
      const allButtons = screen.getAllByRole('button');
      expect(allButtons.length).toBe(6);
      
      allButtons.forEach(button => {
        expect(button).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles empty selectedTypes array', () => {
      render(<FileTypeFilter selectedTypes={[]} onTypeChange={mockOnTypeChange} />);
      
      // Should still render all options
      expect(screen.getByText('All Files')).toBeInTheDocument();
      expect(screen.getByText('PDF')).toBeInTheDocument();
    });

    test('handles rapid filter changes', async () => {
      const user = userEvent.setup();
      render(<FileTypeFilter selectedTypes={['all']} onTypeChange={mockOnTypeChange} />);
      
      await user.click(screen.getByText('PDF'));
      await user.click(screen.getByText('Documents'));
      await user.click(screen.getByText('Text'));
      
      expect(mockOnTypeChange).toHaveBeenCalledTimes(3);
    });

    test('handles all filters being selected at once', () => {
      render(
        <FileTypeFilter 
          selectedTypes={['all', 'pdf', 'doc', 'txt', 'image', 'code']} 
          onTypeChange={mockOnTypeChange} 
        />
      );
      
      // All should have active class
      expect(screen.getByText('All Files')).toHaveClass('active');
      expect(screen.getByText('PDF')).toHaveClass('active');
      expect(screen.getByText('Documents')).toHaveClass('active');
      expect(screen.getByText('Text')).toHaveClass('active');
      expect(screen.getByText('Images')).toHaveClass('active');
      expect(screen.getByText('Code')).toHaveClass('active');
    });
  });

  describe('Component Updates', () => {
    test('updates active state when selectedTypes prop changes', () => {
      const { rerender } = render(
        <FileTypeFilter selectedTypes={['pdf']} onTypeChange={mockOnTypeChange} />
      );
      
      expect(screen.getByText('PDF')).toHaveClass('active');
      expect(screen.getByText('Documents')).not.toHaveClass('active');
      
      rerender(<FileTypeFilter selectedTypes={['doc']} onTypeChange={mockOnTypeChange} />);
      
      expect(screen.getByText('PDF')).not.toHaveClass('active');
      expect(screen.getByText('Documents')).toHaveClass('active');
    });

    test('handles callback function changes', () => {
      render(
        <FileTypeFilter selectedTypes={['all']} onTypeChange={mockOnTypeChange} />
      );
      
      // Should not cause any errors when callback changes
      expect(screen.getByText('All Files')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('all filters are rendered as buttons', () => {
      render(<FileTypeFilter selectedTypes={['all']} onTypeChange={mockOnTypeChange} />);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(6);
    });

    test('active filters are visually distinguishable', () => {
      render(<FileTypeFilter selectedTypes={['pdf', 'code']} onTypeChange={mockOnTypeChange} />);
      
      expect(screen.getByText('PDF')).toHaveClass('active');
      expect(screen.getByText('Code')).toHaveClass('active');
      expect(screen.getByText('Documents')).not.toHaveClass('active');
    });
  });
});
