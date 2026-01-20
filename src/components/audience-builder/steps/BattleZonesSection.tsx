'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Slider,
  Paper,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { usePoiBrands } from '@/features/audience-builder/hooks/useStorePois';
import { useBattleZoneDistricts, useBattleZoneSummary } from '@/features/audience-builder/hooks/useBattleZones';
import { BattleZoneSummary } from '@/features/audience-builder/api/battleZones';

interface BattleZonesSectionProps {
  baseBrand: string;
  onBaseBrandChange: (brand: string) => void;
  competitorBrands: string[];
  onCompetitorBrandsChange: (brands: string[]) => void;
  ringsDraft: number;
  ringsApplied: number;
  onRingsDraftChange: (rings: number) => void;
  onRingsApply: (rings: number) => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  tvRegions?: string[];
}

export function BattleZonesSection({
  baseBrand,
  onBaseBrandChange,
  competitorBrands,
  onCompetitorBrandsChange,
  ringsDraft,
  ringsApplied,
  onRingsDraftChange,
  onRingsApply,
  enabled,
  onEnabledChange,
  tvRegions = [],
}: BattleZonesSectionProps) {
  const { data: brands = [], isLoading: brandsLoading } = usePoiBrands();

  // Initialize defaults if base brand is empty
  useEffect(() => {
    if (!baseBrand && brands.length > 0) {
      // Default to Magnet if present, otherwise first brand
      const magnetBrand = brands.find(b => b.brand === 'Magnet');
      if (magnetBrand) {
        onBaseBrandChange('Magnet');
      } else {
        onBaseBrandChange(brands[0].brand);
      }
    }
  }, [baseBrand, brands, onBaseBrandChange]);

  // Initialize competitor brands if empty
  useEffect(() => {
    if (competitorBrands.length === 0 && brands.length > 0) {
      const defaultCompetitors = ['Howdens', 'Wren', 'Wickes'].filter(brandName =>
        brands.some(b => b.brand === brandName)
      );
      if (defaultCompetitors.length > 0) {
        onCompetitorBrandsChange(defaultCompetitors);
      }
    }
  }, [competitorBrands, brands, onCompetitorBrandsChange]);

  // Fetch battle zones data when enabled
  const battleZonesOptions = useMemo(() => {
    if (!enabled || !baseBrand) return null;
    return {
      baseBrand,
      competitorBrands: competitorBrands.length > 0 ? competitorBrands : undefined,
      rings: ringsApplied,
      tvRegions: tvRegions.length > 0 ? tvRegions : undefined,
    };
  }, [enabled, baseBrand, competitorBrands, ringsApplied, tvRegions]);

  const { data: districts = [], isLoading: districtsLoading } = useBattleZoneDistricts(
    battleZonesOptions,
    enabled && !!baseBrand
  );

  const { data: summary, isLoading: summaryLoading } = useBattleZoneSummary(
    battleZonesOptions,
    enabled && !!baseBrand
  );

  const handleCompetitorToggle = (brand: string) => {
    if (competitorBrands.includes(brand)) {
      onCompetitorBrandsChange(competitorBrands.filter(b => b !== brand));
    } else {
      onCompetitorBrandsChange([...competitorBrands, brand]);
    }
  };

  const handleRingsChange = (_event: Event, value: number | number[]) => {
    onRingsDraftChange(Array.isArray(value) ? value[0] : value);
  };

  const handleRingsChangeCommitted = (_event: Event | React.SyntheticEvent, value: number | number[]) => {
    onRingsApply(Array.isArray(value) ? value[0] : value);
  };

  return (
    <Box sx={{ mt: 2, mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
        Battle Zones
      </Typography>

      {/* Enable Toggle */}
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            size="small"
          />
        }
        label={
          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
            Enable battle zones
          </Typography>
        }
        sx={{ mb: 1.5 }}
      />

      {enabled && (
        <>
          {/* Base Brand Select */}
          <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
            <InputLabel id="base-brand-label">Base brand</InputLabel>
            <Select
              labelId="base-brand-label"
              value={baseBrand}
              onChange={(e) => onBaseBrandChange(e.target.value)}
              label="Base brand"
              disabled={brandsLoading}
            >
              {brands.map((brand) => (
                <MenuItem key={brand.brand} value={brand.brand}>
                  {brand.brand} ({brand.count})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Competitor Brands Multi-Select */}
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block', mb: 0.5 }}>
              Competitor brands
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {brands
                .filter(b => b.brand !== baseBrand)
                .map((brand) => {
                  const isSelected = competitorBrands.includes(brand.brand);
                  return (
                    <Chip
                      key={brand.brand}
                      label={`${brand.brand} (${brand.count})`}
                      onClick={() => handleCompetitorToggle(brand.brand)}
                      size="small"
                      sx={{
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        bgcolor: isSelected ? 'grey.700' : 'grey.100',
                        color: isSelected ? 'white' : 'text.primary',
                        '&:hover': {
                          bgcolor: isSelected ? 'grey.800' : 'grey.200',
                        },
                      }}
                    />
                  );
                })}
            </Box>
          </Box>

          {/* Coverage Radius Slider */}
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 500 }}>
              Coverage radius: {ringsDraft}
            </Typography>
            <Slider
              value={ringsDraft}
              onChange={handleRingsChange}
              onChangeCommitted={handleRingsChangeCommitted}
              min={0}
              max={4}
              step={1}
              marks
              valueLabelDisplay="auto"
              size="small"
            />
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', display: 'block', mt: 0.5 }}>
              Each step expands the battle area by multiple district hops (bigger jumps).
            </Typography>
            {ringsDraft > 0 && (
              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'primary.main', display: 'block', mt: 0.25, fontWeight: 500 }}>
                Radius steps: {ringsDraft * 5} districts outward
              </Typography>
            )}
          </Box>

          {/* Summary */}
          {(districtsLoading || summaryLoading) && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={20} />
            </Box>
          )}

          {!districtsLoading && !summaryLoading && summary && (
            <Paper sx={{ p: 1.5, bgcolor: '#f9f9f9', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, display: 'block', mb: 1 }}>
                Summary
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {process.env.NODE_ENV === 'development' && (
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', fontStyle: 'italic', mb: 0.5 }}>
                    Effective steps: {ringsApplied * 5} (radius {ringsApplied} × scale 5)
                  </Typography>
                )}
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                  Catchment: {summary.totalCatchmentDistricts} districts
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                  Owned: {summary.ownedDistricts} • Contested: {summary.contestedDistricts} • Competitor-only: {summary.competitorOnlyDistricts}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                  Stores: {summary.baseStoreCountInCatchment} base • {summary.competitorStoreCountInCatchment} competitor
                </Typography>
              </Box>

              {/* Top Contested Districts */}
              {summary.topContestedDistricts && summary.topContestedDistricts.length > 0 && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, display: 'block', mb: 0.5 }}>
                    Top contested districts
                  </Typography>
                  <TableContainer sx={{ maxHeight: 150 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontSize: '0.65rem', py: 0.5 }}>District</TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.65rem', py: 0.5 }}>Base</TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.65rem', py: 0.5 }}>Comp</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {summary.topContestedDistricts.slice(0, 5).map((row) => (
                          <TableRow key={row.district}>
                            <TableCell sx={{ fontSize: '0.65rem', py: 0.25 }}>
                              {row.district}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.65rem', py: 0.25 }}>
                              {row.baseStoreCount}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.65rem', py: 0.25 }}>
                              {row.competitorStoreCount}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Paper>
          )}

          {/* Helper Text */}
          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', display: 'block', mt: 1 }}>
            Owned = base brand only • Contested = both • Competitor-only = competitors only
          </Typography>
        </>
      )}
    </Box>
  );
}
