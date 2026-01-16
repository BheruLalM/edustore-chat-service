import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import compression from "compression";

import { connectDB } from "./lib/db.js";
import userRouter from "./Routes/UserRoutes.js";
import messageRouter from "./Routes/MessageRoutes.js";

const app = express();
const httpServer = http.createServer(app);

// Socket.io
import jwt from "jsonwebtoken";

// Socket.io with optimized configuration
export const io = new Server(httpServer, {
    cors: { origin: "*" },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'], // Prefer websocket
});

// Online users map
export const userSocketMap = {}; // { userId: socketId }

// Middleware for Socket Authentication
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId; // This is the Mongo ID
        next();
    } catch (err) {
        next(new Error("Authentication error"));
    }
});

io.on("connection", (socket) => {
    const userId = socket.userId;
    console.log("✅ user connected:", userId);

    if (userId) userSocketMap[userId] = socket.id;

    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("disconnect", () => {
        console.log("❌ user disconnected:", userId);
        if (userId) delete userSocketMap[userId];
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
});

// Middlewares
app.use(express.json({ limit: "10mb" }));
app.use(cors());

// Add compression for all HTTP responses
app.use(compression());

// Add request timing middleware for performance monitoring
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (duration > 100) { // Log slow requests
            console.log(`⏱️  ${req.method} ${req.url} - ${duration}ms`);
        }
    });
    next();
});

// Routes
app.get("/api/status", (req, res) => res.send("Server is running ✅"));
app.use("/api/auth", userRouter);
app.use("/api/messages", messageRouter);

// Connect DB
await connectDB();

// Error handler
app.use((err, req, res, next) => {
    console.error("Global Error Handler:", err);
    res.status(err.status || 500).json({ message: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
