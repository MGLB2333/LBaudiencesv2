'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BuilderProvider } from '@/components/audience-builder/BuilderContext';
import { AudienceDetailsStep } from './steps/AudienceDetailsStep';
import { AudienceSelectionStep } from './steps/AudienceSelectionStep';
import { BuildExploreStep } from './steps/BuildExploreStep';
import { ExportStep } from './steps/ExportStep';

interface AudienceBuilderProps {
  audienceId: string;
  initialStep: number;
}

export function AudienceBuilder({ audienceId, initialStep }: AudienceBuilderProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(initialStep);

  const handleNext = () => {
    const nextStep = currentStep + 1;
    if (nextStep <= 4) {
      setCurrentStep(nextStep);
      router.push(`/audiences/${audienceId}/builder?step=${nextStep}`);
    }
  };

  const handleBack = () => {
    const prevStep = currentStep - 1;
    if (prevStep >= 1) {
      setCurrentStep(prevStep);
      router.push(`/audiences/${audienceId}/builder?step=${prevStep}`);
    } else {
      router.push('/audiences');
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <AudienceDetailsStep audienceId={audienceId} onNext={handleNext} />;
      case 2:
        return <AudienceSelectionStep audienceId={audienceId} onNext={handleNext} onBack={handleBack} />;
      case 3:
        return <BuildExploreStep audienceId={audienceId} onNext={handleNext} onBack={handleBack} />;
      case 4:
        return <ExportStep audienceId={audienceId} onBack={handleBack} />;
      default:
        return <AudienceDetailsStep audienceId={audienceId} onNext={handleNext} />;
    }
  };

  return (
    <AppLayout>
      <ErrorBoundary>
        <BuilderProvider audienceId={audienceId}>
          {renderStep()}
        </BuilderProvider>
      </ErrorBoundary>
    </AppLayout>
  );
}
