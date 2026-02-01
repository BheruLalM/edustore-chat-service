import User from "../models/User.js";
import Message from "../models/Message.js";
import cloudinary from "../lib/Cloudnary.js";
import { io, userSocketMap } from "../server.js";

/* ===========================
   GET USERS FOR SIDEBAR
=========================== */
export const getUsersForSidebar = async (req, res) => {
    try {
        const myId = req.user._id;

        // 1. Find all distinct users who have interacted with current user
        // distinct senderId where receiverId = myId
        const senders = await Message.distinct("senderId", { receiverId: myId });
        // distinct receiverId where senderId = myId
        const receivers = await Message.distinct("receiverId", { senderId: myId });

        // Combine unique IDs
        const chattedUserIds = [...new Set([...senders, ...receivers].map(id => id.toString()))];

        // 2. Fetch User Details for these IDs (excluding self, although set logic already helps)
        const users = await User.find({
            _id: { $in: chattedUserIds }
        }).select("-password");

        // 3. Optimized Unseen Messages Count (Aggregation)
        const unseenCountsRef = await Message.aggregate([
            {
                $match: {
                    receiverId: myId,  // Messages sent TO me
                    seen: false        // That are NOT seen
                }
            },
            {
                $group: {
                    _id: "$senderId", // Group by sender
                    count: { $sum: 1 } // Count them
                }
            }
        ]);

        // Convert array to object map: { userId: count }
        const unseenMessages = {};
        unseenCountsRef.forEach(item => {
            unseenMessages[item._id.toString()] = item.count;
        });

        res.json({ success: true, users, unseenMessages });
    } catch (err) {
        console.error("Sidebar users error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

/* ===========================
   GET MESSAGES
=========================== */
export const getMessages = async (req, res) => {
    try {
        const myId = req.user._id;
        let selectedUserId = req.params.id;

        // If selectedUserId is not a valid MongoDB ObjectId, it might be a postgresId
        if (!selectedUserId.match(/^[0-9a-fA-F]{24}$/)) {
            const user = await User.findOne({ postgresId: selectedUserId });
            if (!user) {
                return res.json({ success: true, messages: [] });
            }
            selectedUserId = user._id;
        }

        const messages = await Message.find({
            $or: [
                { senderId: myId, receiverId: selectedUserId },
                { senderId: selectedUserId, receiverId: myId },
            ],
        }).sort({ createdAt: 1 });

        await Message.updateMany(
            {
                senderId: selectedUserId,
                receiverId: myId,
                seen: false,
            },
            { $set: { seen: true } }
        );

        res.json({ success: true, messages });
    } catch (err) {
        console.error("Get messages error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

/* ===========================
   MARK MESSAGE SEEN
=========================== */
export const markMessagesSeen = async (req, res) => {
    try {
        await Message.findByIdAndUpdate(req.params.id, { seen: true });
        res.json({ success: true });
    } catch (err) {
        console.error("Mark seen error:", err);
        res.status(500).json({ success: false });
    }
};

/* ===========================
   SEND MESSAGE
=========================== */
export const sendMessage = async (req, res) => {
    try {
        const senderId = req.user._id;
        let receiverId = req.params.id;
        const { text, image } = req.body;

        // If receiverId is not a valid MongoDB ObjectId, it might be a postgresId
        if (!receiverId.match(/^[0-9a-fA-F]{24}$/)) {
            let user = await User.findOne({ postgresId: receiverId });
            if (!user) {
                // We should ideally sync here if we had the email/name, but for now 
                // we assume if they clicked from profile, the UI should have passed more info 
                // or the sync should happen in the frontend first.
                // However, as a safety, let's return error if user not found.
                return res.status(404).json({ success: false, message: "Recipient not found in chat system" });
            }
            receiverId = user._id;
        }

        let imageUrl = "";

        if (image) {
            // 🔒 size guard (~12MB base64 for 9MB binary)
            if (image.length > 12_000_000) {
                return res.status(400).json({
                    success: false,
                    message: "Image too large (max 9MB)",
                });
            }

            const uploadResult = await cloudinary.uploader.upload(image, {
                folder: "aura_chat/messages",
                resource_type: "image",
                quality: "auto:low",
                fetch_format: "auto",
                width: 800,
                crop: "limit",
                timeout: 60000,
            });

            imageUrl = uploadResult.secure_url;
        }

        const newMessage = await Message.create({
            senderId,
            receiverId,
            text,
            image: imageUrl,
        });

        // 📡 socket emit (safe)
        const receiverSocketId = userSocketMap?.[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("newMessage", newMessage);
        }

        res.json({ success: true, newMessage });
    } catch (err) {
        console.error("Send message error:", err);
        res.status(500).json({
            success: false,
            message: "Message sending failed",
        });
    }
};
