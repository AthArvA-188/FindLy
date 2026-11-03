import React from 'react';
import Prism from './Prism';
import GridScan from './GridScan';
import DotGrid from './DotGrid';

interface BackgroundAnimationProps {
  type: 'prism' | 'scan' | 'dotgrid';
}

const BackgroundAnimation: React.FC<BackgroundAnimationProps> = ({ type }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 0,
      pointerEvents: 'none'
    }}>
      {type === 'prism' && (
        <Prism
          animationType="rotate"
          timeScale={0.5}
          height={3.5}
          baseWidth={5.5}
          scale={3.6}
          hueShift={0.7}
          colorFrequency={0.3}
          noise={0.1}
          glow={0.1}
          transparent={true}
        />
      )}
      
      {type === 'scan' && (
        <GridScan
          sensitivity={0.55}
          lineThickness={1}
          linesColor="#271E37"
          gridScale={0.1}
          scanColor="#8B7AA8"
          scanOpacity={0.6}
          enablePost={true}
          bloomIntensity={0.4}
          chromaticAberration={0.002}
          noiseIntensity={0.01}
          scanGlow={0.5}
          scanSoftness={2}
          scanDuration={2.0}
          scanDelay={1.0}
        />
      )}
      
      {type === 'dotgrid' && (
        <DotGrid
          dotSize={2}
          gap={62}
          baseColor="#271E37"
          activeColor="#5227FF"
          proximity={120}
          shockRadius={250}
          shockStrength={5}
          resistance={750}
          returnDuration={1.5}
        />
      )}
    </div>
  );
};

export default BackgroundAnimation;
