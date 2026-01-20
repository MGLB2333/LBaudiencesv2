'use client';

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { Download, CloudUpload } from '@mui/icons-material';

interface ExportActionsCardProps {
  audienceId: string;
  activationTarget: 'districts' | 'h3' | 'geojson';
  onActivationTargetChange: (target: 'districts' | 'h3' | 'geojson') => void;
  onExport: (type: 'csv' | 'geojson') => Promise<void>;
  onPreview: (type: 'csv' | 'geojson') => Promise<void>;
  isExporting: boolean;
  isLoadingPreview: boolean;
  previewData?: any;
  previewType?: 'csv' | 'geojson' | null;
  exportMethod: 'download' | 'push';
  onExportMethodChange: (method: 'download' | 'push') => void;
  selectedPlatform: 'magnite' | 'ttd' | 'dv360' | 'liveramp' | null;
  onSelectedPlatformChange: (platform: 'magnite' | 'ttd' | 'dv360' | 'liveramp' | null) => void;
  onExportFormatChange?: (format: 'csv' | 'geojson' | 'h3') => void;
}

interface PlatformConfig {
  magnite: { accountId?: string; destination?: string; notes?: string };
  ttd: { advertiserId?: string; seatId?: string; destination?: string; notes?: string };
  dv360: { advertiserId?: string; partnerId?: string; destination?: string; notes?: string };
  liveramp: { destination?: string; notes?: string };
}

