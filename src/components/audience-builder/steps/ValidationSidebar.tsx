'use client';

import React, { memo, useState } from 'react';
import { Box, Card, CardContent, Typography, Button, Slider, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Avatar, Switch, FormControlLabel, Accordion, AccordionSummary, AccordionDetails, Divider } from '@mui/material';
import { ExpandMore, CheckCircle } from '@mui/icons-material';
import { ConstructionMode } from '@/lib/types';
import { ValidationResults } from '@/features/audience-builder/api/validationResults';
import { BattlegroundDialog } from './BattlegroundDialog';
import { PoiFiltersDialog } from './PoiFiltersDialog';
import { CustomLayerDialog } from './CustomLayerDialog';
import { getProviderFavicon } from '../providers/providerIcons';

function ProviderAvatar({ provider, logoUrl }: { provider: string; logoUrl?: string | null }) {
  const iconUrl = getProviderFavicon(provider, logoUrl);
  return (
    <Avatar
      src={iconUrl}
      sx={{ width: 22, height: 22, fontSize: '0.7rem', bgcolor: '#e0e0e0' }}
    >
      {provider.charAt(0)}
    </Avatar>
  );
}

interface ValidationSidebarProps {
  constructionMode: ConstructionMode;
  sliderDraft: number;
  sliderApplied: number;
  maxSliderValue: number;
  validatingProvidersCount: number;
  validationLoading: boolean;
  onSliderChange: (event: Event | React.SyntheticEvent, value: number | number[]) => void;
  onSliderChangeCommitted: (event: Event | React.SyntheticEvent, value: number | number[]) => void;
  audienceSize: number;
  districtsIncluded: number;
  validationResults: ValidationResults | undefined;
  onViewProviders: () => void;
  // Extension mode props
  suggestedSegments?: any[];
  includedSegments?: any[];
  onToggleSegment?: (segmentId: string, isSelected: boolean) => Promise<void>;
  expandedExplain?: string | null;
  onToggleExplain?: (segmentId: string | null) => void;
  // DEV verification props
  geoDistrictsCount?: number;
  includedDistrictIds?: string[];
  // POI and Battleground props
  selectedPoiTypes?: string[];
  onPoiTypeToggle?: (poiType: string) => void;
  onBattlegroundClick?: () => void;
}

/**
 * Memoized sidebar component
 * Does not receive districtGeoJson or huge objects
 */
