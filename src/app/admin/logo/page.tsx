'use client';

import { Box, Card, CardContent, Typography, Chip, CircularProgress } from '@mui/material';
import { useState } from 'react';
import { AdminPageShell } from '@/features/admin/components/AdminPageShell';
import { useSelectedLogo, useSetSelectedLogo } from '@/features/admin/hooks/useAdminSettings';
import Image from 'next/image';

const AVAILABLE_LOGOS = [
  { file: 'Total TV_Primary logo.png', label: 'Total TV' },
  { file: 'LightBox_Custom_WhiteBlue.png', label: 'LightBox' },
];

export default function LogoPage() {
  const { data: selectedLogo, isLoading } = useSelectedLogo();
  const setSelectedLogo = useSetSelectedLogo();
  const [isSaving, setIsSaving] = useState(false);

  const handleSelectLogo = async (filename: string) => {
    if (selectedLogo === filename) return; // Already selected

    setIsSaving(true);
    try {
      await setSelectedLogo.mutateAsync(filename);
      // Update header logo immediately by triggering a page refresh or context update
      window.location.reload(); // Simple approach - could be optimized with context
    } catch (error) {
      console.error('Failed to set logo:', error);
      alert('Failed to save logo selection. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AdminPageShell title="Logo" subtitle="Select which logo appears across the product (demo setting).">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell title="Logo" subtitle="Select which logo appears across the product (demo setting).">
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {AVAILABLE_LOGOS.map((logo) => {
          const isSelected = selectedLogo === logo.file;
          return (
            <Card
              key={logo.file}
              onClick={() => !isSaving && handleSelectLogo(logo.file)}
              sx={{
                cursor: isSaving ? 'default' : 'pointer',
                border: isSelected ? '2px solid #02b5e7' : '1px solid #e0e0e0',
                bgcolor: '#000000',
                width: 300,
                transition: 'all 0.2s',
                '&:hover': {
                  transform: isSaving ? 'none' : 'translateY(-2px)',
                  boxShadow: isSaving ? 'none' : '0 4px 12px rgba(0,0,0,0.15)',
                },
              }}
            >
              <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: '100%',
                    height: 120,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: '#000000',
                    position: 'relative',
                  }}
                >
                  <img
                    src={`/logos/${logo.file}`}
                    alt={logo.label}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500 }}>
                  {logo.label}
                </Typography>
                {isSelected && (
                  <Chip
                    label="Selected"
                    size="small"
                    sx={{
                      bgcolor: '#02b5e7',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                    }}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </AdminPageShell>
  );
}
