'use client';

import { Box, Typography, Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useExportContext } from './hooks/useExportContext';
import { ExportSummaryCard } from './ExportSummaryCard';
import { ExportActionsCard } from './ExportActionsCard';
import { ExportHistoryCard } from './ExportHistoryCard';

interface ExportStepProps {
  audienceId: string;
  onBack: () => void;
}

export function ExportStep({ audienceId, onBack }: ExportStepProps) {
  const router = useRouter();
  const { context, isLoading } = useExportContext(audienceId);
  const queryClient = useQueryClient();
  const [activationTarget, setActivationTarget] = useState<'districts' | 'h3' | 'geojson'>('h3');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewType, setPreviewType] = useState<'csv' | 'geojson' | null>(null);
  const [exportMethod, setExportMethod] = useState<'download' | 'push'>('download');
  const [selectedPlatform, setSelectedPlatform] = useState<'magnite' | 'ttd' | 'dv360' | 'liveramp' | null>(null);
  const [selectedExportFormat, setSelectedExportFormat] = useState<'csv' | 'geojson' | 'h3'>('csv');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Scroll-to-section behavior
  const summaryRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  const handleExport = async (type: 'csv' | 'geojson' | 'h3') => {
    if (!context) return;
    
    setIsExporting(true);
    // For H3, we export as geojson format but with h3 activation target
    const exportType = type === 'h3' ? 'geojson' : type;
    const targetActivationTarget = type === 'h3' ? 'h3' : type === 'geojson' ? 'geojson' : 'postcode_sector';
    
    try {
      const response = await fetch('/api/exports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audienceId,
          exportType: exportType,
          activationTarget: targetActivationTarget,
          recommendedThreshold: 50,
          validationMinAgreement: context.mode === 'validation' ? 1 : undefined,
          includedSegmentKeys: context.selectedSegments.map(s => s.segment_key),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      const result = await response.json();

      // Invalidate exports query to refresh list
      queryClient.invalidateQueries({ queryKey: ['exports', audienceId] });

      // Trigger download
      if (result.export) {
        handleDownload(result.export.storage_path);
      }
    } catch (error) {
      console.error('Export error:', error);
      setSnackbarMessage(error instanceof Error ? error.message : 'Export failed. Please try again.');
      setSnackbarOpen(true);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = async (storagePath: string) => {
    try {
      const response = await fetch(`/api/exports/download?path=${encodeURIComponent(storagePath)}`);
      if (!response.ok) {
        throw new Error('Failed to generate download URL');
      }
      const { url } = await response.json();
      window.open(url, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      setSnackbarMessage('Download failed. Please try again.');
      setSnackbarOpen(true);
    }
  };

  const handlePreview = async (type: 'csv' | 'geojson' | 'h3') => {
    if (!context) return;
    
    setIsLoadingPreview(true);
    // For H3, we preview as geojson format but with h3 activation target
    const exportType = type === 'h3' ? 'geojson' : type;
    const targetActivationTarget = type === 'h3' ? 'h3' : type === 'geojson' ? 'geojson' : 'postcode_sector';
    setPreviewType(exportType);
    try {
      const response = await fetch('/api/exports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audienceId,
          exportType: exportType,
          activationTarget: targetActivationTarget,
          recommendedThreshold: 50,
          validationMinAgreement: context.mode === 'validation' ? 1 : undefined,
          includedSegmentKeys: context.selectedSegments.map(s => s.segment_key),
          preview: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Preview failed');
      }

      const result = await response.json();
      setPreviewData(result.preview);
    } catch (error) {
      console.error('Preview error:', error);
      setSnackbarMessage(error instanceof Error ? error.message : 'Preview failed. Please try again.');
      setSnackbarOpen(true);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleExportAudience = async () => {
    if (exportMethod === 'download') {
      // Trigger export with selected format
      await handleExport(selectedExportFormat);
    } else if (exportMethod === 'push') {
      // Show demo message
      setSnackbarMessage('Demo: push simulated');
      setSnackbarOpen(true);
    }
  };

  const handleSaveAndClose = () => {
    // Navigate back to audiences list
    router.push('/audiences');
  };

  if (isLoading || !context) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 4 }} suppressHydrationWarning>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, fontSize: '1.125rem' }}>
        Export
      </Typography>

      {/* Export Summary */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', mb: 1 }}>
          Export summary
        </Typography>
        <div ref={summaryRef}>
          <ExportSummaryCard 
            context={context} 
            activationTarget={exportMethod === 'download' ? activationTarget : undefined}
            exportMethod={exportMethod}
          />
        </div>
      </Box>

      {/* Export Actions */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', mb: 1 }}>
          Export method
        </Typography>
        <div ref={actionsRef}>
          <ExportActionsCard
            audienceId={audienceId}
            activationTarget={activationTarget}
            onActivationTargetChange={setActivationTarget}
            onExport={handleExport}
            onPreview={handlePreview}
            isExporting={isExporting}
            isLoadingPreview={isLoadingPreview}
            previewData={previewData}
            previewType={previewType}
            exportMethod={exportMethod}
            onExportMethodChange={setExportMethod}
            selectedPlatform={selectedPlatform}
            onSelectedPlatformChange={setSelectedPlatform}
            onExportFormatChange={setSelectedExportFormat}
          />
        </div>
      </Box>

      {/* Export History */}
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', mb: 1 }}>
          History
        </Typography>
        <div ref={historyRef}>
          <ExportHistoryCard audienceId={audienceId} onDownload={handleDownload} />
        </div>
      </Box>

      {/* Footer Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4, pt: 3, borderTop: '1px solid #e0e0e0' }}>
        <Button
          variant="outlined"
          onClick={onBack}
          size="small"
          sx={{ fontSize: '0.875rem' }}
        >
          Back
        </Button>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={handleSaveAndClose}
            size="small"
            sx={{ fontSize: '0.875rem' }}
          >
            Save & close
          </Button>
          <Button
            variant="contained"
            onClick={handleExportAudience}
            disabled={isExporting || (exportMethod === 'push' && !selectedPlatform)}
            size="small"
            sx={{
              bgcolor: '#02b5e7',
              '&:hover': { bgcolor: '#02a0d0' },
              fontSize: '0.875rem',
            }}
          >
            {isExporting ? 'Exporting...' : 'Export audience'}
          </Button>
        </Box>
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarMessage.includes('failed') ? 'error' : 'info'} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
