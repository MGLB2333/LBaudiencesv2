'use client';

import { Box, Card, CardContent, Typography, Button, Chip, Accordion, AccordionSummary, AccordionDetails, Switch, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions, Link, CircularProgress, Slider, Avatar } from '@mui/material';
import { useRouter } from 'next/navigation';
import { ExpandMore, CheckCircle, Cancel } from '@mui/icons-material';
import { ConstructionModeToggle } from '../ConstructionModeToggle';
import { useState, useEffect } from 'react';
import { ConstructionMode } from '@/lib/types';
import { useConstructionSettings, useUpdateConstructionSettings } from '@/features/audience-builder/hooks/useConstruction';
import { useSegments, useUpdateSegmentSelection } from '@/features/audience-builder/hooks/useSegments';
import { useAudience } from '@/features/audience-builder/hooks/useAudiences';
import { calculateCoverageMetrics } from '@/features/audience-builder/utils/coverage';
import * as segmentLibraryApi from '@/features/audience-builder/api/segmentLibrary';
import { buildAudience } from '@/features/audience-builder/services/buildAudience.service';
import { useQueryClient } from '@tanstack/react-query';
import { useGeoUnits } from '@/features/audience-builder/hooks/useGeo';
import * as geoApi from '@/features/audience-builder/api/geo';
import * as geoDistrictsApi from '@/features/audience-builder/api/geoDistricts';
import { useValidationResults } from '@/features/audience-builder/hooks/useValidationResults';

interface ResultsStepProps {
  audienceId: string;
  onNext: () => void;
  onBack: () => void;
}

const PROVIDER_ICONS: Record<string, string> = {
  CCS: 'https://www.dentsu.com/favicon.ico',
  Experian: 'https://www.experian.co.uk/favicon.ico',
  ONS: 'https://www.ons.gov.uk/favicon.ico',
  Outra: 'https://www.outra.com/favicon.ico',
  YouGov: 'https://yougov.co.uk/favicon.ico',
  TwentyCI: 'https://www.twentyci.co.uk/favicon.ico',
};

function ProviderAvatar({ provider }: { provider: string }) {
  const iconUrl = PROVIDER_ICONS[provider];
  return (
    <Avatar
      src={iconUrl}
      sx={{ width: 22, height: 22, fontSize: '0.7rem', bgcolor: '#e0e0e0' }}
    >
      {provider.charAt(0)}
    </Avatar>
  );
}

