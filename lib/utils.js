import jwt from "jsonwebtoken";

export const generatetoken = (id) => {
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET not defined");
    return jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};
