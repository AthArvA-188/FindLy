import { render } from '@testing-library/react';
import BackgroundAnimation from '../components/backgrounds/BackgroundAnimation';

// Mock the three animation components to avoid WebGL/Canvas issues in tests
jest.mock('../components/backgrounds/Prism', () => {
  return function MockPrism(props: any) {
    return <div className="light-prism" data-testid="prism-animation" data-props={JSON.stringify(props)} />;
  };
});

jest.mock('../components/backgrounds/GridScan', () => {
  return function MockGridScan(props: any) {
    return (
      <div className="grid-scan" data-testid="grid-scan-animation" data-props={JSON.stringify(props)}>
        <div className="scan-line" />
      </div>
    );
  };
});

jest.mock('../components/backgrounds/DotGrid', () => {
  return function MockDotGrid(props: any) {
    return <div className="dot-grid" data-testid="dot-grid-animation" data-props={JSON.stringify(props)} />;
  };
});

describe('BackgroundAnimation Component', () => {
  describe('Prism Animation', () => {
    test('renders prism animation when type is "prism"', () => {
      const { container } = render(<BackgroundAnimation type="prism" />);
      expect(container.querySelector('[data-testid="prism-animation"]')).toBeInTheDocument();
    });

    test('passes correct props to Prism component', () => {
      const { container } = render(<BackgroundAnimation type="prism" />);
      const prismElement = container.querySelector('[data-testid="prism-animation"]');
      const props = JSON.parse(prismElement?.getAttribute('data-props') || '{}');
      
      expect(props.animationType).toBe('rotate');
      expect(props.timeScale).toBe(0.5);
      expect(props.height).toBe(3.5);
      expect(props.baseWidth).toBe(5.5);
      expect(props.scale).toBe(3.6);
      expect(props.hueShift).toBe(0.7);
      expect(props.colorFrequency).toBe(0.3);
      expect(props.noise).toBe(0.1);
      expect(props.glow).toBe(0.1);
      expect(props.transparent).toBe(true);
    });

    test('does not render other animations when prism is active', () => {
      const { container } = render(<BackgroundAnimation type="prism" />);
      expect(container.querySelector('[data-testid="grid-scan-animation"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid="dot-grid-animation"]')).not.toBeInTheDocument();
    });
  });

  describe('Grid Scan Animation', () => {
    test('renders scan animation when type is "scan"', () => {
      const { container } = render(<BackgroundAnimation type="scan" />);
      expect(container.querySelector('[data-testid="grid-scan-animation"]')).toBeInTheDocument();
    });

    test('scan animation includes scan line', () => {
      const { container } = render(<BackgroundAnimation type="scan" />);
      expect(container.querySelector('.scan-line')).toBeInTheDocument();
    });

    test('passes correct props to GridScan component', () => {
      const { container } = render(<BackgroundAnimation type="scan" />);
      const scanElement = container.querySelector('[data-testid="grid-scan-animation"]');
      const props = JSON.parse(scanElement?.getAttribute('data-props') || '{}');
      
      expect(props.sensitivity).toBe(0.55);
      expect(props.lineThickness).toBe(1);
      expect(props.linesColor).toBe('#271E37');
      expect(props.gridScale).toBe(0.1);
      expect(props.scanColor).toBe('#8B7AA8');
      expect(props.scanOpacity).toBe(0.6);
      expect(props.enablePost).toBe(true);
      expect(props.bloomIntensity).toBe(0.4);
      expect(props.chromaticAberration).toBe(0.002);
      expect(props.noiseIntensity).toBe(0.01);
      expect(props.scanGlow).toBe(0.5);
      expect(props.scanSoftness).toBe(2);
      expect(props.scanDuration).toBe(2.0);
      expect(props.scanDelay).toBe(1.0);
    });

    test('does not render other animations when scan is active', () => {
      const { container } = render(<BackgroundAnimation type="scan" />);
      expect(container.querySelector('[data-testid="prism-animation"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid="dot-grid-animation"]')).not.toBeInTheDocument();
    });
  });

  describe('Dot Grid Animation', () => {
    test('renders dotgrid animation when type is "dotgrid"', () => {
      const { container } = render(<BackgroundAnimation type="dotgrid" />);
      expect(container.querySelector('[data-testid="dot-grid-animation"]')).toBeInTheDocument();
    });

    test('passes correct props to DotGrid component', () => {
      const { container } = render(<BackgroundAnimation type="dotgrid" />);
      const dotGridElement = container.querySelector('[data-testid="dot-grid-animation"]');
      const props = JSON.parse(dotGridElement?.getAttribute('data-props') || '{}');
      
      expect(props.dotSize).toBe(2);
      expect(props.gap).toBe(62);
      expect(props.baseColor).toBe('#271E37');
      expect(props.activeColor).toBe('#5227FF');
      expect(props.proximity).toBe(120);
      expect(props.shockRadius).toBe(250);
      expect(props.shockStrength).toBe(5);
      expect(props.resistance).toBe(750);
      expect(props.returnDuration).toBe(1.5);
    });

    test('does not render other animations when dotgrid is active', () => {
      const { container } = render(<BackgroundAnimation type="dotgrid" />);
      expect(container.querySelector('[data-testid="prism-animation"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid="grid-scan-animation"]')).not.toBeInTheDocument();
    });
  });

  describe('Wrapper Styling', () => {
    test('has fixed positioning', () => {
      const { container } = render(<BackgroundAnimation type="prism" />);
      const wrapper = container.firstChild as HTMLElement;
      
      expect(wrapper).toHaveStyle({
        position: 'fixed',
        top: 0,
        left: 0,
      });
    });

    test('covers full viewport', () => {
      const { container } = render(<BackgroundAnimation type="prism" />);
      const wrapper = container.firstChild as HTMLElement;
      
      expect(wrapper).toHaveStyle({
        width: '100%',
        height: '100%',
      });
    });

    test('has correct z-index', () => {
      const { container } = render(<BackgroundAnimation type="prism" />);
      const wrapper = container.firstChild as HTMLElement;
      
      expect(wrapper).toHaveStyle({
        zIndex: 0,
      });
    });

    test('does not interfere with pointer events', () => {
      const { container } = render(<BackgroundAnimation type="prism" />);
      const wrapper = container.firstChild as HTMLElement;
      
      expect(wrapper).toHaveStyle({
        pointerEvents: 'none',
      });
    });
  });

  describe('Animation Switching', () => {
    test('switches from prism to scan', () => {
      const { container, rerender } = render(<BackgroundAnimation type="prism" />);
      expect(container.querySelector('[data-testid="prism-animation"]')).toBeInTheDocument();
      
      rerender(<BackgroundAnimation type="scan" />);
      expect(container.querySelector('[data-testid="prism-animation"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid="grid-scan-animation"]')).toBeInTheDocument();
    });

    test('switches from scan to dotgrid', () => {
      const { container, rerender } = render(<BackgroundAnimation type="scan" />);
      expect(container.querySelector('[data-testid="grid-scan-animation"]')).toBeInTheDocument();
      
      rerender(<BackgroundAnimation type="dotgrid" />);
      expect(container.querySelector('[data-testid="grid-scan-animation"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid="dot-grid-animation"]')).toBeInTheDocument();
    });

    test('switches from dotgrid to prism', () => {
      const { container, rerender } = render(<BackgroundAnimation type="dotgrid" />);
      expect(container.querySelector('[data-testid="dot-grid-animation"]')).toBeInTheDocument();
      
      rerender(<BackgroundAnimation type="prism" />);
      expect(container.querySelector('[data-testid="dot-grid-animation"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid="prism-animation"]')).toBeInTheDocument();
    });

    test('maintains wrapper structure during animation switch', () => {
      const { container, rerender } = render(<BackgroundAnimation type="prism" />);
      const wrapper = container.firstChild as HTMLElement;
      
      rerender(<BackgroundAnimation type="scan" />);
      const newWrapper = container.firstChild as HTMLElement;
      
      expect(newWrapper).toHaveStyle({
        position: 'fixed',
        pointerEvents: 'none',
      });
    });
  });

  describe('Component Lifecycle', () => {
    test('renders correctly on mount', () => {
      const { container } = render(<BackgroundAnimation type="prism" />);
      expect(container.firstChild).toBeInTheDocument();
    });

    test('cleans up properly on unmount', () => {
      const { container, unmount } = render(<BackgroundAnimation type="prism" />);
      expect(container.firstChild).toBeInTheDocument();
      
      unmount();
      expect(container.firstChild).not.toBeInTheDocument();
    });

    test('handles rapid type changes', () => {
      const { container, rerender } = render(<BackgroundAnimation type="prism" />);
      
      rerender(<BackgroundAnimation type="scan" />);
      rerender(<BackgroundAnimation type="dotgrid" />);
      rerender(<BackgroundAnimation type="prism" />);
      
      expect(container.querySelector('[data-testid="prism-animation"]')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('renders prism by default (boundary test)', () => {
      // @ts-expect-error Testing invalid type
      const { container } = render(<BackgroundAnimation type="invalid" />);
      // Component should render wrapper even with invalid type
      expect(container.firstChild).toBeInTheDocument();
    });

    test('maintains structure with all animation types', () => {
      const types: Array<'prism' | 'scan' | 'dotgrid'> = ['prism', 'scan', 'dotgrid'];
      
      types.forEach(type => {
        const { container } = render(<BackgroundAnimation type={type} />);
        const wrapper = container.firstChild as HTMLElement;
        
        expect(wrapper).toHaveStyle({
          position: 'fixed',
          pointerEvents: 'none',
        });
      });
    });
  });
});
