'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
} from '@mui/material';

interface PoiFiltersDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (selectedTypes: string[]) => void;
  selectedTypes?: string[];
}

const poiTypes = [
  { id: 'stores', label: 'Stores' },
  { id: 'restaurants', label: 'Restaurants' },
  { id: 'schools', label: 'Schools' },
  { id: 'hospitals', label: 'Hospitals' },
];

export function PoiFiltersDialog({
  open,
  onClose,
  onApply,
  selectedTypes = [],
}: PoiFiltersDialogProps) {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedTypes);

  // Sync local state when dialog opens or selectedTypes prop changes
  useEffect(() => {
    if (open) {
      setLocalSelected(selectedTypes);
    }
  }, [open, selectedTypes]);

  const handleToggle = (poiId: string) => {
    setLocalSelected((prev) => {
      if (prev.includes(poiId)) {
        return prev.filter((id) => id !== poiId);
      } else {
        return [...prev, poiId];
      }
    });
  };

  const handleApply = () => {
    onApply(localSelected);
    onClose();
  };

  const handleClear = () => {
    setLocalSelected([]);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        },
      }}
    >
      <DialogTitle sx={{ fontSize: '1.25rem', fontWeight: 600, pb: 1 }}>
        Select POI Types
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          {poiTypes.map((poi) => (
            <FormControlLabel
              key={poi.id}
              control={
                <Checkbox
                  checked={localSelected.includes(poi.id)}
                  onChange={() => handleToggle(poi.id)}
                  sx={{
                    color: '#02b5e7',
                    '&.Mui-checked': {
                      color: '#02b5e7',
                    },
                  }}
                />
              }
              label={
                <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                  {poi.label}
                </Typography>
              }
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button
          onClick={handleClear}
          sx={{
            color: '#02b5e7',
            textTransform: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            mr: 'auto',
          }}
        >
          Clear All
        </Button>
        <Button
          onClick={onClose}
          sx={{
            color: '#02b5e7',
            textTransform: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          CANCEL
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          sx={{
            bgcolor: '#02b5e7',
            color: 'white',
            textTransform: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            '&:hover': {
              bgcolor: '#02a0d0',
            },
          }}
        >
          APPLY
        </Button>
      </DialogActions>
    </Dialog>
  );
}
