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
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: { xs: '0.9rem', sm: '1rem' },
      letterSpacing: 1,
      fontWeight: 400,
      boxShadow: '0 -2px 8px rgba(25, 118, 210, 0.1)'
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {/* לוגו החברה */}
      <Box
        component="img"
        src="/logo-dts.png"
        alt="DTS Logo"
        sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: 'white', p: 0.5 }}
      />
      <Typography variant="body2" sx={{ fontWeight: 700, letterSpacing: 2 }}>
        DTS
      </Typography>
      <Typography variant="body2" sx={{ mx: 1 }}>
        © {new Date().getFullYear()} | All rights reserved
      </Typography>
      <IconButton
        href="mailto:dorontzurs@gmail.com"
        sx={{ color: 'white', ml: 1 }}
        size="small"
      >
        <EmailIcon fontSize="small" />
      </IconButton>
      <Link
        href="mailto:dorontzurs@gmail.com"
        underline="hover"
        sx={{ color: 'white', fontWeight: 500, ml: 0.5 }}
      >
        dorontzurs@gmail.com
      </Link>
    </Box>
  </Box>
);

export default Footer; 