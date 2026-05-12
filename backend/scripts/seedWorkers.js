const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const User = require("../models/User");
const WorkerProfile = require("../models/WorkerProfile");
const Job = require("../models/Job");
const Review = require("../models/Review");
const Document = require("../models/Document");

const workers = [
  {
    name: "Rajesh Kumar",
    email: "rajesh.plumber@example.com",
    password: "Password123",
    role: "worker",
    profile: {
      category: "plumber",
      location: "Bangalore",
      experience: 10,
      hourlyRate: 500,
      age: 35,
      bio: "Professional plumber with 10 years of experience in residential and commercial plumbing. I specialize in fixing leaks, installing new fixtures, and clearing clogged drains.",
      skills: ["pipe-fitting", "drainage", "water-heaters"],
      phone: "9876543210",
      verificationStatus: "approved"
    },
    reviews: [
      { rating: 5, comment: "Fixed my kitchen sink in no time. Highly professional!" },
      { rating: 4, comment: "Good work, arrived on time. Reasonable price." },
      { rating: 5, comment: "Very satisfied with the pipe installation." }
    ]
  },
  {
    name: "Anita Sharma",
    email: "anita.electrician@example.com",
    password: "Password123",
    role: "worker",
    profile: {
      category: "electrician",
      location: "Mumbai",
      experience: 7,
      hourlyRate: 600,
      age: 29,
      bio: "Certified electrician with a focus on safety and precision. Expert in household wiring, MCB replacements, and appliance installation.",
      skills: ["wiring", "mcb-repair", "lighting"],
      phone: "9876543211",
      verificationStatus: "approved"
    },
    reviews: [
      { rating: 5, comment: "Anita is an expert! She solved a complex wiring issue that others couldn't." },
      { rating: 5, comment: "Very polite and knowledgeable. Highly recommend for any electrical work." },
      { rating: 5, comment: "Installed our new chandelier perfectly." }
    ]
  },
  {
    name: "Sunil Verma",
    email: "sunil.carpenter@example.com",
    password: "Password123",
    role: "worker",
    profile: {
      category: "carpenter",
      location: "Delhi",
      experience: 15,
      hourlyRate: 450,
      age: 42,
      bio: "Master carpenter specialized in custom wooden furniture and modular kitchen repairs. Over 15 years of experience in creating beautiful wood works.",
      skills: ["furniture", "repair", "polishing"],
      phone: "9876543212",
      verificationStatus: "approved"
    },
    reviews: [
      { rating: 4, comment: "Excellent craftsmanship on my dining table." },
      { rating: 5, comment: "Best carpenter in Delhi! Reliable and skilled." },
      { rating: 4, comment: "Repaired our old wardrobe, looks like new." }
    ]
  },
  {
    name: "Priya Das",
    email: "priya.cleaner@example.com",
    password: "Password123",
    role: "worker",
    profile: {
      category: "cleaner",
      location: "Bangalore",
      experience: 4,
      hourlyRate: 300,
      age: 26,
      bio: "Professional home and office cleaner. I provide deep cleaning services using eco-friendly products. Punctuality and hygiene are my top priorities.",
      skills: ["deep-cleaning", "eco-friendly", "organizing"],
      phone: "9876543213",
      verificationStatus: "approved"
    },
    reviews: [
      { rating: 5, comment: "My house has never been cleaner! Priya is amazing." },
      { rating: 5, comment: "Deep cleaning was worth every penny." }
    ]
  },
  {
    name: "Vikram Singh",
    email: "vikram.painter@example.com",
    password: "Password123",
    role: "worker",
    profile: {
      category: "painter",
      location: "Mumbai",
      experience: 12,
      hourlyRate: 700,
      age: 38,
      bio: "Expert wall painter and texture artist. I bring life to your walls with modern designs and high-quality finishes.",
      skills: ["textures", "interior-painting", "wallpaper"],
      phone: "9876543214",
      verificationStatus: "approved"
    },
    reviews: [
      { rating: 5, comment: "Transformed our living room with beautiful texture work." },
      { rating: 4, comment: "Very professional and clean work." },
      { rating: 5, comment: "Great attention to detail on the ceiling." }
    ]
  },
  {
    name: "Ravi Shankar",
    email: "ravi.gardener@example.com",
    password: "Password123",
    role: "worker",
    profile: {
      category: "gardener",
      location: "Delhi",
      experience: 8,
      hourlyRate: 350,
      age: 45,
      bio: "Passionate gardener with expertise in terrace gardens, landscaping, and indoor plant care.",
      skills: ["landscaping", "terrace-garden", "pruning"],
      phone: "9876543215",
      verificationStatus: "approved"
    },
    reviews: [
      { rating: 5, comment: "Ravi has a green thumb! My garden is thriving now." },
      { rating: 5, comment: "Excellent landscaping work on our backyard." }
    ]
  },
  {
    name: "Meera Iyer",
    email: "meera.acrepair@example.com",
    password: "Password123",
    role: "worker",
    profile: {
      category: "ac_repair",
      location: "Bangalore",
      experience: 9,
      hourlyRate: 650,
      age: 38,
      bio: "Expert AC technician specializing in installation, gas charging, and servicing of all major brands.",
      skills: ["ac-repair", "installation", "servicing"],
      phone: "9876543216",
      verificationStatus: "approved"
    },
    reviews: [
      { rating: 5, comment: "Meera was very professional and fixed our AC unit quickly." },
      { rating: 5, comment: "Highly recommend for AC servicing." }
    ]
  },
  {
    name: "Arjun Reddy",
    email: "arjun.mechanic@example.com",
    password: "Password123",
    role: "worker",
    profile: {
      category: "mechanic",
      location: "Hyderabad",
      experience: 12,
      hourlyRate: 800,
      age: 42,
      bio: "Experienced car mechanic for major repairs and routine maintenance. Expert in engine diagnostics and suspension work.",
      skills: ["engine-repair", "diagnostics", "suspension"],
      phone: "9876543217",
      verificationStatus: "approved"
    },
    reviews: [
      { rating: 5, comment: "Arjun fixed my engine issue that others couldn't diagnose." },
      { rating: 5, comment: "Reliable and honest mechanic." }
    ]
  },
  {
    name: "Sophie Khan",
    email: "sophie.appliances@example.com",
    password: "Password123",
    role: "worker",
    profile: {
      category: "appliance_repair",
      location: "Mumbai",
      experience: 5,
      hourlyRate: 450,
      age: 29,
      bio: "Technician for refrigerators, washing machines, and microwave ovens. Reliable and prompt service.",
      skills: ["washing-machine", "refrigerator", "microwave"],
      phone: "9876543218",
      verificationStatus: "approved"
    },
    reviews: [
      { rating: 5, comment: "Sophie fixed our washing machine on the same day. Great service!" },
      { rating: 5, comment: "Very polite and knowledgeable about appliances." }
    ]
  },
  {
    name: "Karan Johar",
    email: "karan.handyman@example.com",
    password: "Password123",
    role: "worker",
    profile: {
      category: "handyman",
      location: "Pune",
      experience: 3,
      hourlyRate: 300,
      age: 26,
      bio: "Jack of all trades for household repairs, shelf mounting, and minor electrical/plumbing fixes.",
      skills: ["repairs", "mounting", "painting"],
      phone: "9876543219",
      verificationStatus: "approved"
    },
    reviews: [
      { rating: 5, comment: "Karan helped us mount several shelves and fixed a leaky faucet. Very handy!" },
      { rating: 4, comment: "Good work on the minor repairs." }
    ]
  }
];

