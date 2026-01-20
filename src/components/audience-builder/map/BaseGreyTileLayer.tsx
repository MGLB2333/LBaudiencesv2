'use client';

import { TileLayer } from 'react-leaflet';

interface BaseGreyTileLayerProps {
  url?: string;
}

/**
 * Grey basemap tile layer with CSS filter applied
 */
export function BaseGreyTileLayer({ 
  url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' 
}: BaseGreyTileLayerProps) {
  return (
    <TileLayer
      attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
      url={url}
    />
  );
}
