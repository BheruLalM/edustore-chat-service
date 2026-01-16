import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { generatetoken } from "../lib/utils.js";
import cloudinary from "../lib/Cloudnary.js";

// SIGNUP
export const signup = async (req, res) => {
    try {
        const { email, fullName, password, bio } = req.body;

        if (!email || !fullName || !password)
            return res.status(400).json({ message: "All fields are required." });

        if (password.length < 6)
            return res.status(400).json({ message: "Password must be at least 6 characters long." });

        if (await User.findOne({ email }))
            return res.status(400).json({ message: "Email already in use." });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ email, fullName, password: hashedPassword, bio: bio || "" });
        const token = generatetoken(newUser._id.toString());

        res.json({ success: true, userData: newUser, token, message: "Signup successful" });
    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).json({ message: err.message || "Internal server error during signup" });
    }
};

// LOGIN
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "All fields required" });

        const user = await User.findOne({ email }).select("+password");
        if (!user) return res.status(400).json({ message: "Invalid email or password" });

        if (!(await bcrypt.compare(password, user.password)))
            return res.status(400).json({ message: "Invalid email or password" });

        const token = generatetoken(user._id);
        res.json({ success: true, userData: user, token, message: "Login successful" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

// CHECK AUTH
export const checkAuth = async (req, res) => {
    res.json({ success: true, userData: req.user });
};

// UPDATE PROFILE
export const updateProfile = async (req, res) => {
    try {
        const { fullName, profilePic, bio } = req.body;
        let updatedData;
        if (profilePic) {
            const uploadResult = await cloudinary.uploader.upload(profilePic, {
                timeout: 60000,
                folder: "aura_chat/profiles",
                resource_type: "image",
            });
            console.log("Cloudinary upload successful:", uploadResult.secure_url);
            updatedData = await User.findByIdAndUpdate(
                req.user._id,
                { fullName, profilePic: uploadResult.secure_url, bio },
                { new: true }
            );
        } else {
            updatedData = await User.findByIdAndUpdate(
                req.user._id,
                { fullName, bio },
                { new: true }
            );
        }

        if (!updatedData) return res.status(404).json({ message: "User not found." });

        res.json({ success: true, userData: updatedData, message: "Profile updated successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

// SYNC USER (Microservice Integration)
export const syncUser = async (req, res) => {
    try {
        const { email, fullName, profilePic, postgresId, bio } = req.body;

        if (!email || !fullName || !postgresId) {
            return res.status(400).json({ message: "Email, fullName, and postgresId are required." });
        }

        // Find by postgresId or email
        let user = await User.findOne({
            $or: [{ postgresId }, { email }]
        });

        if (user) {
            // Update missing fields if needed
            let updates = {};
            if (!user.postgresId) updates.postgresId = postgresId;
            // Only update pic/name if not set or changed, basically keeping them in sync
            // But we must be careful not to overwrite custom changes if the chat app allows separate profile edits
            // For now, assume main app is source of truth for name/pic
            if (profilePic && user.profilePic !== profilePic) updates.profilePic = profilePic;
            if (fullName && user.fullName !== fullName) updates.fullName = fullName;

            if (Object.keys(updates).length > 0) {
                user = await User.findByIdAndUpdate(user._id, updates, { new: true });
            }
        } else {
            // Create new user
            // Generate a random password since they won't use it
            const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            user = await User.create({
                email,
                fullName,
                password: hashedPassword,
                profilePic: profilePic || "",
                postgresId,
                bio: bio || ""
            });
        }

        const token = generatetoken(user._id.toString());
        res.json({ success: true, userData: user, token, message: "User synced successfully" });

    } catch (err) {
        console.error("Sync error:", err);
        res.status(500).json({ message: err.message || "Internal server error during sync" });
    }
};

// RESET USERS (Bulk Sync Utility)
export const resetUsers = async (req, res) => {
    try {
        await User.deleteMany({});
        res.json({ success: true, message: "All users deleted successfully." });
    } catch (err) {
        console.error("Reset error:", err);
        res.status(500).json({ message: "Internal server error during reset" });
    }
};
