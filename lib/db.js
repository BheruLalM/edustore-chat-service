import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        mongoose.connection.on("connected", () =>
            console.log("Database connected successfully")
        );
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        });
    } catch (error) {
        console.error("Database connection error:", error);
        process.exit(1);
    }
};
