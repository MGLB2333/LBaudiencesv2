'use client';

import { Box, Typography, Avatar } from '@mui/material';
import { useMemo, useState } from 'react';

interface DonutChartProps {
  providers: Array<{
    provider: string;
    providerLabel: string;
    percentContributed: number;
    iconUrl?: string;
  }>;
  size?: number;
}

// Color palette centered around #3bc8ea
const COLOR_PALETTE = [
  '#3bc8ea', // Base lightbox blue
  '#5dd4f0', // Lighter
  '#1bb4d6', // Darker
  '#7de0f5', // Very light
  '#0a9fc4', // Very dark
  '#9de8f8', // Lightest
  '#0088a8', // Darkest
];

export function DonutChart({ providers, size = 160 }: DonutChartProps) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  
  const chartData = useMemo(() => {
    if (providers.length === 0) return [];
    
    // Normalize percentages to sum to 100
    const total = providers.reduce((sum, p) => sum + p.percentContributed, 0);
    const normalized = providers.map(p => ({
      ...p,
      normalizedPercent: total > 0 ? (p.percentContributed / total) * 100 : 0,
    }));

    // Calculate angles
    let currentAngle = -90; // Start at top
    return normalized.map((provider, index) => {
      const angle = (provider.normalizedPercent / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      return {
        ...provider,
        startAngle,
        endAngle,
        color: COLOR_PALETTE[index % COLOR_PALETTE.length],
      };
    });
  }, [providers]);

  const radius = size / 2 - 10;
  const innerRadius = radius * 0.6;
  const centerX = size / 2;
  const centerY = size / 2;

  const createArcPath = (startAngle: number, endAngle: number) => {
    const start = (startAngle * Math.PI) / 180;
    const end = (endAngle * Math.PI) / 180;
    
    const x1 = centerX + radius * Math.cos(start);
    const y1 = centerY + radius * Math.sin(start);
    const x2 = centerX + radius * Math.cos(end);
    const y2 = centerY + radius * Math.sin(end);
    
    const x3 = centerX + innerRadius * Math.cos(end);
    const y3 = centerY + innerRadius * Math.sin(end);
    const x4 = centerX + innerRadius * Math.cos(start);
    const y4 = centerY + innerRadius * Math.sin(start);
    
    const largeArc = end - start > Math.PI ? 1 : 0;
    
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  };

  if (chartData.length === 0) {
    return (
      <Box sx={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
          No data
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
      {/* Chart */}
      <Box sx={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size}>
          {chartData.map((segment, index) => {
            const isHovered = hoveredSegment === segment.provider;
            return (
              <g key={segment.provider}>
                <path
                  d={createArcPath(segment.startAngle, segment.endAngle)}
                  fill={segment.color}
                  stroke="white"
                  strokeWidth={isHovered ? 3 : 2}
                  opacity={isHovered ? 1 : 0.9}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredSegment(segment.provider)}
                  onMouseLeave={() => setHoveredSegment(null)}
                />
              </g>
            );
          })}
        </svg>
        {/* Tooltip overlay */}
        {hoveredSegment && (
          <Box
            sx={{
              position: 'absolute',
              top: -30,
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
              zIndex: 1000,
              pointerEvents: 'none',
            }}
          >
            {(() => {
              const segment = chartData.find(s => s.provider === hoveredSegment);
              return segment ? `${segment.providerLabel}: ${segment.normalizedPercent.toFixed(1)}%` : '';
            })()}
          </Box>
        )}
      </Box>
      
      {/* Legend - positioned to the right */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 180 }}>
        {chartData.map((segment, index) => {
          const isHovered = hoveredSegment === segment.provider;
          return (
            <Box
              key={segment.provider}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 0.75,
                borderRadius: 1,
                bgcolor: isHovered ? '#f5f5f5' : 'transparent',
                transition: 'background-color 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={() => setHoveredSegment(segment.provider)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: segment.color,
                  flexShrink: 0,
                  border: isHovered ? '2px solid #3bc8ea' : 'none',
                }}
              />
              <Avatar
                src={segment.iconUrl}
                sx={{ width: 20, height: 20, fontSize: '0.65rem', bgcolor: '#e0e0e0' }}
              >
                {segment.provider.charAt(0)}
              </Avatar>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.7rem',
                  flex: 1,
                  fontWeight: isHovered ? 600 : 400,
                }}
              >
                {segment.providerLabel}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  minWidth: 40,
                  textAlign: 'right',
                  color: isHovered ? '#3bc8ea' : 'inherit',
                }}
              >
                {segment.normalizedPercent.toFixed(1)}%
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
