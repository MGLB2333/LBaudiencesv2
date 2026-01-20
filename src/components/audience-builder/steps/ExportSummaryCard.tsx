'use client';

import { Box, Card, CardContent, Typography, Chip, Grid } from '@mui/material';
import { ExportContext } from './hooks/useExportContext';
import { format } from 'date-fns';
import { DonutChart } from './DonutChart';

interface ExportSummaryCardProps {
  context: ExportContext;
  activationTarget?: 'districts' | 'h3' | 'geojson';
  exportMethod?: 'download' | 'push';
}

export function ExportSummaryCard({ context, activationTarget, exportMethod }: ExportSummaryCardProps) {
  const isExtension = context.mode === 'extension';
  const hasOverlap = context.providers.some(p => p.overlapPercent !== undefined);

  return (
    <Card id="export-summary" sx={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
      <CardContent sx={{ p: 3, pb: 12, '&:last-child': { pb: 12 } }}>
        {/* Last built timestamp */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            {context.lastBuiltAt
              ? format(new Date(context.lastBuiltAt), 'PPp')
              : 'Not built yet'}
          </Typography>
        </Box>

        {/* Two-column layout: Summary on left, Donut chart on right */}
        <Grid container spacing={3}>
          {/* Left column: Summary details */}
          <Grid item xs={12} md={7}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                  Mode
                </Typography>
                <Chip
                  label={context.mode === 'validation' ? 'Validation' : 'Extension'}
                  size="small"
                  sx={{ height: 24, fontSize: '0.75rem' }}
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                  Segment(s) included
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {context.selectedSegments.map((segment) => (
                    <Chip
                      key={segment.segment_key}
                      label={segment.segment_label}
                      size="small"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  ))}
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                  Included areas
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                  {context.includedCount.toLocaleString()}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                  Estimated households
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                  {context.estimatedHouseholds.toLocaleString()}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                  Threshold
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                  {context.thresholdLabel}
                </Typography>
              </Grid>
              {exportMethod === 'download' && activationTarget && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                    Output target
                  </Typography>
                  <Chip
                    label={activationTarget === 'h3' ? 'H3 hexes' : activationTarget === 'geojson' ? 'GeoJSON' : 'Districts'}
                    size="small"
                    sx={{ height: 24, fontSize: '0.75rem' }}
                  />
                </Grid>
              )}
            </Grid>
          </Grid>

          {/* Right column: Donut chart */}
          <Grid item xs={12} md={5}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 1.5, fontWeight: 600 }}>
                Contributing providers
              </Typography>
              {context.providers.length > 0 ? (
                <DonutChart providers={context.providers} size={180} />
              ) : (
                <Box sx={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    No provider data available
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
