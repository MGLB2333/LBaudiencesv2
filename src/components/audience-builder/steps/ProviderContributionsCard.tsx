'use client';

import { Box, Card, CardContent, Typography, Avatar, LinearProgress } from '@mui/material';
import { ExportContext } from './hooks/useExportContext';

interface ProviderContributionsCardProps {
  context: ExportContext;
}

export function ProviderContributionsCard({ context }: ProviderContributionsCardProps) {
  const isExtension = context.mode === 'extension';
  const hasOverlap = context.providers.some(p => p.overlapPercent !== undefined);

  return (
    <Card id="export-providers" sx={{ mb: 2, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
      <CardContent sx={{ p: 2, pb: 12, '&:last-child': { pb: 12 } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}>
          Contributing Providers
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 2 }}>
          {isExtension && hasOverlap
            ? 'Percentages represent incremental contribution vs current selection.'
            : '% of included districts supported by provider'}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {context.providers.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
              No provider data available
            </Typography>
          ) : (
            context.providers.map((provider) => (
              <Box key={provider.provider} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar
                  src={provider.iconUrl}
                  sx={{ width: 32, height: 32, fontSize: '0.75rem', bgcolor: '#e0e0e0' }}
                >
                  {provider.provider.charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.8125rem', fontWeight: 500, mb: 0.5 }}>
                    {provider.providerLabel}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, provider.percentContributed)}
                      sx={{
                        flex: 1,
                        height: 6,
                        borderRadius: 3,
                        bgcolor: '#e0e0e0',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: '#02b5e7',
                          borderRadius: 3,
                        },
                      }}
                    />
                    <Box sx={{ minWidth: 80, textAlign: 'right' }}>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                        {provider.percentContributed.toFixed(1)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block' }}>
                        ({provider.districtsContributed} districts)
                      </Typography>
                    </Box>
                  </Box>
                  {provider.overlapPercent !== undefined && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', mt: 0.25 }}>
                      Overlap: {provider.overlapPercent.toFixed(0)}%
                    </Typography>
                  )}
                  {provider.avgConfidence !== undefined && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', mt: 0.25 }}>
                      Avg confidence: {provider.avgConfidence.toFixed(2)}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
