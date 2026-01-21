'use client';

import { Box, Card, CardContent, Typography, Button, Avatar, Chip, Switch, Alert, Autocomplete, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useBuilderContext } from '../BuilderContext';
import { flushSync } from 'react-dom';
import { useConstructionSettings, useUpdateConstructionSettings } from '@/features/audience-builder/hooks/useConstruction';
import { useAvailableSegments } from '@/features/audience-builder/hooks/useAvailableSegments';
import { useSegmentProviderCoverage } from '@/features/audience-builder/hooks/useSegmentProviderCoverage';
import { useProviderMetadata } from '@/features/audience-builder/hooks/useProviderMetadata';
import { getProviderFavicon } from '../providers/providerIcons';
import { ConstructionMode } from '@/lib/types';
import { ConstructionModeToggle } from '../ConstructionModeToggle';
import { ProviderRationaleModal } from './ProviderRationaleModal';

interface AudienceSelectionStepProps {
  audienceId: string;
  onNext: () => void;
  onBack: () => void;
}

function ProviderAvatar({ provider, logoUrl }: { provider: string; logoUrl?: string | null }) {
  const iconUrl = getProviderFavicon(provider, logoUrl);
  return (
    <Avatar
      src={iconUrl}
      sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: '#e0e0e0' }}
    >
      {provider.charAt(0)}
    </Avatar>
  );
}

/**
 * Convert segment_key to human-readable label (MVP: simple title case)
 */
