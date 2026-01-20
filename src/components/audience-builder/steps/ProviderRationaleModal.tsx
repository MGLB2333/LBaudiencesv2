'use client';

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';

interface ProviderRationaleModalProps {
  open: boolean;
  onClose: () => void;
  provider: string;
  matchPercent: number;
}

export function ProviderRationaleModal({ open, onClose, provider, matchPercent }: ProviderRationaleModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ fontSize: '1.125rem', fontWeight: 600, pb: 1, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
        Match rationale: {provider}
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5, fontSize: '0.875rem' }}>
              Match: {matchPercent}%
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', lineHeight: 1.6 }}>
              For MVP, match % is calculated from uploaded district coverage for this segment. Later we will use semantic similarity and geo overlap.
            </Typography>
          </Box>
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
