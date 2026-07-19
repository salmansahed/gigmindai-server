const dontenv = require("dotenv");
dontenv.config();
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 4000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(express.json());
app.use(cors());

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
        const limit = parseInt(req.query.limit) || 4;
        const skip = (page - 1) * limit;

        // Build dynamic query object
        let query = {};

        // Search query (Title or Description)
        if (search) {
          query.$or = [
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ];
        }

        // Category filter
        if (category && category !== "All" && category !== "All Categories") {
          query.category = { $regex: `^${category}$`, $options: "i" };
        }

        // Job type filter
        if (type && type !== "All") {
          query.type = { $regex: `^${type}$`, $options: "i" };
        }

        // Build sorting configuration
        let sortOption = {};
        if (sort === "latest") {
          sortOption._id = -1;
        } else if (sort === "price-low") {
          sortOption.price = 1;
        } else if (sort === "price-high") {
          sortOption.price = -1;
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

    // Post a new job
    app.post("/api/jobs", async (req, res) => {
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
