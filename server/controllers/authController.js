import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const shouldBeAdmin = async (email) => {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail && email?.toLowerCase() === adminEmail) return true;

  // Bootstrap: first account becomes admin if no admin exists yet.
  const adminExists = await User.exists({ role: "admin" });
  return !adminExists;
};

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ msg: "name, email and password are required" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ msg: "User exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const makeAdmin = await shouldBeAdmin(email);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: makeAdmin ? "admin" : "user",
    });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ msg: error.message || "Registration failed" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: "email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const makeAdmin = await shouldBeAdmin(email);
    if (makeAdmin && user.role !== "admin") {
      user.role = "admin";
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ msg: error.message || "Login failed" });
  }
};
