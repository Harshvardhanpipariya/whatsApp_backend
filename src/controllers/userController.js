import User from '../models/user.js';

// Existing controller - Get all users (basic version)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('_id name photo');
    
    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: 'Server Error',
    });
  }
};

// NEW: Get all users with block filtering (advanced version)
export const getAllUsersWithBlockFilter = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    
    // Get the current user to find out who they have blocked
    const currentUser = await User.findById(currentUserId).select('blockedUsers');
    const usersIBlocked = currentUser?.blockedUsers || [];
    
    // Find users who have blocked the current user
    const usersWhoBlockedMe = await User.find({
      blockedUsers: currentUserId
    }).select('_id');
    
    const usersWhoBlockedMeIds = usersWhoBlockedMe.map(user => user._id);
    
    // Combine all user IDs to exclude
    const excludeUserIds = [
      currentUserId,
      ...usersIBlocked,
      ...usersWhoBlockedMeIds
    ];
    
    // Get all users except blocked ones
    const users = await User.find({ 
      _id: { $nin: excludeUserIds }
    }).select('name photo lastSeen isOnline email');
    
    console.log(`📊 Found ${users.length} users after filtering blocks`);
    
    res.json({ 
      success: true, 
      users 
    });
  } catch (error) {
    console.error('Error fetching users with block filter:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching users' 
    });
  }
};

// NEW: Get single user details with block status
export const getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('name photo lastSeen isOnline email blockedUsers blockedBy');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Check block status
    const isBlockedByUser = user.blockedUsers?.includes(req.user._id) || false;
    const hasBlockedUser = req.user.blockedUsers?.includes(user._id) || false;
    
    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        photo: user.photo,
        lastSeen: user.lastSeen,
        isOnline: user.isOnline,
        email: user.email,
        isBlocked: hasBlockedUser,
        isBlockedByUser: isBlockedByUser
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching user details' 
    });
  }
};

// NEW: Block a user
export const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;
    
    console.log('🔨 Block request received for user:', userId);
    console.log('Current user:', currentUserId);
    
    if (userId === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot block yourself'
      });
    }
    
    // Check if user exists
    const userToBlock = await User.findById(userId);
    if (!userToBlock) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Add to current user's blocked list
    await User.findByIdAndUpdate(
      currentUserId,
      { $addToSet: { blockedUsers: userId } }
    );
    
    // Add to userToBlock's blockedBy list
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { blockedBy: currentUserId } }
    );
    
    console.log('✅ User blocked successfully');
    
    res.json({
      success: true,
      message: 'User blocked successfully',
      blockedUser: {
        _id: userId,
        name: userToBlock.name
      }
    });
  } catch (error) {
    console.error('❌ Error blocking user:', error);
    res.status(500).json({
      success: false,
      message: 'Error blocking user',
      error: error.message
    });
  }
};

// NEW: Unblock a user
export const unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;
    
    console.log('🔓 Unblock request received for user:', userId);
    
    // Remove from current user's blocked list
    await User.findByIdAndUpdate(
      currentUserId,
      { $pull: { blockedUsers: userId } }
    );
    
    // Remove from user's blockedBy list
    await User.findByIdAndUpdate(
      userId,
      { $pull: { blockedBy: currentUserId } }
    );
    
    console.log('✅ User unblocked successfully');
    
    res.json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    console.error('❌ Error unblocking user:', error);
    res.status(500).json({
      success: false,
      message: 'Error unblocking user',
      error: error.message
    });
  }
};

// NEW: Get blocked users list (users that current user has blocked)
export const getBlockedUsers = async (req, res) => {
  try {
    console.log('📋 Fetching blocked users for:', req.user._id);
    
    const currentUser = await User.findById(req.user._id)
      .populate('blockedUsers', 'name photo email lastSeen isOnline');
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    console.log(`📋 Found ${currentUser.blockedUsers?.length || 0} blocked users`);
    
    res.json({
      success: true,
      blockedUsers: currentUser.blockedUsers || []
    });
  } catch (error) {
    console.error('❌ Error fetching blocked users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching blocked users',
      error: error.message
    });
  }
};

// NEW: Get users who have blocked the current user
export const getUsersWhoBlockedMe = async (req, res) => {
  try {
    console.log('📋 Fetching users who blocked me for:', req.user._id);
    
    const users = await User.find({
      blockedUsers: req.user._id
    }).select('name photo email lastSeen isOnline');
    
    console.log(`📋 Found ${users.length} users who blocked me`);
    
    res.json({
      success: true,
      users: users || []
    });
  } catch (error) {
    console.error('❌ Error fetching users who blocked me:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};