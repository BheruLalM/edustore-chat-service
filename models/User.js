import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
        postgresId: { type: String, unique: true, sparse: true }, // Link to Postgres User ID
        fullName: { type: String, required: true, trim: true },
        password: { type: String, required: true, minlength: 6, select: false },
        profilePic: { type: String, default: "" },
        bio: { type: String, maxlength: 160, default: "" },
    },
    { timestamps: true }
);

export default mongoose.model("User", userSchema);
