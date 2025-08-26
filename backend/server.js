const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const connectDB = require("./config/db");
const { createServer } = require("http");
const { Server } = require("socket.io");
const User = require("./models/User");
const Message = require("./models/Message");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const subscriptionRoutes = require("./routes/subscription");
const meetRoutes = require("./routes/meeting");
const messageRoutes = require("./routes/message");
const upload = require("./middleware/upload");
const recommendChannelVideos = require("./controllers/recommendChannelVideos");
dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173" },
  methods: ["GET", "POST"],
});

const users = {};

app.get("/", (req, res) => res.send("API is Running"));

// const authRoutes = require("./routes/auth");
// const userRoutes = require("./routes/user");

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/subscription", subscriptionRoutes);
app.use("/api/meet", meetRoutes);
app.use("/messages", messageRoutes);
app.use("/uploads", express.static("uploads"));
app.use("/recommend-channel-videos", recommendChannelVideos)

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const { sender, receiver } = req.body;
    const fileUrl = `/uploads/${req.file.filename}`;
    const fileName = req.file.originalname;

    const newMessage = new Message({
      sender,
      receiver,
      fileUrl,
      fileName,
      isRead: users[receiver] ? true : false,
      timestamp: new Date(),
    });

    await newMessage.save();

    io.to(sender).emit("receiveMessage", newMessage);
    if (users[receiver]) {
      io.to(receiver).emit("receiveMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ message: "File upload failed" });
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", async (userId) => {
    socket.join(userId);
    users[userId] = socket.id;
    console.log(`User ${userId} joined their room`);

    const unreadMessages = await Message.find({
      receiver: userId,
      isRead: false,
    });

    unreadMessages.forEach(async (msg) => {
      io.to(userId).emit("receiveMessage", msg);
      await Message.findByIdAndUpdate(msg._id, { isRead: true });
    });
  });

  socket.on("sendMessage", async ({ sender, receiver, message }) => {
    try {
      if (!sender || !receiver || !message) return;

      const newMessage = new Message({
        sender,
        receiver,
        message,
        isRead: users[receiver] ? true : false,
        timestamp: new Date(),
      });

      await newMessage.save();

      io.to(sender).emit("receiveMessage", newMessage);

      if (users[receiver]) {
        io.to(receiver).emit("receiveMessage", newMessage);
      }
    } catch (error) {
      console.error("Error sending message:", error.message);
    }
  });

  socket.on("disconnect", () => {
    for (const userId in users) {
      if (users[userId] === socket.id) {
        delete users[userId];
        console.log(`User ${userId} disconnected`);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
