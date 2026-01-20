'use client';

import { Box, Typography, Card, CardContent, Chip, Radio } from '@mui/material';
import { ConstructionMode } from '@/lib/types';
import { useCallback } from 'react';

interface ConstructionModeToggleProps {
  value: ConstructionMode;
  onChange: (mode: ConstructionMode) => void;
  disabled?: boolean;
}

export function ConstructionModeToggle({ value, onChange, disabled = false }: ConstructionModeToggleProps) {
  // DEV instrumentation
  if (process.env.NODE_ENV === 'development') {
    console.log('[mode-toggle] render', { constructionMode: value, disabled });
  }

  const handleValidationClick = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[mode-toggle] click option1 (validation)', { disabled, currentValue: value });
    }
    if (!disabled) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[mode-toggle] calling onChange with "validation"');
      }
      onChange('validation');
    }
  }, [disabled, value, onChange]);

  const handleExtensionClick = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[mode-toggle] click option2 (extension)', { disabled, currentValue: value });
    }
    if (!disabled) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[mode-toggle] calling onChange with "extension"');
      }
      onChange('extension');
    }
  }, [disabled, value, onChange]);

  const handleValidationKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      handleValidationClick();
    }
  }, [disabled, handleValidationClick]);

  const handleExtensionKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      handleExtensionClick();
    }
  }, [disabled, handleExtensionClick]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
      <Card
        role="radio"
        aria-checked={value === 'validation'}
        tabIndex={disabled ? -1 : 0}
        onClick={handleValidationClick}
        onKeyDown={handleValidationKeyDown}
        sx={{
          flex: 1,
          width: '100%',
          cursor: disabled ? 'not-allowed' : 'pointer',
          border: '1px solid #e0e0e0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.2s ease',
          opacity: disabled ? 0.6 : 1,
          bgcolor: value === 'validation' ? 'white' : '#f5f5f5',
          outline: 'none',
          '&:hover': disabled ? {} : {
            borderColor: '#b0b0b0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          },
          '&:focus-visible': {
            outline: '2px solid #02b5e7',
            outlineOffset: '2px',
          },
        }}
      >
        <CardContent 
          sx={{ 
            p: 2.5, 
            '&:last-child': { pb: 2.5 },
            pointerEvents: 'auto', // Ensure CardContent doesn't block clicks
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Radio
              checked={value === 'validation'}
              sx={{ 
                p: 0, 
                color: '#9e9e9e',
                '&.Mui-checked': { color: '#424242' },
                '& .MuiSvgIcon-root': { fontSize: 24 },
                pointerEvents: 'none', // Let clicks pass through to Card
              }}
              disabled={disabled}
              tabIndex={-1} // Remove from tab order, Card handles it
            />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}>
                Validate anchor segment
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
                Best when you already know the audience you want.{'\n\n'}We start with a trusted base audience and check where other data partners agree.{'\n'}The more partners that confirm the same locations, the higher the confidence.
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card
        role="radio"
        aria-checked={value === 'extension'}
        tabIndex={disabled ? -1 : 0}
        onClick={handleExtensionClick}
        onKeyDown={handleExtensionKeyDown}
        sx={{
          flex: 1,
          width: '100%',
          cursor: disabled ? 'not-allowed' : 'pointer',
          border: '1px solid #e0e0e0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.2s ease',
          opacity: disabled ? 0.6 : 1,
          bgcolor: value === 'extension' ? 'white' : '#f5f5f5',
          outline: 'none',
          '&:hover': disabled ? {} : {
            borderColor: '#b0b0b0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          },
          '&:focus-visible': {
            outline: '2px solid #02b5e7',
            outlineOffset: '2px',
          },
        }}
      >
        <CardContent 
          sx={{ 
            p: 2.5, 
            '&:last-child': { pb: 2.5 },
            pointerEvents: 'auto', // Ensure CardContent doesn't block clicks
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Radio
              checked={value === 'extension'}
              sx={{ 
                p: 0, 
                color: '#9e9e9e',
                '&.Mui-checked': { color: '#424242' },
                '& .MuiSvgIcon-root': { fontSize: 24 },
                pointerEvents: 'none', // Let clicks pass through to Card
              }}
              disabled={disabled}
              tabIndex={-1} // Remove from tab order, Card handles it
            />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}>
                Expand to similar segments
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
                Best when you want more reach.{'\n\n'}We start with your core audience and extend it using related signals from other data partners.{'\n'}This helps uncover additional areas that look similar, even if they aren&apos;t labelled the same.
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
