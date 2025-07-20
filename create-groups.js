const axios = require('axios');
require('dotenv').config();

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // You'll need to set this in .env

const groups = [
  {
    name: '365Scores',
    description: '365Scores Poker Group'
  },
  {
    name: 'Doron & Friends',
    description: 'Doron & Friends Poker Group'
  }
];

async function createGroups() {
  if (!ADMIN_TOKEN) {
    console.error('Error: ADMIN_TOKEN is not set in .env file');
    process.exit(1);
  }

  

  for (const group of groups) {
    try {
      
      const response = await axios.post(
        `${API_URL}/api/groups`,
        group,
        {
          headers: {
            'Authorization': `Bearer ${ADMIN_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
    } catch (error) {
      console.error(`Error creating group ${group.name}:`, error.response?.data || error.message);
    }
  }
}

createGroups().catch(console.error); 