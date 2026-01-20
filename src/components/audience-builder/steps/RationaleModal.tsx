'use client';

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Chip, Avatar } from '@mui/material';
import { ExtensionSuggestion } from '@/features/audience-builder/api/extensionResults';
import { getProviderFavicon } from '../providers/providerIcons';

interface RationaleModalProps {
  open: boolean;
  onClose: () => void;
  suggestion: ExtensionSuggestion | null;
}

function ProviderAvatar({ provider }: { provider: string }) {
  const iconUrl = getProviderFavicon(provider);
  return (
    <Avatar
      src={iconUrl}
      sx={{ width: 20, height: 20, fontSize: '0.65rem', bgcolor: '#e0e0e0' }}
    >
      {provider.charAt(0)}
    </Avatar>
  );
}

export function RationaleModal({ open, onClose, suggestion }: RationaleModalProps) {
  if (!suggestion) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ fontSize: '1.125rem', fontWeight: 600, pb: 1, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
        {suggestion.label}
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Match percentage */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
              Match:
            </Typography>
            <Chip
              label={`${suggestion.matchPercent}%`}
              size="small"
              sx={{
                height: 24,
                fontSize: '0.75rem',
                bgcolor: suggestion.matchPercent >= 80 ? '#e8f5e9' : suggestion.matchPercent >= 60 ? '#fff3e0' : '#ffebee',
                color: suggestion.matchPercent >= 80 ? '#2e7d32' : suggestion.matchPercent >= 60 ? '#e65100' : '#c62828',
              }}
            />
          </Box>

          {/* Provider coverage */}
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5, fontSize: '0.875rem' }}>
              Provider Coverage
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', mb: 1 }}>
              {suggestion.providersAvailableCount} providers covering {suggestion.districtsAvailableCount.toLocaleString()} districts
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {suggestion.providers.slice(0, 6).map((provider) => (
                <Box key={provider} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <ProviderAvatar provider={provider} />
                  <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                    {provider}
                  </Typography>
                </Box>
              ))}
              {suggestion.providers.length > 6 && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  +{suggestion.providers.length - 6} more
                </Typography>
              )}
            </Box>
          </Box>

          {/* Rationale */}
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5, fontSize: '0.875rem' }}>
              Why this segment?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', lineHeight: 1.6 }}>
              {suggestion.rationale}
            </Typography>
          </Box>

          {/* Description if available */}
          {suggestion.description && (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5, fontSize: '0.875rem' }}>
                Description
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', lineHeight: 1.6 }}>
                {suggestion.description}
              </Typography>
            </Box>
          )}

          {/* Tags if available */}
          {suggestion.tags && suggestion.tags.length > 0 && (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5, fontSize: '0.875rem' }}>
                Tags
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {suggestion.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.6875rem',
                      bgcolor: '#f5f5f5',
                      color: 'text.secondary',
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            bgcolor: '#02b5e7',
            '&:hover': { bgcolor: '#02a0d0' },
            fontSize: '0.875rem',
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
