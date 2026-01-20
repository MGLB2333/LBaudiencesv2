'use client';

import { Box, Typography } from '@mui/material';
import { ReactNode } from 'react';

interface AdminPageShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AdminPageShell({ title, subtitle, children }: AdminPageShellProps) {
  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, fontSize: '1rem' }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: '0.8125rem' }}>
          {subtitle}
        </Typography>
      )}
      {children}
    </Box>
  );
}
