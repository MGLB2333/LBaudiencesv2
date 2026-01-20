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
import { Client } from '../api/clients';

interface EditClientDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (client: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  client?: Client | null;
}

export function EditClientDialog({ open, onClose, onSave, client }: EditClientDialogProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});

  useEffect(() => {
    if (open) {
      if (client) {
        setName(client.name || '');
        setUrl(client.url || '');
      } else {
        setName('');
        setUrl('');
      }
      setErrors({});
    }
  }, [open, client]);

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
    const newErrors: { name?: string; url?: string } = {};
    
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (url && !validateUrl(url)) {
      newErrors.url = 'Please enter a valid URL';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        url: url.trim() || null,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save client:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: '1.25rem', fontWeight: 600 }}>
        {client ? 'Edit Client' : 'New Client'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            required
            fullWidth
            size="small"
          />
          <TextField
            label="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            error={!!errors.url}
            helperText={errors.url || 'Optional'}
            fullWidth
            size="small"
            placeholder="https://example.com"
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
