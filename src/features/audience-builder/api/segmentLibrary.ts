import { createClient } from '@/lib/supabase/client';

export interface SegmentLibraryItem {
  id: string;
  provider: string;
  segment_key: string;
  label: string;
  description: string | null;
  tags: string[];
  adjacency: {
    related_segments?: string[];
    adjacency_score?: number;
  };
  example_signals: {
    signals?: string[];
    evidence?: string;
  };
  is_active: boolean;
}

export interface SegmentMatch {
  provider: string;
  segment_key: string;
  segment_label: string;
  match_confidence: number;
  agreement_level: 'high' | 'medium' | 'low';
}

export interface SuggestedSegment {
  id: string;
  provider: string;
  segment_key: string;
  label: string;
  description: string | null;
  why_suggested: string;
  evidence: string;
  adjacency_score: number;
}

/**
 * Get like-for-like matches across providers for Option 1 (Validation)
 */
export async function getSegmentMatches(
  briefSegmentKey: string,
  briefProvider: string = 'CCS'
): Promise<SegmentMatch[]> {
  const supabase = createClient();
  
  // Query segment_library for segments with similar keys or labels
  // This is a simplified matching - in production, you'd have a proper mapping table
  const { data: librarySegments, error } = await supabase
    .from('segment_library')
    .select('*')
    .eq('is_active', true)
    .ilike('segment_key', `%${briefSegmentKey}%`);

  if (error) {
    // If segment_library table doesn't exist or query fails, return empty array
    console.warn('Could not query segment_library for matches:', error);
    return [];
  }

  // For now, return segments from other providers that might match
  // In production, this would use a proper mapping/translation table
  const matches: SegmentMatch[] = [];
  const providers = ['CCS', 'ONS', 'Experian', 'Outra', 'TwentyCI'];
  
  for (const segment of (librarySegments as any[]) || []) {
    const seg = segment as any;
    if (seg.provider !== briefProvider) {
      // Calculate match confidence based on key similarity
      const keySimilarity = calculateSimilarity(briefSegmentKey, seg.segment_key);
      const agreementLevel = keySimilarity > 0.8 ? 'high' : keySimilarity > 0.5 ? 'medium' : 'low';
      
      matches.push({
        provider: seg.provider,
        segment_key: seg.segment_key,
        segment_label: seg.label,
        match_confidence: keySimilarity,
        agreement_level: agreementLevel,
      });
    }
  }

  return matches.sort((a, b) => b.match_confidence - a.match_confidence);
}

/**
 * Get suggested adjacent segments for Option 2 (Extension)
 */
export async function getSuggestedSegments(
  existingSegmentKeys: string[],
  tags: string[] = [],
  limit: number = 10,
  searchQuery?: string,
  providerFilter?: string
): Promise<SuggestedSegment[]> {
  const supabase = createClient();
  
  // Query segment_library for segments with related tags or adjacency
  let query = supabase
    .from('segment_library')
    .select('*')
    .eq('is_active', true);

  // Filter by tags if provided
  if (tags.length > 0) {
    query = query.overlaps('tags', tags);
  }

  // Filter by provider if provided
  if (providerFilter && providerFilter !== 'All') {
    query = query.eq('provider', providerFilter);
  }

  const { data: librarySegments, error } = await query;

  if (error) {
    // If segment_library table doesn't exist or query fails, return empty array
    console.warn('Could not query segment_library for suggestions:', error);
    return [];
  }

  // Filter out existing segments and apply search query client-side
  let filtered = ((librarySegments as any[]) || []).filter(
    (seg: any) => !existingSegmentKeys.includes(seg.segment_key)
  );

  // Apply search query if provided
  if (searchQuery && searchQuery.trim()) {
    const queryLower = searchQuery.toLowerCase();
    filtered = filtered.filter((seg: any) => 
      seg.label.toLowerCase().includes(queryLower) ||
      seg.description?.toLowerCase().includes(queryLower) ||
      seg.segment_key.toLowerCase().includes(queryLower) ||
      (seg.tags || []).some((tag: any) => tag.toLowerCase().includes(queryLower))
    );
  }

  // Calculate adjacency scores and build suggestions
  const suggestions: SuggestedSegment[] = filtered.map((segment) => {
    const adjacency = segment.adjacency as any;
    const exampleSignals = segment.example_signals as any;
    
    // Check if any existing segments are in related_segments
    const hasRelatedSegment = adjacency?.related_segments?.some((rel: string) =>
      existingSegmentKeys.some(key => key.includes(rel) || rel.includes(key))
    );
    
    const adjacencyScore = hasRelatedSegment 
      ? (adjacency?.adjacency_score || 0.7)
      : 0.5;

    const seg = segment as any;
    return {
      id: seg.id,
      provider: seg.provider,
      segment_key: seg.segment_key,
      label: seg.label,
      description: seg.description,
      why_suggested: exampleSignals?.evidence || `Related to your selected segments based on ${seg.provider} data`,
      evidence: JSON.stringify(exampleSignals?.signals || []),
      adjacency_score: adjacencyScore,
    };
  });

  // Sort by adjacency score and return top N
  return suggestions
    .sort((a, b) => b.adjacency_score - a.adjacency_score)
    .slice(0, limit);
}

/**
 * Simple string similarity calculation
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}
