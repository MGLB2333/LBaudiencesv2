'use client';

import { Box, Card, CardContent, TextField, Typography, Button, IconButton, Modal, Backdrop, Fade, LinearProgress, CircularProgress, Divider, Chip } from '@mui/material';
import { InfoOutlined, AttachFile, Close } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAudience, useUpdateAudience } from '@/features/audience-builder/hooks/useAudiences';
import { useConstructionSettings, useUpdateConstructionSettings } from '@/features/audience-builder/hooks/useConstruction';
import { buildAudience } from '@/features/audience-builder/services/buildAudience.service';
import { format } from 'date-fns';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useBuilderContext } from '../BuilderContext';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  target_reach: z.number().positive().optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

interface AudienceDetailsStepProps {
  audienceId: string;
  onNext: () => void;
}

const fieldInfoModals: Record<string, { title: string; content: string }> = {
  audience_description: {
    title: 'Audience Description',
    content: 'Describe your target audience in detail. Our AI will analyze your description to suggest relevant signals and segments. Be specific about demographics, behaviors, interests, and any other characteristics that define your ideal audience.',
  },
  audience_name: {
    title: 'Audience Name',
    content: 'Give your audience a clear, descriptive name that will help you identify it later. This name will be used throughout the platform to reference this audience.',
  },
  dates: {
    title: 'Campaign Dates',
    content: 'Set the start and end dates for your campaign. These dates help define the campaign timeline and can be used for scheduling and reporting purposes.',
  },
  budget: {
    title: 'Budget Total',
    content: 'Enter your total campaign budget. This helps with planning and optimization. You can leave this blank if you don\'t have a budget set yet.',
  },
};

function InfoModal({ fieldKey, open, onClose }: { fieldKey: string; open: boolean; onClose: () => void }) {
  const info = fieldInfoModals[fieldKey];
  if (!info) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{
        backdrop: {
          timeout: 500,
        },
      }}
    >
      <Fade in={open}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 400,
            bgcolor: 'background.paper',
            border: '1px solid #e0e0e0',
            borderRadius: 1,
            boxShadow: 24,
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: '1rem' }}>
            {info.title}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 2 }}>
            {info.content}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={onClose} size="small" variant="contained" sx={{ fontSize: '0.875rem' }}>
              Close
            </Button>
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
}

