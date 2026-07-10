// models/User.js
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true, // Stores the permanent Google 'sub' ID string
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    canvasCalendarUrl: {
      type: String,
      default: null, // Example: https://cpp.edu
    },
    ntfyTopic: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

const User = mongoose.model("User", UserSchema);
export default User;
