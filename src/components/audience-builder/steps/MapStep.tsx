'use client';

import { Box, Card, CardContent, Typography, Button, Tabs, Tab, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { useEffect, useState } from 'react';
import { useGeoUnits, useGenerateGeoUnits } from '@/features/audience-builder/hooks/useGeo';
import { usePoiLayers, useCreatePoiLayer, useUpdatePoiLayer } from '@/features/audience-builder/hooks/usePoi';
import { useProfileSettings } from '@/features/audience-builder/hooks/useProfile';
import { useSegments } from '@/features/audience-builder/hooks/useSegments';
import { useConstructionSettings } from '@/features/audience-builder/hooks/useConstruction';
import * as geoDistrictsApi from '@/features/audience-builder/api/geoDistricts';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

// Dynamically import to avoid SSR issues with Leaflet
const MapContent = dynamic(() => import('./MapContent'), { ssr: false });

interface MapStepProps {
  audienceId: string;
  onNext: () => void;
  onBack: () => void;
}

export function MapStep({ audienceId, onNext, onBack }: MapStepProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [audienceType, setAudienceType] = useState<'primary' | 'secondary'>('primary');
  const [logicMode, setLogicMode] = useState<'and' | 'or'>('and');

  const { data: geoUnits = [], isLoading: geoLoading } = useGeoUnits(audienceId);
  const { data: poiLayers = [] } = usePoiLayers(audienceId);
  const { data: profile } = useProfileSettings(audienceId);
  const { data: segments = [] } = useSegments(audienceId, 'primary');
  const { data: constructionSettings } = useConstructionSettings(audienceId);
  const generateGeoMutation = useGenerateGeoUnits();
  
  // Get included segment keys for filtering (extension mode)
  const includedSegments = segments.filter(s => s.is_selected);
  const includedSegmentKeys = includedSegments.map(s => s.segment_key);
  const createPoiMutation = useCreatePoiLayer();
  const updatePoiMutation = useUpdatePoiLayer();

  // Fetch districts for validation mode
  const [districts, setDistricts] = useState<any[]>([]);
  useEffect(() => {
    if (constructionSettings?.construction_mode === 'validation') {
      const audienceKey = 'home_movers'; // TODO: derive from anchor segment
      const providers = ['CCS', 'ONS', 'Experian', 'TwentyCI', 'Outra'];
      const minAgreement = constructionSettings.validation_min_agreement || 1;
      
      geoDistrictsApi.getDistrictsWithAgreement(audienceKey, minAgreement, providers)
        .then(setDistricts)
        .catch(() => setDistricts([]));
    } else {
      setDistricts([]);
    }
  }, [constructionSettings?.construction_mode, constructionSettings?.validation_min_agreement]);

  useEffect(() => {
    if (geoUnits.length === 0 && !geoLoading) {
      generateGeoMutation.mutate({
        audienceId,
        scaleAccuracy: profile?.scale_accuracy || 50,
      });
    }
  }, [audienceId, geoUnits.length, geoLoading]);

  const handleAddLayer = async () => {
    const layerName = prompt('Enter layer name (e.g., Morrisons, Aldi, Asda):');
    if (layerName) {
      await createPoiMutation.mutateAsync({
        audienceId,
        layer: {
          layer_name: layerName,
          layer_type: 'stores',
          metadata: { count: Math.floor(Math.random() * 500) + 100 },
        },
      });
    }
  };

  const handleToggleLayer = async (layerId: string, isEnabled: boolean) => {
    await updatePoiMutation.mutateAsync({
      layerId,
      updates: { is_enabled: !isEnabled },
    });
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', gap: 2, minHeight: '600px', position: 'relative' }}>
      <Card sx={{ width: 300, flexShrink: 0 }}>
        <CardContent>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} orientation="vertical">
            <Tab label="Location Insight" />
            <Tab label="TV Spot Insight" />
          </Tabs>

          {activeTab === 0 && (
            <Box sx={{ mt: 2 }}>
              <Tabs value={activeSubTab} onChange={(_, v) => setActiveSubTab(v)} orientation="vertical">
                <Tab label="POI" />
                <Tab label="Locations" />
                <Tab label="Battlegrounds" />
              </Tabs>

              <Button
                variant="contained"
                fullWidth
                sx={{ mt: 2 }}
                onClick={handleAddLayer}
              >
                + Add Layer
              </Button>

              {activeSubTab === 0 && (
                <Box sx={{ mt: 2 }}>
                  {poiLayers.map((layer) => (
                    <Box key={layer.id} sx={{ mb: 1 }}>
                      <Button
                        fullWidth
                        variant={layer.is_enabled ? 'contained' : 'outlined'}
                        onClick={() => handleToggleLayer(layer.id, layer.is_enabled)}
                      >
                        {layer.layer_name}
                      </Button>
                    </Box>
                  ))}
                </Box>
              )}

              {activeSubTab === 1 && (
                <Box sx={{ mt: 2 }}>
                  <ToggleButtonGroup
                    value={audienceType}
                    exclusive
                    onChange={(_, v) => v && setAudienceType(v)}
                    orientation="vertical"
                    fullWidth
                  >
                    <ToggleButton value="primary">Primary</ToggleButton>
                    <ToggleButton value="secondary">Secondary</ToggleButton>
                  </ToggleButtonGroup>
                  <ToggleButtonGroup
                    value={logicMode}
                    exclusive
                    onChange={(_, v) => v && setLogicMode(v)}
                    orientation="vertical"
                    fullWidth
                    sx={{ mt: 2 }}
                  >
                    <ToggleButton value="and">AND</ToggleButton>
                    <ToggleButton value="or">OR</ToggleButton>
                  </ToggleButtonGroup>
                  {geoUnits.length > 0 && (
                    <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem', mb: 0.5, display: 'block' }}>
                        Map Explainability
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                        Hover over map areas to see which signals contributed to each location&apos;s score. 
                        Scores are calculated deterministically from your signal configuration.
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}

              {activeSubTab === 2 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Battlegrounds feature coming soon. Create polygons/areas as saved objects.
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {activeTab === 1 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                TV Spot Insight coming soon.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card sx={{ flex: 1, position: 'relative' }}>
        <CardContent sx={{ p: 0, height: '600px' }}>
          <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
            <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 1000, bgcolor: 'white', p: 1, borderRadius: 1, boxShadow: 1, maxWidth: 300 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                Map reflects selected segments from Step 2
              </Typography>
            </Box>
            <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1000, bgcolor: 'white', p: 1, borderRadius: 1, boxShadow: 1 }}>
              <Typography variant="body2">
                Audience Size: <strong>{geoUnits.length > 0 ? '5,971,000' : '0'}</strong>
              </Typography>
            </Box>
            {typeof window !== 'undefined' && (
              <MapContainer
                center={[54.5, -2]}
                zoom={6}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapContent 
                  geoUnits={geoUnits} 
                  poiLayers={poiLayers.filter((l) => l.is_enabled)}
                  includedSegmentKeys={includedSegmentKeys}
                  constructionMode={constructionSettings?.construction_mode}
                  validationMinAgreement={constructionSettings?.validation_min_agreement}
                  districts={districts}
                />
              </MapContainer>
            )}
          </Box>
        </CardContent>
      </Card>

        <Box sx={{ position: 'absolute', bottom: 16, left: 320, display: 'flex', gap: 2, zIndex: 1000 }}>
          <Button onClick={onBack} sx={{ bgcolor: 'white' }}>BACK</Button>
          <Button variant="contained" onClick={onNext}>NEXT</Button>
        </Box>
      </Box>
    </Box>
  );
}
