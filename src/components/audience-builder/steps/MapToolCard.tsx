'use client';

import React from 'react';
import { Card, CardActionArea, Box, Typography, Chip } from '@mui/material';

interface MapToolCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
  badgeCount?: number;
}

export function MapToolCard({ title, subtitle, icon, selected = false, onClick, badgeCount }: MapToolCardProps) {
  return (
    <Card
      sx={{
        mb: 1.5,
        border: selected ? '2px solid' : '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'action.selected' : 'background.paper',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: 2,
        },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 1,
              bgcolor: selected ? 'primary.light' : 'action.hover',
              color: selected ? 'primary.main' : 'text.secondary',
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: 'text.primary',
                }}
              >
                {title}
              </Typography>
              {badgeCount !== undefined && badgeCount > 0 && (
                <Chip
                  label={badgeCount}
                  size="small"
                  sx={{
                    height: 18,
                    minWidth: 20,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    bgcolor: '#02b5e7',
                    color: 'white',
                    '& .MuiChip-label': {
                      px: 0.75,
                    },
                  }}
                />
              )}
            </Box>
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.75rem',
                color: 'text.secondary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {subtitle}
            </Typography>
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
}
