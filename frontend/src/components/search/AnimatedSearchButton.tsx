import { useEffect, useRef } from 'react';
import { Renderer, Triangle, Program, Mesh } from 'ogl';
import './AnimatedSearchButton.css';

interface AnimatedSearchButtonProps {
  isSearching: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const AnimatedSearchButton: React.FC<AnimatedSearchButtonProps> = ({
  isSearching,
  onClick,
  disabled = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const rendererRef = useRef<Renderer | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const renderer = new Renderer({
      dpr,
      alpha: true,
      antialias: false
    });
    const gl = renderer.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);

    Object.assign(gl.canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      display: 'block',
      pointerEvents: 'none'
    });
    container.appendChild(gl.canvas);

    rendererRef.current = renderer;
    glRef.current = gl;

    const vertex = /* glsl */ `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragment = /* glsl */ `
      precision highp float;

      uniform vec2  iResolution;
      uniform float iTime;
      uniform float uIntensity;
      uniform float uRotationSpeed;
      uniform float uGlow;

      vec4 tanh4(vec4 x){
        vec4 e2x = exp(2.0*x);
        return (e2x - 1.0) / (e2x + 1.0);
      }

      void main(){
        vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
        
        float dist = length(uv);
        float angle = atan(uv.y, uv.x);
        
        float t = iTime * uRotationSpeed;
        
        // Single ring at the edge of the button
        float ringDist = 0.35; // Distance from center for the ring (reduced to avoid clipping)
        float ringWidth = 0.08; // Width of the ring
        float ring = smoothstep(ringDist - ringWidth, ringDist - ringWidth * 0.5, dist) - 
                     smoothstep(ringDist + ringWidth * 0.5, ringDist + ringWidth, dist);
        
        // Create 3 rotating points on the ring (120 degrees apart)
        float point1Angle = t * 2.0;
        float point2Angle = t * 2.0 + 2.094; // 120 degrees in radians
        float point3Angle = t * 2.0 + 4.189; // 240 degrees in radians
        
        // Calculate distance from current angle to each point
        float angleDiff1 = abs(mod(angle - point1Angle + 3.14159, 6.28318) - 3.14159);
        float angleDiff2 = abs(mod(angle - point2Angle + 3.14159, 6.28318) - 3.14159);
        float angleDiff3 = abs(mod(angle - point3Angle + 3.14159, 6.28318) - 3.14159);
        
        // Create bright spots at the three points
        float spotSize = 0.4;
        float spot1 = smoothstep(spotSize, 0.0, angleDiff1);
        float spot2 = smoothstep(spotSize, 0.0, angleDiff2);
        float spot3 = smoothstep(spotSize, 0.0, angleDiff3);
        float spots = spot1 + spot2 + spot3;
        
        // Pulsing effect
        float pulse = sin(t * 3.0) * 0.3 + 0.7;
        
        // Combine ring and spots
        float combinedIntensity = ring * spots * pulse * uIntensity;
        
        // Purple/pink color
        vec3 color = vec3(0.85, 0.70, 1.0);
        
        // Add extra glow to the bright spots
        color += vec3(0.3, 0.2, 0.4) * spots * pulse;
        
        vec4 col = vec4(color * combinedIntensity * uGlow, combinedIntensity * 0.9);
        
        gl_FragColor = col;
      }
    `;

    const geometry = new Triangle(gl);
    const iResBuf = new Float32Array(2);

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iResolution: { value: iResBuf },
        iTime: { value: 0 },
        uIntensity: { value: 0 },
        uRotationSpeed: { value: 1.2 },
        uGlow: { value: 6.5 }
      }
    });
    const mesh = new Mesh(gl, { geometry, program });
    meshRef.current = mesh;

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h);
      iResBuf[0] = gl.drawingBufferWidth;
      iResBuf[1] = gl.drawingBufferHeight;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const t0 = performance.now();
    let targetIntensity = 0;

    const render = (t: number) => {
      const time = (t - t0) * 0.001;
      program.uniforms.iTime.value = time;

      // Smoothly interpolate intensity
      const currentIntensity = program.uniforms.uIntensity.value as number;
      const newIntensity = currentIntensity + (targetIntensity - currentIntensity) * 0.15;
      program.uniforms.uIntensity.value = newIntensity;

      renderer.render({ scene: mesh });
      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    // Store target intensity setter
    (container as any).__setTargetIntensity = (val: number) => {
      targetIntensity = val;
    };

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      if (gl.canvas.parentElement === container) container.removeChild(gl.canvas);
      rendererRef.current = null;
      meshRef.current = null;
      glRef.current = null;
    };
  }, []);

  // Update animation intensity based on searching state
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const setIntensity = (container as any).__setTargetIntensity;
    if (setIntensity) {
      setIntensity(isSearching ? 1.0 : 0.0);
    }
  }, [isSearching]);

  return (
    <button
      className={`animated-search-button ${isSearching ? 'searching' : ''}`}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      <div className="animation-container" ref={containerRef} />
      <img 
        src="/Findly Logo 2 white.png" 
        alt="Search" 
        className="search-logo"
      />
    </button>
  );
};

export default AnimatedSearchButton;