export function ExportActionsCard({
  audienceId,
  activationTarget,
  onActivationTargetChange,
  onExport,
  onPreview,
  isExporting,
  isLoadingPreview,
  previewData: externalPreviewData,
  previewType: externalPreviewType,
  exportMethod,
  onExportMethodChange,
  selectedPlatform,
  onSelectedPlatformChange,
  onExportFormatChange,
}: ExportActionsCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [platformConfigs, setPlatformConfigs] = useState<PlatformConfig>({
    magnite: {},
    ttd: {},
    dv360: {},
    liveramp: {},
  });
  const [platformDialogOpen, setPlatformDialogOpen] = useState<string | null>(null);
  const [platformDialogData, setPlatformDialogData] = useState<any>({});
  const [selectedExportFormat, setSelectedExportFormat] = useState<'csv' | 'geojson' | 'h3'>('csv');

  const handlePreview = async (type: 'csv' | 'geojson') => {
    try {
      await onPreview(type);
      setPreviewOpen(true);
    } catch (error) {
      console.error('Preview failed:', error);
    }
  };

  const previewData = externalPreviewData;
  const previewType = externalPreviewType;

  const handlePlatformClick = (platform: 'magnite' | 'ttd' | 'dv360' | 'liveramp') => {
    const config = platformConfigs[platform];
    if (!config || Object.keys(config).length === 0) {
      // Open dialog to configure
      setPlatformDialogData({});
      setPlatformDialogOpen(platform);
    }
  };

  const handlePlatformSave = () => {
    if (platformDialogOpen) {
      setPlatformConfigs(prev => ({
        ...prev,
        [platformDialogOpen]: platformDialogData,
      }));
      setPlatformDialogOpen(null);
      setPlatformDialogData({});
    }
  };

  const isPlatformConfigured = (platform: string) => {
    const config = platformConfigs[platform as keyof PlatformConfig];
    return config && Object.keys(config).length > 0 && Object.values(config).some(v => v);
  };

  return (
    <>
      <Card id="export-actions" sx={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
        <CardContent sx={{ p: 3, pb: 12, '&:last-child': { pb: 12 } }}>

          {/* First row: Download or Push to platform */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.75 }}>
              Select export type
            </Typography>
            <ToggleButtonGroup
              value={exportMethod}
              exclusive
              onChange={(_, v) => v && onExportMethodChange(v)}
              sx={{
                '& .MuiToggleButton-root': {
                  px: 2,
                  py: 1,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textTransform: 'none',
                  color: '#02b5e7',
                  borderColor: 'rgba(2, 181, 231, 0.3)',
                  bgcolor: 'white',
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(2, 181, 231, 0.1)',
                    color: '#02b5e7',
                    '&:hover': {
                      backgroundColor: 'rgba(2, 181, 231, 0.15)',
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(2, 181, 231, 0.05)',
                  },
                },
              }}
            >
              <ToggleButton value="download">Download</ToggleButton>
              <ToggleButton value="push">Push to platform</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Second row: Format or Platform selection */}
          {exportMethod === 'download' && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.75 }}>
                Select file type
              </Typography>
              <ToggleButtonGroup
                value={selectedExportFormat}
                exclusive
                onChange={(_, v) => {
                  if (v) {
                    setSelectedExportFormat(v);
                    onExportFormatChange?.(v);
                  }
                }}
                sx={{
                  '& .MuiToggleButton-root': {
                    px: 2,
                    py: 1,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    textTransform: 'none',
                    color: '#02b5e7',
                    borderColor: 'rgba(2, 181, 231, 0.3)',
                    bgcolor: 'white',
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(2, 181, 231, 0.1)',
                      color: '#02b5e7',
                      '&:hover': {
                        backgroundColor: 'rgba(2, 181, 231, 0.15)',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(2, 181, 231, 0.05)',
                    },
                  },
                }}
              >
                <ToggleButton value="csv">CSV</ToggleButton>
                <ToggleButton value="geojson">JSON</ToggleButton>
                <ToggleButton value="h3">H3 hex</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}

          {exportMethod === 'push' && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.75 }}>
                Select platform
              </Typography>
              <ToggleButtonGroup
                value={selectedPlatform || ''}
                exclusive
                onChange={(_, v) => {
                  if (v) {
                    onSelectedPlatformChange(v as 'magnite' | 'ttd' | 'dv360' | 'liveramp');
                    handlePlatformClick(v as 'magnite' | 'ttd' | 'dv360' | 'liveramp');
                  }
                }}
                sx={{
                  '& .MuiToggleButton-root': {
                    px: 2,
                    py: 1,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    textTransform: 'none',
                    color: '#02b5e7',
                    borderColor: 'rgba(2, 181, 231, 0.3)',
                    bgcolor: 'white',
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(2, 181, 231, 0.1)',
                      color: '#02b5e7',
                      '&:hover': {
                        backgroundColor: 'rgba(2, 181, 231, 0.15)',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(2, 181, 231, 0.05)',
                    },
                  },
                }}
              >
                <ToggleButton value="liveramp">LiveRamp</ToggleButton>
                <ToggleButton value="ttd">The Trade Desk</ToggleButton>
                <ToggleButton value="magnite">Magnite</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}


          {/* Push to platform panel */}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog
        open={previewOpen && !!previewData}
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: '1.125rem', fontWeight: 600 }}>
          Preview Export ({previewType?.toUpperCase()})
        </DialogTitle>
        <DialogContent>
          {previewData && (
            <>
              {/* Metadata */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, display: 'block', mb: 0.5 }}>
                  Metadata:
                </Typography>
                <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1, maxHeight: 200, overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {JSON.stringify(previewData.metadata, null, 2)}
                  </pre>
                </Box>
              </Box>

              {/* CSV Preview */}
              {previewType === 'csv' && previewData.rows && (
                <Box>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, display: 'block', mb: 0.5 }}>
                    Sample rows ({previewData.rows.length} of {previewData.totalRows}):
                  </Typography>
                  <TableContainer component={Paper} sx={{ maxHeight: 300, overflow: 'auto' }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          {previewData.headers?.map((header: string, idx: number) => (
                            <TableCell key={idx} sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                              {header}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {previewData.rows.map((row: string[], idx: number) => (
                          <TableRow key={idx}>
                            {row.map((cell: string, cellIdx: number) => (
                              <TableCell key={cellIdx} sx={{ fontSize: '0.7rem' }}>
                                {cell}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* GeoJSON Preview */}
              {previewType === 'geojson' && previewData.sampleFeatures && (
                <Box>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, display: 'block', mb: 0.5 }}>
                    Sample features ({previewData.sampleFeatures.length} of {previewData.featureCount}):
                  </Typography>
                  <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1, maxHeight: 300, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace' }}>
                      {JSON.stringify(previewData.sampleFeatures, null, 2)}
                    </pre>
                  </Box>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)} size="small" sx={{ fontSize: '0.875rem' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
