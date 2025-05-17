import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, Button } from '@mui/material';
import { keyframes } from '@mui/system';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

// Card sliding animation
const slideCard = keyframes`
  0% { 
    transform: translate(0, 0) rotate(0deg);
    opacity: 0;
  }
  30% { 
    transform: translate(calc(var(--slide-x) * 0.6), calc(var(--slide-y) * 0.6)) rotate(calc(var(--rotate) * 0.6));
    opacity: 1;
  }
  100% { 
    transform: translate(var(--slide-x), var(--slide-y)) rotate(var(--rotate));
    opacity: 1;
  }
`;

// Text fade animation
const fadeInOut = keyframes`
  0%, 100% { opacity: 0; transform: translateY(20px); }
  15%, 85% { opacity: 1; transform: translateY(0); }
`;

// Add flip and glow keyframes
const flipIn = keyframes`
  0% { transform: rotateY(90deg) scale(0.8); opacity: 0; }
  60% { transform: rotateY(-10deg) scale(1.05); opacity: 1; }
  80% { transform: rotateY(5deg) scale(0.98); }
  100% { transform: rotateY(0deg) scale(1); opacity: 1; }
`;

const riverGlow = keyframes`
  0% { box-shadow: 0 0 0 0 #FFD70044; }
  60% { box-shadow: 0 0 24px 8px #FFD700cc; }
  100% { box-shadow: 0 0 12px 4px #FFD70088; }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
`;

