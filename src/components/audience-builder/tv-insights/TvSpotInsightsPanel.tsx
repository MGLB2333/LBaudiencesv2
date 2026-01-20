'use client';

import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Accordion, AccordionSummary, AccordionDetails, Card, CardContent, Grid } from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import { useBuilderContext } from '../BuilderContext';
import { getMockTvInsights, getTopChannel, getTopProgramme, getBestDaypart } from './tvSpotMockData';
import { useMemo } from 'react';

export function TvSpotInsightsPanel() {
  const { state } = useBuilderContext();
  
  // Get filtered insights based on TV regions
  const insights = useMemo(() => {
    return getMockTvInsights(state.tvRegions.length > 0 ? state.tvRegions : undefined);
  }, [state.tvRegions]);
  
  // Calculate summary metrics
  const topChannel = getTopChannel(insights);
  const topProgramme = getTopProgramme(insights);
  const bestDaypart = getBestDaypart(insights);
  
  // Group by channel for top channels table
  const channelStats = useMemo(() => {
    const channelMap = insights.reduce((acc, insight) => {
      if (!acc[insight.channel]) {
        acc[insight.channel] = {
          channel: insight.channel,
          totalIndex: 0,
          count: 0,
        };
      }
      acc[insight.channel].totalIndex += insight.index;
      acc[insight.channel].count += 1;
      return acc;
    }, {} as Record<string, { channel: string; totalIndex: number; count: number }>);
    
    return Object.values(channelMap)
      .map(ch => ({
        channel: ch.channel,
        avgIndex: Math.round(ch.totalIndex / ch.count),
      }))
      .sort((a, b) => b.avgIndex - a.avgIndex);
  }, [insights]);
  
  // Top programmes (sorted by index)
  const topProgrammes = useMemo(() => {
    return [...insights]
      .sort((a, b) => b.index - a.index)
      .slice(0, 10);
  }, [insights]);
  
  // Daypart & Genre matrix
  const daypartGenreMatrix = useMemo(() => {
    const dayparts: Array<'Breakfast' | 'Daytime' | 'Peak' | 'Late'> = ['Breakfast', 'Daytime', 'Peak', 'Late'];
    const genres: Array<'Drama' | 'Sport' | 'Entertainment' | 'News' | 'Factual'> = ['Drama', 'Sport', 'Entertainment', 'News', 'Factual'];
    
    const matrix: Record<string, Record<string, number>> = {};
    
    dayparts.forEach(daypart => {
      matrix[daypart] = {};
      genres.forEach(genre => {
        const matching = insights.filter(i => i.daypart === daypart && i.genre === genre);
        if (matching.length > 0) {
          const avgIndex = Math.round(matching.reduce((sum, i) => sum + i.index, 0) / matching.length);
          matrix[daypart][genre] = avgIndex;
        }
      });
    });
    
    return { dayparts, genres, matrix };
  }, [insights]);
  
  return (
    <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
      {/* Page title */}
      <Typography variant="h6" sx={{ fontSize: '1.125rem', fontWeight: 600, mb: 2 }}>
        TV Spot Insights
      </Typography>
      
      {/* Explanatory subheading */}
      <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(0, 0, 0, 0.04)', borderRadius: 1 }}>
        <Typography variant="subtitle2" sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 0.75, color: 'text.primary' }}>
          How this works
        </Typography>
        <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.secondary', lineHeight: 1.6 }}>
          This view shows which linear TV channels, programmes, and dayparts your selected audience is most likely to watch.
          Insights are derived by matching viewing behaviour to the locations and characteristics of your audience.
          Results are indexed, so higher values indicate stronger affinity relative to the average viewer.
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 1, display: 'block', fontStyle: 'italic' }}>
          Index: 100 = average, higher means stronger affinity
        </Typography>
      </Box>
      
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Top Channel
              </Typography>
              <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 0.25 }}>
                {topChannel?.channel || 'N/A'}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'primary.main', fontWeight: 500 }}>
                Index: {topChannel?.index || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Top Programme
              </Typography>
              <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 0.25 }}>
                {topProgramme?.programme || 'N/A'}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'primary.main', fontWeight: 500 }}>
                Index: {topProgramme?.index || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Best Daypart
              </Typography>
              <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 0.25 }}>
                {bestDaypart?.daypart || 'N/A'}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'primary.main', fontWeight: 500 }}>
                Index: {bestDaypart?.index || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Top Channels & Top Programmes Tables */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1.5 }}>
              Top Channels
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 600, py: 0.5 }}>Rank</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 600, py: 0.5 }}>Channel</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.7rem', fontWeight: 600, py: 0.5 }}>Index</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {channelStats.slice(0, 10).map((ch, idx) => (
                    <TableRow key={ch.channel}>
                      <TableCell sx={{ fontSize: '0.7rem', py: 0.75 }}>{idx + 1}</TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', py: 0.75, fontWeight: 500 }}>{ch.channel}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.7rem', py: 0.75, color: 'primary.main', fontWeight: 500 }}>{ch.avgIndex}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1.5 }}>
              Top Programmes
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 600, py: 0.5 }}>Rank</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 600, py: 0.5 }}>Programme</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 600, py: 0.5 }}>Channel</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 600, py: 0.5 }}>Daypart</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.7rem', fontWeight: 600, py: 0.5 }}>Index</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topProgrammes.map((prog, idx) => (
                    <TableRow key={`${prog.channel}-${prog.programme}`}>
                      <TableCell sx={{ fontSize: '0.7rem', py: 0.75 }}>{idx + 1}</TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', py: 0.75, fontWeight: 500 }}>{prog.programme}</TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', py: 0.75 }}>{prog.channel}</TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', py: 0.75 }}>{prog.daypart}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.7rem', py: 0.75, color: 'primary.main', fontWeight: 500 }}>{prog.index}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Daypart & Genre Matrix */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1.5 }}>
          Daypart & Genre Performance
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: '0.7rem', fontWeight: 600, py: 0.5 }}>Daypart</TableCell>
                {daypartGenreMatrix.genres.map(genre => (
                  <TableCell key={genre} align="right" sx={{ fontSize: '0.7rem', fontWeight: 600, py: 0.5 }}>{genre}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {daypartGenreMatrix.dayparts.map(daypart => (
                <TableRow key={daypart}>
                  <TableCell sx={{ fontSize: '0.7rem', py: 0.75, fontWeight: 500 }}>{daypart}</TableCell>
                  {daypartGenreMatrix.genres.map(genre => {
                    const index = daypartGenreMatrix.matrix[daypart]?.[genre];
                    return (
                      <TableCell 
                        key={genre} 
                        align="right" 
                        sx={{ 
                          fontSize: '0.7rem', 
                          py: 0.75,
                          bgcolor: index ? `rgba(2, 181, 231, ${Math.min((index - 100) / 100, 0.3)})` : 'transparent',
                          color: index && index > 120 ? 'primary.main' : 'text.primary',
                          fontWeight: index && index > 130 ? 600 : 400,
                        }}
                      >
                        {index || '-'}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
      {/* How to use this */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
            How to use this
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            <Typography component="li" variant="body2" sx={{ fontSize: '0.8125rem', mb: 1 }}>
              Plan around high-index channels/programmes to maximize relevance to your audience
            </Typography>
            <Typography component="li" variant="body2" sx={{ fontSize: '0.8125rem', mb: 1 }}>
              Use dayparts to target when your audience over-indexes - focus on dayparts with higher index values
            </Typography>
            <Typography component="li" variant="body2" sx={{ fontSize: '0.8125rem' }}>
              Insights are derived by matching viewing behaviour to the locations and characteristics of your audience
            </Typography>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
