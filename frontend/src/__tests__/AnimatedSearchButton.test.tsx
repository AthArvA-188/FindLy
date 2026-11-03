import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnimatedSearchButton from '../components/search/AnimatedSearchButton';

// Mock OGL library to avoid WebGL issues in tests
jest.mock('ogl', () => ({
  Renderer: jest.fn().mockImplementation(() => ({
    gl: {
      canvas: document.createElement('canvas'),
      disable: jest.fn(),
      DEPTH_TEST: 0,
      CULL_FACE: 1,
      BLEND: 2,
      drawingBufferWidth: 100,
      drawingBufferHeight: 100,
    },
    setSize: jest.fn(),
    render: jest.fn(),
  })),
  Triangle: jest.fn(),
  Program: jest.fn().mockImplementation(() => ({
    uniforms: {
      iResolution: { value: new Float32Array(2) },
      iTime: { value: 0 },
      uIntensity: { value: 0 },
      uRotationSpeed: { value: 1.2 },
      uGlow: { value: 6.5 },
    },
  })),
  Mesh: jest.fn(),
}));

describe('AnimatedSearchButton Component', () => {
  const mockOnClick = jest.fn();
  let rafId = 0;

  beforeEach(() => {
    mockOnClick.mockClear();
    rafId = 0;
    
    // Mock requestAnimationFrame without executing callback
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => {
      return ++rafId;
    });
    
    // Mock cancelAnimationFrame
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    test('renders button element', () => {
      render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    test('renders with correct button type', () => {
      render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });

    test('renders animation container', () => {
      const { container } = render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      const animationContainer = container.querySelector('.animation-container');
      expect(animationContainer).toBeInTheDocument();
    });

    test('renders search logo', () => {
      render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      const logo = screen.getByAltText('Search');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', '/Findly Logo 2 white.png');
    });

    test('has correct base class', () => {
      const { container } = render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      const button = container.querySelector('.animated-search-button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Search State', () => {
    test('applies searching class when isSearching is true', () => {
      const { container } = render(
        <AnimatedSearchButton 
          isSearching={true} 
          onClick={mockOnClick} 
        />
      );
      
      const button = container.querySelector('.animated-search-button');
      expect(button).toHaveClass('searching');
    });

    test('does not apply searching class when isSearching is false', () => {
      const { container } = render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      const button = container.querySelector('.animated-search-button');
      expect(button).not.toHaveClass('searching');
    });

    test('updates class when isSearching changes', () => {
      const { container, rerender } = render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      let button = container.querySelector('.animated-search-button');
      expect(button).not.toHaveClass('searching');
      
      rerender(
        <AnimatedSearchButton 
          isSearching={true} 
          onClick={mockOnClick} 
        />
      );
      
      button = container.querySelector('.animated-search-button');
      expect(button).toHaveClass('searching');
    });
  });

  describe('Click Interaction', () => {
    test('calls onClick when button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    test('calls onClick multiple times when clicked repeatedly', async () => {
      const user = userEvent.setup();
      render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      const button = screen.getByRole('button');
      await user.click(button);
      await user.click(button);
      await user.click(button);
      
      expect(mockOnClick).toHaveBeenCalledTimes(3);
    });

    test('does not call onClick when disabled', async () => {
      const user = userEvent.setup();
      render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
          disabled={true}
        />
      );
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    test('button is disabled when disabled prop is true', () => {
      render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
          disabled={true}
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    test('button is not disabled when disabled prop is false', () => {
      render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
          disabled={false}
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    test('button is not disabled by default', () => {
      render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    test('disabled state can be toggled', () => {
      const { rerender } = render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
          disabled={false}
        />
      );
      
      let button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
      
      rerender(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
          disabled={true}
        />
      );
      
      button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Animation Lifecycle', () => {
    test('initializes WebGL renderer', () => {
      const { container } = render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      const animationContainer = container.querySelector('.animation-container');
      expect(animationContainer).toBeInTheDocument();
    });

    test('cleans up animation on unmount', () => {
      const { unmount } = render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      unmount();
      expect(window.cancelAnimationFrame).toHaveBeenCalled();
    });

    test('handles component remount', () => {
      const { unmount } = render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      unmount();
      
      // Render fresh after unmount
      render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Combined States', () => {
    test('can be both searching and disabled', () => {
      const { container } = render(
        <AnimatedSearchButton 
          isSearching={true} 
          onClick={mockOnClick} 
          disabled={true}
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(container.querySelector('.animated-search-button')).toHaveClass('searching');
    });

    test('can be searching but not disabled', () => {
      const { container } = render(
        <AnimatedSearchButton 
          isSearching={true} 
          onClick={mockOnClick} 
          disabled={false}
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
      expect(container.querySelector('.animated-search-button')).toHaveClass('searching');
    });

    test('can be disabled but not searching', () => {
      const { container } = render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
          disabled={true}
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(container.querySelector('.animated-search-button')).not.toHaveClass('searching');
    });
  });

  describe('Logo Display', () => {
    test('logo has correct CSS class', () => {
      render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      const logo = screen.getByAltText('Search');
      expect(logo).toHaveClass('search-logo');
    });

    test('logo is always visible', () => {
      render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      const logo = screen.getByAltText('Search');
      expect(logo).toBeVisible();
    });

    test('logo persists when searching state changes', () => {
      const { rerender } = render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      expect(screen.getByAltText('Search')).toBeInTheDocument();
      
      rerender(
        <AnimatedSearchButton 
          isSearching={true} 
          onClick={mockOnClick} 
        />
      );
      
      expect(screen.getByAltText('Search')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles rapid state changes', () => {
      const { rerender } = render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      for (let i = 0; i < 10; i++) {
        rerender(
          <AnimatedSearchButton 
            isSearching={i % 2 === 0} 
            onClick={mockOnClick} 
          />
        );
      }
      
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    test('handles onClick callback change', async () => {
      const user = userEvent.setup();
      const newCallback = jest.fn();
      
      const { rerender } = render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      rerender(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={newCallback} 
        />
      );
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(newCallback).toHaveBeenCalledTimes(1);
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    test('maintains structure during prop updates', () => {
      const { container, rerender } = render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      rerender(
        <AnimatedSearchButton 
          isSearching={true} 
          onClick={mockOnClick} 
          disabled={true}
        />
      );
      
      expect(container.querySelector('.animated-search-button')).toBeInTheDocument();
      expect(container.querySelector('.animation-container')).toBeInTheDocument();
      expect(screen.getByAltText('Search')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('button is keyboard accessible', () => {
      render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('BUTTON');
    });

    test('logo has alt text', () => {
      render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
        />
      );
      
      const logo = screen.getByAltText('Search');
      expect(logo).toHaveAttribute('alt', 'Search');
    });

    test('disabled button prevents interaction', async () => {
      const user = userEvent.setup();
      render(
        <AnimatedSearchButton 
          isSearching={false} 
          onClick={mockOnClick} 
          disabled={true}
        />
      );
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });
});
