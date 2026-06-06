// In src/socket/socket.js
import Message from '../models/message.js';
import User from '../models/user.js';

const socketHandler = (io) => {
    const onlineUsers = new Map();

    // Helper function to check if users are blocked
    const isBlocked = async (userId1, userId2) => {
        try {
            const [user1, user2] = await Promise.all([
                User.findById(userId1).select('blockedUsers'),
                User.findById(userId2).select('blockedUsers')
            ]);
            
            if (!user1 || !user2) return false;
            
            return user1.blockedUsers?.includes(userId2) || user2.blockedUsers?.includes(userId1);
        } catch (error) {
            console.error('Error checking block status:', error);
            return false;
        }
    };

    // Helper function to update user status
    const updateUserStatus = async (userId, isOnline) => {
        try {
            await User.findByIdAndUpdate(userId, {
                isOnline,
                lastSeen: new Date()
            });
        } catch (error) {
            console.error('Error updating user status:', error);
        }
    };

    // Helper function to mark messages as read
    const markMessagesAsRead = async (senderId, receiverId, messageId = null) => {
        try {
            if (messageId) {
                return await Message.findByIdAndUpdate(messageId, { status: 'read' });
            } else {
                return await Message.updateMany(
                    {
                        sender: senderId,
                        receiver: receiverId,
                        status: { $in: ['sent', 'delivered'] }
                    },
                    { status: 'read' }
                );
            }
        } catch (error) {
            console.error('Error marking messages as read:', error);
            return null;
        }
    };

    io.on('connection', (socket) => {
        const userId = socket.handshake.auth.userId;
        console.log('✅ User connected:', userId, 'Socket ID:', socket.id);

        // Handle user connection
        if (userId) {
            if (!onlineUsers.has(userId)) {
                onlineUsers.set(userId, new Set());
            }
            onlineUsers.get(userId).add(socket.id);
            socket.join(userId);

            updateUserStatus(userId, true);

            const onlineUserIds = Array.from(onlineUsers.keys());
            socket.emit('onlineUsers', onlineUserIds);

            if (onlineUsers.get(userId).size === 1) {
                socket.broadcast.emit('userOnline', userId);
            }
        }

        // ========================================
        // GET USER STATUS
        // ========================================
        socket.on('getUserStatus', async (requestedUserId) => {
            console.log('🔍 Status requested for user:', requestedUserId);

            const isOnline = onlineUsers.has(requestedUserId) && onlineUsers.get(requestedUserId).size > 0;

            if (isOnline) {
                socket.emit('userStatus', {
                    userId: requestedUserId,
                    isOnline: true,
                    lastSeen: null
                });
            } else {
                try {
                    const user = await User.findById(requestedUserId).select('lastSeen isOnline');
                    socket.emit('userStatus', {
                        userId: requestedUserId,
                        isOnline: user?.isOnline || false,
                        lastSeen: user?.lastSeen || null
                    });
                } catch (error) {
                    console.error('Error fetching user status:', error);
                    socket.emit('userStatus', {
                        userId: requestedUserId,
                        isOnline: false,
                        lastSeen: null
                    });
                }
            }
        });

        // ========================================
        // MARK MESSAGES AS READ
        // ========================================
        socket.on('messageRead', async ({ messageId, senderId, receiverId }) => {
            console.log('📖 Message read receipt:', messageId, 'by user:', userId);
            
            try {
                const blocked = await isBlocked(userId, senderId);
                if (blocked) {
                    console.log('🚫 Blocked user trying to mark message as read');
                    return;
                }

                if (messageId) {
                    await markMessagesAsRead(senderId, receiverId, messageId);
                    console.log('✅ Message marked as read:', messageId);
                }
                
                if (senderId && receiverId) {
                    const result = await markMessagesAsRead(senderId, receiverId);
                    console.log(`📚 Marked ${result?.modifiedCount || 0} messages as read`);
                    
                    if (onlineUsers.has(senderId) && onlineUsers.get(senderId).size > 0) {
                        io.to(senderId).emit('messagesRead', {
                            byUserId: receiverId,
                            readAt: new Date(),
                            messageIds: result?.modifiedCount > 0 ? 'all' : null
                        });
                    }
                }
                
                if (messageId && onlineUsers.has(senderId) && onlineUsers.get(senderId).size > 0) {
                    io.to(senderId).emit('messageRead', {
                        messageId: messageId,
                        userId: receiverId,
                        readAt: new Date()
                    });
                }
                
            } catch (error) {
                console.error('❌ Error marking message as read:', error);
            }
        });

        // ========================================
        // MARK SINGLE MESSAGE AS DELIVERED
        // ========================================
        socket.on('messageDelivered', async ({ messageId, receiverId }) => {
            console.log('✅ Message delivered receipt:', messageId);
            
            try {
                const blocked = await isBlocked(userId, receiverId);
                if (blocked) {
                    console.log('🚫 Blocked user trying to mark message as delivered');
                    return;
                }

                await Message.findByIdAndUpdate(messageId, { status: 'delivered' });
                
                if (onlineUsers.has(receiverId) && onlineUsers.get(receiverId).size > 0) {
                    io.to(receiverId).emit('messageDelivered', {
                        messageId: messageId,
                        userId: userId,
                        deliveredAt: new Date()
                    });
                }
            } catch (error) {
                console.error('❌ Error marking message as delivered:', error);
            }
        });

        // ========================================
        // CLEAR CONVERSATION
        // ========================================
        socket.on('clearConversation', async ({ otherUserId, conversationId }) => {
            try {
                console.log('🗑️ Clearing conversation between', userId, 'and', otherUserId);

                if (!otherUserId) {
                    socket.emit('error', { message: 'Other user ID is required' });
                    return;
                }

                const blocked = await isBlocked(userId, otherUserId);
                if (blocked) {
                    socket.emit('error', { message: 'Cannot clear conversation. User is blocked.' });
                    return;
                }

                const result = await Message.deleteMany({
                    $or: [
                        { sender: userId, receiver: otherUserId },
                        { sender: otherUserId, receiver: userId }
                    ]
                });

                console.log(`✅ Deleted ${result.deletedCount} messages`);

                if (onlineUsers.has(otherUserId) && onlineUsers.get(otherUserId).size > 0) {
                    io.to(otherUserId).emit('conversationCleared', {
                        conversationId: conversationId || [userId, otherUserId].sort().join('_'),
                        clearedBy: userId,
                        timestamp: new Date(),
                        deletedCount: result.deletedCount,
                        success: true
                    });
                }

                socket.emit('conversationCleared', {
                    success: true,
                    conversationId: conversationId || [userId, otherUserId].sort().join('_'),
                    deletedCount: result.deletedCount,
                    message: `Cleared ${result.deletedCount} messages successfully`
                });

            } catch (error) {
                console.error('❌ Error clearing conversation:', error);
                socket.emit('error', { 
                    message: 'Failed to clear conversation',
                    details: error.message 
                });
            }
        });

        // ========================================
        // SEND PRIVATE MESSAGE
        // ========================================
        socket.on('sendMessage', async (message) => {
            console.log('📨 Message from', userId, 'to', message.receiver, ':', message.text);

            try {
                const { receiver, text } = message;

                if (!receiver || !text) {
                    socket.emit('messageError', { error: 'Invalid message format' });
                    return;
                }

                const blocked = await isBlocked(userId, receiver);
                if (blocked) {
                    socket.emit('messageError', { 
                        error: 'Cannot send message. User has blocked you or you have blocked them.',
                        blocked: true
                    });
                    return;
                }

                const newMessage = new Message({
                    sender: userId,
                    receiver: receiver,
                    text: text,
                    senderName: message.senderName || 'Unknown',
                    receiverName: message.receiverName || 'Unknown',
                    status: 'sent',
                    type: message.type || 'text',
                    createdAt: message.createdAt || new Date(),
                });

                const savedMessage = await newMessage.save();
                console.log('💾 Message saved to DB:', savedMessage._id);

                const messageToSend = {
                    id: savedMessage._id.toString(),
                    _id: savedMessage._id,
                    text: savedMessage.text,
                    sender: savedMessage.sender.toString(),
                    receiver: savedMessage.receiver.toString(),
                    senderName: savedMessage.senderName,
                    receiverName: savedMessage.receiverName,
                    status: 'sent',
                    type: savedMessage.type,
                    createdAt: savedMessage.createdAt,
                };

                const isReceiverOnline = onlineUsers.has(receiver) && onlineUsers.get(receiver).size > 0;
                
                if (isReceiverOnline) {
                    const stillBlocked = await isBlocked(userId, receiver);
                    if (!stillBlocked) {
                        io.to(receiver).emit('receiveMessage', {
                            ...messageToSend,
                            status: 'delivered'
                        });
                        console.log('✅ Message delivered to', receiver);

                        await Message.findByIdAndUpdate(savedMessage._id, { status: 'delivered' });
                        
                        socket.emit('messageDelivered', {
                            messageId: savedMessage._id.toString(),
                            receiverId: receiver,
                            deliveredAt: new Date()
                        });
                    }
                } else {
                    console.log('⚠️ Receiver offline, message saved for later');
                }

                socket.emit('receiveMessage', {
                    ...messageToSend,
                    status: (isReceiverOnline && !(await isBlocked(userId, receiver))) ? 'delivered' : 'sent'
                });

            } catch (error) {
                console.error('❌ Error sending message:', error);
                socket.emit('messageError', { error: 'Failed to send message' });
            }
        });

        // ========================================
        // GET CHAT HISTORY
        // ========================================
        socket.on('getChatHistory', async ({ otherUserId }) => {
            try {
                console.log('📜 Fetching chat history between', userId, 'and', otherUserId);

                const blocked = await isBlocked(userId, otherUserId);
                if (blocked) {
                    console.log('🚫 Blocked user trying to fetch chat history');
                    socket.emit('chatHistory', []);
                    socket.emit('error', { 
                        message: 'Cannot fetch chat history. User is blocked.',
                        blocked: true
                    });
                    return;
                }

                const messages = await Message.find({
                    $or: [
                        { sender: userId, receiver: otherUserId },
                        { sender: otherUserId, receiver: userId }
                    ]
                })
                .sort({ createdAt: 1 })
                .limit(100);

                console.log(`📜 Found ${messages.length} messages`);

                const unreadMessages = messages.filter(msg => 
                    msg.sender.toString() === otherUserId && 
                    msg.status !== 'read'
                );
                
                if (unreadMessages.length > 0) {
                    await Message.updateMany(
                        {
                            sender: otherUserId,
                            receiver: userId,
                            status: { $in: ['sent', 'delivered'] }
                        },
                        { status: 'read' }
                    );
                    console.log(`📚 Marked ${unreadMessages.length} messages as read`);
                    
                    if (onlineUsers.has(otherUserId) && onlineUsers.get(otherUserId).size > 0) {
                        io.to(otherUserId).emit('messagesRead', {
                            byUserId: userId,
                            readAt: new Date(),
                            messageIds: 'all'
                        });
                    }
                }

                const formattedMessages = messages.map(msg => ({
                    id: msg._id.toString(),
                    _id: msg._id,
                    text: msg.text,
                    sender: msg.sender.toString(),
                    receiver: msg.receiver.toString(),
                    senderName: msg.senderName,
                    receiverName: msg.receiverName,
                    status: msg.status,
                    type: msg.type,
                    createdAt: msg.createdAt,
                }));

                socket.emit('chatHistory', formattedMessages);

            } catch (error) {
                console.error('❌ Error fetching chat history:', error);
                socket.emit('chatHistory', []);
            }
        });

        // ========================================
        // TYPING INDICATOR
        // ========================================
        socket.on('typing', async ({ receiver, senderName, isTyping }) => {
            const blocked = await isBlocked(userId, receiver);
            if (!blocked && onlineUsers.has(receiver)) {
                io.to(receiver).emit('userTyping', {
                    userId: userId,
                    senderName: senderName,
                    isTyping: isTyping
                });
            }
        });

        // ========================================
        // DISCONNECT
        // ========================================
        socket.on('disconnect', async () => {
            console.log('👋 Socket disconnected:', socket.id, 'User:', userId);

            if (userId && onlineUsers.has(userId)) {
                const userSockets = onlineUsers.get(userId);
                userSockets.delete(socket.id);

                if (userSockets.size === 0) {
                    onlineUsers.delete(userId);
                    await updateUserStatus(userId, false);
                    socket.broadcast.emit('userOffline', userId);
                }
            }
        });
    });
};

export default socketHandler;