'use client';

import { Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Menu, MenuItem, TextField, InputAdornment, Chip, Select, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, FormControlLabel } from '@mui/material';
import { Add as AddIcon, MoreVert as MoreVertIcon, Search as SearchIcon, FilterList as FilterIcon, FolderOpen as FolderOpenIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAudiences, useCreateAudience, useDeleteAudience } from '@/features/audience-builder/hooks/useAudiences';
import { AppLayout } from '@/components/layout/AppLayout';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

interface AudienceRowData {
  id: string;
  name: string;
  client: string;
  segmentName: string;
  constructionMode: 'validation' | 'extension' | null;
  households: number | null;
  districts: number | null;
}

// Fetch audience details in batch
async function fetchAudienceDetails(audienceIds: string[]) {
  if (audienceIds.length === 0) return new Map();
  
  const supabase = createClient();
  const detailsMap = new Map<string, Partial<AudienceRowData>>();

  // Fetch audiences with client_id
  const { data: audiences } = await supabase
    .from('audiences')
    .select('id, client_id')
    .in('id', audienceIds);

  // Fetch all clients for lookup
  const { data: clients } = await supabase
    .from('admin_clients')
    .select('id, name');

  // Create client lookup map
  const clientMap = new Map<string, string>();
  clients?.forEach(client => {
    clientMap.set(client.id, client.name);
  });

  // Fetch construction settings
  const { data: settings } = await supabase
    .from('audience_construction_settings')
    .select('audience_id, construction_mode')
    .in('audience_id', audienceIds);

  // Fetch segments
  const { data: segments } = await supabase
    .from('audience_segments')
    .select('audience_id, segment_label, is_selected, origin, construction_mode')
    .in('audience_id', audienceIds)
    .eq('segment_type', 'primary');

  // Build details map
  audienceIds.forEach((id) => {
    const audience = audiences?.find(a => a.id === id);
    const setting = settings?.find(s => s.audience_id === id);
    const audienceSegments = segments?.filter(s => s.audience_id === id) || [];
    const anchorSegment = audienceSegments.find(s => s.origin === 'brief' || s.is_selected) || audienceSegments[0];
    
    // Get client name from lookup
    const clientName = audience?.client_id 
      ? (clientMap.get(audience.client_id) || '—')
      : '—';

    detailsMap.set(id, {
      constructionMode: setting?.construction_mode || null,
      segmentName: anchorSegment?.segment_label || '—',
      client: clientName,
      households: null, // Will be populated from validation/extension results if available
      districts: null,
    });
  });

  return detailsMap;
}

