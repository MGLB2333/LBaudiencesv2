'use client';

import { Box, Card, CardContent, Typography, Slider, Grid, Button, Chip } from '@mui/material';
import { useProfileSettings, useUpdateProfileSettings } from '@/features/audience-builder/hooks/useProfile';
import { useSegments } from '@/features/audience-builder/hooks/useSegments';
import { useRescoreGeoUnits } from '@/features/audience-builder/hooks/useGeo';
import { useConstructionSettings } from '@/features/audience-builder/hooks/useConstruction';
import { calculateDerivedStats } from '@/features/audience-builder/api/profile';
import { calculateCoverageMetrics } from '@/features/audience-builder/utils/coverage';
import { useState, useEffect } from 'react';
import { People as PeopleIcon } from '@mui/icons-material';

interface AudienceProfileStepProps {
  audienceId: string;
  onNext: () => void;
  onBack: () => void;
}

export function AudienceProfileStep({ audienceId, onNext, onBack }: AudienceProfileStepProps) {
  const { data: profile, isLoading: profileLoading } = useProfileSettings(audienceId);
  const { data: segments = [] } = useSegments(audienceId, 'primary');
  const { data: constructionSettings } = useConstructionSettings(audienceId);
  const updateMutation = useUpdateProfileSettings();
  const rescoreMutation = useRescoreGeoUnits();

  const coverageMetrics = calculateCoverageMetrics(constructionSettings);

  const [scaleAccuracy, setScaleAccuracy] = useState(profile?.scale_accuracy ?? 50);
  const [pendingAccuracy, setPendingAccuracy] = useState<number | null>(null);

  useEffect(() => {
    if (profile) {
      setScaleAccuracy(profile.scale_accuracy);
      setPendingAccuracy(null);
    }
  }, [profile]);

  const handleSliderChange = (_: Event, newValue: number | number[]) => {
    const value = newValue as number;
    setPendingAccuracy(value);
  };

  const handleApplySlider = async () => {
    if (pendingAccuracy === null) return;
    
    const value = pendingAccuracy;
    setScaleAccuracy(value);

    const baseSize = profile?.derived_audience_size ?? 5000000;
    const derived = calculateDerivedStats(value, baseSize);

    await updateMutation.mutateAsync({
      audienceId,
      updates: {
        scale_accuracy: value,
        ...derived,
      },
    });

    // Trigger geo re-scoring
    await rescoreMutation.mutateAsync({
      audienceId,
      scaleAccuracy: value,
    });
  };

  if (profileLoading) {
    return <Typography>Loading...</Typography>;
  }

  const audienceSize = profile?.derived_audience_size ?? 5050000;
  const primarySegment = segments.find((s) => s.segment_type === 'primary' && s.is_selected);
  
  // Get included segments
  const includedSegments = segments.filter(s => s.is_selected);
  const anchorSegment = includedSegments.find(s => s.origin === 'brief' || (s.provider === 'CCS' && !s.origin));
  const inferredSegments = includedSegments.filter(s => s.origin === 'suggested' || s.match_type === 'inferred');
  const validatedSegments = includedSegments.filter(s => s.origin === 'validated' || s.match_type === 'name_match');
  
  const mode = constructionSettings?.construction_mode || 'extension';
  const contributingProviders = validatedSegments.length;
  const totalProviders = 5;
  const suggestionsFound = segments.filter(s => s.origin === 'suggested').length;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <PeopleIcon sx={{ color: '#02b5e7', fontSize: '1.25rem' }} />
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
          Audience Profile
        </Typography>
      </Box>

      {/* Audience Composition Card */}
      <Card sx={{ mb: 3, bgcolor: '#f9f9f9', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, fontSize: '0.875rem' }}>
            Audience composition
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {anchorSegment && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                  Anchor segment
                </Typography>
                <Chip 
                  label={anchorSegment.segment_label} 
                  size="small" 
                  sx={{ height: 24, fontSize: '0.75rem', fontWeight: 500 }}
                />
              </Box>
            )}
            
            {inferredSegments.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                  Included inferred segments
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {inferredSegments.slice(0, 3).map((segment) => (
                    <Chip 
                      key={segment.id}
                      label={segment.segment_label} 
                      size="small" 
                      sx={{ height: 24, fontSize: '0.75rem' }}
                    />
                  ))}
                  {inferredSegments.length > 3 && (
                    <Chip 
                      label={`+${inferredSegments.length - 3} more`} 
                      size="small" 
                      sx={{ height: 24, fontSize: '0.75rem', bgcolor: '#e0e0e0' }}
                    />
                  )}
                </Box>
              </Box>
            )}
            
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
              <Chip 
                label={`Mode: ${mode === 'validation' ? 'Validation' : 'Extension'}`} 
                size="small" 
                sx={{ height: 24, fontSize: '0.75rem' }}
              />
              {mode === 'validation' ? (
                <Chip 
                  label={`Providers matched: ${contributingProviders}/${totalProviders}`} 
                  size="small" 
                  sx={{ height: 24, fontSize: '0.75rem' }}
                />
              ) : (
                <Chip 
                  label={`Suggestions found: ${suggestionsFound}`} 
                  size="small" 
                  sx={{ height: 24, fontSize: '0.75rem' }}
                />
              )}
              {constructionSettings?.last_run_at && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', alignSelf: 'center' }}>
                  Last built: {new Date(constructionSettings.last_run_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
        {/* Coverage Meter - Compact */}
        <Box sx={{ mb: 3, p: 1.5, bgcolor: '#f9f9f9', borderRadius: 1, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                Active Signals
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                {coverageMetrics.activeSignalsCount}
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                Modelled Confidence
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                {coverageMetrics.modelledConfidence}%
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                Est. Match Coverage
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                {coverageMetrics.estimatedMatchCoverage}%
              </Typography>
            </Grid>
          </Grid>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 2, mb: 2, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontSize: '0.8125rem' }}>
                Primary Audience
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 1, fontSize: '0.875rem' }}>
                {primarySegment?.segment_label || 'Families with kids over 11'}
              </Typography>
              <Typography variant="body2" color="success.main" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                High
              </Typography>
            </Card>
            <Card sx={{ p: 2, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontSize: '0.8125rem' }}>
                Secondary Audience
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 1, fontSize: '0.875rem' }}>
                Shopper habits
              </Typography>
              <Typography variant="body2" color="success.main" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                High
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={12} md={8}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: '1rem' }}>
                {primarySegment?.segment_label || 'Families with kids over 11'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="body2" sx={{ minWidth: 80, fontSize: '0.8125rem' }}>
                  Accuracy
                </Typography>
                <Slider
                  value={pendingAccuracy ?? scaleAccuracy}
                  onChange={handleSliderChange}
                  min={0}
                  max={100}
                  step={1}
                  sx={{ flex: 1 }}
                  size="small"
                />
                <Typography variant="body2" sx={{ minWidth: 60, fontSize: '0.8125rem' }}>
                  Scale
                </Typography>
              </Box>
              {pendingAccuracy !== null && pendingAccuracy !== scaleAccuracy && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleApplySlider}
                    disabled={rescoreMutation.isPending}
                  >
                    {rescoreMutation.isPending ? 'Applying...' : 'Apply Changes'}
                  </Button>
                </Box>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                    Audience Size
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '1.5rem' }}>
                    {audienceSize.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ mt: 3 }}>
              {segments
                .filter((s) => s.is_selected)
                .map((segment) => (
                  <Card key={segment.id} sx={{ p: 2, mb: 2, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: '#e0f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                          {segment.provider.substring(0, 2)}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, fontSize: '0.875rem' }}>
                          {segment.segment_label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, fontSize: '0.75rem' }}>
                          Provider: {segment.provider}
                        </Typography>
                        {segment.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                            {segment.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Card>
                ))}
            </Box>
          </Grid>
        </Grid>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button onClick={onBack} size="small">BACK</Button>
            <Button variant="contained" onClick={onNext} size="small">
              NEXT
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
