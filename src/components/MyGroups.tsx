import React from 'react';
import { Box, Typography, Card, CardContent, List, ListItem, ListItemText, Divider } from '@mui/material';

// TODO: Replace with real data from backend in the future
const mockGroups: { name: string; description: string; role: string }[] = [
  // Example:
  // { name: 'Poker Pros', description: 'Weekly high-stakes games', role: 'Owner' },
  // { name: 'Friends Table', description: 'Casual Friday night games', role: 'Table Manager' },
];

const MyGroups: React.FC = () => {
  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 6, p: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3, textAlign: 'center' }}>
        My Groups
      </Typography>
      {mockGroups.length === 0 ? (
        <Card sx={{ p: 3, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="body1" color="text.secondary">
            You are not a member of any groups yet.
          </Typography>
        </Card>
      ) : (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <List>
              {mockGroups.map((group, idx) => (
                <React.Fragment key={group.name}>
                  <ListItem alignItems="flex-start">
                    <ListItemText
                      primary={
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {group.name}
                        </Typography>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" color="text.secondary">
                            {group.description}
                          </Typography>
                          <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                            Role: {group.role}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                  {idx < mockGroups.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default MyGroups; 