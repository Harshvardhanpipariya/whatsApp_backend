import dotenv from 'dotenv';

dotenv.config({
  path: './.env',
});

import { server } from './app.js';
import connectDB from './config/db.js';

console.log(process.env.CLOUDINARY_API_KEY);

const PORT = process.env.PORT || 5000;

// database
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Socket.IO is ready for connections`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  });