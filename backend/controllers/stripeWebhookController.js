import { stripe } from "../config/stripe.js";
import User from "../models/User.js";

export const handleStripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.error(
      "Stripe webhook signature verification failed:",
      error.message,
    );

    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const userId = session.metadata?.userId || session.client_reference_id;

      if (!userId) {
        console.error(
          "Checkout session completed without a user ID:",
          session.id,
        );

        return res.status(400).json({
          error: "Checkout session has no associated user",
        });
      }

      if (session.payment_status !== "paid") {
        console.log(`Checkout session ${session.id} is not paid yet`);

        return res.status(200).json({
          received: true,
          premiumActivated: false,
        });
      }

      const user = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            isPremium: true,
          },
        },
        {
          new: true,
        },
      );

      if (!user) {
        console.error(`MongoDB user not found for Stripe payment: ${userId}`);

        return res.status(404).json({
          error: "Associated user not found",
        });
      }

      console.log(`Premium activated for ${user.email}`);
    }

    return res.status(200).json({
      received: true,
    });
  } catch (error) {
    console.error("Stripe webhook processing error:", error);

    return res.status(500).json({
      error: "Webhook processing failed",
    });
  }
};
