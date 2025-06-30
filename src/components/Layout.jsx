import { AppBar, Toolbar, Typography, Box, Container, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { Dashboard as DashboardIcon, Settings as SettingsIcon, Folder as FolderIcon, CloudQueue as DeployIcon } from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';

const drawerWidth = 300;

const menuItems = [
  { text: 'Benchmark Results', icon: <DashboardIcon />, path: '/' },
  { text: 'Project Manager', icon: <FolderIcon />, path: '/projects' },
  { text: 'Benchmark Deployer', icon: <DeployIcon />, path: '/deployer' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

function Layout({ children }) {
  const location = useLocation();

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{ 
          width: '100%', 
          ml: `${drawerWidth}px`,
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            VLLM Benchmark Manager
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar />
        <Divider />
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                component={Link}
                to={item.path}
                selected={location.pathname === item.path}
              >
                <ListItemIcon>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{ 
          flexGrow: 1, 
          bgcolor: 'background.default', 
          p: 3,
          minHeight: '100vh'
        }}
      >
        <Toolbar />
        <Container maxWidth="xl">
          {children}
        </Container>
      </Box>
    </Box>
  );
}

export default Layout; 