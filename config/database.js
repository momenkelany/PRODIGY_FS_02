const mongoose = require('mongoose');


const connectDB = async () => {
  try {
    // Use MongoDB URI if provided, otherwise use in-memory MongoDB for testing
    let mongoURI = process.env.MONGODB_URI;
    
      
        const conn = await mongoose.connect(mongoURI, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
    
        
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Create default admin user if it doesn't exist
    await createDefaultAdmin();
    
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

async function createDefaultAdmin() {
  try {
    const User = require('../models/User');
    
    // Check if admin user already exists
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (!adminExists) {
      const adminUser = new User({
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin'
      });
      
      await adminUser.save();
      console.log('Default admin user created: admin@example.com / admin123');
    }
    
    // Create a regular test user
    const userExists = await User.findOne({ role: 'user' });
    if (!userExists) {
      const testUser = new User({
        username: 'testuser',
        email: 'user@example.com',
        password: 'user123',
        role: 'user'
      });
      
      await testUser.save();
      console.log('Default test user created: user@example.com / user123');
    }
  } catch (error) {
    console.log('Could not create default users:', error.message);
  }
}

// Cleanup function for testing
const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  } catch (error) {
    console.error('Error disconnecting from database:', error);
  }
};

module.exports = { connectDB, disconnectDB };

