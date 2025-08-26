const express = require("express");
const Message = require("../models/Message");
const User = require("../models/User");

const router = express.Router();

router.put("/markAsRead/:receiver/:sender", async (req, res) => {
    try {
        const { loggedInUserId, selectedUserId } = req.params;

        await Message.updateMany(
            { receiver: loggedInUserId, sender: selectedUserId, isRead: false },
            { $set: { isRead: true } }
          );

        res.status(200).json({ message: "Messages marked as read" });
    } catch (error) {
        console.error("Error marking messages as read:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});


router.get("/:user1/:user2", async (req, res) => {
    try {
        const { user1, user2 } = req.params;

        const messages = await Message.find({
            $or: [
                { sender: user1, receiver: user2 },
                { sender: user2, receiver: user1 }
            ]
        }).sort({ createdAt: 1 });

        const selectedUser = await User.findById(user2, "name");

        res.status(200).json({
            messages,
            selectedUserName: selectedUser?.name || "Unknown",
        });
    } catch (error) {
        console.error("Error fetching chat history:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

module.exports = router;