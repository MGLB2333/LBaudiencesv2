'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
} from '@mui/material';
import { DataPartner } from '../api/dataPartners';

interface EditDataPartnerDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Pick<DataPartner, 'display_name' | 'website_url' | 'description' | 'logo_url'>>) => Promise<void>;
  partner?: DataPartner | null;
}

export function EditDataPartnerDialog({ open, onClose, onSave, partner }: EditDataPartnerDialogProps) {
  const [displayName, setDisplayName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ displayName?: string; websiteUrl?: string }>({});

  useEffect(() => {
    if (open && partner) {
      setDisplayName(partner.display_name || '');
      setWebsiteUrl(partner.website_url || '');
      setDescription(partner.description || '');
      setLogoUrl(partner.logo_url || '');
      setErrors({});
    }
  }, [open, partner]);

  const validateUrl = (urlValue: string): boolean => {
    if (!urlValue) return true; // URL is optional
    try {
      const urlWithScheme = urlValue.startsWith('http://') || urlValue.startsWith('https://')
        ? urlValue
        : `https://${urlValue}`;
      new URL(urlWithScheme);
      return true;
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    const newErrors: { displayName?: string; websiteUrl?: string } = {};
    
    if (!displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    }

    if (websiteUrl && !validateUrl(websiteUrl)) {
      newErrors.websiteUrl = 'Please enter a valid URL';
    }

    if (logoUrl && !validateUrl(logoUrl)) {
      newErrors.websiteUrl = 'Logo URL must be a valid URL';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      // If logo_url is empty but website_url is provided, let the backend auto-generate it
      // (by not passing logo_url, the trigger will handle it)
      await onSave({
        display_name: displayName.trim(),
        website_url: websiteUrl.trim() || null,
        description: description.trim() || null,
        logo_url: logoUrl.trim() || (websiteUrl.trim() ? undefined : null), // undefined = auto-generate, null = clear
      });
      onClose();
    } catch (error) {
      console.error('Failed to save data partner:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: '1.25rem', fontWeight: 600 }}>
        Edit Data Partner
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Provider Key"
            value={partner?.provider_key || ''}
            disabled
            fullWidth
            size="small"
            helperText="Provider key cannot be changed (matches geo_district_signals.provider)"
          />
          <TextField
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={!!errors.displayName}
            helperText={errors.displayName || 'Name shown in UI'}
            required
            fullWidth
            size="small"
          />
          <TextField
            label="Website URL"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            error={!!errors.websiteUrl}
            helperText={errors.websiteUrl || 'Optional'}
            fullWidth
            size="small"
            placeholder="https://example.com"
          />
          <TextField
            label="Logo URL"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            helperText={websiteUrl ? "Optional. Leave empty to auto-generate favicon from website URL" : "Optional logo/favicon URL"}
            fullWidth
            size="small"
            placeholder={websiteUrl ? "Auto-generated from website" : "https://example.com/logo.png"}
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            size="small"
            multiline
            rows={3}
            placeholder="Optional description"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSaving}
          sx={{ bgcolor: '#02b5e7', '&:hover': { bgcolor: '#02a0d0' } }}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