async function seed() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/app";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for advanced worker seeding...");

    // 1. Create a Reviewer Customer
    let reviewer = await User.findOne({ email: "reviewer@example.com" });
    if (!reviewer) {
      reviewer = new User({
        name: "Verified Customer",
        email: "reviewer@example.com",
        password: "Password123",
        role: "customer"
      });
      await reviewer.save();
      console.log("Created Reviewer customer.");
    }

    for (const w of workers) {
      // 2. Upsert User
      let user = await User.findOne({ email: w.email });
      if (!user) {
        user = new User({
          name: w.name,
          email: w.email,
          password: w.password,
          role: w.role
        });
        await user.save();
      } else {
        user.name = w.name;
        user.role = "worker";
        await user.save();
      }

      // 3. Upsert WorkerProfile
      await WorkerProfile.findOneAndUpdate(
        { userId: user._id },
        {
          $set: {
            ...w.profile,
            isDeleted: false,
            deletedAt: null
          }
        },
        { upsert: true, new: true }
      );

      // 4. Create Approved Certificate Document
      await Document.findOneAndUpdate(
        { userId: user._id, documentType: "certificate" },
        {
          $set: {
            fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
            originalName: `${w.category}_certification.pdf`,
            mimeType: "application/pdf",
            fileSize: 1024 * 500,
            status: "approved",
            reviewedAt: new Date()
          }
        },
        { upsert: true }
      );

      // 5. Create Jobs and Reviews
      for (let i = 0; i < w.reviews.length; i++) {
        const rev = w.reviews[i];
        
        // Use findOneAndUpdate for Jobs to avoid duplicates on re-run
        const job = await Job.findOneAndUpdate(
          { 
            customerId: reviewer._id, 
            workerId: user._id,
            description: `Job for review ${i}`
          },
          {
            $set: {
              status: "completed",
              serviceDate: new Date(Date.now() - (i + 1) * 86400000),
              completedAt: new Date()
            }
          },
          { upsert: true, new: true }
        );

        await Review.findOneAndUpdate(
          { jobId: job._id },
          {
            $set: {
              customerId: reviewer._id,
              workerId: user._id,
              rating: rev.rating,
              comment: rev.comment
            }
          },
          { upsert: true }
        );
      }

      // 6. Calculate and Set Final Trust Score
      let score = 50; // Base score
      const approvedJobs = await Job.countDocuments({ workerId: user._id, status: "completed" });
      score += Math.min(approvedJobs * 10, 30);
      
      const fiveStarReviews = await Review.countDocuments({ workerId: user._id, rating: 5 });
      score += Math.min(fiveStarReviews * 5, 20);
      
      const finalScore = Math.min(Math.max(score, 0), 100);
      
      await WorkerProfile.updateOne(
        { userId: user._id },
        { $set: { trustScore: finalScore } }
      );

      const savedProfile = await WorkerProfile.findOne({ userId: user._id });
      console.log(`Successfully seeded worker: ${w.name} (Score in DB: ${savedProfile.trustScore}%)`);
    }

    console.log("Advanced seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Advanced seeding failed:", error);
    process.exit(1);
  }
}

seed();
