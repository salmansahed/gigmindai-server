const dontenv = require("dotenv");
dontenv.config();
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 4000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

app.use(express.json());
app.use(cors());

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);
// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  // console.log("authHeader =>", authHeader);
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  // console.log("token =>", token);
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  try {
    const { payload } = await jwtVerify(token, JWKS);
    // console.log("payload =>", payload);
    next();
  } catch (error) {
    // console.log("error =>", error);
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const db = client.db(process.env.MONGODB_DB);
    // _________________________________Collections Start___________________________________________\\
    const jobsCollection = db.collection("jobs");

    // _________________________________Collections End___________________________________________\\

    // ________________________________Routes Start___________________________________________\\
    // Get all jobs with optional search, filter, sort, and pagination
  app.get("/api/jobs", async (req, res) => {
    try {
      const search = req.query.search || "";
      const category = req.query.category || "";
      const type = req.query.type || "";
      const sort = req.query.sort || "latest";

      // Pagination parameters
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 8;
      const skip = (page - 1) * limit;

      // Build dynamic query object
      let query = {};

      // 1. Search query (Title or Description)
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      // Helper function to escape special characters for regex (Fixes "AI & ML" issue)
      const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // 2. Category filter
      if (category && category !== "All" && category !== "All Categories") {
        query.category = {
          $regex: `^${escapeRegex(category)}$`,
          $options: "i",
        };
      }

      // 3. Job type filter 
      if (type && type !== "All") {
        query.jobType = { $regex: escapeRegex(type), $options: "i" };
      }

      // 4. Build sorting configuration (FIXED: Changed 'price' to 'budget' to match your database)
      let sortOption = {};
      if (sort === "latest") {
        sortOption._id = -1;
      } else if (sort === "price-low") {
        sortOption.budget = 1;
      } else if (sort === "price-high") {
        sortOption.budget = -1;
      }

      // Fetch filtered data from database
      const cursor = jobsCollection
        .find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit);
      const result = await cursor.toArray();

      // Calculate pagination metadata
      const totalJobs = await jobsCollection.countDocuments(query);
      const totalPages = Math.ceil(totalJobs / limit);

      // Send response to frontend
      res.send({
        jobs: result,
        meta: {
          totalJobs,
          totalPages,
          currentPage: page,
          limit,
        },
      });
    } catch (error) {
      console.error("❌ Error fetching jobs:", error);
      res.status(500).send({ message: "Internal Server Error" });
    }
  }); 

    // Specific job details
    app.get("/api/jobs/:id", async (req, res) => {
      try {
        const jobId = req.params.id;
        const job = await jobsCollection.findOne({
          _id: new ObjectId(jobId),
        });
        if (!job) {
          return res.status(404).send({ message: "Job not found" });
        }
        res.send(job);
      } catch (error) {
        console.error("❌ Error fetching job details:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // Get all gigs posted by a specific user (by authorId)
    app.get("/api/my-gigs/:authorId", verifyToken, async (req, res) => {
      try {
        const authorId = req.params.authorId;

        // Query using the string authorId directly as per database structure
        const query = { authorId: authorId };

        const gigs = await jobsCollection
          .find(query)
          .sort({ _id: -1 })
          .toArray();

        // Respond with the fetched gigs array
        res.send(gigs);
      } catch (error) {
        console.error("❌ Error fetching user gigs:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // Delete a job by ID
    app.delete("/api/delete-jobs/:id", verifyToken, async (req, res) => {
      try {
        const jobId = req.params.id;
        const result = await jobsCollection.deleteOne({
          _id: new ObjectId(jobId),
        });
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Job not found" });
        }
        res
          .status(200)
          .send({ message: "Job deleted successfully", success: true });
      } catch (error) {
        console.error("❌ Error deleting job:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // Post a new job
    app.post("/api/jobs", verifyToken, async (req, res) => {
      try {
        const newJob = req.body;
        const result = await jobsCollection.insertOne(newJob);
        res.status(201).send(result);
      } catch (error) {
        console.error("❌ Error creating job:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // ________________________________Routes End___________________________________________\\

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