const pokerQuotes = [
  "If you can't spot the sucker in your first half hour at the table, then you are the sucker. - Rounders",
  "Life is not always a matter of holding good cards, but sometimes, playing a poor hand well. - Jack London",
  "Trust everyone, but always cut the cards. - Benny Binion",
  "The beautiful thing about poker is that everybody thinks they can play. - Chris Moneymaker",
  "Fold and live to fold again. - Stu Ungar",
  "Poker is war. People pretend it is a game. - Doyle Brunson",
  "The commonest mistake in history is underestimating your opponent; it happens at the poker table all the time. - David Shoup",
  "Poker may be a branch of psychological warfare, an art form or indeed a way of life, but it is also merely a game, in which money is simply the means of keeping score. - Anthony Holden",
  "A man with money is no match against a man on a mission. - Doyle Brunson",
  "The smarter you play, the luckier you'll be. - Mark Pilarski",
  "In the long run there's no luck in poker, but the short run is longer than most people know. - Rick Bennet",
  "Poker is a hard way to make an easy living. - Doyle Brunson",
  "You will show your poker greatness by the hands you fold, not the hands you play. - Dan Reed",
  "Luck is what happens when preparation meets opportunity. - Seneca",
  "The cardinal sin in poker, worse than playing dead cards, worse even than not figuring your odds correctly, is becoming emotionally involved. - Anonymous"
];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [currentQuote, setCurrentQuote] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    const quoteInterval = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % pokerQuotes.length);
    }, 6500);

    // Reset animation every 14 seconds (to allow last card to show)
    const animationInterval = setInterval(() => {
      setAnimationKey(prev => prev + 1);
    }, 14000);

    return () => {
      clearInterval(quoteInterval);
      clearInterval(animationInterval);
    };
  }, []);

  return (
    <Container 
      maxWidth="lg"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        pt: { xs: 8, sm: 12 }, // Add top padding to prevent overlap with header
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          bgcolor: '#1a1a2e',
          borderRadius: 4,
          p: { xs: 2, sm: 4 },
          flex: 1,
        }}
      >
        <Typography
          variant="h2"
          component="h1"
          sx={{
            color: '#fff',
            textAlign: 'center',
            mb: { xs: 3, sm: 6 },
            fontWeight: 'bold',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
            fontSize: { xs: '1.8rem', sm: '2.5rem', md: '3.5rem' }
          }}
        >
          Welcome to Poker Management
        </Typography>

        {/* Poker Table Animation Container */}
        <Box
          key={animationKey}
          sx={{
            position: 'relative',
            width: '100%',
            height: { xs: '250px', sm: '350px', md: '400px' },
            perspective: '1000px',
            mb: 4,
            bgcolor: '#0d4d1d',
            borderRadius: { xs: '100px', sm: '200px' },
            border: { xs: '10px solid #593a23', sm: '20px solid #593a23' },
            boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5), 0 0 30px rgba(0,0,0,0.3)',
            mx: 'auto',
            maxWidth: { xs: '300px', sm: '600px', md: '800px' }
          }}
        >
          {/* Deck */}
          <Box
            sx={{
              position: 'absolute',
              width: { xs: '50px', sm: '70px' },
              height: { xs: '70px', sm: '100px' },
              bottom: '15%',
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: '#2980b9',
              borderRadius: '8px',
              boxShadow: '0 0 10px rgba(0,0,0,0.5)',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: '5px',
                left: '5px',
                right: '5px',
                bottom: '5px',
                background: 'repeating-linear-gradient(45deg, #2980b9, #2980b9 10px, #2471a3 10px, #2471a3 20px)',
                borderRadius: '4px',
                opacity: 0.5
              }
            }}
          />

          {/* Burn Cards */}
          {[...Array(3)].map((_, index) => (
            <Box
              key={`burn-${index}`}
              sx={{
                position: 'absolute',
                width: { xs: '50px', sm: '70px' },
                height: { xs: '70px', sm: '100px' },
                bottom: '15%',
                left: '50%',
                bgcolor: '#2980b9',
                borderRadius: '8px',
                animation: `${slideCard} 0.8s ${3 + index * 4}s cubic-bezier(0.4, 0, 0.2, 1) forwards`,
                opacity: 0,
                '--slide-x': { xs: '-100px', sm: '-150px' },
                '--slide-y': '0px',
                '--rotate': '90deg',
                zIndex: 1,
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'repeating-linear-gradient(45deg, #2980b9, #2980b9 10px, #2471a3 10px, #2471a3 20px)',
                  borderRadius: '8px',
                  opacity: 0.5
                }
              }}
            />
          ))}

          {/* Community Cards */}
          {[
            { rank: 'K', suit: '♥', color: '#e74c3c', delay: 4, x: -100, rotate: -8 },
            { rank: 'Q', suit: '♠', color: '#2c3e50', delay: 4.2, x: -50, rotate: -4 },
            { rank: 'J', suit: '♦', color: '#e74c3c', delay: 4.4, x: 0, rotate: 0 },
            { rank: 'A', suit: '♣', color: '#2c3e50', delay: 8, x: 50, rotate: 4 },
            { rank: '10', suit: '♥', color: '#e74c3c', delay: 12.5, x: 100, rotate: 8 }
          ].map((card, index, arr) => {
            const isFan = animationKey > 0;
            const isRiver = index === arr.length - 1;
            return (
              <Box
                key={`community-${index}`}
                sx={{
                  position: 'absolute',
                  width: { xs: '50px', sm: '70px' },
                  height: { xs: '70px', sm: '100px' },
                  bottom: '30%',
                  left: { xs: `calc(50% + ${card.x * 0.7}px)`, sm: `calc(50% + ${card.x}px)` },
                  bgcolor: '#fff',
                  borderRadius: '8px',
                  boxShadow: isRiver
                    ? '0 0 12px 4px #FFD70088, 0 2px 8px rgba(0,0,0,0.3)'
                    : '0 2px 8px rgba(0,0,0,0.3)',
                  animation: `${flipIn} 0.8s ${card.delay}s cubic-bezier(0.4, 0, 0.2, 1) forwards` +
                    (isRiver ? `, ${riverGlow} 1.2s ${card.delay + 0.6}s cubic-bezier(0.4,0,0.2,1) forwards, ${pulse} 1.2s ${card.delay + 0.6}s` : ''),
                  opacity: 0,
                  transform: 'translateX(-50%)' + (isFan ? ` translateY(-120px) rotate(${card.rotate}deg)` : ''),
                  zIndex: index + 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: card.color,
                  fontSize: { xs: '1.5rem', sm: '2rem' },
                  transition: isFan ? 'transform 0.7s cubic-bezier(0.4,0,0.2,1)' : undefined,
                  '&::before': {
                    content: `"${card.suit}"`,
                    position: 'absolute',
                    top: { xs: '4px', sm: '8px' },
                    left: { xs: '4px', sm: '8px' },
                    fontSize: { xs: '0.8rem', sm: '1.2rem' }
                  },
                  '&::after': {
                    content: `"${card.rank}"`,
                    position: 'absolute',
                    fontSize: { xs: '1.8rem', sm: '2.5rem' },
                    fontWeight: 'bold'
                  }
                }}
              />
            );
          })}
        </Box>

        {/* Rotating Quotes */}
        <Box
          sx={{
            height: { xs: '100px', sm: '80px' },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: { xs: 2, sm: 4 },
            px: 2
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: '#fff',
              textAlign: 'center',
              fontStyle: 'italic',
              animation: `${fadeInOut} 6.5s infinite`,
              opacity: 0,
              maxWidth: '800px',
              fontSize: { xs: '0.9rem', sm: '1.1rem', md: '1.25rem' }
            }}
          >
            {pokerQuotes[currentQuote]}
          </Typography>
        </Box>

        {/* Navigation/Login Button */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'center',
            alignItems: 'center',
            gap: 2,
            mt: { xs: 2, sm: 4 },
          }}
        >
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/statistics')}
            sx={{
              bgcolor: '#43a047',
              color: '#fff',
              fontSize: { xs: '1rem', sm: '1.2rem', md: '1.5rem' },
              padding: { xs: '8px 16px', sm: '12px 24px', md: '16px 32px' },
              '&:hover': {
                bgcolor: '#388e3c'
              },
              boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
              borderRadius: 2,
              width: { xs: '80%', sm: 'auto' }
            }}
          >
            VIEW STATISTICS
          </Button>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate(user ? '/tables' : '/tableslist')}
          sx={{
            bgcolor: '#3498db',
            color: '#fff',
            fontSize: { xs: '1rem', sm: '1.2rem', md: '1.5rem' },
            padding: { xs: '8px 16px', sm: '12px 24px', md: '16px 32px' },
            '&:hover': {
              bgcolor: '#2980b9'
            },
            boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
            borderRadius: 2,
            width: { xs: '80%', sm: 'auto' }
          }}
        >
          {user ? 'GO TO TABLES LIST' : 'LOGIN'}
        </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default LandingPage; 