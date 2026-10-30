const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");

const router = express.Router();


// =================================
// REGISTER API
// =================================

router.post("/register", async (req, res) => {

    try {

        const { name, email, password } = req.body;

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !name.trim() ||
            !email.trim() ||
            password.length < 8 ||
            password.length > 72
        ) {
            return res.status(400).json({
                message: "Enter a name, email and password of 8–72 characters."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {

            return res.status(400).json({
                message: "User already exists"
            });

        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        const newUser = new User({

            name: name.trim(),

            email: normalizedEmail,

            password: hashedPassword

        });

        await newUser.save();

        res.status(201).json({
            message: "Registration successful"
        });

    } catch (error) {

        if (error.code === 11000) {
            return res.status(400).json({
                message: "User already exists"
            });
        }

        console.error(error);

        res.status(500).json({
            message: "Server error"
        });

    }

});


// =================================
// LOGIN API
// =================================

router.post("/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                message: "Invalid email or password"
            });
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase()
        }).select("+password");

        if (!user) {

            return res.status(401).json({
                message: "Invalid email or password"
            });

        }

        // Compare password with hashed password
        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {

            return res.status(401).json({
                message: "Invalid email or password"
            });

        }

        // Regenerate session to prevent session fixation
        req.session.regenerate((error) => {

            if (error) {
                return res.status(500).json({
                    message: "Unable to create session"
                });
            }

            req.session.userId = user._id.toString();

            req.session.save((error) => {

                if (error) {
                    return res.status(500).json({
                        message: "Unable to save session"
                    });
                }

                return res.json({
                    message: "Login successful",
                    redirect: "/dashboard"
                });

            });

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server error"
        });

    }

});


// =================================
// CHECK SESSION API
// =================================

router.get("/session", protect, async (req, res) => {

    const user = await User.findById(
        req.session.userId
    ).select("name email");

    if (!user) {

        return res.status(401).json({
            message: "User not found"
        });

    }

    res.json({
        loggedIn: true,
        user: user
    });

});


// =================================
// LOGOUT API
// =================================

router.post("/logout", (req, res) => {

    if (!req.session) {
        return res.json({
            message: "Logged out"
        });
    }

    req.session.destroy((error) => {

        if (error) {

            return res.status(500).json({
                message: "Logout failed"
            });

        }

        res.clearCookie("connect.sid");

        res.json({
            message: "Logged out successfully"
        });

    });

});

module.exports = router;