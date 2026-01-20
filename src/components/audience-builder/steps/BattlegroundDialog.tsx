'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  IconButton,
  Slider,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { Add, Remove } from '@mui/icons-material';

interface BattlegroundConfig {
  zoneType: 'district' | 'hex';
  minTotalStores: number;
  balance: number; // 0 = client-heavy, 100 = competitor-heavy
  requireClientStore: boolean;
}

interface BattlegroundDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (config: BattlegroundConfig) => void;
  initialConfig?: BattlegroundConfig;
}

const defaultConfig: BattlegroundConfig = {
  zoneType: 'district',
  minTotalStores: 3,
  balance: 50,
  requireClientStore: true,
};

export function BattlegroundDialog({
  open,
  onClose,
  onApply,
  initialConfig = defaultConfig,
}: BattlegroundDialogProps) {
  const [config, setConfig] = useState<BattlegroundConfig>(initialConfig);

  const handleZoneTypeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newType: 'district' | 'hex' | null
  ) => {
    if (newType !== null) {
      setConfig((prev) => ({ ...prev, zoneType: newType }));
    }
  };

  const handleMinStoresChange = (delta: number) => {
    setConfig((prev) => ({
      ...prev,
      minTotalStores: Math.max(1, prev.minTotalStores + delta),
    }));
  };

  const handleBalanceChange = (_event: Event, newValue: number | number[]) => {
    setConfig((prev) => ({ ...prev, balance: newValue as number }));
  };

  const handleRequireClientStoreChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prev) => ({ ...prev, requireClientStore: event.target.checked }));
  };

  const handleApply = () => {
    onApply(config);
    onClose();
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
        Define Battleground Zones
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
          {/* Zone Type */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1.5 }}>
              Zone Type
            </Typography>
            <ToggleButtonGroup
              value={config.zoneType}
              exclusive
              onChange={handleZoneTypeChange}
              fullWidth
              sx={{
                '& .MuiToggleButton-root': {
                  flex: 1,
                  px: 2,
                  py: 1,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textTransform: 'none',
                  color: '#02b5e7',
                  borderColor: 'rgba(2, 181, 231, 0.3)',
                  bgcolor: 'white',
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(2, 181, 231, 0.1)',
                    color: '#02b5e7',
                    '&:hover': {
                      backgroundColor: 'rgba(2, 181, 231, 0.15)',
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(2, 181, 231, 0.05)',
                  },
                },
              }}
            >
              <ToggleButton value="district">Postcode District</ToggleButton>
              <ToggleButton value="hex">Hex Grid (H3)</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Minimum Total Stores Required */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1.5 }}>
              Minimum Total Stores Required
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                onClick={() => handleMinStoresChange(-1)}
                disabled={config.minTotalStores <= 1}
                sx={{
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                  width: 36,
                  height: 36,
                }}
              >
                <Remove sx={{ fontSize: '1rem' }} />
              </IconButton>
              <TextField
                value={config.minTotalStores}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1) {
                    setConfig((prev) => ({ ...prev, minTotalStores: val }));
                  }
                }}
                inputProps={{
                  style: { textAlign: 'center', fontSize: '1rem', fontWeight: 500 },
                  min: 1,
                }}
                sx={{
                  width: 80,
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: '#e0e0e0',
                    },
                  },
                }}
              />
              <IconButton
                onClick={() => handleMinStoresChange(1)}
                sx={{
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                  width: 36,
                  height: 36,
                }}
              >
                <Add sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 1, display: 'block' }}>
              Zones must contain at least this many combined stores (yours + competitors) to be included.
            </Typography>
          </Box>

          {/* Battleground Balance */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1.5 }}>
              Battleground Balance
            </Typography>
            <Slider
              value={config.balance}
              onChange={handleBalanceChange}
              min={0}
              max={100}
              step={1}
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
                  '&:hover': {
                    boxShadow: '0 2px 8px rgba(2, 181, 231, 0.4)',
                  },
                },
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
              <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                Client-heavy
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                Competitor-heavy
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 1, display: 'block' }}>
              Choose the balance of store presence you want to highlight:
            </Typography>
          </Box>

          {/* Checkbox */}
          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.requireClientStore}
                  onChange={handleRequireClientStoreChange}
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
                  Only include zones with at least one client store
                </Typography>
              }
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
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
          APPLY BATTLEGROUND LOGIC
        </Button>
      </DialogActions>
    </Dialog>
  );
}
