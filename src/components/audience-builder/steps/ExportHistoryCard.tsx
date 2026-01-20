'use client';

import { Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button } from '@mui/material';
import { Download } from '@mui/icons-material';
import { useExports } from '@/features/audience-builder/hooks/useExports';

interface ExportHistoryCardProps {
  audienceId: string;
  onDownload: (storagePath: string) => Promise<void>;
}

export function ExportHistoryCard({ audienceId, onDownload }: ExportHistoryCardProps) {
  const { data: exports = [] } = useExports(audienceId);

  return (
    <Card id="export-history" sx={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
      <CardContent sx={{ p: 2, pb: 12, '&:last-child': { pb: 12 } }}>
        {exports.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', textAlign: 'center', py: 4 }}>
            No exports yet. Generate your first export to see it here.
          </Typography>
        ) : (
          <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Target</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Created</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {exports.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell sx={{ fontSize: '0.8125rem' }}>{exp.export_type.toUpperCase()}</TableCell>
                    <TableCell sx={{ fontSize: '0.8125rem' }}>—</TableCell>
                    <TableCell sx={{ fontSize: '0.8125rem' }}>
                      {new Date(exp.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.7rem',
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          bgcolor: '#e8f5e9',
                          color: '#2e7d32',
                        }}
                      >
                        Ready
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        startIcon={<Download />}
                        onClick={() => onDownload(exp.storage_path)}
                        sx={{ fontSize: '0.75rem' }}
                      >
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
