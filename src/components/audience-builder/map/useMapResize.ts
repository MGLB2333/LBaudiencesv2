'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Hook to safely handle map resize using ResizeObserver
 * Calls invalidateSize() when container size changes, without storing size in state
 */
export function useMapResize() {
  const map = useMap();
  const observerRef = useRef<ResizeObserver | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = map?.getContainer();
    if (!container || !map) return;

    containerRef.current = container;

    // Invalidate size on mount to ensure correct initial sizing
    // Add a small delay to ensure map is fully initialized
    const timeoutId = setTimeout(() => {
      try {
        if (map && map.getContainer()) {
          map.invalidateSize();
        }
      } catch (error) {
        // Map might not be fully initialized yet, ignore error
        console.warn('Map resize error (ignored):', error);
      }
    }, 100);

    // Create ResizeObserver to watch for container size changes
    observerRef.current = new ResizeObserver(() => {
      // Use requestAnimationFrame to batch resize calls
      requestAnimationFrame(() => {
        try {
          if (map && map.getContainer()) {
            map.invalidateSize();
          }
        } catch (error) {
          // Map might be destroyed, ignore error
          console.warn('Map resize error (ignored):', error);
        }
      });
    });

    observerRef.current.observe(container);

    // Cleanup on unmount
    return () => {
      clearTimeout(timeoutId);
      if (observerRef.current && containerRef.current) {
        observerRef.current.unobserve(containerRef.current);
        observerRef.current.disconnect();
      }
    };
  }, [map]);
}