function formatSegmentLabel(segmentKey: string): string {
  return segmentKey
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function AudienceSelectionStep({ audienceId, onNext, onBack }: AudienceSelectionStepProps) {
  const router = useRouter();
  const { 
    state, 
    setSelectionConfirmed, 
    setConstructionMode, 
    setSelectedProviders, 
    setSelectedSegmentKey,
    confirmSelection,
    getAllProvidersForBuild 
  } = useBuilderContext();
  const { data: settings } = useConstructionSettings(audienceId);
  const updateConstructionMutation = useUpdateConstructionSettings();
  
  const constructionMode = settings?.construction_mode || state.constructionMode || 'validation';
  const [localConstructionMode, setLocalConstructionMode] = useState<ConstructionMode>(constructionMode || 'validation');
  
  // Fetch available segments from actual data
  const { data: availableSegments = [], isLoading: segmentsLoading } = useAvailableSegments();
  
  // Get selected segment from context or default to first available
  const selectedSegmentKey = state.selectedSegmentKey;
  const selectedSegment = useMemo(() => {
    if (selectedSegmentKey) {
      return availableSegments.find(s => s.segmentKey === selectedSegmentKey) || null;
    }
    // Auto-select first segment if none selected and segments are loaded
    if (availableSegments.length > 0 && !selectedSegmentKey) {
      return availableSegments[0];
    }
    return null;
  }, [selectedSegmentKey, availableSegments]);
  
  // Auto-select first segment if none selected
  useEffect(() => {
    if (availableSegments.length > 0 && !selectedSegmentKey) {
      setSelectedSegmentKey(availableSegments[0].segmentKey);
    }
  }, [availableSegments, selectedSegmentKey, setSelectedSegmentKey]);
  
  // Fetch provider coverage for the selected segment
  const { data: providerCoverage = [], isLoading: coverageLoading } = useSegmentProviderCoverage({
    segmentKey: selectedSegment?.segmentKey || '',
    enabled: !!selectedSegment?.segmentKey,
  });
  
  // Compute CCS count and validators
  const { ccsCount, validators } = useMemo(() => {
    if (!selectedSegment) return { ccsCount: 0, validators: [] };
    
    const ccs = providerCoverage.find(p => p.provider === 'CCS');
    const ccsCount = ccs?.districtCount || selectedSegment.ccsDistricts || 0;
    
    // Get validators from coverage (excluding CCS)
    const validators = providerCoverage
      .filter(p => p.provider !== 'CCS')
      .sort((a, b) => b.districtCount - a.districtCount);
    
    return { ccsCount, validators };
  }, [providerCoverage, selectedSegment]);
  
  // Fetch provider metadata for display names and logos
  const providerKeys = useMemo(() => {
    const keys = new Set<string>();
    if (validators.length > 0) {
      validators.forEach(v => keys.add(v.provider));
    }
    keys.add('CCS'); // Always include CCS
    return Array.from(keys);
  }, [validators]);
  
  const { data: providerMetadataMap = new Map<string, any>() } = useProviderMetadata(providerKeys);
  
  // Track selected providers (for extension mode)
  const [localSelectedProviders, setLocalSelectedProviders] = useState<string[]>([]);
  const [rationaleModalOpen, setRationaleModalOpen] = useState(false);
  const [selectedRationaleProvider, setSelectedRationaleProvider] = useState<{ provider: string; matchPercent: number } | null>(null);
  const [segmentPickerOpen, setSegmentPickerOpen] = useState(false);
  const [hasUnappliedModeChange, setHasUnappliedModeChange] = useState(false);
  const didInitDefaultsRef = useRef<string | null>(null);
  
  // Sync local mode with context/settings only on mount or when applied mode changes externally
  // Don't override user's local changes (they need to click Apply)
  const appliedModeRef = useRef(constructionMode);
  useEffect(() => {
    const currentMode = settings?.construction_mode || state.constructionMode;
    // Only sync if the applied mode changed externally (not from user clicking Apply)
    if (currentMode !== appliedModeRef.current) {
      appliedModeRef.current = currentMode;
      // Only update local if there's no unapplied change
      if (!hasUnappliedModeChange) {
        setLocalConstructionMode(currentMode);
      }
    }
  }, [settings?.construction_mode, state.constructionMode, hasUnappliedModeChange]);
  
  // Initialize default selections (top 2 providers) for extension mode - only once per segment
  useEffect(() => {
    if (
      constructionMode === 'extension' && 
      validators.length > 0 && 
      selectedSegment?.segmentKey &&
      didInitDefaultsRef.current !== selectedSegment.segmentKey
    ) {
      if (state.selectedProviders.length === 0) {
        // Auto-select top 2 by districtCount
        const topProviders = validators.slice(0, 2).map(v => v.provider);
        setLocalSelectedProviders(topProviders);
        didInitDefaultsRef.current = selectedSegment.segmentKey;
      } else {
        // Use existing selections from context
        setLocalSelectedProviders(state.selectedProviders);
        didInitDefaultsRef.current = selectedSegment.segmentKey;
      }
    } else if (constructionMode === 'validation') {
      // Reset flag when switching modes
      didInitDefaultsRef.current = null;
    }
  }, [constructionMode, validators, state.selectedProviders, selectedSegment?.segmentKey]);
  
  // Handle mode change (only updates local state, doesn't apply)
  const handleConstructionModeChange = useCallback((mode: ConstructionMode) => {
    console.log('[AudienceSelectionStep] handleConstructionModeChange called with:', mode, 'current:', localConstructionMode, 'applied:', constructionMode);
    setLocalConstructionMode(mode);
    setHasUnappliedModeChange(mode !== constructionMode);
  }, [constructionMode, localConstructionMode]);
  
  // Apply the construction mode change
  const handleApplyModeChange = useCallback(async () => {
    const modeToApply = localConstructionMode;
    appliedModeRef.current = modeToApply;
    setConstructionMode(modeToApply);
    setSelectionConfirmed(false);
    setLocalSelectedProviders([]);
    didInitDefaultsRef.current = null;
    setHasUnappliedModeChange(false);
    
    // Persist mode to database
    try {
      await updateConstructionMutation.mutateAsync({
        audienceId,
        updates: {
          construction_mode: modeToApply,
          audience_intent: settings?.audience_intent || null,
          active_signals: settings?.active_signals || {},
        },
      });
    } catch (error) {
      console.error('Failed to update construction mode:', error);
    }
  }, [localConstructionMode, setConstructionMode, setSelectionConfirmed, audienceId, updateConstructionMutation, settings]);
  
  // Handle segment selection
  const handleSegmentChange = (segmentKey: string | null) => {
    setSelectedSegmentKey(segmentKey);
    setLocalSelectedProviders([]);
    didInitDefaultsRef.current = null;
  };
  
  // Handle provider toggle (extension mode only)
  const handleToggleProvider = (provider: string, isSelected: boolean) => {
    setLocalSelectedProviders(prev => {
      if (isSelected) {
        return [...prev, provider];
      } else {
        return prev.filter(p => p !== provider);
      }
    });
  };
  
  // Compute match % for a provider
  const computeMatchPercent = (providerDistrictCount: number): number => {
    if (ccsCount === 0) return 0;
    return Math.min(100, Math.round((providerDistrictCount / ccsCount) * 100));
  };
  
  // Handle confirm
  const handleConfirm = async () => {
    if (!selectedSegment) return;
    
    // Determine providers to set
    const providersToSet = constructionMode === 'validation' 
      ? validators.map(v => v.provider)
      : localSelectedProviders;
    
    // Store in sessionStorage as backup (in case context doesn't propagate immediately)
    try {
      sessionStorage.setItem(`audience_${audienceId}_selection`, JSON.stringify({
        segmentKey: selectedSegment.segmentKey,
        providers: providersToSet,
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.warn('Failed to store selection in sessionStorage:', e);
    }
    
    // Use flushSync to ensure state update completes synchronously before navigation
    flushSync(() => {
      confirmSelection(selectedSegment.segmentKey, providersToSet);
    });
    
    // Small delay to ensure context update propagates
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Navigate after state is set
    onNext();
  };
  
  const canConfirm = selectedSegment && (
    constructionMode === 'validation' || 
    (constructionMode === 'extension' && localSelectedProviders.length > 0)
  );
  
  return (
    <Box sx={{ maxWidth: '75%', mx: 'auto', py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
          Audience Selection
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {constructionMode === 'validation' 
            ? 'Choose an anchor segment and review validating providers that will be used to build your audience.'
            : 'Choose an anchor segment and select additional providers to extend your audience.'}
        </Typography>
      </Box>
      
      {/* Construction Mode Toggle - Side by Side */}
      <Box id="selection-construction-mode" sx={{ mb: 3, scrollMarginTop: '80px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
            Construction Mode
          </Typography>
        </Box>
        <ConstructionModeToggle
          value={localConstructionMode}
          onChange={handleConstructionModeChange}
          disabled={false}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="contained"
            onClick={handleApplyModeChange}
            disabled={!hasUnappliedModeChange}
            sx={{
              bgcolor: '#02b5e7',
              '&:hover': { bgcolor: '#02a0d0' },
              fontSize: '0.875rem',
            }}
          >
            Apply
          </Button>
        </Box>
      </Box>
      
      {!selectedSegment ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Please select an anchor segment to continue.
        </Alert>
      ) : (
        <>
          {/* CCS Warning - only show if truly missing */}
          {ccsCount === 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              CCS data not uploaded for this segment. Please ensure CCS data is available.
            </Alert>
          )}
          
          {/* Anchor Provider Card */}
          <Box id="selection-select-segment" sx={{ mb: 2, scrollMarginTop: '80px' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', mb: 1 }}>
              Anchor Segment
            </Typography>
            <Card sx={{ borderLeft: '4px solid #9c27b0' }}>
              <CardContent sx={{ pb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <ProviderAvatar provider="CCS" logoUrl={providerMetadataMap.get('CCS')?.logo_url} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {formatSegmentLabel(selectedSegment.segmentKey)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      Source: CCS • Coverage: {ccsCount.toLocaleString()} districts
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setSegmentPickerOpen(true)}
                    sx={{ fontSize: '0.75rem', minWidth: 'auto', px: 1.5 }}
                  >
                    Change
                  </Button>
                  <Chip
                    label={constructionMode === 'validation' ? 'Base universe' : 'Always included'}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      bgcolor: '#e3f2fd',
                      color: '#1976d2',
                    }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Box>
          
          {constructionMode === 'validation' ? (
            <>
              {/* Validating Providers */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', mb: 1 }}>
                  Validating Providers
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {validators.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                      No validating providers found for this segment. Ensure data has been uploaded.
                    </Typography>
                  ) : (
                    validators.map((validator) => {
                      const matchPercent = computeMatchPercent(validator.districtCount);
                      const metadata = providerMetadataMap.get(validator.provider);
                      const displayName = metadata?.display_name || validator.provider;
                      return (
                        <Card key={validator.provider} sx={{ borderLeft: '4px solid #3bc8ea' }}>
                          <CardContent sx={{ pb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <ProviderAvatar provider={validator.provider} logoUrl={metadata?.logo_url} />
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body1" sx={{ fontWeight: 500, mb: 0.5 }}>
                                  {displayName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                                  {selectedSegment ? formatSegmentLabel(selectedSegment.segmentKey) : 'Segment'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                  Coverage: {validator.districtCount.toLocaleString()} districts • Match: {matchPercent}%
                                </Typography>
                              </Box>
                              <Chip
                                label="Ready to validate"
                                size="small"
                                sx={{
                                  height: 22,
                                  fontSize: '0.7rem',
                                  bgcolor: '#e8f5e9',
                                  color: '#2e7d32',
                                }}
                              />
                            </Box>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </Box>
              </Box>
            </>
          ) : (
            <>
              {/* Extension Providers */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', mb: 1 }}>
                  Extension Providers
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {validators.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                      No extension providers found for this segment. Ensure data has been uploaded.
                    </Typography>
                  ) : (
                    validators.map((validator) => {
                      const matchPercent = computeMatchPercent(validator.districtCount);
                      const isSelected = localSelectedProviders.includes(validator.provider);
                      const metadata = providerMetadataMap.get(validator.provider);
                      const displayName = metadata?.display_name || validator.provider;
                      return (
                        <Card key={validator.provider} sx={{ borderLeft: '4px solid #3bc8ea' }}>
                          <CardContent sx={{ pb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                              <ProviderAvatar provider={validator.provider} logoUrl={metadata?.logo_url} />
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                    {displayName}
                                  </Typography>
                                  <Chip
                                    label={`${matchPercent}% match`}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: '0.6875rem',
                                      bgcolor: matchPercent >= 80 ? '#e8f5e9' : matchPercent >= 60 ? '#fff3e0' : '#ffebee',
                                      color: matchPercent >= 80 ? '#2e7d32' : matchPercent >= 60 ? '#e65100' : '#c62828',
                                    }}
                                  />
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                                  {selectedSegment ? formatSegmentLabel(selectedSegment.segmentKey) : 'Segment'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                                  Coverage: {validator.districtCount.toLocaleString()} districts • Match: {matchPercent}%
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => {
                                    setSelectedRationaleProvider({ provider: validator.provider, matchPercent });
                                    setRationaleModalOpen(true);
                                  }}
                                  sx={{ fontSize: '0.75rem', minWidth: 'auto', px: 1.5 }}
                                >
                                  Rationale
                                </Button>
                                <Switch
                                  checked={isSelected}
                                  onChange={(e) => handleToggleProvider(validator.provider, e.target.checked)}
                                  size="small"
                                />
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </Box>
                
                <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f9f9f9', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    Provider impact will be calculated on the Map step
                  </Typography>
                </Box>
              </Box>
            </>
          )}
        </>
      )}
      
      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button
          variant="outlined"
          onClick={onBack}
          sx={{ fontSize: '0.875rem' }}
        >
          Back
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!canConfirm || coverageLoading}
          sx={{
            bgcolor: '#02b5e7',
            '&:hover': { bgcolor: '#02a0d0' },
            fontSize: '0.875rem',
          }}
        >
          Confirm Selection
        </Button>
      </Box>
      
      {/* Provider Rationale Modal */}
      {selectedRationaleProvider && (
        <ProviderRationaleModal
          open={rationaleModalOpen}
          onClose={() => {
            setRationaleModalOpen(false);
            setSelectedRationaleProvider(null);
          }}
          provider={selectedRationaleProvider.provider}
          matchPercent={selectedRationaleProvider.matchPercent}
        />
      )}
      
      {/* Segment Picker Dialog */}
      <Dialog
        open={segmentPickerOpen}
        onClose={() => setSegmentPickerOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: '1.125rem', fontWeight: 600, pb: 1, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
          Choose Anchor Segment
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Autocomplete
            options={availableSegments}
            getOptionLabel={(option) => formatSegmentLabel(option.segmentKey)}
            value={selectedSegment}
            onChange={(_, newValue) => {
              if (newValue) {
                handleSegmentChange(newValue.segmentKey);
                setSegmentPickerOpen(false);
              }
            }}
            loading={segmentsLoading}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select segment"
                placeholder="Choose a segment..."
              />
            )}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1">
                    {formatSegmentLabel(option.segmentKey)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    CCS coverage: {option.ccsDistricts.toLocaleString()} districts • {option.providers.length} providers
                  </Typography>
                </Box>
              </Box>
            )}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setSegmentPickerOpen(false)}
            variant="outlined"
            sx={{ fontSize: '0.875rem' }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
      
    </Box>
  );
}
