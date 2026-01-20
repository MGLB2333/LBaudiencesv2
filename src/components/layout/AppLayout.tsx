'use client';

import { Box, AppBar, Toolbar, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Avatar, Menu, MenuItem, Divider, Collapse } from '@mui/material';
import { People as PeopleIcon, CheckCircle, RadioButtonUnchecked, AdminPanelSettings, Image as ImageIcon, Hub, Business, ExpandMore, ExpandLess } from '@mui/icons-material';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { LogoImage } from './LogoImage';

const drawerWidth = 240;

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isBuilderActive = pathname?.includes('/builder');
  const currentStep = isBuilderActive ? parseInt(searchParams?.get('step') || '1', 10) : 0;
  const [userEmail, setUserEmail] = useState<string>('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const isAdminActive = pathname?.startsWith('/admin');
  const [adminExpanded, setAdminExpanded] = useState(isAdminActive);

  const steps = [
    'Brief',
    'Audience Selection',
    'Build & Explore',
    'Export',
  ];

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || '');
      }
    });
  }, []);

  useEffect(() => {
    setAdminExpanded(isAdminActive);
  }, [isAdminActive]);

  const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
    handleMenuClose();
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: '#000000',
          height: 64,
        }}
      >
        <Toolbar sx={{ minHeight: '64px !important', justifyContent: 'space-between' }}>
          <LogoImage />
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: '#9e9e9e',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
              onClick={handleAvatarClick}
            >
              {userEmail.charAt(0).toUpperCase() || 'U'}
            </Avatar>
            <Menu
              anchorEl={anchorEl}
              open={open}
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
              <MenuItem onClick={handleSignOut}>Sign Out</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            marginTop: '64px',
            height: 'calc(100vh - 64px)',
            backgroundColor: '#ffffff',
            borderRight: '1px solid #e0e0e0',
            boxShadow: 'none',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            <List sx={{ py: 1 }}>
          <ListItem disablePadding>
            <ListItemButton
              selected={isBuilderActive}
              onClick={() => router.push('/audiences')}
              sx={{
                backgroundColor: 'transparent',
                color: '#424242',
                '&.Mui-selected': {
                  backgroundColor: 'transparent',
                  color: '#424242',
                  '&:hover': {
                    backgroundColor: '#fafafa',
                  },
                },
                '&:hover': {
                  backgroundColor: '#fafafa',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <PeopleIcon 
                  sx={{ 
                    color: '#616161',
                    fontSize: '1.25rem',
                  }} 
                />
              </ListItemIcon>
              <ListItemText 
                primary="Audience Builder" 
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: 400,
                }}
              />
            </ListItemButton>
          </ListItem>
        </List>
        
        {/* Step Navigation */}
        {isBuilderActive && (
          <List sx={{ py: 0, borderTop: '1px solid #e0e0e0' }}>
            {steps.map((label, index) => {
              const stepNumber = index + 1;
              const isCompleted = stepNumber < currentStep;
              const isActive = stepNumber === currentStep;
              
              // Sub-sections for Brief (step 1)
              const briefSubSections = stepNumber === 1 ? ['Target audience', 'Name', 'Client'] : [];
              // Sub-sections for Audience Selection (step 2)
              const selectionSubSections = stepNumber === 2 ? ['Construction mode', 'Select segment'] : [];
              // Sub-sections for Build & Explore (step 3)
              const buildSubSections = stepNumber === 3 ? ['Visualisation'] : [];
              // Sub-sections for Export (step 4)
              const exportSubSections = stepNumber === 4 ? ['Export summary', 'Export method', 'History'] : [];
              const subSections = briefSubSections.length > 0 ? briefSubSections 
                : (selectionSubSections.length > 0 ? selectionSubSections 
                : (buildSubSections.length > 0 ? buildSubSections : exportSubSections));
              
              return (
                <Box key={label}>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => {
                        const audienceId = pathname?.split('/')[2];
                        if (audienceId) {
                          router.push(`/audiences/${audienceId}/builder?step=${stepNumber}`);
                        }
                      }}
                      sx={{
                        py: 0.5,
                        px: 1.5,
                        borderRadius: 0,
                        minHeight: 32,
                        '&:hover': {
                          bgcolor: 'rgba(0,0,0,0.04)',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 20, mr: 1 }}>
                        {isCompleted ? (
                          <CheckCircle sx={{ fontSize: '1rem', color: '#9e9e9e' }} />
                        ) : (
                          <RadioButtonUnchecked sx={{ fontSize: '1rem', color: '#9e9e9e' }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={label}
                        primaryTypographyProps={{
                          fontSize: '0.75rem',
                          fontWeight: isActive ? 700 : 400,
                          color: '#424242',
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                  
                  {/* Sub-sections with vertical line */}
                  {isActive && subSections.length > 0 && (
                    <Box sx={{ position: 'relative', pl: 4.5 }}>
                      {/* Vertical line */}
                      <Box
                        sx={{
                          position: 'absolute',
                          left: 20,
                          top: 0,
                          bottom: 0,
                          width: '1px',
                          bgcolor: '#e0e0e0',
                        }}
                      />
                      {subSections.map((subSection, subIndex) => {
                        const sectionId = subSection.toLowerCase().replace(/\s+/g, '-');
                        const anchorId = stepNumber === 3 
                          ? `export-${sectionId === 'summary' ? 'summary' : sectionId === 'downloads' ? 'actions' : sectionId === 'push-to-platform' ? 'actions' : 'history'}`
                          : undefined;
                        
                        return (
                          <ListItem key={subSection} disablePadding>
                            <ListItemButton
                              onClick={() => {
                                if (anchorId) {
                                  const element = document.getElementById(anchorId);
                                  if (element) {
                                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }
                                }
                              }}
                              sx={{
                                py: 0.5,
                                px: 1.5,
                                pl: 3.5,
                                borderRadius: 0,
                                minHeight: 28,
                                '&:hover': {
                                  bgcolor: 'rgba(0,0,0,0.04)',
                                },
                              }}
                            >
                              <ListItemText
                                primary={subSection}
                                primaryTypographyProps={{
                                  fontSize: '0.75rem',
                                  fontWeight: 400,
                                  color: '#424242',
                                }}
                              />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              );
            })}
          </List>
        )}
          </Box>

          {/* Admin Section - Bottom of sidebar */}
          <Box sx={{ borderTop: '1px solid #e0e0e0', flexShrink: 0 }}>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => setAdminExpanded(!adminExpanded)}
                sx={{
                  py: 0.5,
                  px: 1.5,
                  borderRadius: 0,
                  minHeight: 32,
                  bgcolor: isAdminActive ? 'rgba(2, 181, 231, 0.08)' : 'transparent',
                  '&:hover': {
                    bgcolor: 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <AdminPanelSettings
                    sx={{
                      color: isAdminActive ? '#02b5e7' : '#616161',
                      fontSize: '1.25rem',
                    }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary="Admin"
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isAdminActive ? 600 : 400,
                    color: isAdminActive ? '#02b5e7' : '#424242',
                  }}
                />
                {adminExpanded ? (
                  <ExpandLess sx={{ fontSize: '1rem', color: '#616161' }} />
                ) : (
                  <ExpandMore sx={{ fontSize: '1rem', color: '#616161' }} />
                )}
              </ListItemButton>
            </ListItem>

            <Collapse in={adminExpanded}>
              <List sx={{ py: 0 }}>
                {[
                  { label: 'Logo', icon: ImageIcon, path: '/admin/logo' },
                  { label: 'Data partners', icon: Hub, path: '/admin/data-partners' },
                  { label: 'Clients', icon: Business, path: '/admin/clients' },
                ].map((item) => {
                  const isActive = pathname === item.path;
                  const Icon = item.icon;
                  return (
                    <ListItem key={item.path} disablePadding>
                      <ListItemButton
                        onClick={() => router.push(item.path)}
                        sx={{
                          py: 0.5,
                          px: 1.5,
                          pl: 4.5,
                          borderRadius: 0,
                          minHeight: 28,
                          bgcolor: isActive ? 'rgba(2, 181, 231, 0.08)' : 'transparent',
                          '&:hover': {
                            bgcolor: 'rgba(0,0,0,0.04)',
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 20, mr: 1 }}>
                          <Icon
                            sx={{
                              fontSize: '0.875rem',
                              color: isActive ? '#02b5e7' : '#616161',
                            }}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            fontSize: '0.75rem',
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? '#02b5e7' : '#424242',
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </Collapse>
          </Box>
        </Box>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          marginTop: '64px',
          backgroundColor: '#f6f6f6',
          minHeight: 'calc(100vh - 64px)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 1400,
            p: 4,
            px: { xs: 4, sm: 6, md: 8 },
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
