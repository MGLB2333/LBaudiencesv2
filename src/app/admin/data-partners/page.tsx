'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  CircularProgress,
  Typography,
} from '@mui/material';
import { Edit } from '@mui/icons-material';
import { AdminPageShell } from '@/features/admin/components/AdminPageShell';
import { EditDataPartnerDialog } from '@/features/admin/components/EditDataPartnerDialog';
import {
  useDataPartners,
  useUpdateDataPartner,
  useSyncDataPartners,
} from '@/features/admin/hooks/useDataPartners';
import { DataPartner } from '@/features/admin/api/dataPartners';
import { Avatar } from '@mui/material';

export default function DataPartnersPage() {
  const { data: partners = [], isLoading } = useDataPartners();
  const updatePartner = useUpdateDataPartner();
  const syncPartners = useSyncDataPartners();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<DataPartner | null>(null);

  const handleEdit = (partner: DataPartner) => {
    setEditingPartner(partner);
    setDialogOpen(true);
  };

  const handleSync = async () => {
    try {
      const count = await syncPartners.mutateAsync();
      alert(`Synced ${count} new providers from uploaded data.`);
    } catch (error) {
      console.error('Failed to sync partners:', error);
      alert('Failed to sync. Please try again.');
    }
  };

  const handleSave = async (updates: Partial<Pick<DataPartner, 'display_name' | 'website_url' | 'description' | 'logo_url'>>) => {
    if (editingPartner) {
      await updatePartner.mutateAsync({ providerKey: editingPartner.provider_key, updates });
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingPartner(null);
  };

  if (isLoading) {
    return (
      <AdminPageShell title="Data Partners">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell title="Data Partners">
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
          Providers are automatically synced from uploaded data. Edit display names and metadata below.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            onClick={handleSync}
            disabled={syncPartners.isPending}
            size="small"
            sx={{ fontSize: '0.875rem' }}
          >
            {syncPartners.isPending ? 'Syncing...' : 'Sync from data'}
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper} sx={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Logo</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Provider Key</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Display Name</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Website</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Description</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {partners.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No data partners yet. Click "Sync from data" to load providers from uploaded files.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              partners.map((partner) => (
                <TableRow key={partner.id}>
                  <TableCell>
                    <Avatar
                      src={partner.logo_url || undefined}
                      sx={{ width: 32, height: 32, fontSize: '0.75rem', bgcolor: '#e0e0e0' }}
                    >
                      {partner.display_name.charAt(0)}
                    </Avatar>
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8125rem', fontFamily: 'monospace' }}>{partner.provider_key}</TableCell>
                  <TableCell sx={{ fontSize: '0.8125rem', fontWeight: 500 }}>{partner.display_name}</TableCell>
                  <TableCell sx={{ fontSize: '0.8125rem' }}>
                    {partner.website_url ? (
                      <a href={partner.website_url} target="_blank" rel="noopener noreferrer" style={{ color: '#02b5e7' }}>
                        {partner.website_url}
                      </a>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8125rem' }}>{partner.description || '—'}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleEdit(partner)}>
                      <Edit sx={{ fontSize: '1rem' }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <EditDataPartnerDialog
        open={dialogOpen}
        onClose={handleClose}
        onSave={handleSave}
        partner={editingPartner}
      />
    </AdminPageShell>
  );
}
