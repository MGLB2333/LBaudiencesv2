'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { GeoUnit, PoiLayer } from '@/lib/types';
import L from 'leaflet';

// Fix Leaflet default icon issue
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

interface MapContentProps {
  geoUnits: GeoUnit[];
  poiLayers: PoiLayer[];
  includedSegmentKeys?: string[];
  constructionMode?: 'validation' | 'extension';
  validationMinAgreement?: number;
  districts?: Array<{
    district: string;
    centroid_lat: number;
    centroid_lng: number;
    geometry: any;
    agreeing_providers: string[];
    agreement_count: number;
    avg_confidence: number;
  }>;
}

export default function MapContent({ 
  geoUnits, 
  poiLayers, 
  includedSegmentKeys = [],
  constructionMode = 'extension',
  validationMinAgreement = 1,
  districts = [],
}: MapContentProps) {
  const map = useMap();

  useEffect(() => {
    // Clear existing layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) return;
      map.removeLayer(layer);
    });

    // Validation mode: render districts as polygons
    if (constructionMode === 'validation' && districts.length > 0) {
      districts.forEach((district) => {
        const geometry = district.geometry;
        if (!geometry || geometry.type !== 'Polygon') return;

        // Determine color intensity based on agreement count
        const maxAgreement = 5; // Max providers
        const intensity = district.agreement_count / maxAgreement;
        const color = intensity >= 0.7 ? '#02b5e7' : intensity >= 0.4 ? '#4dd0e1' : '#b2ebf2';
        const opacity = 0.3 + (intensity * 0.4); // 0.3 to 0.7

        // Convert GeoJSON coordinates to Leaflet format
        const coordinates = geometry.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);

        const polygon = L.polygon(coordinates, {
          fillColor: color,
          color: color,
          weight: 1,
          opacity: 0.8,
          fillOpacity: opacity,
        });

        // Build tooltip
        const confidenceBand = district.avg_confidence >= 0.7 ? 'High' : district.avg_confidence >= 0.4 ? 'Med' : 'Low';
        let tooltipText = `District: ${district.district}\n`;
        tooltipText += `Providers agreeing: ${district.agreement_count}\n`;
        tooltipText += `Confidence: ${confidenceBand}\n\n`;
        tooltipText += `Agreeing providers:\n`;
        district.agreeing_providers.forEach((provider) => {
          tooltipText += `• ${provider}\n`;
        });

        polygon.bindTooltip(tooltipText, {
          permanent: false,
          direction: 'top',
          className: 'geo-tooltip',
        });

        polygon.addTo(map);
      });

      // Fit bounds to districts
      if (districts.length > 0) {
        const bounds = districts
          .map((d) => {
            const geometry = d.geometry;
            if (geometry?.coordinates?.[0]) {
              return geometry.coordinates[0].map(([lng, lat]: [number, number]) => L.latLng(lat, lng));
            }
            return null;
          })
          .filter(Boolean)
          .flat() as L.LatLng[];

        if (bounds.length > 0) {
          map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
        }
      }
    } else if (geoUnits.length > 0) {
      // Extension mode: use existing circle markers
      // Filter and calculate display scores based on mode
      let filteredUnits = geoUnits;
      
      if (constructionMode === 'validation') {
        // Validation mode: filter by agreement_count
        filteredUnits = geoUnits.filter((unit: any) => 
          (unit.agreement_count || 0) >= validationMinAgreement
        );
      } else {
        // Extension mode: filter by included segments (existing logic)
        // Keep all units but adjust display score based on segment contributions
      }
      
      const unitsWithDisplayScore = filteredUnits.map((unit) => {
        const drivers = unit.drivers as any;
        const signals = drivers?.signals || [];
        
        let displayScore = 0;
        const contributingSignals: any[] = [];
        
        if (constructionMode === 'validation') {
          // Validation mode: use agreement_count as display score
          displayScore = (unit.agreement_count || 0) * 10; // Scale for visualization
          contributingSignals.push(...signals);
        } else {
          // Extension mode: use signal contributions
          if (includedSegmentKeys.length > 0) {
            displayScore = signals.reduce((sum: number, sig: any) => sum + (sig.contribution || 0), 0);
            contributingSignals.push(...signals);
          } else {
            displayScore = signals.reduce((sum: number, sig: any) => sum + (sig.contribution || 0), 0);
            contributingSignals.push(...signals);
          }
        }
        
        return { unit, displayScore, contributingSignals };
      });
      
      // Normalize display scores for visual consistency
      const maxDisplayScore = Math.max(...unitsWithDisplayScore.map(u => u.displayScore), 1);
      const normalizedUnits = unitsWithDisplayScore.map(({ unit, displayScore, contributingSignals }) => ({
        unit,
        normalizedScore: maxDisplayScore > 0 ? (displayScore / maxDisplayScore) * 100 : unit.score,
        contributingSignals,
      }));
      
      // Create simple circle markers for heat visualization with explainability
      normalizedUnits.forEach(({ unit, normalizedScore, contributingSignals }) => {
          const geometry = unit.geometry as any;
          if (!geometry?.coordinates?.[0]?.[0]) return;
          
          const [lng, lat] = geometry.coordinates[0][0];
          const score = normalizedScore;
          const color = score > 70 ? '#02b5e7' : score > 40 ? '#4dd0e1' : '#b2ebf2';
          const radius = Math.max(5, score / 10);
          
          // Build explainability tooltip
          let tooltipText = '';
          
          if (constructionMode === 'validation') {
            // Validation mode: show agreement info
            const agreementCount = (unit as any).agreement_count || 0;
            const agreeingProviders = (unit as any).agreeing_providers || [];
            const totalProviders = agreeingProviders.length || 7;
            
            tooltipText = `Agrees with ${agreementCount}/${totalProviders} providers\n`;
            tooltipText += `Confidence: ${unit.confidence_tier}\n\n`;
            
            if (agreeingProviders.length > 0) {
              tooltipText += `Agreeing providers:\n`;
              agreeingProviders.slice(0, 5).forEach((provider: string) => {
                tooltipText += `• ${provider}\n`;
              });
              if (agreeingProviders.length > 5) {
                tooltipText += `... and ${agreeingProviders.length - 5} more`;
              }
            }
          } else {
            // Extension mode: show signal contributions
            const topSignals = contributingSignals
              .sort((a: any, b: any) => (b.contribution || 0) - (a.contribution || 0))
              .slice(0, 3);
            
            tooltipText = `Score: ${score.toFixed(1)} (${unit.confidence_tier})\n\nTop signals:`;
            if (topSignals.length > 0) {
              topSignals.forEach((sig: any) => {
                const inferred = sig.inferred ? ' (inferred)' : '';
                tooltipText += `\n• ${sig.signal_type || 'unknown'}: ${(sig.contribution || 0).toFixed(1)}${inferred}`;
              });
            } else {
              tooltipText += '\n(No matching segments selected)';
            }
          }
          
          const circle = L.circle([lat, lng], {
            radius: radius * 1000,
            fillColor: color,
            color: color,
            weight: 1,
            opacity: 0.6,
            fillOpacity: 0.4,
          });
          
          circle.bindTooltip(tooltipText, {
            permanent: false,
            direction: 'top',
            className: 'geo-tooltip',
          });
          
          circle.addTo(map);
        });
    }

    // Fit bounds to show all geo units
    if (geoUnits.length > 0) {
      const bounds = geoUnits
        .map((unit) => {
          const geometry = unit.geometry as any;
          if (geometry?.coordinates?.[0]?.[0]) {
            return geometry.coordinates[0][0] as [number, number];
          }
          return null;
        })
        .filter(Boolean) as [number, number][];

      if (bounds.length > 0) {
        const latLngs = bounds.map(([lng, lat]) => L.latLng(lat, lng));
        map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50] });
      }
    }
  }, [map, geoUnits, poiLayers, includedSegmentKeys, constructionMode, validationMinAgreement, districts]);

  return null;
}
