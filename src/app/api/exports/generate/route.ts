import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as geoDistrictsApi from '@/features/audience-builder/api/geoDistricts';
import { getProviderImpact } from '@/features/audience-builder/api/extensionResults';
import { getSelectedSegmentKeys } from '@/features/audience-builder/api/selectedSegments';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      audienceId, 
      exportType, 
      activationTarget = 'h3', 
      recommendedThreshold = 50, 
      preview = false,
      validationMinAgreement, // From context (optional, falls back to DB)
      includedSegmentKeys, // From context (optional, falls back to DB)
    } = body;

    if (!audienceId || !exportType || !['csv', 'geojson'].includes(exportType)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Verify ownership
    const { data: audience, error: audienceError } = await supabase
      .from('audiences')
      .select('id, user_id')
      .eq('id', audienceId)
      .eq('user_id', user.id)
      .single();

    if (audienceError || !audience) {
      return NextResponse.json({ error: 'Audience not found or access denied' }, { status: 403 });
    }

    // Get construction settings first (needed to determine mode)
    const { data: constructionSettings } = await supabase
      .from('audience_construction_settings')
      .select('*')
      .eq('audience_id', audienceId)
      .single();

    // Determine if we're in validation mode and should use districts
    const isValidationMode = constructionSettings?.construction_mode === 'validation';
    // Use validationMinAgreement from context if provided, otherwise fall back to DB (default 1)
    const minAgreement = validationMinAgreement !== undefined ? validationMinAgreement : (constructionSettings?.validation_min_agreement || 1);
    
    let geoUnits: any[] = [];
    let districts: any[] = [];
    let providerImpactData: any = null;

    if (isValidationMode) {
      // Validation mode: use districts with agreement
      const audienceKey = 'home_movers'; // TODO: derive from anchor segment
      const providers = ['CCS', 'ONS', 'Experian', 'TwentyCI', 'Outra'];
      
      try {
        districts = await geoDistrictsApi.getDistrictsWithAgreement(audienceKey, minAgreement, providers);
        
        // Convert districts to geo_units format for compatibility
        geoUnits = districts.map((d) => ({
          id: `district_${d.district}`,
          audience_id: audienceId,
          geo_type: 'postcode_sector',
          geo_id: d.district,
          score: d.avg_confidence * 100,
          confidence_tier: d.avg_confidence >= 0.7 ? 'high' : d.avg_confidence >= 0.4 ? 'medium' : 'low',
          drivers: {
            signals: [],
            agreement_count: d.agreement_count,
          },
          geometry: d.geometry,
          agreement_count: d.agreement_count,
          agreeing_providers: d.agreeing_providers,
        }));
      } catch (error) {
        console.error('Failed to fetch districts:', error);
        // Fallback to empty array
      }
    } else {
      // Extension mode: use providerImpact results
      const anchorKey = 'home_movers'; // TODO: derive from anchor segment
      
      // Get selected segments
      let selectedKeys: string[] = [];
      if (includedSegmentKeys && includedSegmentKeys.length > 0) {
        selectedKeys = includedSegmentKeys;
      } else {
        try {
          selectedKeys = await getSelectedSegmentKeys(audienceId);
          // Ensure anchor is included
          if (!selectedKeys.includes(anchorKey)) {
            selectedKeys = [anchorKey, ...selectedKeys];
          }
        } catch (error) {
          console.error('Failed to load selected segments:', error);
          selectedKeys = [anchorKey];
        }
      }

      // Get provider impact
      try {
        const providerImpact = await getProviderImpact({
          anchorKey,
          includedSegmentKeys: selectedKeys,
          confidenceThreshold: 0.5,
          includeAnchorOnly: true,
        });

        // Convert includedDistricts to geo_units format
        geoUnits = providerImpact.includedDistricts.map((d) => ({
          id: `district_${d.district}`,
          audience_id: audienceId,
          geo_type: 'postcode_sector',
          geo_id: d.district,
          score: d.avgConfidence * 100,
          confidence_tier: d.avgConfidence >= 0.7 ? 'high' : d.avgConfidence >= 0.4 ? 'medium' : 'low',
          drivers: {
            signals: [],
            agreement_count: d.agreementCount,
            supporting_providers: d.supportingProviders,
          },
          geometry: null, // Centroids only, no polygon
          agreement_count: d.agreementCount,
          agreeing_providers: d.supportingProviders,
          centroid_lat: d.centroid_lat,
          centroid_lng: d.centroid_lng,
        }));

        // Store provider impact for metadata
        providerImpactData = providerImpact;
      } catch (error) {
        console.error('Failed to fetch provider impact:', error);
        // Fallback to empty array
        geoUnits = [];
      }
    }

    // Get included segments for metadata
    // Use includedSegmentKeys from context if provided, otherwise query DB
    let segments: any[] = [];
    
    if (isValidationMode) {
      // Validation mode: get segments from audience_segments
      if (includedSegmentKeys && includedSegmentKeys.length > 0) {
        const { data: segs = [] } = await supabase
          .from('audience_segments')
          .select('*')
          .eq('audience_id', audienceId)
          .in('segment_key', includedSegmentKeys);
        segments = segs;
      } else {
        const { data: segs = [] } = await supabase
          .from('audience_segments')
          .select('*')
          .eq('audience_id', audienceId)
          .eq('is_selected', true);
        segments = segs;
      }
    } else {
      // Extension mode: segments come from selectedSegmentKeys
      const anchorKey = 'home_movers';
      let selectedKeys: string[] = [];
      if (includedSegmentKeys && includedSegmentKeys.length > 0) {
        selectedKeys = includedSegmentKeys;
      } else {
        try {
          selectedKeys = await getSelectedSegmentKeys(audienceId);
          if (!selectedKeys.includes(anchorKey)) {
            selectedKeys = [anchorKey, ...selectedKeys];
          }
        } catch (error) {
          selectedKeys = [anchorKey];
        }
      }
      
      // Get segment labels from segment_library
      if (selectedKeys.length > 0) {
        const { data: segLibs = [] } = await supabase
          .from('segment_library')
          .select('segment_key, label, provider')
          .in('segment_key', selectedKeys)
          .eq('is_active', true);
        segments = segLibs.map(s => ({
          segment_key: s.segment_key,
          segment_label: s.label,
          provider: s.provider,
          origin: 'suggested',
        }));
      }
    }

    // Build metadata
    const metadata: any = {
      mode: constructionSettings?.construction_mode || 'extension',
      included_segments: segments.map(s => ({
        segment_key: s.segment_key,
        segment_label: s.segment_label,
        provider: s.provider,
        origin: s.origin,
      })),
      last_built_at: constructionSettings?.last_run_at || null,
      activation_target: activationTarget,
      recommended_threshold: recommendedThreshold,
      export_generated_at: new Date().toISOString(),
    };
    
    // Add provider impact for Extension mode (already computed above)
    if (!isValidationMode && providerImpactData) {
      metadata.provider_impact = providerImpactData.providerStats;
      metadata.totals = providerImpactData.totals;
    }

    // Calculate inclusion based on threshold
    const threshold = recommendedThreshold || 50;
    
    // Generate content
    let content: string;
    if (exportType === 'csv') {
      // Add metadata as commented JSON line
      const metadataLine = `# ${JSON.stringify(metadata)}`;
      
      // Headers differ for validation vs extension mode
      const headers = isValidationMode
        ? ['district', 'providers_agreeing', 'confidence_level', 'avg_confidence', 'agreeing_providers', 'lat', 'lng']
        : ['geo_id', 'geo_type', 'score', 'confidence_tier', 'included', 'top_drivers', 'lat', 'lng'];
      
      const rows = geoUnits.map((unit) => {
        const geometry = unit.geometry as any;
        let lat = 0;
        let lng = 0;
        
        if (isValidationMode && districts.length > 0) {
          // For districts, use centroid
          const district = districts.find(d => d.district === unit.geo_id);
          if (district) {
            lat = district.centroid_lat;
            lng = district.centroid_lng;
          }
        } else {
          // For geo units, extract from geometry
          [lng, lat] = geometry?.coordinates?.[0]?.[0] || [0, 0];
        }
        
        if (isValidationMode) {
          // Validation mode: district-based export
          const agreementCount = unit.agreement_count || 0;
          const confidenceLevel = unit.confidence_tier || 'low';
          const avgConfidence = districts.find(d => d.district === unit.geo_id)?.avg_confidence || 0;
          const agreeingProviders = (unit.agreeing_providers || []).join('; ');
          
          return [
            unit.geo_id, // district code
            agreementCount,
            confidenceLevel,
            avgConfidence.toFixed(3),
            `"${agreeingProviders}"`,
            lat,
            lng,
          ].join(',');
        } else {
          // Extension mode: existing logic
          const included = unit.score >= threshold;
          
          const drivers = unit.drivers as any;
          const signals = drivers?.signals || [];
          const topDrivers = signals
            .sort((a: any, b: any) => b.contribution - a.contribution)
            .slice(0, 3)
            .map((s: any) => `${s.signal_type}(${s.contribution.toFixed(1)})`)
            .join('; ');
          
          return [
            unit.geo_id,
            unit.geo_type,
            unit.score,
            unit.confidence_tier,
            included ? 'true' : 'false',
            `"${topDrivers || ''}"`,
            lat,
            lng,
          ].join(',');
        }
      });
      content = [metadataLine, headers.join(','), ...rows].join('\n');
    } else {
      const features = geoUnits.map((unit) => {
        if (isValidationMode) {
          // Validation mode: district-based GeoJSON
          const district = districts.find(d => d.district === unit.geo_id);
          return {
            type: 'Feature',
            geometry: district?.geometry || unit.geometry || {
              type: 'Polygon',
              coordinates: [],
            },
            properties: {
              district: unit.geo_id,
              providers_agreeing: unit.agreement_count || 0,
              confidence_level: unit.confidence_tier || 'low',
              avg_confidence: district?.avg_confidence || 0,
              agreeing_providers: unit.agreeing_providers || [],
              audience_key: 'home_movers',
            },
          };
        } else {
          // Extension mode: existing logic
          const drivers = unit.drivers as any;
          const signals = drivers?.signals || [];
          const topDrivers = signals
            .sort((a: any, b: any) => b.contribution - a.contribution)
            .slice(0, 3)
            .map((s: any) => ({
              signal_type: s.signal_type,
              contribution: s.contribution,
              inferred: s.inferred || false,
            }));
          
          return {
            type: 'Feature',
            geometry: unit.geometry || {
              type: 'Point',
              coordinates: [0, 0],
            },
            properties: {
              geo_id: unit.geo_id,
              geo_type: unit.geo_type,
              score: unit.score,
              confidence_tier: unit.confidence_tier,
              included: unit.score >= threshold,
              top_drivers: topDrivers,
              recommended_threshold: threshold,
              activation_target: activationTarget,
            },
          };
        }
      });
      content = JSON.stringify(
        {
          type: 'FeatureCollection',
          metadata,
          features,
        },
        null,
        2
      );
    }

    // If preview mode, return content without uploading
    if (preview) {
      if (exportType === 'csv') {
        const rows = content.split('\n');
        const metadataRow = rows.find(r => r.startsWith('#'));
        const headerRow = rows.find(r => !r.startsWith('#') && r.trim());
        const dataRows = rows
          .filter(r => !r.startsWith('#') && r.trim() && r !== headerRow)
          .slice(0, 15);
        return NextResponse.json({
          success: true,
          preview: {
            metadata,
            headers: headerRow?.split(',') || [],
            rows: dataRows.map(r => r.split(',')),
            totalRows: geoUnits.length,
          },
        });
      } else {
        return NextResponse.json({
          success: true,
          preview: {
            metadata,
            featureCount: features.length,
            sampleFeatures: features.slice(0, 5),
          },
        });
      }
    }

    // Upload to storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `audience-${audienceId}-${activationTarget}-v1-${timestamp}.${exportType}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audience-exports')
      .upload(filename, content, {
        contentType: exportType === 'csv' ? 'text/csv' : 'application/geo+json',
      });

    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload export' }, { status: 500 });
    }

    // Create export record
    const { data: exportRecord, error: exportError } = await supabase
      .from('exports')
      .insert({
        audience_id: audienceId,
        user_id: user.id,
        export_type: exportType,
        storage_path: uploadData.path,
      })
      .select()
      .single();

    if (exportError) {
      return NextResponse.json({ error: 'Failed to create export record' }, { status: 500 });
    }

    return NextResponse.json({ success: true, export: exportRecord });
  } catch (error) {
    console.error('Export generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
