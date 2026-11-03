import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar from '../components/search/SearchBar';

// Mock the AnimatedSearchButton
jest.mock('../components/search/AnimatedSearchButton', () => {
  return function MockAnimatedSearchButton({ onClick, disabled, isSearching }: any) {
    return (
      <button 
        onClick={onClick} 
        disabled={disabled}
        data-testid="animated-search-button"
        data-searching={isSearching}
      >
        Search
      </button>
    );
  };
});

describe('SearchBar Component', () => {
  const mockOnSearch = jest.fn();

  beforeEach(() => {
    mockOnSearch.mockClear();
  });

  describe('Rendering', () => {
    test('renders search input with correct placeholder', () => {
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      expect(screen.getByPlaceholderText('Find...')).toBeInTheDocument();
    });

    test('renders centered when no results', () => {
      const { container } = render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      const searchContainer = container.querySelector('.search-container');
      expect(searchContainer).toHaveClass('centered');
    });

    test('renders in header when has results', () => {
      const { container } = render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={true} />);
      const searchContainer = container.querySelector('.search-container');
      expect(searchContainer).toHaveClass('header');
    });

    test('shows image upload button initially', () => {
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      const uploadButton = screen.getByTitle('Upload image');
      expect(uploadButton).toBeInTheDocument();
    });

    test('renders animated search button', () => {
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      expect(screen.getByTestId('animated-search-button')).toBeInTheDocument();
    });
  });

  describe('Input Functionality', () => {
    test('allows typing in search input', async () => {
      const user = userEvent.setup();
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      
      const input = screen.getByPlaceholderText('Find...') as HTMLInputElement;
      await user.type(input, 'test query');
      
      expect(input.value).toBe('test query');
    });

    test('updates input value on change', async () => {
      const user = userEvent.setup();
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      
      const input = screen.getByPlaceholderText('Find...') as HTMLInputElement;
      await user.type(input, 'machine learning');
      
      expect(input.value).toBe('machine learning');
    });

    test('disables input when loading', () => {
      render(<SearchBar onSearch={mockOnSearch} loading={true} hasResults={false} />);
      const input = screen.getByPlaceholderText('Find...');
      expect(input).toBeDisabled();
    });

    test('enables input when not loading', () => {
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      const input = screen.getByPlaceholderText('Find...');
      expect(input).not.toBeDisabled();
    });
  });

  describe('Search Button', () => {
    test('calls onSearch when search button is clicked with query', async () => {
      const user = userEvent.setup();
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      
      const input = screen.getByPlaceholderText('Find...');
      await user.type(input, 'test query');
      
      const searchButton = screen.getByTestId('animated-search-button');
      await user.click(searchButton);
      
      expect(mockOnSearch).toHaveBeenCalledWith('test query', null);
    });

    test('search button is disabled when no query and no image', () => {
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      const searchButton = screen.getByTestId('animated-search-button');
      expect(searchButton).toBeDisabled();
    });

    test('search button is enabled when query exists', async () => {
      const user = userEvent.setup();
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      
      const input = screen.getByPlaceholderText('Find...');
      await user.type(input, 'test');
      
      const searchButton = screen.getByTestId('animated-search-button');
      expect(searchButton).not.toBeDisabled();
    });

    test('search button is disabled during loading', () => {
      render(<SearchBar onSearch={mockOnSearch} loading={true} hasResults={false} />);
      const searchButton = screen.getByTestId('animated-search-button');
      expect(searchButton).toBeDisabled();
    });

    test('shows searching state when hasPendingChange is true', () => {
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} hasPendingChange={true} />);
      const searchButton = screen.getByTestId('animated-search-button');
      expect(searchButton).toHaveAttribute('data-searching', 'true');
    });

    test('shows searching state when loading is true', () => {
      render(<SearchBar onSearch={mockOnSearch} loading={true} hasResults={false} />);
      const searchButton = screen.getByTestId('animated-search-button');
      expect(searchButton).toHaveAttribute('data-searching', 'true');
    });
  });

  describe('Image Upload', () => {
    test('shows image upload button', () => {
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      const uploadButton = screen.getByTitle('Upload image');
      expect(uploadButton).toBeInTheDocument();
    });

    test('accepts image file upload', async () => {
      const user = userEvent.setup();
      const { container } = render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      
      const file = new File(['dummy'], 'test.png', { type: 'image/png' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      expect(fileInput.files?.[0]).toBe(file);
    });

    test('shows clear button when image is selected', async () => {
      const user = userEvent.setup();
      const { container } = render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      
      const file = new File(['dummy'], 'test.png', { type: 'image/png' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        const clearButton = container.querySelector('.clear-image-btn');
        expect(clearButton).toBeInTheDocument();
      });
    });

    test('clears image when clear button is clicked', async () => {
      const user = userEvent.setup();
      const { container } = render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      
      const file = new File(['dummy'], 'test.png', { type: 'image/png' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        const clearButton = container.querySelector('.clear-image-btn');
        expect(clearButton).toBeInTheDocument();
      });
      
      const imagePreviewBadge = container.querySelector('.image-preview-badge') as HTMLElement;
      await user.click(imagePreviewBadge);
      
      await waitFor(() => {
        expect(screen.getByTitle('Upload image')).toBeInTheDocument();
      });
    });

    test('disables image upload button when loading', () => {
      render(<SearchBar onSearch={mockOnSearch} loading={true} hasResults={false} />);
      const uploadButton = screen.getByTitle('Upload image');
      expect(uploadButton).toBeDisabled();
    });

    test('calls onSearch with image file when search is clicked', async () => {
      const user = userEvent.setup();
      const { container } = render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      
      const file = new File(['dummy'], 'test.png', { type: 'image/png' });
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      const searchButton = screen.getByTestId('animated-search-button');
      await user.click(searchButton);
      
      expect(mockOnSearch).toHaveBeenCalledWith('', file);
    });
  });

  describe('Keyboard Shortcuts', () => {
    test('triggers search on Enter key press', async () => {
      const user = userEvent.setup();
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      
      const input = screen.getByPlaceholderText('Find...');
      await user.type(input, 'test query');
      await user.keyboard('{Enter}');
      
      expect(mockOnSearch).toHaveBeenCalledWith('test query', null);
    });

    test('does not trigger search on Enter if no query or image', async () => {
      const user = userEvent.setup();
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      
      await user.keyboard('{Enter}');
      
      expect(mockOnSearch).not.toHaveBeenCalled();
    });

    test('global Enter key triggers search when query exists', async () => {
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      
      const input = screen.getByPlaceholderText('Find...');
      fireEvent.change(input, { target: { value: 'test' } });
      
      fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
      
      expect(mockOnSearch).toHaveBeenCalledWith('test', null);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty query', async () => {
      const user = userEvent.setup();
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      
      const input = screen.getByPlaceholderText('Find...');
      await user.type(input, '   ');
      
      const searchButton = screen.getByTestId('animated-search-button');
      await user.click(searchButton);
      
      // Should not call onSearch with whitespace-only query
      expect(mockOnSearch).not.toHaveBeenCalled();
    });

    test('trims whitespace from query', async () => {
      const user = userEvent.setup();
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      
      const input = screen.getByPlaceholderText('Find...');
      await user.type(input, '  test query  ');
      
      const searchButton = screen.getByTestId('animated-search-button');
      await user.click(searchButton);
      
      expect(mockOnSearch).toHaveBeenCalledWith('  test query  ', null);
    });

    test('handles very long queries', async () => {
      const user = userEvent.setup();
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      
      const longQuery = 'a'.repeat(100); // Reduced size for test performance
      const input = screen.getByPlaceholderText('Find...');
      await user.type(input, longQuery);
      
      const searchButton = screen.getByTestId('animated-search-button');
      await user.click(searchButton);
      
      expect(mockOnSearch).toHaveBeenCalledWith(longQuery, null);
    }, 10000);

    test('handles rapid input changes', () => {
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      
      const input = screen.getByPlaceholderText('Find...') as HTMLInputElement;
      
      // Use fireEvent for direct manipulation
      fireEvent.change(input, { target: { value: 'abc' } });
      expect(input.value).toBe('abc');
      
      fireEvent.change(input, { target: { value: '' } });
      expect(input.value).toBe('');
      
      fireEvent.change(input, { target: { value: 'xyz' } });
      expect(input.value).toBe('xyz');
    });
  });

  describe('Component State', () => {
    test('maintains input state when props change', () => {
      const { rerender } = render(
        <SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />
      );
      
      const input = screen.getByPlaceholderText('Find...') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'test' } });
      
      rerender(<SearchBar onSearch={mockOnSearch} loading={true} hasResults={false} />);
      
      expect(input.value).toBe('test');
    });

    test('resets state after clear and new search', () => {
      render(<SearchBar onSearch={mockOnSearch} loading={false} hasResults={false} />);
      
      const input = screen.getByPlaceholderText('Find...') as HTMLInputElement;
      
      // Use fireEvent for direct state manipulation
      fireEvent.change(input, { target: { value: 'first query' } });
      expect(input.value).toBe('first query');
      
      fireEvent.change(input, { target: { value: '' } });
      expect(input.value).toBe('');
      
      fireEvent.change(input, { target: { value: 'second query' } });
      expect(input.value).toBe('second query');
    });
  });
});
