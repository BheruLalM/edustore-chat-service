import express from "express";
import { protect } from "../middleware/auth.js";
import { getMessages, getUsersForSidebar, markMessagesSeen, sendMessage } from "../controllers/MessageController.js";

const router = express.Router();

router.get("/users", protect, getUsersForSidebar);
router.get("/:id", protect, getMessages);
router.put("/mark/:id", protect, markMessagesSeen);
router.post("/send/:id", protect, sendMessage);

export default router;
