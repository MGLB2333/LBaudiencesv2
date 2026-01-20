'use client';

import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  IconButton,
  CircularProgress,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
} from '@mui/material';
import { Add, Close } from '@mui/icons-material';
import { useDebounce } from '@/hooks/useDebounce';
import { usePoiSearch, usePoiDistrictMap, usePoisByIds, usePoiBrands, usePoisByBrands } from '@/features/audience-builder/hooks/useStorePois';
import { StorePoi } from '@/features/audience-builder/api/storePois';

type SelectionMode = 'brand' | 'individual';

interface StorePoiPickerProps {
  selectedPoiIds: string[];
  onPoiIdsChange: (poiIds: string[]) => void;
  selectedPoiBrands: string[];
  onPoiBrandsChange: (brands: string[]) => void;
}

export function StorePoiPicker({ 
  selectedPoiIds, 
  onPoiIdsChange,
  selectedPoiBrands,
  onPoiBrandsChange,
}: StorePoiPickerProps) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('brand');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [selectedBrand, setSelectedBrand] = useState<string>('');

  // Get available brands
  const { data: brands = [], isLoading: brandsLoading } = usePoiBrands();

  // Get POIs for selected brands
  const { data: brandPois = [] } = usePoisByBrands(selectedPoiBrands);

  // Search for POIs (only in individual mode)
  const { data: searchResults = [], isLoading: isSearching } = usePoiSearch(debouncedQuery, {
    limit: 20,
    enabled: selectionMode === 'individual' && debouncedQuery.trim().length > 0,
  });

  // Get selected POI details (for individual mode)
  const { data: selectedPois = [] } = usePoisByIds(selectedPoiIds);

  // Get district mappings for selected POIs (individual mode)
  const { data: districtMap = {} } = usePoiDistrictMap(selectedPoiIds);

  // Calculate total displayed POIs (deduped)
  const displayPoiIds = useMemo(() => {
    const brandPoiIds = brandPois.map(p => p.id);
    const allIds = [...brandPoiIds, ...selectedPoiIds];
    return Array.from(new Set(allIds));
  }, [brandPois, selectedPoiIds]);

  const totalShown = displayPoiIds.length;

  const handleAddPoi = (poiId: string) => {
    if (!selectedPoiIds.includes(poiId)) {
      onPoiIdsChange([...selectedPoiIds, poiId]);
    }
  };

  const handleRemovePoi = (poiId: string) => {
    onPoiIdsChange(selectedPoiIds.filter(id => id !== poiId));
  };

  const handleAddBrand = (brand: string) => {
    if (!selectedPoiBrands.includes(brand)) {
      onPoiBrandsChange([...selectedPoiBrands, brand]);
      setSelectedBrand(''); // Reset dropdown
    }
  };

  const handleRemoveBrand = (brand: string) => {
    onPoiBrandsChange(selectedPoiBrands.filter(b => b !== brand));
  };

  const handleClearAll = () => {
    onPoiIdsChange([]);
    onPoiBrandsChange([]);
  };

  // Filter out already selected POIs from search results
  const availableResults = useMemo(() => {
    return searchResults.filter(poi => !selectedPoiIds.includes(poi.id));
  }, [searchResults, selectedPoiIds]);

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
        Store POIs
      </Typography>

      {/* Selection Mode Toggle */}
      <FormControl component="fieldset" sx={{ mb: 2 }}>
        <RadioGroup
          row
          value={selectionMode}
          onChange={(e) => setSelectionMode(e.target.value as SelectionMode)}
          sx={{ gap: 1 }}
        >
          <FormControlLabel
            value="brand"
            control={<Radio size="small" />}
            label={
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                Show all for brand
              </Typography>
            }
          />
          <FormControlLabel
            value="individual"
            control={<Radio size="small" />}
            label={
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                Pick individual stores
              </Typography>
            }
          />
        </RadioGroup>
      </FormControl>

      {/* Brand Shortcuts */}
      {selectionMode === 'brand' && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block', mb: 0.5 }}>
            Quick select:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {['Magnet', 'Howdens', 'Wren', 'Wickes'].map((brand) => {
              const brandData = brands.find(b => b.brand === brand);
              const isSelected = selectedPoiBrands.includes(brand);
              return (
                <Chip
                  key={brand}
                  label={brandData ? `${brand} (${brandData.count})` : brand}
                  onClick={() => {
                    if (isSelected) {
                      handleRemoveBrand(brand);
                    } else {
                      handleAddBrand(brand);
                    }
                  }}
                  size="small"
                  sx={{
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    bgcolor: isSelected ? 'primary.main' : 'grey.100',
                    color: isSelected ? 'white' : 'text.primary',
                    '&:hover': {
                      bgcolor: isSelected ? 'primary.dark' : 'grey.200',
                    },
                  }}
                />
              );
            })}
          </Box>
        </Box>
      )}

      {/* Brand Selection Mode */}
      {selectionMode === 'brand' && (
        <Box sx={{ mb: 2 }}>
          <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
            <InputLabel id="brand-select-label">Select brand</InputLabel>
            <Select
              labelId="brand-select-label"
              id="brand-select"
              value={selectedBrand}
              onChange={(e) => {
                const brand = e.target.value;
                if (brand) {
                  handleAddBrand(brand);
                }
              }}
              label="Select brand"
              disabled={brandsLoading}
            >
              {brands.map((brand) => (
                <MenuItem key={brand.brand} value={brand.brand}>
                  {brand.brand} • {brand.count}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Selected Brands */}
          {selectedPoiBrands.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selectedPoiBrands.map((brand) => {
                  const brandData = brands.find(b => b.brand === brand);
                  return (
                    <Chip
                      key={brand}
                      label={`${brand}${brandData ? ` (${brandData.count})` : ''}`}
                      onDelete={() => handleRemoveBrand(brand)}
                      size="small"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  );
                })}
              </Box>
              <Button
                size="small"
                onClick={() => onPoiBrandsChange([])}
                sx={{
                  mt: 0.5,
                  fontSize: '0.7rem',
                  textTransform: 'none',
                  color: 'text.secondary',
                }}
              >
                Clear brands
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* Individual Selection Mode */}
      {selectionMode === 'individual' && (
        <>
          {/* Search Input */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search by brand"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ mb: 1.5 }}
            InputProps={{
              endAdornment: isSearching ? <CircularProgress size={20} /> : null,
            }}
          />

          {/* Search Results */}
          {debouncedQuery.trim().length > 0 && (
        <Paper
          elevation={2}
          sx={{
            mb: 1.5,
            maxHeight: 200,
            overflowY: 'auto',
            border: '1px solid #e0e0e0',
          }}
        >
          {availableResults.length > 0 ? (
            <List dense>
              {availableResults.map((poi) => (
                <ListItem
                  key={poi.id}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleAddPoi(poi.id)}
                      sx={{ color: 'primary.main' }}
                    >
                      <Add fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {poi.brand}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {poi.name}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box>
                        {poi.postcode && (
                          <Typography variant="caption" color="text.secondary">
                            {poi.postcode}
                            {poi.city && `, ${poi.city}`}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {isSearching ? 'Searching...' : 'No stores found'}
              </Typography>
            </Box>
            )}
          </Paper>
          )}
        </>
      )}

      {/* Summary */}
      {totalShown > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 1 }}>
          Showing {totalShown} store marker{totalShown !== 1 ? 's' : ''}
        </Typography>
      )}

      {/* Selected Individual POIs (only in individual mode) */}
      {selectionMode === 'individual' && selectedPois.length > 0 && (
        <Box>
          <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, display: 'block', mb: 1 }}>
            Selected stores ({selectedPois.length})
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {selectedPois.map((poi) => {
              const mapping = districtMap[poi.id];
              return (
                <Box
                  key={poi.id}
                  sx={{
                    p: 1,
                    bgcolor: '#f9f9f9',
                    borderRadius: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
                        {poi.brand}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleRemovePoi(poi.id)}
                        sx={{ p: 0.25, ml: 'auto' }}
                      >
                        <Close fontSize="small" />
                      </IconButton>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>
                      {poi.name}
                    </Typography>
                    {mapping && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', mt: 0.25 }}>
                        Nearest district: {mapping.district} ({mapping.distance_km.toFixed(2)} km)
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
            <Button
              size="small"
              onClick={() => onPoiIdsChange([])}
              sx={{
                mt: 1,
                fontSize: '0.75rem',
                textTransform: 'none',
                color: 'text.secondary',
              }}
            >
              Clear all
            </Button>
          </Box>
        </Box>
      )}

      {/* Clear All Button (when both modes have selections) */}
      {(selectedPoiBrands.length > 0 || selectedPoiIds.length > 0) && (
        <Button
          size="small"
          onClick={handleClearAll}
          sx={{
            mt: 1,
            fontSize: '0.75rem',
            textTransform: 'none',
            color: 'text.secondary',
          }}
        >
          Clear all POIs
        </Button>
      )}

      {totalShown === 0 && selectionMode === 'individual' && debouncedQuery.trim().length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>
          Search for stores by brand to add them to the map
        </Typography>
      )}

      {totalShown === 0 && selectionMode === 'brand' && selectedPoiBrands.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>
          Select a brand to show all stores on the map
        </Typography>
      )}
    </Box>
  );
}
