'use client';

import { Box } from '@mui/material';
import Image from 'next/image';
import { useSelectedLogo } from '@/features/admin/hooks/useAdminSettings';

export function LogoImage() {
  const { data: selectedLogo, isLoading } = useSelectedLogo();
  
  // Default logo if none selected or loading
  const logoFile = selectedLogo || 'Total TV_Primary logo.png';
  
  // LightBox logo has no padding, so make it smaller
  const isLightBox = logoFile === 'LightBox_Custom_WhiteBlue.png';
  const logoHeight = isLightBox ? 28 : 48;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', height: 48 }}>
      <Image
        src={`/logos/${logoFile}`}
        alt="Logo"
        height={logoHeight}
        width={logoHeight * 2} // Approximate aspect ratio
        style={{ height: logoHeight, width: 'auto', objectFit: 'contain' }}
        unoptimized
      />
    </Box>
  );
}
