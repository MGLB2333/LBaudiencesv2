// Mock TV Spot Insights Data
// In production, this would come from ACR viewing data aggregated by postcode districts

export interface TvSpotInsight {
  channel: string;
  programme: string;
  daypart: 'Breakfast' | 'Daytime' | 'Peak' | 'Late';
  genre: 'Drama' | 'Sport' | 'Entertainment' | 'News' | 'Factual';
  index: number; // 100 = average, >100 = over-index
  topRegions: string[]; // TV region keys
}

// Mock dataset
const MOCK_INSIGHTS: TvSpotInsight[] = [
  // ITV
  { channel: 'ITV', programme: 'Coronation Street', daypart: 'Peak', genre: 'Drama', index: 145, topRegions: ['granada', 'yorkshire', 'central'] },
  { channel: 'ITV', programme: 'Emmerdale', daypart: 'Peak', genre: 'Drama', index: 138, topRegions: ['yorkshire', 'granada', 'central'] },
  { channel: 'ITV', programme: 'Good Morning Britain', daypart: 'Breakfast', genre: 'News', index: 125, topRegions: ['london', 'central', 'granada'] },
  { channel: 'ITV', programme: 'Love Island', daypart: 'Peak', genre: 'Entertainment', index: 165, topRegions: ['london', 'central', 'meridian'] },
  { channel: 'ITV', programme: 'The Chase', daypart: 'Daytime', genre: 'Entertainment', index: 132, topRegions: ['central', 'granada', 'yorkshire'] },
  
  // Channel 4
  { channel: 'Channel 4', programme: 'Gogglebox', daypart: 'Peak', genre: 'Entertainment', index: 152, topRegions: ['london', 'central', 'yorkshire'] },
  { channel: 'Channel 4', programme: 'The Great British Bake Off', daypart: 'Peak', genre: 'Entertainment', index: 178, topRegions: ['london', 'central', 'meridian'] },
  { channel: 'Channel 4', programme: 'Location, Location, Location', daypart: 'Peak', genre: 'Factual', index: 142, topRegions: ['london', 'meridian', 'central'] },
  { channel: 'Channel 4', programme: 'Channel 4 News', daypart: 'Peak', genre: 'News', index: 118, topRegions: ['london', 'central'] },
  
  // Channel 5
  { channel: 'Channel 5', programme: 'Neighbours', daypart: 'Daytime', genre: 'Drama', index: 128, topRegions: ['central', 'granada'] },
  { channel: 'Channel 5', programme: 'The Gadget Show', daypart: 'Peak', genre: 'Factual', index: 135, topRegions: ['london', 'central'] },
  
  // Sky
  { channel: 'Sky Sports', programme: 'Premier League Live', daypart: 'Peak', genre: 'Sport', index: 188, topRegions: ['london', 'granada', 'yorkshire'] },
  { channel: 'Sky One', programme: 'Game of Thrones', daypart: 'Peak', genre: 'Drama', index: 162, topRegions: ['london', 'central', 'meridian'] },
  { channel: 'Sky News', programme: 'Sky News at Ten', daypart: 'Peak', genre: 'News', index: 112, topRegions: ['london', 'central'] },
  
  // BBC
  { channel: 'BBC One', programme: 'EastEnders', daypart: 'Peak', genre: 'Drama', index: 148, topRegions: ['london', 'meridian', 'central'] },
  { channel: 'BBC One', programme: 'Match of the Day', daypart: 'Late', genre: 'Sport', index: 175, topRegions: ['london', 'granada', 'yorkshire'] },
  { channel: 'BBC One', programme: 'The One Show', daypart: 'Peak', genre: 'Entertainment', index: 128, topRegions: ['london', 'central', 'yorkshire'] },
  { channel: 'BBC One', programme: 'BBC Breakfast', daypart: 'Breakfast', genre: 'News', index: 122, topRegions: ['london', 'central', 'granada'] },
  { channel: 'BBC Two', programme: 'Top Gear', daypart: 'Peak', genre: 'Entertainment', index: 155, topRegions: ['london', 'central', 'meridian'] },
  { channel: 'BBC Two', programme: 'Horizon', daypart: 'Peak', genre: 'Factual', index: 138, topRegions: ['london', 'central'] },
];

export function getMockTvInsights(tvRegions?: string[]): TvSpotInsight[] {
  if (!tvRegions || tvRegions.length === 0) {
    return MOCK_INSIGHTS;
  }
  
  // Filter to insights that have at least one matching region
  return MOCK_INSIGHTS.filter(insight =>
    insight.topRegions.some(region => tvRegions.includes(region))
  );
}

export function getTopChannel(insights: TvSpotInsight[]): { channel: string; index: number } | null {
  if (insights.length === 0) return null;
  
  const channelIndexes = insights.reduce((acc, insight) => {
    if (!acc[insight.channel]) {
      acc[insight.channel] = { total: 0, count: 0 };
    }
    acc[insight.channel].total += insight.index;
    acc[insight.channel].count += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);
  
  const channelAverages = Object.entries(channelIndexes).map(([channel, data]) => ({
    channel,
    index: Math.round(data.total / data.count),
  }));
  
  channelAverages.sort((a, b) => b.index - a.index);
  return channelAverages[0] || null;
}

export function getTopProgramme(insights: TvSpotInsight[]): { programme: string; channel: string; index: number } | null {
  if (insights.length === 0) return null;
  
  const top = insights.reduce((max, insight) => 
    insight.index > max.index ? { programme: insight.programme, channel: insight.channel, index: insight.index } : max
  , { programme: '', channel: '', index: 0 });
  
  return top.index > 0 ? top : null;
}

export function getBestDaypart(insights: TvSpotInsight[]): { daypart: string; index: number } | null {
  if (insights.length === 0) return null;
  
  const daypartIndexes = insights.reduce((acc, insight) => {
    if (!acc[insight.daypart]) {
      acc[insight.daypart] = { total: 0, count: 0 };
    }
    acc[insight.daypart].total += insight.index;
    acc[insight.daypart].count += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);
  
  const daypartAverages = Object.entries(daypartIndexes).map(([daypart, data]) => ({
    daypart,
    index: Math.round(data.total / data.count),
  }));
  
  daypartAverages.sort((a, b) => b.index - a.index);
  return daypartAverages[0] || null;
}

