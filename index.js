const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const wishlistCollection = client
      .db("echoEstatesDB")
      .collection("wishlist");

    const propertyCollection = client
      .db("echoEstatesDB")
      .collection("properties");

    // ------------Custom Middlewares----------
    const verifyToken = (req, res, next) => {
      if (!req.headers?.authorization) {
        return res.status(401).send({ message: "Unauthorised Access" });
      }
      const token = req.headers.authorization.split(" ")[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: "Forbidden Access" });
        }
        console.log(decoded);
        req.decoded = decoded;
        next();
      });
    };

    //-------------API Endpoints--------------

    // GET Requests
    app.get("/api/v1/user/check-agent/:id", async (req, res) => {
      const id = req.params.id;
      const user = await usersCollection.findOne({ userId: id });
      if (user?.role === "agent") {
        return res.send({ isAgent: true });
      } else {
        return res.send({ isAgent: false });
      }
    });
    app.get("/api/v1/user/check-admin/:id", async (req, res) => {
      const id = req.params.id;
      const user = await usersCollection.findOne({ userId: id });
      if (user?.role === "admin") {
        return res.send({ isAdmin: true });
      } else {
        return res.send({ isAdmin: false });
      }
    });

    app.get("/api/v1/admin/get-users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/api/v1/agent/added-properties/:id", async (req, res) => {
      const id = req.params.id;
      const result = await propertyCollection.find({ agent_id: id }).toArray();
      res.send(result);
    });

    app.get("/api/v1/user/verified-properties", async (req, res) => {
      const query = { verification_status: "verified" };
      const result = await propertyCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/api/v1/admin/agent-properties", async (req, res) => {
      const result = await propertyCollection.find().toArray();
      res.send(result);
    });

    app.get("/api/v1/user/property/details/:id", async (req, res) => {
      const id = req.params.id;
      const result = await propertyCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.get("/api/v1/user/get-wishlist/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      if (!req.decoded.uid === id) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const items = await wishlistCollection
        .find({ wishlisted_by: id })
        .toArray();

      const wishlisted = items.map((item) => new ObjectId(item.property_id));

      const result = await propertyCollection
        .find({ _id: { $in: wishlisted } })
        .toArray();

      res.send(result);
    });

    // -----------Create JWT Token---------------
    app.post("/api/v1/auth/create-token", async (req, res) => {
      const info = req.body;
      const token = jwt.sign(info, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
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

    app.post("/api/v1/user/add-to-wishlist", async (req, res) => {
      const info = req.body;

      const result = await wishlistCollection.insertOne(info);

      res.send(result);
    });

    // PATCH request
    app.patch("/api/v1/admin/update-user/:id", async (req, res) => {
      const id = req.params.id;

      const { role } = req.query;
      const updatedDoc = {
        $set: {
          role: role,
        },
      };

      const result = await usersCollection.updateOne(
        { userId: id },
        updatedDoc
      );
      res.send(result);
    });

    app.patch("/api/v1/admin/update-property/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.query;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          verification_status: status,
        },
      };

      const result = await propertyCollection.updateOne(query, updatedDoc);

      res.send(result);
    });
    app.patch("/api/v1/admin/advertise-property/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.query;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          isAdvertised: status,
        },
      };

      const result = await propertyCollection.updateOne(query, updatedDoc);

      res.send(result);
    });

    // DELETE request
    app.delete("/api/v1/user/remove-wishlist/:itemId", async (req, res) => {
      const itemId = req.params.itemId;

      const result = await wishlistCollection.deleteMany({
        property_id: itemId,
      });

      res.send(result);
    });

    app.delete("/api/v1/admin/delete-user/:id", async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.deleteOne({ userId: id });
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
