'use client';

import { useState } from 'react';
import { Box, Typography, FormControl, FormHelperText, Chip, Checkbox, FormControlLabel, Paper, Collapse, IconButton } from '@mui/material';
import { ExpandMore, ExpandLess, Close } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { getAllTvRegions } from '@/features/audience-builder/api/tvRegions';

interface TvRegionFilterProps {
  selectedRegions: string[];
  onRegionsChange: (regions: string[]) => void;
  tvRegionDistrictsCount?: number; // Total districts in selected TV region(s) (union)
  finalEligibleCount?: number; // Final eligible districts after segment AND TV region filter
}

export function TvRegionFilter({ 
  selectedRegions, 
  onRegionsChange,
  tvRegionDistrictsCount,
  finalEligibleCount,
}: TvRegionFilterProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: tvRegions = [], isLoading } = useQuery({
    queryKey: ['tvRegions'],
    queryFn: getAllTvRegions,
    staleTime: 10 * 60 * 1000, // 10 minutes - TV regions don't change often
  });

  const handleToggle = (regionKey: string) => {
    if (selectedRegions.includes(regionKey)) {
      onRegionsChange(selectedRegions.filter(r => r !== regionKey));
    } else {
      onRegionsChange([...selectedRegions, regionKey]);
    }
  };

  const handleRemoveChip = (regionKey: string, event: React.MouseEvent) => {
    event.stopPropagation();
    onRegionsChange(selectedRegions.filter(r => r !== regionKey));
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
        TV Regions
      </Typography>
      
      {/* Selected chips */}
      {selectedRegions.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
          {selectedRegions.map((regionKey) => {
            const region = tvRegions.find((r) => r.region_key === regionKey);
            return (
              <Chip
                key={regionKey}
                label={region?.name || regionKey}
                size="small"
                onDelete={(e) => handleRemoveChip(regionKey, e)}
                deleteIcon={<Close />}
                sx={{
                  '& .MuiChip-deleteIcon': {
                    fontSize: '1rem',
                  },
                }}
              />
            );
          })}
        </Box>
      )}

      {/* Multi-select with checkboxes */}
      <FormControl fullWidth>
        <Paper
          variant="outlined"
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
            cursor: 'pointer',
            '&:hover': {
              borderColor: 'primary.main',
            },
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 1.5,
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="body2" sx={{ color: selectedRegions.length > 0 ? 'text.primary' : 'text.secondary' }}>
              {selectedRegions.length === 0
                ? 'Select TV regions'
                : selectedRegions.length === 1
                ? `${tvRegions.find(r => r.region_key === selectedRegions[0])?.name || '1 region'} selected`
                : `${selectedRegions.length} regions selected`
              }
            </Typography>
            <IconButton size="small" sx={{ p: 0.5 }}>
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
          
          <Collapse in={expanded}>
            <Box
              sx={{
                maxHeight: 300,
                overflowY: 'auto',
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {isLoading ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Loading regions...
                  </Typography>
                </Box>
              ) : tvRegions.length === 0 ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No TV regions available
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ p: 1 }}>
                  {tvRegions.map((region) => {
                    const isSelected = selectedRegions.includes(region.region_key);
                    return (
                      <FormControlLabel
                        key={region.region_key}
                        control={
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleToggle(region.region_key)}
                            size="small"
                            sx={{ py: 0.5 }}
                          />
                        }
                        label={region.name}
                        sx={{
                          display: 'flex',
                          width: '100%',
                          m: 0,
                          py: 0.5,
                          '&:hover': {
                            bgcolor: 'action.hover',
                            borderRadius: 0.5,
                          },
                        }}
                      />
                    );
                  })}
                </Box>
              )}
            </Box>
          </Collapse>
        </Paper>
        
        {selectedRegions.length > 0 && tvRegionDistrictsCount !== undefined && finalEligibleCount !== undefined && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', mt: 1, display: 'block' }}>
            {selectedRegions.length === 1 
              ? `${tvRegions.find(r => r.region_key === selectedRegions[0])?.name || 'Selected region'}: ${tvRegionDistrictsCount} districts in region • ${finalEligibleCount} match your selected audience`
              : `${tvRegionDistrictsCount} districts in selected regions • ${finalEligibleCount} match your selected audience`
            }
          </Typography>
        )}
        <FormHelperText sx={{ mt: 0.5 }}>
          Filters the map to selected TV broadcast regions
        </FormHelperText>
      </FormControl>
    </Box>
  );
}
