const express = require("express");
const razorpay = require("../utils/razorpay");
const Subscription = require("../models/Subscription");
const crypto = require("crypto");
const cron = require("node-cron");

const router = express.Router();

const plans = {
  Basic: { price: 99, connectionsAllowed: 5, durationDays: 30 },
  Premium: { price: 299, connectionsAllowed: 15, durationDays: 30 },
};

// 📌 1️⃣ CREATE ORDER ROUTE
router.post("/create-order", async (req, res) => {
  const { userId, planName } = req.body;

  if (!plans[planName]) {
    return res.status(400).json({ message: "Invalid plan selected" });
  }

  const plan = plans[planName];

  try {
    const shortId = crypto.randomBytes(4).toString("hex");

    const options = {
      amount: plan.price * 100,
      currency: "INR",
      receipt: `receipt_${shortId}`,
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      orderId: order.id,
      amount: options.amount,
      currency: options.currency,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Error creating order" });
  }
});

// 📌 2️⃣ VERIFY PAYMENT & ACTIVATE SUBSCRIPTION
router.post("/verify-payment", async (req, res) => {
  const { userId, planName, orderId, paymentId, signature } = req.body;

  if (!plans[planName]) {
    return res.status(400).json({ message: "Invalid plan selected" });
  }

  const plan = plans[planName];

  try {
    // Validate Razorpay signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(orderId + "|" + paymentId)
      .digest("hex");

    if (generatedSignature !== signature) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + plan.durationDays);

    // 📌 Check if user already has an active subscription
    const existingSubscription = await Subscription.findOne({ userId, status: "active" });

    if (existingSubscription) {
      // Update existing subscription
      existingSubscription.planName = planName;
      existingSubscription.price = plan.price;
      existingSubscription.connectionsAllowed = plan.connectionsAllowed;
      existingSubscription.connectionsLeft = plan.connectionsAllowed;
      existingSubscription.expiryDate = expiryDate;
      existingSubscription.paymentId = paymentId;

      await existingSubscription.save();
    } else {
      // Create a new subscription
      const newSubscription = new Subscription({
        userId,
        planName,
        price: plan.price,
        connectionsAllowed: plan.connectionsAllowed,
        connectionsLeft: plan.connectionsAllowed,
        expiryDate,
        paymentId,
        status: "active",
      });

      await newSubscription.save();
    }

    res.status(200).json({ message: "Subscription activated successfully!" });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ message: "Error verifying payment" });
  }
});

// 📌 3️⃣ GET SUBSCRIPTION STATUS
router.get("/status/:userId", async (req, res) => {
  const { userId } = req.params;

  console.log("Fetching subscription status for user:", userId);
  try {
    const subscription = await Subscription.findOne({
      userId,
      status: "active",
    });

    if (!subscription) {
      return res.status(200).json({ isSubscribed: false, plan: null, connectionsLeft: 2 }); // Default 2 free connects
    }

    res.status(200).json({
      isSubscribed: true,
      plan: subscription.planName,
      expiryDate: subscription.expiryDate,
      connectionsLeft: subscription.connectionsLeft,
    });
  } catch (error) {
    console.error("Error fetching subscription status:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// 📌 5️⃣ RESET CONNECTIONS MONTHLY
cron.schedule("0 0 1 * *", async () => {
  console.log("🔄 Resetting connections for free users...");

  try {
    // ✅ Reset only FREE-TIER users (not paid users)
    await User.updateMany(
      { _id: { $nin: await Subscription.distinct("userId", { status: "active" }) } },
      { $set: { freeConnectionsLeft: 2 } }
    );

    console.log("✅ Free users' connections reset successfully!");
  } catch (error) {
    console.error("❌ Error resetting free user connections:", error);
  }
});

// 📌 6️⃣ AUTO-RENEWAL OF SUBSCRIPTIONS (SIMULATED FOR NOW)
cron.schedule("0 0 * * *", async () => {
  console.log("🔄 Checking for expired subscriptions...");
  try {
    const now = new Date();

    const expiredSubscriptions = await Subscription.find({
      expiryDate: { $lt: now },
      status: "active",
    });

    for (const sub of expiredSubscriptions) {
      sub.status = "expired";
      await sub.save();

      // ✅ When a subscription expires, user gets 2 free connects
      await User.updateOne({ _id: sub.userId }, { freeConnectionsLeft: 2 });
    }

    console.log(`✅ Expired ${expiredSubscriptions.length} subscriptions.`);
  } catch (error) {
    console.error("❌ Error in subscription renewal check:", error);
  }
});


module.exports = router;