export const ValidationSidebar = memo(function ValidationSidebar({
  constructionMode,
  sliderDraft,
  sliderApplied,
  maxSliderValue,
  validatingProvidersCount,
  validationLoading,
  onSliderChange,
  onSliderChangeCommitted,
  audienceSize,
  districtsIncluded,
  validationResults,
  onViewProviders,
  suggestedSegments = [],
  includedSegments = [],
  onToggleSegment,
  expandedExplain,
  onToggleExplain,
  geoDistrictsCount,
  includedDistrictIds = [],
  selectedPoiTypes = [],
  onPoiTypeToggle,
  onBattlegroundClick,
}: ValidationSidebarProps) {
  const [battlegroundDialogOpen, setBattlegroundDialogOpen] = useState(false);
  const [poiFiltersDialogOpen, setPoiFiltersDialogOpen] = useState(false);
  const [customLayerDialogOpen, setCustomLayerDialogOpen] = useState(false);

  const handleBattlegroundClick = () => {
    setBattlegroundDialogOpen(true);
    // Also call the external handler if provided (for future use)
    if (onBattlegroundClick) {
      onBattlegroundClick();
    }
  };

  const handleBattlegroundApply = (config: any) => {
    // TODO: Apply battleground logic
    console.log('Battleground config applied:', config);
    setBattlegroundDialogOpen(false);
  };

  const handlePoiFiltersApply = (selectedTypes: string[]) => {
    // Update parent state through the toggle handler
    // First, clear all current selections
    selectedPoiTypes.forEach((type) => {
      if (!selectedTypes.includes(type)) {
        onPoiTypeToggle?.(type);
      }
    });
    // Then, add new selections
    selectedTypes.forEach((type) => {
      if (!selectedPoiTypes.includes(type)) {
        onPoiTypeToggle?.(type);
      }
    });
  };

  return (
    <Card sx={{ 
      width: '100%',
      height: '100%',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      bgcolor: 'white',
      borderRadius: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden', // Prevent card from growing
    }}>
      <Box sx={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', minHeight: 0 }}>
        <CardContent sx={{ p: 2 }}>

          {constructionMode === 'validation' ? (
            /* Validation mode controls */
            <Box>
              {/* Live metrics with slider */}
              <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f9f9f9', borderRadius: 1, border: '1px solid white' }}>
                {/* Slider at top */}
                <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 500 }}>
                      Validation strictness
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                      {sliderDraft} of {validatingProvidersCount || maxSliderValue} providers
                    </Typography>
                  </Box>
                  <Slider
                    value={sliderDraft}
                    onChange={onSliderChange}
                    onChangeCommitted={onSliderChangeCommitted}
                    min={1}
                    max={Math.max(1, maxSliderValue)}
                    marks={false}
                    step={1}
                    disabled={maxSliderValue <= 1 || validatingProvidersCount < 1 || validationLoading}
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
                        '&.Mui-focusVisible': {
                          boxShadow: '0 2px 8px rgba(2, 181, 231, 0.4)',
                        },
                        '&.Mui-active': {
                          boxShadow: '0 2px 8px rgba(2, 181, 231, 0.4)',
                        },
                      },
                    }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                      Bigger audience
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                      Higher confidence
                    </Typography>
                  </Box>
                </Box>
                
                {/* Metrics below slider */}
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.2, mb: 0.25 }}>
                      {audienceSize.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                      Estimated audience size
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.2, mb: 0.25 }}>
                      {districtsIncluded}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                      Postcode districts
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          ) : (
            /* Extension mode controls */
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, fontSize: '0.875rem' }}>
                Suggested adjacent segments
              </Typography>
              
              {suggestedSegments.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2, maxHeight: 400, overflowY: 'auto' }}>
                  {suggestedSegments.map((segment) => {
                    const evidence = segment.evidence as any;
                    return (
                      <Card key={segment.id} sx={{ p: 1.5, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                              <Chip
                                label="Inferred"
                                size="small"
                                sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f3e5f5', color: '#7b1fa2' }}
                              />
                              {segment.is_recommended && (
                                <Chip
                                  label="Recommended"
                                  size="small"
                                  sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#e8f5e9', color: '#2e7d32' }}
                                />
                              )}
                              <ProviderAvatar provider={segment.provider} />
                              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                                {segment.segment_label}
                              </Typography>
                            </Box>
                            {segment.description && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', display: 'block', mb: 1 }}>
                                {segment.description}
                              </Typography>
                            )}
                            <Accordion
                              expanded={expandedExplain === segment.id}
                              onChange={() => onToggleExplain?.(expandedExplain === segment.id ? null : segment.id)}
                              sx={{ boxShadow: 'none', '&:before': { display: 'none' } }}
                            >
                              <AccordionSummary expandIcon={<ExpandMore sx={{ fontSize: '1rem' }} />}>
                                <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                                  Why suggested?
                                </Typography>
                              </AccordionSummary>
                              <AccordionDetails>
                                <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                                  {evidence?.why_suggested || 'Related to your anchor segment based on behavioral adjacency.'}
                                </Typography>
                              </AccordionDetails>
                            </Accordion>
                          </Box>
                          <Box sx={{ ml: 1 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={segment.is_selected}
                                  onChange={(e) => onToggleSegment?.(segment.id, e.target.checked)}
                                  size="small"
                                />
                              }
                              label={segment.is_selected ? 'Included' : 'Excluded'}
                              sx={{
                                '& .MuiFormControlLabel-label': {
                                  fontSize: '0.75rem',
                                  ml: 0.5,
                                },
                              }}
                            />
                          </Box>
                        </Box>
                      </Card>
                    );
                  })}
                </Box>
              ) : (
                <Box sx={{ p: 2, bgcolor: '#f9f9f9', borderRadius: 1, mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                    No suggested segments found. Click "Build audience" in Step 1 to generate suggestions.
                  </Typography>
                </Box>
              )}

              {/* Included segments mini list */}
              {includedSegments.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, display: 'block', mb: 1 }}>
                    Included segments ({includedSegments.length})
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 150, overflowY: 'auto' }}>
                    {includedSegments.map((segment) => (
                      <Box key={segment.id} sx={{ p: 1, bgcolor: '#f9f9f9', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <ProviderAvatar provider={segment.provider} />
                        <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                          {segment.segment_label}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Basic metrics */}
              <Box sx={{ p: 1.5, bgcolor: '#f9f9f9', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                  Included segments
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                  {includedSegments.length}
                </Typography>
              </Box>
            </Box>
          )}

          {/* POI Filters Section */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1.5 }}>
              POI Filters
            </Typography>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => setPoiFiltersDialogOpen(true)}
              sx={{
                borderColor: '#02b5e7',
                color: '#02b5e7',
                textTransform: 'none',
                fontSize: '0.875rem',
                fontWeight: 500,
                '&:hover': {
                  borderColor: '#02a0d0',
                  bgcolor: 'rgba(2, 181, 231, 0.08)',
                },
              }}
            >
              Select POI Types
              {selectedPoiTypes.length > 0 && (
                <Chip
                  label={selectedPoiTypes.length}
                  size="small"
                  sx={{
                    ml: 1,
                    height: 20,
                    fontSize: '0.7rem',
                    bgcolor: '#02b5e7',
                    color: 'white',
                  }}
                />
              )}
            </Button>
          </Box>

          {/* Battleground Section */}
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e0e0e0' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1.5 }}>
              Battleground
            </Typography>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleBattlegroundClick}
              sx={{
                borderColor: '#02b5e7',
                color: '#02b5e7',
                textTransform: 'none',
                fontSize: '0.875rem',
                fontWeight: 500,
                mb: 1.5,
                '&:hover': {
                  borderColor: '#02a0d0',
                  bgcolor: 'rgba(2, 181, 231, 0.08)',
                },
              }}
            >
              Define Battleground Zones
            </Button>
          </Box>

          {/* Custom Layer Section */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1.5 }}>
              Custom Layers
            </Typography>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => setCustomLayerDialogOpen(true)}
              sx={{
                borderColor: '#02b5e7',
                color: '#02b5e7',
                textTransform: 'none',
                fontSize: '0.875rem',
                fontWeight: 500,
                '&:hover': {
                  borderColor: '#02a0d0',
                  bgcolor: 'rgba(2, 181, 231, 0.08)',
                },
              }}
            >
              Add Custom Layer
            </Button>
          </Box>
        </CardContent>
      </Box>

      {/* Battleground Dialog */}
      <BattlegroundDialog
        open={battlegroundDialogOpen}
        onClose={() => setBattlegroundDialogOpen(false)}
        onApply={handleBattlegroundApply}
      />

      {/* POI Filters Dialog */}
      <PoiFiltersDialog
        open={poiFiltersDialogOpen}
        onClose={() => setPoiFiltersDialogOpen(false)}
        onApply={handlePoiFiltersApply}
        selectedTypes={selectedPoiTypes}
      />

      {/* Custom Layer Dialog */}
      <CustomLayerDialog
        open={customLayerDialogOpen}
        onClose={() => setCustomLayerDialogOpen(false)}
        onApply={(file, layerName) => {
          // TODO: Handle custom layer upload
          console.log('Custom layer added:', { layerName, fileName: file.name });
          setCustomLayerDialogOpen(false);
        }}
      />
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if these props change
  return (
    prevProps.constructionMode === nextProps.constructionMode &&
    prevProps.sliderDraft === nextProps.sliderDraft &&
    prevProps.sliderApplied === nextProps.sliderApplied &&
    prevProps.maxSliderValue === nextProps.maxSliderValue &&
    prevProps.validatingProvidersCount === nextProps.validatingProvidersCount &&
    prevProps.validationLoading === nextProps.validationLoading &&
    prevProps.audienceSize === nextProps.audienceSize &&
    prevProps.districtsIncluded === nextProps.districtsIncluded &&
    prevProps.validationResults === nextProps.validationResults &&
    prevProps.suggestedSegments?.length === nextProps.suggestedSegments?.length &&
    prevProps.includedSegments?.length === nextProps.includedSegments?.length &&
    prevProps.expandedExplain === nextProps.expandedExplain &&
    prevProps.selectedPoiTypes?.join(',') === nextProps.selectedPoiTypes?.join(',')
  );
});
