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
  Avatar,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { AdminPageShell } from '@/features/admin/components/AdminPageShell';
import { EditClientDialog } from '@/features/admin/components/EditClientDialog';
import {
  useClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
} from '@/features/admin/hooks/useClients';
import { Client } from '@/features/admin/api/clients';
import { getFaviconUrl } from '@/features/admin/utils/favicon';
import { Typography } from '@mui/material';

export default function ClientsPage() {
  const { data: clients = [], isLoading } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return;

    try {
      await deleteClient.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete client:', error);
      alert('Failed to delete. Please try again.');
    }
  };

  const handleSave = async (client: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingClient) {
      await updateClient.mutateAsync({ id: editingClient.id, updates: client });
    } else {
      await createClient.mutateAsync(client);
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingClient(null);
  };

  if (isLoading) {
    return (
      <AdminPageShell title="Clients">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell title="Clients">
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setEditingClient(null);
            setDialogOpen(true);
          }}
          sx={{ bgcolor: '#02b5e7', '&:hover': { bgcolor: '#02a0d0' } }}
        >
          New Client
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, width: 60 }}></TableCell>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Name</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>URL</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No clients yet. Click "New Client" to add one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Avatar
                      src={getFaviconUrl(client.url || '')}
                      sx={{ width: 32, height: 32 }}
                      alt={client.name}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8125rem' }}>{client.name}</TableCell>
                  <TableCell sx={{ fontSize: '0.8125rem' }}>
                    {client.url ? (
                      <a href={client.url} target="_blank" rel="noopener noreferrer" style={{ color: '#02b5e7' }}>
                        {client.url}
                      </a>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleEdit(client)}>
                      <Edit sx={{ fontSize: '1rem' }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(client.id)}>
                      <Delete sx={{ fontSize: '1rem' }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <EditClientDialog
        open={dialogOpen}
        onClose={handleClose}
        onSave={handleSave}
        client={editingClient}
      />
    </AdminPageShell>
  );
}
