'use client';

import React from 'react';
import { Box, Card, Typography, Slider, Chip, Divider } from '@mui/material';
import { TvRegionFilter } from './TvRegionFilter';

interface ValidationCoreProps {
  mode: 'validation';
  // Metrics
  audienceSize: number;
  districtsIncluded: number;
  // Slider
  sliderDraft: number;
  sliderApplied: number;
  maxSliderValue: number;
  validatingProvidersCount: number;
  validationLoading: boolean;
  onSliderChange: (event: Event | React.SyntheticEvent, value: number | number[]) => void;
  onSliderChangeCommitted: (event: Event | React.SyntheticEvent, value: number | number[]) => void;
  // TV Regions
  selectedTvRegions?: string[];
  onTvRegionsChange?: (regions: string[]) => void;
  tvRegionDistrictsCount?: number;
  finalEligibleCount?: number;
}

interface ExtensionCoreProps {
  mode: 'extension';
  // Metrics
  districtsIncluded: number;
  estimatedHouseholds: number;
  avgConfidence: number;
  // Slider
  confidenceThresholdDraft: number;
  onConfidenceThresholdChange: (value: number) => void;
  onConfidenceThresholdCommit: (value: number) => void;
  // TV Regions
  selectedTvRegions?: string[];
  onTvRegionsChange?: (regions: string[]) => void;
  tvRegionDistrictsCount?: number;
  finalEligibleCount?: number;
}

type MapCorePanelProps = ValidationCoreProps | ExtensionCoreProps;

export function MapCorePanel(props: MapCorePanelProps) {
  const confidenceBand = props.mode === 'extension' 
    ? props.avgConfidence >= 0.7 ? 'High' : props.avgConfidence >= 0.5 ? 'Med' : 'Low'
    : null;

  return (
    <Card
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        bgcolor: 'white',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        mb: 2,
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      }}
    >
      <Box sx={{ p: 2 }}>
        {/* Core Slider */}
        {props.mode === 'validation' ? (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 500 }}>
                Validation strictness
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                {props.sliderDraft} of {props.validatingProvidersCount || props.maxSliderValue} providers
              </Typography>
            </Box>
            <Box sx={{ px: 1 }}>
              <Slider
                value={props.sliderDraft}
                onChange={props.onSliderChange}
                onChangeCommitted={props.onSliderChangeCommitted}
                min={1}
                max={Math.max(1, props.maxSliderValue)}
                step={1}
                disabled={props.maxSliderValue <= 1 || props.validatingProvidersCount < 1 || props.validationLoading}
                marks={Array.from({ length: props.maxSliderValue }, (_, i) => ({
                  value: i + 1,
                  label: (i + 1).toString(),
                }))}
                sx={{
                  color: '#02b5e7',
                  height: 6,
                  '& .MuiSlider-track': {
                    height: 6,
                    borderRadius: 3,
                    border: 'none',
                    bgcolor: '#02b5e7',
                  },
                  '& .MuiSlider-rail': {
                    height: 6,
                    borderRadius: 3,
                    bgcolor: 'rgba(2, 181, 231, 0.2)',
                    opacity: 1,
                  },
                  '& .MuiSlider-thumb': {
                    width: 20,
                    height: 20,
                    bgcolor: '#02b5e7',
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    '&:hover': {
                      boxShadow: '0 2px 8px rgba(2, 181, 231, 0.4)',
                    },
                  },
                  '& .MuiSlider-mark': {
                    bgcolor: 'rgba(0, 0, 0, 0.3)',
                    width: 2,
                    height: 8,
                    borderRadius: 1,
                  },
                  '& .MuiSlider-markLabel': {
                    fontSize: '0.65rem',
                    color: 'text.secondary',
                    mt: 0.5,
                  },
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                Bigger audience
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                Higher confidence
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}>
              Signal Threshold
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 1, display: 'block' }}>
              Adjust how similar related segments need to be to your anchor audience
            </Typography>
            <Box sx={{ px: 1 }}>
              <Slider
                value={props.confidenceThresholdDraft}
                onChange={(_, value) => props.onConfidenceThresholdChange(value as number)}
                onChangeCommitted={(_, value) => props.onConfidenceThresholdCommit(value as number)}
                min={0.3}
                max={0.8}
                step={0.1}
                marks={[
                  { value: 0.3, label: '0.3' },
                  { value: 0.4, label: '0.4' },
                  { value: 0.5, label: '0.5' },
                  { value: 0.6, label: '0.6' },
                  { value: 0.7, label: '0.7' },
                  { value: 0.8, label: '0.8' },
                ]}
                sx={{
                  color: '#02b5e7',
                  height: 6,
                  '& .MuiSlider-track': {
                    height: 6,
                    borderRadius: 3,
                    border: 'none',
                    bgcolor: '#02b5e7',
                  },
                  '& .MuiSlider-rail': {
                    height: 6,
                    borderRadius: 3,
                    bgcolor: 'rgba(2, 181, 231, 0.2)',
                    opacity: 1,
                  },
                  '& .MuiSlider-thumb': {
                    width: 20,
                    height: 20,
                    bgcolor: '#02b5e7',
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  },
                  '& .MuiSlider-mark': {
                    bgcolor: 'rgba(0, 0, 0, 0.3)',
                    width: 2,
                    height: 8,
                    borderRadius: 1,
                  },
                  '& .MuiSlider-markLabel': {
                    fontSize: '0.65rem',
                    color: 'text.secondary',
                    mt: 0.5,
                  },
                }}
              />
            </Box>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Metrics */}
        {props.mode === 'validation' ? (
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.2, mb: 0.25 }}>
                {props.audienceSize.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                Estimated audience size
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.2, mb: 0.25 }}>
                {props.districtsIncluded}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                Postcode districts
              </Typography>
            </Box>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.2, mb: 0.25 }}>
                  {props.districtsIncluded}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Districts included
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.2, mb: 0.25 }}>
                  {props.estimatedHouseholds.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Estimated households
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Avg confidence:
              </Typography>
              <Chip
                label={confidenceBand}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  bgcolor:
                    confidenceBand === 'High'
                      ? '#e8f5e9'
                      : confidenceBand === 'Med'
                      ? '#fff3e0'
                      : '#ffebee',
                  color:
                    confidenceBand === 'High'
                      ? '#2e7d32'
                      : confidenceBand === 'Med'
                      ? '#e65100'
                      : '#c62828',
                }}
              />
            </Box>
          </>
        )}
      </Box>
    </Card>
  );
}
