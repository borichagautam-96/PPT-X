import React from 'react';
import type { FooterConfig } from '@/core/schema';
import { resolveFooter } from '@/core/footer-defaults';

interface PESFooterProps {
  slideIndex: number;
  totalSlides: number;
  systemName?: string;
  baseHeight?: number;
  footer?: FooterConfig;
}

export default function PESFooter({ slideIndex, totalSlides, systemName = 'Name of System', baseHeight = 900, footer }: PESFooterProps) {
  const slideNum = slideIndex + 1;
  const { deliverableText, orgLine, copyrightText, logoUrl } = resolveFooter(footer);

  // Calculate fixed pixel heights based on the original 16:9 aspect ratio
  const blueBarH = baseHeight * 0.07876;
  const grayBarH = baseHeight * 0.03097;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: `${blueBarH + grayBarH}px`,
        pointerEvents: 'none',
        zIndex: 50,
        overflow: 'hidden',
        fontFamily: '"Trebuchet MS", Arial, sans-serif',
      }}
    >
      {/* Blue Footer Bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: '100%',
          height: `${blueBarH}px`,
          backgroundColor: '#003F72',
        }}
      />

      {/* Gray Footer Bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: `${blueBarH}px`,
          width: '100%',
          height: `${grayBarH}px`,
          backgroundColor: '#BFBFBF',
        }}
      />

      {/* Left Footer Text */}
      <div
        style={{
          position: 'absolute',
          left: '2.160%',
          bottom: `${blueBarH + (grayBarH - baseHeight * 0.02855) / 2}px`,
          width: '37.651%',
          height: `${baseHeight * 0.02855}px`,
          display: 'flex',
          alignItems: 'center',
          fontSize: '10.6px', // ~8pt
          color: '#000000',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <span>
          {deliverableText} |{' '}
          {systemName === 'Name of System' || systemName === 'Untitled Presentation' ? (
            <>
              <span style={{ color: '#FF0000' }}>{'<'}</span>{systemName}<span style={{ color: '#FF0000' }}>{'>'}</span>
            </>
          ) : (
            systemName
          )}
        </span>
      </div>

      {/* Page Number */}
      <div
        style={{
          position: 'absolute',
          left: '87.839%',
          bottom: `${blueBarH + (grayBarH - baseHeight * 0.03097) / 2}px`,
          width: '10.000%',
          height: `${baseHeight * 0.03097}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          fontSize: '10.6px', // ~8pt
          color: '#000000',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        {slideNum} of {totalSlides}
      </div>

      {/* L&T Logo */}
      <div
        style={{
          position: 'absolute',
          left: '69.691%',
          bottom: `${(blueBarH - baseHeight * 0.07876) / 2}px`,
          width: '28.149%',
          height: `${baseHeight * 0.07876}px`,
          backgroundImage: `url(${logoUrl})`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Aerospace Text */}
      <div
        style={{
          position: 'absolute',
          left: '2.637%',
          bottom: `${(blueBarH - baseHeight * 0.03814) / 2}px`,
          width: '34.369%',
          height: `${baseHeight * 0.03814}px`,
          display: 'flex',
          alignItems: 'center',
          fontSize: '14.6px', // ~11pt
          color: '#D9D9D9',
        }}
      >
        {orgLine}
      </div>

      {/* Copyright Text */}
      <div
        style={{
          position: 'absolute',
          left: '33.810%',
          bottom: `${(blueBarH - baseHeight * 0.03814) / 2}px`,
          width: '31.893%',
          height: `${baseHeight * 0.03814}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14.6px', // ~11pt
          color: '#D9D9D9',
        }}
      >
        {copyrightText}
      </div>
    </div>
  );
}
