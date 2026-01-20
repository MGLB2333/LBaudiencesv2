'use client';

import React, { memo, useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Avatar,
  ToggleButtonGroup,
  ToggleButton,
  Slider,
} from '@mui/material';
import { Store, LocationOn, GpsFixed } from '@mui/icons-material';
import { ExtensionResults, ExtensionSuggestion } from '@/features/audience-builder/api/extensionResults';
import { getProviderFavicon } from '../providers/providerIcons';
import { MapCorePanel } from './MapCorePanel';
import { MapToolCard } from './MapToolCard';
import { useBuilderContext } from '../BuilderContext';

interface ExtensionSidebarProps {
  anchorKey: string;
  anchorLabel: string;
  confidenceThreshold: number;
  confidenceThresholdDraft: number;
  onConfidenceThresholdChange: (value: number) => void;
  onConfidenceThresholdCommit: (value: number) => void;
  suggestions: ExtensionSuggestion[];
  selectedSegmentKeys: string[];
  onToggleSegment: (segmentKey: string, isSelected: boolean) => void;
  providerImpact: ExtensionResults | undefined;
  providerImpactLoading: boolean;
  expandedExplain: string | null;
  onToggleExplain: (segmentKey: string | null) => void;
  selectedTvRegions?: string[];
  onTvRegionsChange?: (regions: string[]) => void;
  tvRegionDistrictsCount?: number;
  finalEligibleCount?: number;
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

function ProviderAvatar({ provider, logoUrl }: { provider: string; logoUrl?: string | null }) {
  const iconUrl = getProviderFavicon(provider, logoUrl);
  return (
    <Avatar
      src={iconUrl}
      sx={{ width: 22, height: 22, fontSize: '0.7rem', bgcolor: '#e0e0e0' }}
      onError={() => {
        // Fallback handled by Avatar component
      }}
    >
      {provider.charAt(0)}
    </Avatar>
  );
}

export const ExtensionSidebar = memo(function ExtensionSidebar({
  anchorKey,
  anchorLabel,
  confidenceThreshold,
  confidenceThresholdDraft,
  onConfidenceThresholdChange,
  onConfidenceThresholdCommit,
  suggestions,
  selectedSegmentKeys,
  onToggleSegment,
  providerImpact,
  providerImpactLoading,
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
}: ExtensionSidebarProps) {


  // Summary metrics
  const districtsIncluded = providerImpact?.totals.includedDistricts || 0;
  const estimatedHouseholds = providerImpact?.totals.estimatedHouseholds || 0;
  const avgConfidence = providerImpact?.totals.avgConfidence || 0;

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
      <Card
        sx={{
          width: '100%',
          height: '100%',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          bgcolor: 'white',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', minHeight: 0 }}>
          <CardContent sx={{ p: 2 }}>
            {/* Core Panel - Sticky at top */}
            <MapCorePanel
              mode="extension"
              districtsIncluded={districtsIncluded}
              estimatedHouseholds={estimatedHouseholds}
              avgConfidence={avgConfidence}
              confidenceThresholdDraft={confidenceThresholdDraft}
              onConfidenceThresholdChange={onConfidenceThresholdChange}
              onConfidenceThresholdCommit={onConfidenceThresholdCommit}
              selectedTvRegions={selectedTvRegions}
              onTvRegionsChange={onTvRegionsChange}
              tvRegionDistrictsCount={tvRegionDistrictsCount}
              finalEligibleCount={finalEligibleCount}
            />

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
          </CardContent>
        </Box>
      </Card>
    </>
  );
});