export function ResultsStep({ audienceId, onNext, onBack }: ResultsStepProps) {
  const router = useRouter();
  const { data: audience } = useAudience(audienceId);
  const { data: settings, isLoading } = useConstructionSettings(audienceId);
  const { data: segments = [] } = useSegments(audienceId, 'primary', settings?.construction_mode);
  const updateMutation = useUpdateConstructionSettings();
  const updateSegmentSelection = useUpdateSegmentSelection();
  const queryClient = useQueryClient();
  
  const [constructionMode, setConstructionMode] = useState<ConstructionMode,>(settings?.construction_mode || 'extension');
  const [expandedExplain, setExpandedExplain] = useState<string | null,>(null);
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [validationMinAgreement, setValidationMinAgreement] = useState(1);
  const [geoUnits, setGeoUnits] = useState<any[],>([]);
  const [districtsWithAgreement, setDistrictsWithAgreement] = useState<any[],>([]);

  // Filter segments first (needed by useEffects below)
  const anchorSegment = segments.find(s => s.origin === 'brief' && s.provider === 'CCS');
  const validatedSegments = segments.filter(s => s.origin === 'validated' || s.match_type === 'name_match');
  const suggestedSegments = segments.filter(s => s.origin === 'suggested' || s.match_type === 'inferred');
  const includedSegments = segments.filter(s => s.is_selected);
  const includedSegmentKeys = includedSegments.map(s => s.segment_key);

  // Get validation results from geo_district_signals (CSV-based, Validation mode only)
  const segmentKey = 'home_movers'; // TODO: derive from anchor segment or audience
  const { data: validationResults, isLoading: validationLoading } = useValidationResults({
    segmentKey,
    enabled: constructionMode === 'validation',
  });

  useEffect(() => {
    if (settings) {
      setConstructionMode(settings.construction_mode);
      // Validation mode: slider always starts at 1 (view-layer only, not persisted)
      if (settings.construction_mode === 'validation') {
        setValidationMinAgreement(1);
      } else {
        // Reset to 1 when switching away from validation mode
        setValidationMinAgreement(1);
      }
    }
  }, [settings]);
  
  // Update validationMinAgreement when validationResults change (to clamp value to max)
  useEffect(() => {
    if (constructionMode === 'validation' && validationResults) {
      const maxValue = Math.max(1, validationResults.totals.contributingProvidersCount);
      // Ensure current value doesn't exceed max (use functional form to avoid stale closure)
      setValidationMinAgreement(prev => {
        if (prev > maxValue && maxValue > 0) {
          return maxValue;
        }
        return prev;
      });
    }
  }, [validationResults, constructionMode]);

  // Convert validation results to geo_units format for map compatibility
  useEffect(() => {
    if (constructionMode === 'validation' && validationResults) {
      // Filter includedDistricts by current minAgreement
      const filteredIncluded = validationResults.includedDistricts.filter(
        district => (validationResults.agreementByDistrict[district] || 0) >= validationMinAgreement
      );
      
      // Fetch district geometries
      geoDistrictsApi.getGeoDistricts()
        .then((allDistricts) => {
          const districtMap = new Map(allDistricts.map(d => [d.district, d]));
          
          const convertedUnits = filteredIncluded.map((district) => {
            const districtGeo = districtMap.get(district);
            const agreementCount = validationResults.agreementByDistrict[district] || 0;
            // Use a default confidence based on agreement ratio
            const avgConfidence = validationResults.totals.contributingProvidersCount > 0
              ? agreementCount / validationResults.totals.contributingProvidersCount
              : 0;
            
            return {
              id: `district_${district}`,
              audience_id: audienceId,
              geo_type: 'postcode_sector' as const,
              geo_id: district,
              score: avgConfidence * 100,
              confidence_tier: avgConfidence >= 0.7 ? 'high' : avgConfidence >= 0.4 ? 'medium' : 'low',
              drivers: {
                signals: [],
                agreement_count: agreementCount,
              },
              geometry: districtGeo?.geometry,
              agreement_count: agreementCount,
              agreeing_providers: [], // Not stored in new structure, can derive from providerStats if needed
            };
          });
          setGeoUnits(convertedUnits);
          setDistrictsWithAgreement(filteredIncluded.map(district => {
            const agreementCount = validationResults.agreementByDistrict[district] || 0;
            const avgConfidence = validationResults.totals.contributingProvidersCount > 0
              ? agreementCount / validationResults.totals.contributingProvidersCount
              : 0;
            return {
              district,
              centroid_lat: 0, // Will be filled from geo_districts
              centroid_lng: 0,
              geometry: null,
              agreeing_providers: [],
              agreement_count: agreementCount,
              avg_confidence: avgConfidence,
            };
          }));
        })
        .catch((error) => {
          console.error('Failed to fetch district geometries:', error);
        });
    } else if (constructionMode === 'extension') {
      // Extension mode: use existing geo units
      geoApi.getGeoUnits(audienceId)
        .then(setGeoUnits)
        .catch(() => setGeoUnits([]));
    }
  }, [audienceId, constructionMode, validationResults, validationMinAgreement]);

  // Coverage metrics only used in Extension mode (not Validation mode)
  const coverageMetrics = constructionMode === 'extension' ? calculateCoverageMetrics(settings) : {
    activeSignalsCount: 0,
    modelledConfidence: 0,
    estimatedMatchCoverage: 0,
  };

  // Provider matches are now derived from validationResults (Validation mode only)
  // No need to query segment_library for validation mode

  const handleModeChange = async (mode: ConstructionMode) => {
    setConstructionMode(mode);
    setIsRebuilding(true);
    
    try {
      await updateMutation.mutateAsync({
        audienceId,
        updates: {
          construction_mode: mode,
        },
      });

      await buildAudience(audienceId, mode);

      await queryClient.invalidateQueries({ queryKey: ['segments', audienceId] });
      await queryClient.invalidateQueries({ queryKey: ['construction_settings', audienceId] });
    } catch (error) {
      console.error('Mode change rebuild failed:', error);
      setConstructionMode(settings?.construction_mode || 'extension');
      alert(error instanceof Error ? error.message : 'Failed to rebuild. Please try again.');
    } finally {
      setIsRebuilding(false);
    }
  };

  const handleToggleSegment = async (segmentId: string, isSelected: boolean) => {
    await updateSegmentSelection.mutateAsync({
      segmentId,
      isSelected,
    });
  };

  const handleEditBrief = () => {
    router.push(`/audiences/${audienceId}/builder?step=1`);
  };

  const handleSliderChange = (_event: Event | React.SyntheticEvent, newValue: number | number[]) => {
    // View-layer filter only - no DB writes
    const value = Array.isArray(newValue) ? newValue[0] : newValue;
    setValidationMinAgreement(value);
  };

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  // ============================================================================
  // Validation metrics are derived live from geo_audience_signals. Do not persist or memoise.
  // ============================================================================
  
  // Calculate validating providers count from validationResults (Validation mode only)
  // EXCLUDE CCS from the count (CCS is the base universe, not a validating provider)
  const validatingProvidersCount = constructionMode === 'validation' && validationResults
    ? validationResults.totals.contributingProvidersCount
    : 0; // Extension mode doesn't use slider
  
  // Slider max value (Validation mode only)
  const maxSliderValue = constructionMode === 'validation'
    ? Math.max(1, validatingProvidersCount)
    : 1;
  
  // Validation mode: districts included (derived live from validationResults, filtered by current minAgreement)
  // Extension mode: use existing logic
  const includedCount = constructionMode === 'validation' && validationResults
    ? validationResults.includedDistricts.filter(
        d => (validationResults.agreementByDistrict[d] || 0) >= validationMinAgreement
      ).length
    : geoUnits.filter((unit: any) => {
        const drivers = unit.drivers as any;
        const signals = drivers?.signals || [];
        if (includedSegmentKeys.length === 0) return true;
        return signals.some((sig: any) => includedSegmentKeys.includes(sig.segment_key));
      }).length;
  
  // Validation mode: estimated audience size (derived live from validationResults)
  // Extension mode: use existing logic
  const avgHouseholdsPerDistrict = 2500;
  const audienceSize = constructionMode === 'validation' && validationResults
    ? includedCount * avgHouseholdsPerDistrict
    : (() => {
        const baseAudienceSize = audience?.target_reach || 5000000;
        const totalGeoUnits = geoUnits.length || 1;
        return Math.round(baseAudienceSize * (includedCount / totalGeoUnits));
      })();
  
  // Validation mode: confidence level (derived live from validationResults)
  // Extension mode: calculated fallback
  let confidenceLevel: 'High' | 'Med' | 'Low' = 'Low';
  if (constructionMode === 'validation' && validationResults) {
    confidenceLevel = validationResults.totals.confidenceBand;
  } else if (constructionMode === 'extension' && maxSliderValue > 0) {
    // Extension mode fallback (not used for slider, but keep for consistency)
    const ratio = validationMinAgreement / maxSliderValue;
    if (ratio >= 0.7) {
      confidenceLevel = 'High';
    } else if (ratio >= 0.4) {
      confidenceLevel = 'Med';
    }
  }

  const description = audience?.description || '';
  const shouldTruncate = description.length > 150;
  const displayDescription = (descriptionExpanded || !shouldTruncate) ? description : description.substring(0, 150) + '...';

  // Provider counts from validationResults (Validation mode) or validatedSegments (Extension mode)
  const contributingProviders = constructionMode === 'validation' && validationResults
    ? Object.keys(validationResults.providerStats).length
    : validatedSegments.length;
  const totalProviders = constructionMode === 'validation' && validationResults
    ? Object.keys(validationResults.providerStats).length + 1 // +1 for CCS
    : 5;
  const hasHighAgreement = constructionMode === 'validation' && validationResults
    ? validationResults.totals.confidenceBand === 'High'
    : validatedSegments.some(s => {
        const evidence = s.evidence as any;
        return evidence?.agreement_level === 'high';
      });

  // Geo agreement from validationResults (Validation mode) or calculated (Extension mode)
  let geoAgreement: 'High' | 'Med' | 'Low' = 'Low';
  if (constructionMode === 'validation' && validationResults) {
    geoAgreement = validationResults.totals.confidenceBand;
  } else {
    // Extension mode fallback (keep existing logic for now)
    const agreementLevels: string[] = [];
    const highAgreementCount = agreementLevels.filter((l: string) => l === 'high').length;
    const providerMatchesLength = Math.max(1, 1);
    if (providerMatchesLength > 0 && highAgreementCount >= providerMatchesLength * 0.7) {
      geoAgreement = 'High';
    } else if (providerMatchesLength > 0 && highAgreementCount >= providerMatchesLength * 0.4) {
      geoAgreement = 'Med';
    }
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Stage A: Step header row */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
          Segments
        </Typography>
        <Link
          component="button"
          variant="body2"
          onClick={handleEditBrief}
          sx={{ fontSize: '0.75rem', textDecoration: 'underline', cursor: 'pointer', color: 'text.secondary' }}
        >
          Edit brief and rebuild
        </Link>
      </Box>

      {/* Brief Summary Banner */}
      <Card sx={{ mb: 3, bgcolor: '#f9f9f9', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, fontSize: '0.875rem' }}>
            Audience brief (from Step 1)
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1 }}>
            {audience?.name || 'Untitled Audience'}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', mb: 1 }}>
              {displayDescription}
              {shouldTruncate && (
                <Link
                  component="button"
                  variant="body2"
                  onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                  sx={{ ml: 0.5, fontSize: '0.8125rem' }}
                >
                  {descriptionExpanded ? 'Show less' : 'Show more'}
                </Link>
              )}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {/* Mode Toggle */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <ConstructionModeToggle 
                  value={constructionMode} 
                  onChange={handleModeChange}
                  disabled={isRebuilding}
                />
              </Box>
              {isRebuilding && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} sx={{ color: '#02b5e7' }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    Updating results…
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Stage B: Summary Strip */}
          <Box sx={{ mb: 3, p: 1.5, bgcolor: '#f9f9f9', borderRadius: 1, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            {anchorSegment && (
              <Chip 
                label={`Anchor: ${anchorSegment.segment_label}`} 
                size="small" 
                sx={{ height: 24, fontSize: '0.75rem', fontWeight: 500 }}
              />
            )}
            {constructionMode === 'validation' ? (
              <Chip 
                label={`Providers matched: ${contributingProviders}/${totalProviders}`} 
                size="small" 
                sx={{ height: 24, fontSize: '0.75rem' }}
              />
            ) : (
              <Chip 
                label={`Suggestions found: ${suggestedSegments.length}`} 
                size="small" 
                sx={{ height: 24, fontSize: '0.75rem' }}
              />
            )}
            <Chip 
              label={`Included: ${includedSegments.length}`} 
              size="small" 
              sx={{ height: 24, fontSize: '0.75rem' }}
            />
            {constructionMode === 'extension' && (
              <Chip 
                label={`Coverage: ${coverageMetrics.modelledConfidence}%`} 
                size="small" 
                sx={{ height: 24, fontSize: '0.75rem' }}
              />
            )}
            {settings?.last_run_at && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Last built: {new Date(settings.last_run_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            )}
          </Box>

          {/* Loading Overlay */}
          {isRebuilding && (
            <Box
              sx={{
                position: 'relative',
                mb: 3,
                minHeight: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#f9f9f9',
                borderRadius: 1,
                border: '1px solid #e0e0e0',
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={24} sx={{ color: '#02b5e7' }} />
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                  Updating results…
                </Typography>
              </Box>
            </Box>
          )}

          {/* Stage C: Validation Mode View */}
          {!isRebuilding && constructionMode === 'validation' && (
            <Box sx={{ mb: 3 }}>
              {anchorSegment ? (
                <>
                  <Card sx={{ p: 2, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <ProviderAvatar provider={anchorSegment.provider || 'CCS'} />
                          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                            {anchorSegment.segment_label}
                          </Typography>
                        </Box>
                        {anchorSegment.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', mb: 1 }}>
                            {anchorSegment.description}
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                            Contributing providers: {contributingProviders} of {totalProviders}
                          </Typography>
                          {hasHighAgreement && (
                            <Chip
                              icon={<CheckCircle sx={{ fontSize: '0.875rem !important' }} />}
                              label="High confidence"
                              size="small"
                              color="success"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                        </Box>
                      </Box>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setProviderModalOpen(true)}
                      sx={{ fontSize: '0.875rem' }}
                    >
                      View validating providers
                    </Button>
                  </Card>

                  {/* Confidence Slider Section */}
                  <Card sx={{ mt: 2, p: 2, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, fontSize: '0.875rem' }}>
                      Audience confidence
                    </Typography>
                    
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          Bigger audience
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          Higher confidence
                        </Typography>
                      </Box>
                      <Slider
                        value={validationMinAgreement}
                        onChange={handleSliderChange}
                        min={1}
                        max={maxSliderValue}
                        marks={maxSliderValue > 1}
                        step={1}
                        disabled={maxSliderValue <= 1 || constructionMode !== 'validation' || !validationResults || validatingProvidersCount < 1}
                        sx={{
                          color: '#02b5e7',
                          '& .MuiSlider-thumb': {
                            width: 18,
                            height: 18,
                          },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', display: 'block', mt: 1, textAlign: 'center' }}>
                        Include areas where at least {validationMinAgreement} of {validatingProvidersCount || maxSliderValue} providers agree.
                      </Typography>
                    </Box>

                    {/* Metrics */}
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                      <Box sx={{ flex: 1, minWidth: 120 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                          Estimated audience size
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                          {audienceSize.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 120 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                          Included areas
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                          {includedCount} {constructionMode === 'validation' ? 'postcode districts' : 'postcode sectors'}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 120 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                          Confidence level
                        </Typography>
                        <Chip 
                          label={confidenceLevel} 
                          size="small" 
                          sx={{ 
                            height: 20, 
                            fontSize: '0.7rem',
                            bgcolor: confidenceLevel === 'High' ? '#e8f5e9' : confidenceLevel === 'Med' ? '#fff3e0' : '#ffebee',
                            color: confidenceLevel === 'High' ? '#2e7d32' : confidenceLevel === 'Med' ? '#e65100' : '#c62828',
                          }}
                        />
                      </Box>
                    </Box>
                  </Card>
                </>
              ) : (
                <Card sx={{ p: 2, bgcolor: '#fff3cd', border: '1px solid #ffc107', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, fontSize: '0.875rem', color: '#856404' }}>
                    Anchor segment missing
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', mb: 2 }}>
                    The anchor segment was not found. This should not happen after building. Please rebuild the audience.
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleEditBrief}
                    sx={{ fontSize: '0.875rem' }}
                  >
                    Rebuild from Step 1
                  </Button>
                </Card>
              )}
            </Box>
          )}

          {/* Stage D: Extension Mode View */}
          {!isRebuilding && constructionMode === 'extension' && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {/* Main Content */}
                <Box sx={{ flex: 1 }}>
                  {/* Anchor Segment (always included, pinned at top) */}
                  {anchorSegment ? (
                    <Card sx={{ p: 1.5, mb: 2, bgcolor: '#f9f9f9', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <ProviderAvatar provider={anchorSegment.provider || 'CCS'} />
                            <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                              {anchorSegment.segment_label}
                            </Typography>
                          </Box>
                          {anchorSegment.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                              {anchorSegment.description}
                            </Typography>
                          )}
                        </Box>
                        <Chip label="Anchor" size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#e3f2fd' }} />
                      </Box>
                    </Card>
                  ) : (
                    <Card sx={{ p: 2, mb: 2, bgcolor: '#fff3cd', border: '1px solid #ffc107', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, fontSize: '0.875rem', color: '#856404' }}>
                        Anchor segment missing
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', mb: 2 }}>
                        The anchor segment was not found. This should not happen after building. Please rebuild the audience.
                      </Typography>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={handleEditBrief}
                        sx={{ fontSize: '0.875rem' }}
                      >
                        Rebuild from Step 1
                      </Button>
                    </Card>
                  )}

                  {/* Suggested Segments */}
                  {suggestedSegments.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
                                  onChange={() => setExpandedExplain(expandedExplain === segment.id ? null : segment.id)}
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
                                      onChange={(e) => handleToggleSegment(segment.id, e.target.checked)}
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
                    <Card sx={{ p: 2, bgcolor: '#f9f9f9', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                        {anchorSegment 
                          ? 'No suggested segments found. Click "Build audience" in Step 1 to generate suggestions.'
                          : 'Complete Step 1 and click "Build audience" to generate segment suggestions.'}
                      </Typography>
                    </Card>
                  )}
                </Box>

                {/* Included Segments Panel */}
                {includedSegments.length > 0 && (
                  <Card sx={{ width: 280, p: 1.5, bgcolor: '#f9f9f9', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', height: 'fit-content', position: 'sticky', top: 20 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, fontSize: '0.875rem' }}>
                      Included segments ({includedSegments.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {includedSegments.map((segment) => (
                        <Box key={segment.id} sx={{ p: 1, bgcolor: '#fff', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                            <ProviderAvatar provider={segment.provider} />
                            {segment.is_recommended && (
                              <Chip 
                                label="Recommended" 
                                size="small" 
                                sx={{ height: 16, fontSize: '0.65rem', bgcolor: '#e8f5e9', color: '#2e7d32' }}
                              />
                            )}
                          </Box>
                          <Typography variant="body2" sx={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                            {segment.segment_label}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Card>
                )}
              </Box>
            </Box>
          )}

          {/* Coverage Meter (Extension mode only) */}
          {constructionMode === 'extension' && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f9f9f9', borderRadius: 1, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
              <Box sx={{ display: 'flex', gap: 3 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                    Active Signals
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                    {coverageMetrics.activeSignalsCount}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                    Modelled Confidence
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                    {coverageMetrics.modelledConfidence}%
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                    Est. Match Coverage
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                    {coverageMetrics.estimatedMatchCoverage}%
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button onClick={onBack} size="small" sx={{ fontSize: '0.875rem' }}>BACK</Button>
            <Button variant="contained" onClick={onNext} size="small" sx={{ fontSize: '0.875rem' }}>
              NEXT
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Provider Match Modal (Validation Mode) */}
      <Dialog open={providerModalOpen} onClose={() => setProviderModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
          Contributing Data Providers: {contributingProviders} of {totalProviders}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontSize: '0.8125rem', mb: 1, color: 'text.secondary' }}>
              Confidence increases where multiple sources agree on the same locations.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
              <Chip 
                label={`Name agreement: ${contributingProviders}/${totalProviders}`} 
                size="small" 
                sx={{ height: 24, fontSize: '0.75rem', fontWeight: 500 }}
              />
              <Chip 
                label={`Geo agreement: ${geoAgreement}`} 
                size="small" 
                sx={{ height: 24, fontSize: '0.75rem', fontWeight: 500 }}
              />
            </Box>
            {constructionMode === 'validation' && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                Areas included in the audience require at least {validationMinAgreement} agreeing providers.
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {constructionMode === 'validation' && validationResults ? (
              // Validation mode: use validationResults
              <>
                {/* CCS is the base universe */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                  <ProviderAvatar provider="CCS" />
                  <Box sx={{ minWidth: 100 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                      CCS
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '0.875rem', mb: 0.5 }}>
                      Base universe provider
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      Defines eligible districts (confidence &gt;= 0.5)
                    </Typography>
                  </Box>
                  <Box>
                    <CheckCircle sx={{ color: '#4caf50', fontSize: '1.25rem' }} />
                  </Box>
                </Box>
                {/* Validating providers */}
                {Object.entries(validationResults.providerStats).map(([provider, stats]) => (
                  <Box key={provider} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <ProviderAvatar provider={provider} />
                    <Box sx={{ minWidth: 100 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                        {provider}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem', mb: 0.5 }}>
                        {stats.providerSegmentLabel || 'Validating provider'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                        Agreeing districts: {stats.agreeingDistricts}
                      </Typography>
                    </Box>
                    <Box>
                      <CheckCircle sx={{ color: '#4caf50', fontSize: '1.25rem' }} />
                    </Box>
                  </Box>
                ))}
              </>
            ) : (
              // Extension mode: use existing logic
              ['CCS', 'ONS', 'Experian', 'Outra', 'TwentyCI'].map((provider) => {
                const validatedSegment = validatedSegments.find(s => s.provider === provider);
                
                return (
                  <Box key={provider} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <ProviderAvatar provider={provider} />
                    <Box sx={{ minWidth: 100 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                        {provider}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      {validatedSegment ? (
                        <>
                          <Typography variant="body2" sx={{ fontSize: '0.875rem', mb: 0.5 }}>
                            {validatedSegment.segment_label}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                          No matching segment
                        </Typography>
                      )}
                    </Box>
                    <Box>
                      {validatedSegment ? (
                        <CheckCircle sx={{ color: '#4caf50', fontSize: '1.25rem' }} />
                      ) : (
                        <Cancel sx={{ color: '#9e9e9e', fontSize: '1.25rem' }} />
                      )}
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProviderModalOpen(false)} size="small" sx={{ fontSize: '0.875rem' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
