import express from "express";
import { checkAuth, login, signup, updateProfile, syncUser } from "../controllers/UserController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/sync", syncUser);
router.put("/update-profile", protect, updateProfile);
router.get("/check", protect, checkAuth);

export default router;