export function AudienceDetailsStep({ audienceId, onNext }: AudienceDetailsStepProps) {
  const { data: audience, isLoading } = useAudience(audienceId);
  const { data: settings } = useConstructionSettings(audienceId);
  const updateMutation = useUpdateAudience();
  const updateConstructionMutation = useUpdateConstructionSettings();
  const [infoModalOpen, setInfoModalOpen] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState<{
    step: number;
    label: string;
    error?: string;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mark as mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: audience
      ? {
          name: audience.name,
          description: audience.description || '',
          target_reach: audience.target_reach || '',
        }
      : undefined,
    values: audience
      ? {
          name: audience.name,
          description: audience.description || '',
          target_reach: audience.target_reach || '',
        }
      : undefined,
  });

  const handleBuildAudience = async (data: FormData) => {
    setIsBuilding(true);
    setBuildProgress({ step: 1, label: 'Saving brief' });
    
    try {
      // Step 1: Save audience form values
      await updateMutation.mutateAsync({
        id: audienceId,
        updates: {
          name: data.name,
          description: data.description || null,
          target_reach: data.target_reach ? Number(data.target_reach) : null,
        },
      });

      // Get current construction settings (mode is set in Step 2)
      let currentSettings = settings;
      if (!currentSettings) {
        // Create default construction settings if they don't exist (default to extension)
        currentSettings = await updateConstructionMutation.mutateAsync({
          audienceId,
          updates: {
            construction_mode: 'extension',
            audience_intent: null,
            active_signals: {},
          },
        });
      }

      // Step 2: Validate providers OR Generate suggestions
      const mode = currentSettings?.construction_mode || 'extension';
      setBuildProgress({ 
        step: 2, 
        label: mode === 'validation' ? 'Validating providers' : 'Generating suggestions' 
      });
      
      // Trigger build pipeline
      await buildAudience(audienceId);

      // Step 3: Scoring geo units (simulated - actual scoring happens on map step)
      setBuildProgress({ step: 3, label: 'Scoring geo units' });
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX

      // Step 4: Finalising outputs
      setBuildProgress({ step: 4, label: 'Finalising outputs' });
      await new Promise(resolve => setTimeout(resolve, 300)); // Brief delay for UX

      // Navigate to Step 2
      onNext();
    } catch (error) {
      console.error('Build audience failed:', error);
      setBuildProgress({
        step: buildProgress?.step || 1,
        label: buildProgress?.label || 'Error',
        error: error instanceof Error ? error.message : 'Failed to build audience. Please try again.',
      });
    } finally {
      setIsBuilding(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validExtensions = ['pdf', 'doc', 'docx', 'csv'];
    const validFiles = files.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ext && validExtensions.includes(ext);
    });
    setSelectedFiles(prev => [...prev, ...validFiles]);
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddFileClick = () => {
    fileInputRef.current?.click();
  };

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <div suppressHydrationWarning>
      <form onSubmit={handleSubmit(handleBuildAudience)}>
        <Box sx={{ maxWidth: '75%', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {/* Audience Description Card */}
          <Box id="brief-target-audience" sx={{ scrollMarginTop: '80px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                Who do you want to target?
              </Typography>
              <IconButton
                size="small"
                sx={{ p: 0.5, color: '#9e9e9e' }}
                onClick={() => setInfoModalOpen('audience_description')}
              >
                <InfoOutlined sx={{ fontSize: '0.875rem' }} />
              </IconButton>
            </Box>
            <Card>
              <CardContent sx={{ pb: selectedFiles.length > 0 ? 2 : 2, '&:last-child': { pb: selectedFiles.length > 0 ? 2 : 2 } }}>
                <TextField
                placeholder="Describe the people you want to reach, in your own words.
e.g. 'People likely to be moving home in the next 12 months'"
                multiline
                rows={6}
                {...register('description')}
                error={!!errors.description}
                helperText={errors.description?.message}
                fullWidth
                size="small"
                sx={{
                  mb: 1,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#f5f5f5',
                    borderRadius: 0,
                    '& fieldset': {
                      border: 'none',
                      borderBottom: '2px solid transparent',
                    },
                    '&:hover fieldset': {
                      border: 'none',
                      borderBottom: '2px solid rgba(59, 200, 234, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      border: 'none',
                      borderBottom: '2px solid #3bc8ea',
                    },
                  },
                  '& .MuiInputBase-input': {
                    fontSize: '0.875rem',
                    color: '#757575',
                  },
                }}
                />
                <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block', mt: 0.5 }}>
                  You can describe an audience, upload a brief, or add supporting files.
                </Typography>
                
                {/* Footer with file upload */}
                <Divider sx={{ my: 2 }} />
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.csv"
                      multiple
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AttachFile />}
                      onClick={handleAddFileClick}
                      sx={{ fontSize: '0.75rem', textTransform: 'none' }}
                    >
                      Add supporting file
                    </Button>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                      PDF, DOCX, CSV
                    </Typography>
                  </Box>
                  {selectedFiles.length > 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
                      {selectedFiles.map((file, index) => (
                        <Chip
                          key={index}
                          label={file.name}
                          onDelete={() => handleRemoveFile(index)}
                          deleteIcon={<Close sx={{ fontSize: '0.875rem' }} />}
                          size="small"
                          sx={{
                            fontSize: '0.7rem',
                            height: 24,
                            '& .MuiChip-label': {
                              px: 1,
                            },
                          }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Audience Name & Dates Card */}
          <Box id="brief-name" sx={{ scrollMarginTop: '80px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                Audience name
              </Typography>
              <IconButton
                size="small"
                sx={{ p: 0.5, color: '#9e9e9e' }}
                onClick={() => setInfoModalOpen('audience_name')}
              >
                <InfoOutlined sx={{ fontSize: '0.875rem' }} />
              </IconButton>
            </Box>
            <Card>
              <CardContent sx={{ pb: 12, '&:last-child': { pb: 12 } }}>
                <TextField
                placeholder="Enter audience name..."
                {...register('name')}
                error={!!errors.name}
                helperText={errors.name?.message}
                fullWidth
                required
                size="small"
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#f5f5f5',
                    borderBottom: '2px solid transparent',
                    '& fieldset': {
                      border: 'none',
                    },
                    '&:hover fieldset': {
                      border: 'none',
                    },
                    '&:hover': {
                      borderBottom: '2px solid rgba(59, 200, 234, 0.5)',
                    },
                    '&.Mui-focused': {
                      borderBottom: '2px solid #3bc8ea',
                    },
                    '&.Mui-focused fieldset': {
                      border: 'none',
                    },
                  },
                  '& .MuiInputBase-input': {
                    fontSize: '0.875rem',
                    color: '#757575',
                  },
                }}
                />

              </CardContent>
            </Card>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <Button 
              type="submit" 
              variant="contained" 
              size="small" 
              disabled={isBuilding}
              sx={{ fontSize: '0.875rem' }}
            >
              {isBuilding ? 'Building...' : 'Build audience'}
            </Button>
          </Box>
        </Box>
      </form>

      {/* Info Modals */}
      {Object.keys(fieldInfoModals).map((key) => (
        <InfoModal
          key={key}
          fieldKey={key}
          open={infoModalOpen === key}
          onClose={() => setInfoModalOpen(null)}
        />
      ))}

      {/* Build Progress Modal */}
      <Modal
        open={isBuilding || !!buildProgress?.error}
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{
          backdrop: {
            timeout: 500,
          },
        }}
      >
        <Fade in={isBuilding || !!buildProgress?.error}>
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 400,
              bgcolor: 'background.paper',
              border: '1px solid #e0e0e0',
              borderRadius: 1,
              boxShadow: 24,
              p: 3,
            }}
          >
            {buildProgress?.error ? (
              <>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: '1rem' }}>
                  Build Failed
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 2 }}>
                  {buildProgress.error}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <Button
                    size="small"
                    onClick={() => {
                      setBuildProgress(null);
                      setIsBuilding(false);
                    }}
                    sx={{ fontSize: '0.875rem' }}
                  >
                    Close
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => {
                      setBuildProgress(null);
                      setIsBuilding(false);
                      handleSubmit(handleBuildAudience)();
                    }}
                    sx={{ fontSize: '0.875rem' }}
                  >
                    Try again
                  </Button>
                </Box>
              </>
            ) : (
              <>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: '1rem' }}>
                  Building audience
                </Typography>
                <Box sx={{ mb: 2 }}>
                  {[1, 2, 3, 4].map((step) => {
                    // Get mode from current settings or default
                    const currentMode = settings?.construction_mode || 'extension';
                    const stepLabels = [
                      'Saving brief',
                      currentMode === 'validation' ? 'Validating providers' : 'Generating suggestions',
                      'Scoring geo units',
                      'Finalising outputs',
                    ];
                    const isActive = buildProgress?.step === step;
                    const isComplete = buildProgress && buildProgress.step > step;
                    
                    return (
                      <Box key={step} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                        {isComplete ? (
                          <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: '#4caf50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography sx={{ color: 'white', fontSize: '0.75rem' }}>✓</Typography>
                          </Box>
                        ) : isActive ? (
                          <CircularProgress size={20} sx={{ color: '#02b5e7' }} />
                        ) : (
                          <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: '#e0e0e0' }} />
                        )}
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontSize: '0.875rem',
                            color: isActive ? 'text.primary' : 'text.secondary',
                            fontWeight: isActive ? 500 : 400,
                          }}
                        >
                          {stepLabels[step - 1]}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
                <LinearProgress sx={{ mb: 2 }} />
              </>
            )}
          </Box>
        </Fade>
      </Modal>
    </div>
  );
}
