'use client';

import React, { memo, useState } from 'react';
import { Box, Card, CardContent, Typography, Button, Chip, Avatar, Switch, FormControlLabel, Accordion, AccordionSummary, AccordionDetails, ToggleButtonGroup, ToggleButton, Slider } from '@mui/material';
import { ExpandMore, Store, LocationOn, GpsFixed } from '@mui/icons-material';
import { ConstructionMode } from '@/lib/types';
import { ValidationResults } from '@/features/audience-builder/api/validationResults';
import { MapCorePanel } from './MapCorePanel';
import { MapToolCard } from './MapToolCard';
import { getProviderFavicon } from '../providers/providerIcons';
import { useBuilderContext } from '../BuilderContext';

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
  // TV region filter props
  selectedTvRegions?: string[];
  onTvRegionsChange?: (regions: string[]) => void;
  tvRegionDistrictsCount?: number;
  finalEligibleCount?: number;
  // Store POI props
  selectedPoiIds?: string[];
  onPoiIdsChange?: (poiIds: string[]) => void;
  selectedPoiBrands?: string[];
  onPoiBrandsChange?: (brands: string[]) => void;
  // Tool drawer props
  activeTool?: 'stores' | 'locations' | 'battleZones' | null;
  onToolClick?: (tool: 'stores' | 'locations' | 'battleZones' | null) => void;
  // Overlay mode props
  overlayMode?: 'district' | 'hex';
  onOverlayModeChange?: (mode: 'district' | 'hex') => void;
  hexResolution?: number;
  onHexResolutionChange?: (resolution: number) => void;
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
  selectedTvRegions = [],
  onTvRegionsChange,
  tvRegionDistrictsCount,
  finalEligibleCount,
  selectedPoiIds = [],
  onPoiIdsChange,
  selectedPoiBrands = [],
  onPoiBrandsChange,
  activeTool = null,
  onToolClick,
  overlayMode = 'hex',
  onOverlayModeChange,
  hexResolution = 5,
  onHexResolutionChange,
}: ValidationSidebarProps) {
  const {
    state: {
      battleZonesEnabled,
      battleZoneBaseBrand,
      battleZoneCompetitorBrands,
      battleZoneRings,
      tvRegions,
    },
    setBattleZonesEnabled,
    setBattleZoneBaseBrand,
    setBattleZoneCompetitorBrands,
    setBattleZoneRings,
  } = useBuilderContext();

  const [battleZoneRingsDraft, setBattleZoneRingsDraft] = useState(battleZoneRings);


  const handleToolClick = (tool: 'stores' | 'locations' | 'battleZones') => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ValidationSidebar] handleToolClick', { tool, currentActiveTool: activeTool });
    }
    if (onToolClick) {
      onToolClick(activeTool === tool ? null : tool);
    }
  };

  // Count selected stores/brands for tool card subtitle and badge
  const storesCount = (selectedPoiIds?.length || 0) + (selectedPoiBrands?.length || 0);
  const storesSubtitle = storesCount > 0 ? `${storesCount} selected` : 'Select stores to display';
  
  // Count for locations badge (TV regions selected)
  const locationsCount = selectedTvRegions?.length || 0;
  
  // Count for battle zones badge (1 if enabled, 0 if not)
  const battleZonesCount = battleZonesEnabled ? 1 : 0;

  return (
    <>
      <Card sx={{ 
        width: '100%',
        height: '100%',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        bgcolor: 'white',
        borderRadius: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <Box sx={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', minHeight: 0 }}>
          <CardContent sx={{ p: 2 }}>
            {/* Core Panel - Sticky at top */}
            {constructionMode === 'validation' ? (
              <MapCorePanel
                mode="validation"
                audienceSize={audienceSize}
                districtsIncluded={districtsIncluded}
                sliderDraft={sliderDraft}
                sliderApplied={sliderApplied}
                maxSliderValue={maxSliderValue}
                validatingProvidersCount={validatingProvidersCount}
                validationLoading={validationLoading}
                onSliderChange={onSliderChange}
                onSliderChangeCommitted={onSliderChangeCommitted}
                selectedTvRegions={selectedTvRegions}
                onTvRegionsChange={onTvRegionsChange}
                tvRegionDistrictsCount={tvRegionDistrictsCount}
                finalEligibleCount={finalEligibleCount}
              />
            ) : null}

            {/* Tool Cards */}
            <Box sx={{ mb: 2 }}>
              {/* Stores Tool Card */}
              {onPoiIdsChange && (
                <MapToolCard
                  title="Stores"
                  subtitle={storesSubtitle}
                  icon={<Store />}
                  selected={activeTool === 'stores'}
                  onClick={() => handleToolClick('stores')}
                  badgeCount={storesCount > 0 ? storesCount : undefined}
                />
              )}

              {/* Locations Tool Card */}
              <MapToolCard
                title="Locations"
                subtitle="TV regions & nearby districts"
                icon={<LocationOn />}
                selected={activeTool === 'locations'}
                onClick={() => handleToolClick('locations')}
                badgeCount={locationsCount > 0 ? locationsCount : undefined}
              />

              {/* Battle Zones Tool Card */}
              <MapToolCard
                title="Battle Zones"
                subtitle={battleZonesEnabled ? 'Active' : 'Competition analysis'}
                icon={<GpsFixed />}
                selected={activeTool === 'battleZones'}
                onClick={() => handleToolClick('battleZones')}
                badgeCount={battleZonesCount > 0 ? battleZonesCount : undefined}
              />
            </Box>

            {/* Extension mode content */}
            {constructionMode === 'extension' && (
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
                      No suggested segments found. Click &quot;Build audience&quot; in Step 1 to generate suggestions.
                    </Typography>
                  </Box>
                )}

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

          </CardContent>
        </Box>
      </Card>
    </>
  );
}, (prevProps, nextProps) => {
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
    prevProps.activeTool === nextProps.activeTool &&
    prevProps.onToolClick === nextProps.onToolClick
  );
});
