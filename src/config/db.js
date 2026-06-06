import dns from 'dns';
import mongoose from 'mongoose';

// Force public DNS servers
dns.setServers(['1.1.1.1', '8.8.8.8']);
dns.setDefaultResultOrder('ipv4first');

const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB...');

    await mongoose.connect(process.env.MONGO_URI);

    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB Error:');
    console.error(error);
    process.exit(1);
  }
};

export default connectDB;