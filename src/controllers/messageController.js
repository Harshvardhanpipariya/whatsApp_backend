import Message from "../models/message.js";

// Existing controller - Get messages between two users
export const getMessages = async (req, res) => {
  try {
    const myId = req.user.id;
    const otherUserId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { sender: myId, receiver: otherUserId },
        { sender: otherUserId, receiver: myId },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// NEW: Get chat history with limit
export const getChatHistory = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const otherUserId = req.params.userId;
    
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId }
      ]
    })
    .sort({ createdAt: 1 })
    .limit(50);
    
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// NEW: Get all conversations for current user
export const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get unique conversations
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: userId },
            { receiver: userId }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', userId] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { 
                  $and: [
                    { $eq: ['$receiver', userId] },
                    { $ne: ['$status', 'read'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    
    res.json({ success: true, conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// NEW: Clear entire conversation between two users
export const clearConversation = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { otherUserId } = req.body;
    
    console.log('🗑️ Clearing conversation:', { currentUserId, otherUserId });
    
    if (!otherUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'otherUserId is required' 
      });
    }
    
    // Delete all messages between the two users
    const result = await Message.deleteMany({
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId }
      ]
    });
    
    console.log(`✅ Deleted ${result.deletedCount} messages`);
    
    res.json({ 
      success: true, 
      deletedCount: result.deletedCount,
      message: `Cleared ${result.deletedCount} messages successfully`
    });
  } catch (error) {
    console.error('❌ Error clearing conversation:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// NEW: Delete a single message
export const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    
    // Only sender can delete
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    await Message.findByIdAndDelete(req.params.messageId);
    
    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// NEW: Mark messages as read
export const markMessagesAsRead = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { otherUserId } = req.body;
    
    if (!otherUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'otherUserId is required' 
      });
    }
    
    const result = await Message.updateMany(
      {
        sender: otherUserId,
        receiver: currentUserId,
        status: { $in: ['sent', 'delivered'] }
      },
      {
        status: 'read'
      }
    );
    
    res.json({ 
      success: true, 
      updatedCount: result.modifiedCount,
      message: `Marked ${result.modifiedCount} messages as read`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// NEW: Get unread message count
export const getUnreadCount = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    
    const unreadCount = await Message.countDocuments({
      receiver: currentUserId,
      status: { $in: ['sent', 'delivered'] }
    });
    
    res.json({ success: true, unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};