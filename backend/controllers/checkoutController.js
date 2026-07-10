import { stripe } from "../config/stripe.js";
import User from "../models/User.js";

export const createCheckoutSession = async (req, res) => {
  try {
    const priceId = process.env.STRIPE_PRICE_ID;
    const frontendUrl = process.env.FRONTEND_URL;

    if (!priceId) {
      return res.status(500).json({
        error: "Missing STRIPE_PRICE_ID",
      });
    }

    if (!frontendUrl) {
      return res.status(500).json({
        error: "Missing FRONTEND_URL",
      });
    }

    // This should come from your verified Google login token,
    // not directly from something the frontend typed.
    const userId = req.user?.sub;

    if (!userId) {
      return res.status(401).json({
        error: "You must be logged in to purchase premium",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    if (user.isPremium) {
      return res.status(400).json({
        error: "User already has premium",
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      // Connect this Stripe payment to your MongoDB user.
      client_reference_id: user._id,

      metadata: {
        userId: user._id,
      },

      customer_email: user.email,

      success_url:
        `${frontendUrl}/index.html` +
        "?payment=success&session_id={CHECKOUT_SESSION_ID}",

      cancel_url: `${frontendUrl}/index.html?payment=cancel`,
    });

    return res.status(200).json({
      url: session.url,
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);

    return res.status(500).json({
      error: "Failed to create checkout session",
    });
  }
};
