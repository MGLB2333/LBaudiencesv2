import { useEffect, useRef } from 'react';

/**
 * Dev-only hook to log why a component re-rendered
 * Helps identify render storms by tracking which props/state changed
 */
export function useWhyRender(name: string, watchedValues: Record<string, any>) {
  const prevValuesRef = useRef<Record<string, any>>({});
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevValuesRef.current = { ...watchedValues };
      return;
    }

    const changedKeys: string[] = [];

    // Check each watched value for changes (shallow comparison)
    for (const key in watchedValues) {
      const prev = prevValuesRef.current[key];
      const curr = watchedValues[key];

      // Handle primitives
      if (prev !== curr) {
        // Handle arrays (shallow compare length and reference)
        if (Array.isArray(prev) && Array.isArray(curr)) {
          if (prev.length !== curr.length || prev !== curr) {
            changedKeys.push(`${key} (array: ${prev.length} -> ${curr.length})`);
          }
        }
        // Handle objects (shallow compare reference)
        else if (typeof prev === 'object' && typeof curr === 'object' && prev !== null && curr !== null) {
          if (prev !== curr) {
            changedKeys.push(`${key} (object ref changed)`);
          }
        }
        // Primitives
        else {
          changedKeys.push(`${key} (${prev} -> ${curr})`);
        }
      }
    }

    if (changedKeys.length > 0) {
      console.log(`[useWhyRender] ${name} re-rendered:`, changedKeys);
    }

    prevValuesRef.current = { ...watchedValues };
  });
}
