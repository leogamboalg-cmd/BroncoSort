// controllers/canvasController.js
import User from "../models/User.js";

export const setupCanvasFeed = async (req, res) => {
  const { googleId, calendarUrl, ntfyTopic } = req.body;

  // 1. Structural Validation
  if (!googleId || !calendarUrl || !ntfyTopic) {
    return res
      .status(400)
      .json({ error: "Missing required onboarding fields." });
  }

  // 2. Format Validation: Ensure it's a real Canvas calendar feed
  if (!calendarUrl.includes("/feeds/calendars/")) {
    return res
      .status(400)
      .json({ error: "Invalid Canvas Calendar Feed URL style." });
  }

  try {
    // 3. Flat Update (No hashing or encryption needed)
    const updatedUser = await User.findByIdAndUpdate(
      googleId,
      {
        isPremium: true,
        canvasCalendarUrl: calendarUrl,
        ntfyTopic: ntfyTopic,
      },
      { returnDocument: "after" }, // Fixed: Replaced { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User profile not found." });
    }

    res.status(200).json({
      message: "Canvas summary profile successfully configured!",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
