import { Box, Typography, Link, IconButton } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';

const Footer = () => (
  <Box
    component="footer"
    sx={{
      width: '100%',
      py: 2,
      px: 2,
      mt: 'auto',
      background: 'linear-gradient(90deg, #232526 0%, #414345 100%)',
      color: 'white',
      display: 'flex',
      flexDirection: { xs: 'column', sm: 'row' },
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: { xs: '0.9rem', sm: '1rem' },
      letterSpacing: 1,
      fontWeight: 400,
      boxShadow: '0 -2px 8px rgba(25, 118, 210, 0.1)',
      gap: { xs: 1, sm: 2 },
      textAlign: { xs: 'center', sm: 'left' }
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 1, sm: 0 } }}>
      <Box
        component="img"
        src="/dtslogo.jpg"
        alt="DTS Logo"
        sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: 'white', p: 0.5 }}
      />
      <Typography variant="body2" sx={{ fontWeight: 700, letterSpacing: 2 }}>
        DTS
      </Typography>
      <Typography variant="body2" sx={{ mx: 1 }}>
        © {new Date().getFullYear()} | All rights reserved
      </Typography>
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: { xs: 'center', sm: 'flex-start' } }}>
      <IconButton
        href="mailto:dorontzurs@gmail.com"
        sx={{ color: 'white' }}
        size="small"
      >
        <EmailIcon fontSize="small" />
      </IconButton>
      <Link
        href="mailto:dorontzurs@gmail.com"
        underline="hover"
        sx={{ color: 'white', fontWeight: 500 }}
      >
        dorontzurs@gmail.com
      </Link>
    </Box>
  </Box>
);

export default Footer; 