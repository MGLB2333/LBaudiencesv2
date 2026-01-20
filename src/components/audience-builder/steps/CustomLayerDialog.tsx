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
  TextField,
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

interface CustomLayerDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (file: File, layerName: string) => void;
}

export function CustomLayerDialog({
  open,
  onClose,
  onApply,
}: CustomLayerDialogProps) {
  const [layerName, setLayerName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      // Auto-fill layer name from filename if empty
      if (!layerName) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setLayerName(nameWithoutExt);
      }
    }
  };

  const handleApply = () => {
    if (selectedFile && layerName.trim()) {
      onApply(selectedFile, layerName.trim());
      // Reset form
      setSelectedFile(null);
      setFileName('');
      setLayerName('');
      onClose();
    }
  };

  const handleClose = () => {
    // Reset form on close
    setSelectedFile(null);
    setFileName('');
    setLayerName('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
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
        Add Custom Layer
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
          {/* Layer Name */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1 }}>
              Layer Name
            </Typography>
            <TextField
              fullWidth
              value={layerName}
              onChange={(e) => setLayerName(e.target.value)}
              placeholder="Enter a name for this layer"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: '#e0e0e0',
                  },
                },
              }}
            />
          </Box>

          {/* CSV File Upload */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1 }}>
              Upload CSV File
            </Typography>
            <Box
              sx={{
                border: '2px dashed #e0e0e0',
                borderRadius: 1,
                p: 3,
                textAlign: 'center',
                bgcolor: '#f9f9f9',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: '#02b5e7',
                  bgcolor: 'rgba(2, 181, 231, 0.05)',
                },
              }}
            >
              <input
                accept=".csv"
                style={{ display: 'none' }}
                id="csv-file-upload"
                type="file"
                onChange={handleFileChange}
              />
              <label htmlFor="csv-file-upload">
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                  }}
                >
                  <CloudUpload sx={{ fontSize: 40, color: '#02b5e7' }} />
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                    {fileName || 'Click to upload CSV file'}
                  </Typography>
                  {fileName && (
                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {selectedFile?.size ? `(${(selectedFile.size / 1024).toFixed(1)} KB)` : ''}
                    </Typography>
                  )}
                  <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 1 }}>
                    CSV should contain postcode districts
                  </Typography>
                </Box>
              </label>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button
          onClick={handleClose}
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
          disabled={!selectedFile || !layerName.trim()}
          sx={{
            bgcolor: '#02b5e7',
            color: 'white',
            textTransform: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            '&:hover': {
              bgcolor: '#02a0d0',
            },
            '&.Mui-disabled': {
              bgcolor: '#e0e0e0',
              color: '#9e9e9e',
            },
          }}
        >
          ADD LAYER
        </Button>
      </DialogActions>
    </Dialog>
  );
}