export function AudiencesList() {
  const router = useRouter();
  const { data: audiences = [], isLoading } = useAudiences();
  const createMutation = useCreateAudience();
  const deleteMutation = useDeleteAudience();
  const [creating, setCreating] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedAudienceId, setSelectedAudienceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newAudienceName, setNewAudienceName] = useState('');
  const [newAudienceClient, setNewAudienceClient] = useState<string>('');

  // Fetch clients for filter
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('admin_clients')
        .select('*')
        .order('name');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch audience details
  const audienceIds = useMemo(() => audiences.map(a => a.id), [audiences]);
  const { data: detailsMap = new Map() } = useQuery({
    queryKey: ['audienceDetails', audienceIds],
    queryFn: () => fetchAudienceDetails(audienceIds),
    enabled: audienceIds.length > 0,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Build table data
  const tableData = useMemo(() => {
    let data: AudienceRowData[] = audiences.map((audience) => {
      const details = detailsMap.get(audience.id) || {};
      return {
        id: audience.id,
        name: audience.name,
        client: details.client || 'Default Client',
        segmentName: details.segmentName || '—',
        constructionMode: details.constructionMode || null,
        households: details.households || null,
        districts: details.districts || null,
      };
    });

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(
        (row) =>
          row.name.toLowerCase().includes(query) ||
          row.segmentName.toLowerCase().includes(query) ||
          row.client.toLowerCase().includes(query)
      );
    }

    // Client filter
    if (clientFilter !== 'all') {
      data = data.filter((row) => row.client === clientFilter);
    }

    // Mode filter
    if (modeFilter !== 'all') {
      data = data.filter((row) => row.constructionMode === modeFilter);
    }

    return data;
  }, [audiences, detailsMap, searchQuery, clientFilter, modeFilter]);

  const handleCreateClick = () => {
    setNewAudienceName('');
    setNewAudienceClient('');
    setCreateDialogOpen(true);
  };

  const handleCreateConfirm = async () => {
    if (!newAudienceName.trim()) {
      alert('Please enter an audience name');
      return;
    }

    // Find the client ID from the selected client name
    const selectedClient = clients.find(c => c.name === newAudienceClient);
    const clientId = selectedClient?.id || null;

    setCreating(true);
    try {
      const audience = await createMutation.mutateAsync({
        name: newAudienceName.trim(),
        client_id: clientId,
        description: '',
      });
      setCreateDialogOpen(false);
      setNewAudienceName('');
      setNewAudienceClient('');
      router.push(`/audiences/${audience.id}/builder?step=1`);
    } catch (error) {
      console.error('Failed to create audience:', error);
      alert('Failed to create audience. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateCancel = () => {
    setCreateDialogOpen(false);
    setNewAudienceName('');
    setNewAudienceClient('');
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, audienceId: string) => {
    setMenuAnchor(event.currentTarget);
    setSelectedAudienceId(audienceId);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedAudienceId(null);
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
    setMenuAnchor(null); // Close menu but keep selectedAudienceId
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAudienceId) return;
    
    try {
      await deleteMutation.mutateAsync(selectedAudienceId);
      setDeleteDialogOpen(false);
      setSelectedAudienceId(null);
    } catch (error) {
      console.error('Failed to delete audience:', error);
      alert('Failed to delete audience');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSelectedAudienceId(null);
  };

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.125rem' }}>
            Audiences
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateClick}
            disabled={creating}
            size="small"
            sx={{ bgcolor: '#02b5e7', '&:hover': { bgcolor: '#02a0d0' } }}
          >
            Create New Audience
          </Button>
        </Box>

        {isLoading ? (
          <Typography variant="body2">Loading...</Typography>
        ) : (
          <Card sx={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', mt: 6 }}>
            {/* Search and Filters - directly above table */}
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #e0e0e0', bgcolor: '#fafafa' }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <TextField
                  placeholder="Search..."
                  size="small"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ 
                    flex: 1, 
                    minWidth: 180,
                    '& .MuiInputBase-root': {
                      height: 32,
                    },
                    '& .MuiInputBase-input': {
                      py: 0.75,
                      fontSize: '0.8125rem',
                    },
                  }}
                />
                <IconButton
                  size="small"
                  onClick={() => setFilterDialogOpen(true)}
                  sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    width: 32,
                    height: 32,
                    bgcolor: (clientFilter !== 'all' || modeFilter !== 'all') ? '#e3f2fd' : 'transparent',
                    '&:hover': {
                      bgcolor: '#f5f5f5',
                    },
                  }}
                >
                  <FilterIcon sx={{ fontSize: '1rem', color: (clientFilter !== 'all' || modeFilter !== 'all') ? '#1976d2' : 'text.secondary' }} />
                </IconButton>
              </Box>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 1.5 }}>Client</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 1.5 }}>Segment Name</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 1.5 }}>Construction Mode</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 1.5 }} align="right">Households</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 1.5 }} align="right">Districts</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 1.5, width: 48 }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 8, px: 3, border: 0 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <Box
                            sx={{
                              width: 64,
                              height: 64,
                              borderRadius: '50%',
                              bgcolor: '#f5f5f5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <FolderOpenIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                          </Box>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body1" sx={{ fontWeight: 500, mb: 0.5, color: 'text.primary' }}>
                              {searchQuery || clientFilter !== 'all' || modeFilter !== 'all'
                                ? 'No audiences match your filters'
                                : 'No audiences yet'}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                              {searchQuery || clientFilter !== 'all' || modeFilter !== 'all'
                                ? 'Try adjusting your search or filter criteria'
                                : 'Create your first audience to get started'}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tableData.map((row) => (
                    <TableRow
                      key={row.id}
                      hover
                      onClick={() => router.push(`/audiences/${row.id}/builder?step=1`)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#fafafa' } }}
                    >
                      <TableCell sx={{ fontSize: '0.8125rem', py: 1 }}>
                        {row.client}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8125rem', py: 1 }}>
                        <Typography sx={{ fontWeight: 500, color: '#02b5e7' }}>
                          {row.segmentName}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8125rem', py: 1 }}>
                        {row.constructionMode ? (
                          <Chip
                            label={row.constructionMode === 'validation' ? 'Validation' : 'Extension'}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              bgcolor: row.constructionMode === 'validation' ? '#e3f2fd' : '#f3e5f5',
                              color: row.constructionMode === 'validation' ? '#1976d2' : '#7b1fa2',
                            }}
                          />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8125rem', py: 1 }} align="right">
                        {row.households ? row.households.toLocaleString() : '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8125rem', py: 1 }} align="right">
                        {row.districts ? row.districts.toLocaleString() : '—'}
                      </TableCell>
                      <TableCell
                        sx={{ fontSize: '0.8125rem', py: 1 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, row.id)}
                          sx={{ padding: '4px' }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={handleMenuClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main', fontSize: '0.875rem' }}>
                Delete
              </MenuItem>
            </Menu>
          </Card>
        )}

        {/* Filter Dialog */}
        <Dialog
          open={filterDialogOpen}
          onClose={() => setFilterDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontSize: '1.25rem', fontWeight: 600, pb: 1 }}>
            Filter Audiences
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}>
                  Client
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    sx={{ fontSize: '0.8125rem' }}
                  >
                    <MenuItem value="all" sx={{ fontSize: '0.8125rem' }}>All Clients</MenuItem>
                    {clients.map((client) => (
                      <MenuItem key={client.id} value={client.name} sx={{ fontSize: '0.8125rem' }}>
                        {client.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}>
                  Construction Mode
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={modeFilter}
                    onChange={(e) => setModeFilter(e.target.value)}
                    sx={{ fontSize: '0.8125rem' }}
                  >
                    <MenuItem value="all" sx={{ fontSize: '0.8125rem' }}>All Modes</MenuItem>
                    <MenuItem value="validation" sx={{ fontSize: '0.8125rem' }}>Validation</MenuItem>
                    <MenuItem value="extension" sx={{ fontSize: '0.8125rem' }}>Extension</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setClientFilter('all');
              setModeFilter('all');
            }}>
              Clear
            </Button>
            <Button
              variant="contained"
              onClick={() => setFilterDialogOpen(false)}
              sx={{ bgcolor: '#02b5e7', '&:hover': { bgcolor: '#02a0d0' } }}
            >
              Apply
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create Audience Dialog */}
        <Dialog
          open={createDialogOpen}
          onClose={handleCreateCancel}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontSize: '1.25rem', fontWeight: 600, pb: 1, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
            Create New Audience
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
              <Box>
                <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 500, color: 'text.secondary', display: 'block', mb: 0.75 }}>
                  Client
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={newAudienceClient}
                    onChange={(e) => setNewAudienceClient(e.target.value)}
                    displayEmpty
                    sx={{
                      fontSize: '0.8125rem',
                      bgcolor: '#f5f5f5',
                      '& .MuiSelect-select': {
                        py: 1,
                      },
                    }}
                  >
                    <MenuItem value="" sx={{ fontSize: '0.8125rem' }}>
                      <em>Select a client</em>
                    </MenuItem>
                    {clients.map((client) => (
                      <MenuItem key={client.id} value={client.name} sx={{ fontSize: '0.8125rem' }}>
                        {client.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 500, color: 'text.secondary', display: 'block', mb: 0.75 }}>
                  Audience Name
                </Typography>
                <TextField
                  value={newAudienceName}
                  onChange={(e) => setNewAudienceName(e.target.value)}
                  required
                  fullWidth
                  size="small"
                  placeholder="Enter audience name"
                  sx={{
                    fontSize: '0.8125rem',
                    '& .MuiInputBase-root': {
                      bgcolor: '#f5f5f5',
                    },
                    '& .MuiInputBase-input': {
                      fontSize: '0.8125rem',
                      py: 1,
                    },
                  }}
                />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleCreateCancel} sx={{ fontSize: '0.8125rem' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateConfirm}
              disabled={creating || !newAudienceName.trim() || !newAudienceClient}
              sx={{
                bgcolor: '#02b5e7',
                '&:hover': { bgcolor: '#02a0d0' },
                fontSize: '0.8125rem',
              }}
            >
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={handleDeleteCancel}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontSize: '1.25rem', fontWeight: 600, pb: 1 }}>
            Delete Audience
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
              Are you sure you want to delete this audience? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleDeleteCancel} sx={{ fontSize: '0.8125rem' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleDeleteConfirm}
              sx={{
                bgcolor: '#d32f2f',
                '&:hover': { bgcolor: '#c62828' },
                fontSize: '0.8125rem',
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AppLayout>
  );
}
