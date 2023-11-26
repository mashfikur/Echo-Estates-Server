const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  res.send("Server is Running Successfully");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rnoho8k.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // ----------Databses & Collections----------
    const usersCollection = client.db("echoEstatesDB").collection("users");
    const propertyCollection = client
      .db("echoEstatesDB")
      .collection("properties");

    // ------------Custom Middlewares----------

    //-------------API Endpoints--------------

    // GET Requests
    app.get("/api/v1/user/check-agent/:id", async (req, res) => {
      const id = req.params.id;
      const user = await usersCollection.findOne({ userId: id });
      if (user.role === "agent") {
        return res.send({ isAgent: true });
      } else {
        return res.send({ isAgent: false });
      }
    });

    //POST Requests
    app.post("/api/v1/add-user", async (req, res) => {
      const userInfo = req.body;

      const { userId } = userInfo;

      const user = await usersCollection.findOne({ userId: userId });

      if (!user) {
        const result = await usersCollection.insertOne(userInfo);
        res.send(result);
        return;
      } else {
        res.send({ message: "User Already Exists" });
        return;
      }
    });

    app.post("/api/v1/user/add-property", async (req, res) => {
      const info = req.body;
      const result = await propertyCollection.insertOne(info);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
