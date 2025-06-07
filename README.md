# Poker Management App

A comprehensive mobile-friendly poker management app for physical poker games. This app provides tools to create poker tables, manage players, track buy-ins and cash-outs, and view statistics during in-person poker games.

## Features

- Create and manage multiple poker tables
- Track players, buy-ins, and cash-outs
- Real-time chip count management
- Player statistics and history
- Table balance tracking
- Mobile-friendly interface
- Dark mode design
- Secure authentication system
- Admin and editor roles
- Automatic database backups

## Getting Started

### Prerequisites

- Node.js (v18.x)
- npm or yarn
- SQLite3

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Create the data directory:
```bash
mkdir -p data
```
4. Start the development server:
```bash
# Start the React development server
npm start

# In a separate terminal, start the backend server
npm run server
```

## Production Deployment

The app is configured for deployment on Render.com. The deployment configuration is specified in `render.yaml`.

### Environment Variables

- `NODE_ENV`: Set to 'production' for production environment
- `PORT`: The port number for the server (default: 10000)

### Database

The app uses SQLite3 for data storage. In production, the database file is stored in a persistent disk volume mounted at `/opt/render/project/src/data`.

#### Database Backups
- Automatic daily backups are performed at midnight
- Backups are stored in the `data/backup` directory
- Each backup file is named with a timestamp (e.g., `poker_2024-04-29T12-00-00-000Z.db`)
- The backup system ensures data persistence and recovery options
- Only the last 5 backups are kept to manage storage space

### Security
- CORS is configured to only allow requests from the production domain
- Password hashing is implemented for user authentication
- Role-based access control (admin and editor roles)
- Rate limiting to prevent abuse
- Comprehensive error handling and logging

## Usage

1. Create a new poker table by clicking the "Create New Table" button
2. Enter table details including name, small blind, big blind, and location
3. Add players to the table with their starting chip counts
4. Track buy-ins and manage chip counts during the game
5. Cash out players when they leave
6. View statistics and history in the Statistics section

## Technologies Used

- React 18
- TypeScript
- Material UI v5
- React Router v6
- Express.js
- SQLite3
- JSON Web Tokens for authentication

## Mobile Setup

The app is designed to be mobile-friendly and can be added to your home screen on mobile devices for a better experience. It features a responsive design that works well on both desktop and mobile devices.

## License

This project is licensed under the MIT License.
