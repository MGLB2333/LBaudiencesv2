'use client';

import { Box, Skeleton, Card, CardContent } from '@mui/material';

export function StepLoadingSkeleton() {
  return (
    <Card>
      <CardContent>
        <Skeleton variant="text" width="60%" height={40} sx={{ mb: 2 }} />
        <Skeleton variant="text" width="80%" height={24} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={100} />
      </CardContent>
    </Card>
  );
}

export function MapLoadingSkeleton() {
  return (
    <Box sx={{ display: 'flex', gap: 2, minHeight: '600px' }}>
      <Card sx={{ width: 300 }}>
        <CardContent>
          <Skeleton variant="rectangular" height={40} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={40} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={200} />
        </CardContent>
      </Card>
      <Card sx={{ flex: 1 }}>
        <Skeleton variant="rectangular" height="100%" />
      </Card>
    </Box>
  );
}
