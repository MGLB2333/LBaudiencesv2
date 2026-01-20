'use client';

import { Box, Stepper, Step, StepLabel, Typography } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';

const steps = [
  'Brief',
  'Build & Explore',
  'Export',
];

interface StepHeaderProps {
  currentStep: number;
}

export function StepHeader({ currentStep }: StepHeaderProps) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5, fontSize: '1.125rem' }}>
        Audience Builder
      </Typography>
      <Stepper 
        activeStep={currentStep - 1} 
        alternativeLabel 
        sx={{ 
          mb: 2,
          '& .MuiStepLabel-label': {
            fontSize: '0.75rem',
            fontWeight: 500,
          },
          '& .MuiStepLabel-root': {
            padding: '0 8px',
          },
        }}
      >
        {steps.map((label, index) => (
          <Step key={label} completed={index < currentStep - 1}>
            <StepLabel
              StepIconComponent={({ active, completed }) => {
                if (completed) {
                  return <CheckCircle sx={{ color: '#02b5e7', fontSize: '20px' }} />;
                }
                if (active) {
                  return (
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        backgroundColor: '#02b5e7',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                      }}
                    >
                      {index + 1}
                    </Box>
                  );
                }
                return (
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      backgroundColor: '#e0e0e0',
                      color: '#757575',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                    }}
                  >
                    {index + 1}
                  </Box>
                );
              }}
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
}
