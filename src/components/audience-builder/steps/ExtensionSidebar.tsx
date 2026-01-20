'use client';

import React, { memo, useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Slider,
  Chip,
  Avatar,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import { ExtensionSuggestion } from '@/features/audience-builder/api/extensionResults';
import { ExtensionResults } from '@/features/audience-builder/api/extensionResults';
import { getProviderFavicon } from '../providers/providerIcons';
import { useProviderMetadata } from '@/features/audience-builder/hooks/useProviderMetadata';
import { PoiFiltersDialog } from './PoiFiltersDialog';
import { CustomLayerDialog } from './CustomLayerDialog';

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
  selectedPoiTypes?: string[];
  onPoiTypeToggle?: (poiType: string) => void;
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
  selectedPoiTypes = [],
  onPoiTypeToggle,
}: ExtensionSidebarProps) {
  const [poiFiltersDialogOpen, setPoiFiltersDialogOpen] = useState(false);
  const [customLayerDialogOpen, setCustomLayerDialogOpen] = useState(false);
  const [providerImpactExpanded, setProviderImpactExpanded] = useState(false);

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
  // Summary metrics
  const districtsIncluded = providerImpact?.totals.includedDistricts || 0;
  const estimatedHouseholds = providerImpact?.totals.estimatedHouseholds || 0;
  const avgConfidence = providerImpact?.totals.avgConfidence || 0;
  const confidenceBand = useMemo(() => {
    if (avgConfidence >= 0.7) return 'High';
    if (avgConfidence >= 0.5) return 'Med';
    return 'Low';
  }, [avgConfidence]);

  // Fetch provider metadata for display names and logos
  const providerKeys = useMemo(() => {
    const keys = new Set<string>(['CCS']); // Always include CCS
    if (providerImpact?.providerStats) {
      providerImpact.providerStats.forEach(stat => keys.add(stat.provider));
    }
    return Array.from(keys);
  }, [providerImpact]);

  const { data: providerMetadata = [] } = useProviderMetadata(providerKeys);
  const providerMetadataMap = useMemo(() => {
    return new Map(providerMetadata.map(p => [p.provider_key, p]));
  }, [providerMetadata]);

  return (
    <Card
      sx={{
        width: '100%',
        height: '100%',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        bgcolor: 'white',
        borderRadius: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden', // Prevent card from growing
      }}
    >
      <Box sx={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', minHeight: 0 }}>
        <CardContent sx={{ p: 2 }}>
          {/* Summary strip */}
          <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f9f9f9', borderRadius: 1, border: '1px solid #e0e0e0' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.2, mb: 0.25 }}>
                  {districtsIncluded}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Districts included
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.2, mb: 0.25 }}>
                  {estimatedHouseholds.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Estimated households
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
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
          </Box>

          {/* Confidence threshold slider */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1 }}>
              Signal Threshold
            </Typography>
            <Box sx={{ px: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                  {confidenceThresholdDraft.toFixed(1)}
                </Typography>
              </Box>
              <Slider
                value={confidenceThresholdDraft}
                onChange={(_, value) => onConfidenceThresholdChange(value as number)}
                onChangeCommitted={(_, value) => onConfidenceThresholdCommit(value as number)}
                min={0.3}
                max={0.8}
                step={0.1}
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
                }}
              />
            </Box>
          </Box>

          {/* Suggested segments */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1.5 }}>
              Suggested Segments
            </Typography>
            {suggestions.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 300, overflowY: 'auto' }}>
                {suggestions.map((suggestion) => {
                  const isSelected = selectedSegmentKeys.includes(suggestion.segment_key);
                  return (
                    <Card key={suggestion.segment_key} sx={{ p: 1.5, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                            <Chip
                              label="Suggested"
                              size="small"
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#e3f2fd', color: '#1976d2' }}
                            />
                            {suggestion.tags.slice(0, 2).map((tag) => (
                              <Chip
                                key={tag}
                                label={tag}
                                size="small"
                                sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f5f5f5', color: '#616161' }}
                              />
                            ))}
                            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                              {suggestion.label}
                            </Typography>
                          </Box>
                          {suggestion.description && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', display: 'block', mb: 1 }}>
                              {suggestion.description}
                            </Typography>
                          )}
                          {suggestion.providers.length > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 1 }}>
                              Potential providers: {suggestion.providers.join(', ')}
                            </Typography>
                          )}
                          <Accordion
                            expanded={expandedExplain === suggestion.segment_key}
                            onChange={() => onToggleExplain(expandedExplain === suggestion.segment_key ? null : suggestion.segment_key)}
                            sx={{ boxShadow: 'none', '&:before': { display: 'none' } }}
                          >
                            <AccordionSummary expandIcon={<ExpandMore sx={{ fontSize: '1rem' }} />}>
                              <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                                Why suggested?
                              </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                              <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                                {suggestion.why_suggested}
                              </Typography>
                            </AccordionDetails>
                          </Accordion>
                        </Box>
                        <Box sx={{ ml: 1 }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={isSelected}
                                onChange={(e) => onToggleSegment(suggestion.segment_key, e.target.checked)}
                                size="small"
                              />
                            }
                            label=""
                            sx={{ m: 0 }}
                          />
                        </Box>
                      </Box>
                    </Card>
                  );
                })}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                No suggestions found.
              </Typography>
            )}
          </Box>

        </CardContent>
      </Box>

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
});
