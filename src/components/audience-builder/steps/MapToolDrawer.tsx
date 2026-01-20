'use client';

import React from 'react';
import { Box, IconButton, Typography, Paper, Backdrop } from '@mui/material';
import { ChevronRight, Store, LocationOn, GpsFixed } from '@mui/icons-material';

interface MapToolDrawerProps {
  open: boolean;
  tool: 'stores' | 'locations' | 'battleZones' | null;
  onClose: () => void;
  children: React.ReactNode;
}

export function MapToolDrawer({ open, tool, onClose, children }: MapToolDrawerProps) {
  const toolTitles: Record<string, string> = {
    stores: 'Store POIs',
    locations: 'Locations',
    battleZones: 'Battle Zones',
  };

  const toolIcons: Record<string, React.ReactNode> = {
    stores: <Store />,
    locations: <LocationOn />,
    battleZones: <GpsFixed />,
  };

  const title = tool ? toolTitles[tool] : '';
  const icon = tool ? toolIcons[tool] : null;

  return (
    <>
      {/* Backdrop - click to close */}
      <Backdrop
        open={open}
        onClick={onClose}
        sx={{
          position: 'absolute',
          zIndex: 1299,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          transition: 'opacity 0.3s ease-in-out',
        }}
      />
      
      {/* Drawer */}
      <Paper
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: { xs: '90%', sm: 420 },
          height: '100%',
          zIndex: 1300,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.15)',
          borderRadius: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {icon && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  color: 'text.secondary',
                }}
              >
                {icon}
              </Box>
            )}
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
              {title}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
            <ChevronRight />
          </IconButton>
        </Box>

        {/* Content */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 3,
            bgcolor: 'background.paper',
          }}
        >
          {children}
        </Box>
      </Paper>
    </>
  );
}
