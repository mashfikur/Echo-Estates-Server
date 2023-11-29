const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
    const offeredCollection = client.db("echoEstatesDB").collection("offered");
    const reviewsCollection = client.db("echoEstatesDB").collection("reviews");

    // ------------Custom Middlewares----------
    const verifyToken = async (req, res, next) => {
      if (!req.headers?.authorization) {
        return res.status(401).send({ message: "Unauthorised Access" });
      }
      const token = req.headers.authorization.split(" ")[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorised Access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verfiyAgent = async (req, res, next) => {
      const { uid } = req.decoded;
      const user = await usersCollection.findOne({ userId: uid });

      if (!(user.role === "agent")) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      next();
    };
    const verfiyAdmin = async (req, res, next) => {
      const { uid } = req.decoded;
      const user = await usersCollection.findOne({ userId: uid });

      if (!(user.role === "admin")) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      next();
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

    app.get(
      "/api/v1/admin/get-users",
      verifyToken,
      verfiyAdmin,
      async (req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
      }
    );

    app.get(
      "/api/v1/agent/added-properties/:id",
      verifyToken,
      verfiyAgent,
      async (req, res) => {
        const id = req.params.id;
        const result = await propertyCollection
          .find({ agent_id: id })
          .toArray();
        res.send(result);
      }
    );

    app.get(
      "/api/v1/user/verified-properties",
      verifyToken,
      async (req, res) => {
        const { search, sort } = req.query;
        const filter = {
          $and: [
            { verification_status: "verified" },
            { property_title: { $regex: new RegExp(search, "i") } },
          ],
        };
        const result = sort
          ? await propertyCollection
              .find(filter)
              .sort({
                "price_range.0": sort ? (sort === "asc" ? 1 : -1) : 1,
              })
              .toArray()
          : await propertyCollection.find(filter).toArray();
        res.send(result);
      }
    );

    app.get(
      "/api/v1/admin/agent-properties",
      verifyToken,
      verfiyAdmin,
      async (req, res) => {
        const result = await propertyCollection.find().toArray();
        res.send(result);
      }
    );

    app.get(
      "/api/v1/user/property/details/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const result = await propertyCollection.findOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      }
    );

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

    app.get(
      "/api/v1/user/get-offered-properties/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const result = await offeredCollection.find({ buyer_id: id }).toArray();
        res.send(result);
      }
    );
    app.get(
      "/api/v1/agent/get-requested-properties/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const result = await offeredCollection
          .find({
            agent_id: id,
          })
          .toArray();
        res.send(result);
      }
    );

    app.get("/api/v1/advertised-properties", async (req, res) => {
      const result = await propertyCollection
        .find({ isAdvertised: "true" })
        .toArray();

      res.send(result);
    });

    app.get("/api/v1/public/get-reviews", async (req, res) => {
      const result = await reviewsCollection
        .find()
        .sort({ _id: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get(
      "/api/v1/admin/get-reviews",
      verifyToken,
      verfiyAdmin,
      async (req, res) => {
        const result = await reviewsCollection.find().toArray();
        res.send(result);
      }
    );

    app.get(
      "/api/v1/property/get-reviews/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const result = await reviewsCollection
          .find({ property_id: id })
          .toArray();

        res.send(result);
      }
    );

    app.get("/api/v1/user/get-reviews/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await reviewsCollection
        .find({ reviewer_id: id })
        .toArray();

      res.send(result);
    });

    app.get(
      "/api/v1/user/accepted-offered-properties/:id",
      async (req, res) => {
        const id = req.params.id;
        const result = await offeredCollection.findOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      }
    );

    app.get(
      "/api/v1/agent/sold-properties/:id",
      verifyToken,
      verfiyAgent,
      async (req, res) => {
        const id = req.params.id;
        const result = await offeredCollection
          .find({
            $and: [{ agent_id: id }, { status: "bought" }],
          })
          .toArray();

        res.send(result);
      }
    );

    // -----------Create JWT Token---------------
    app.post("/api/v1/auth/create-token", async (req, res) => {
      const info = req.body;
      const token = jwt.sign(info, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "5h",
      });
      res.send({ token });
    });

    // ------------Payment API-------------
    app.post("/api/v1/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
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

    app.post(
      "/api/v1/agent/add-property",
      verifyToken,
      verfiyAgent,
      async (req, res) => {
        const info = req.body;
        const result = await propertyCollection.insertOne(info);
        res.send(result);
      }
    );

    app.post("/api/v1/user/add-to-wishlist", verifyToken, async (req, res) => {
      const info = req.body;

      const result = await wishlistCollection.insertOne(info);

      res.send(result);
    });

    app.post("/api/v1/user/offered", verifyToken, async (req, res) => {
      const info = req.body;
      const result = await offeredCollection.insertOne(info);
      res.send(result);
    });

    app.post("/api/v1/admin/make-fraud/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { agent_id: id };
      const updatedDoc = {
        $set: {
          role: "fraud",
        },
      };
      const makeFraud = await usersCollection.updateOne(
        { userId: id },
        updatedDoc
      );
      const result = await propertyCollection.deleteMany(filter);
      res.send(result);
    });

    app.post("/api/v1/user/add-review", verifyToken, async (req, res) => {
      const info = req.body;
      const result = await reviewsCollection.insertOne(info);

      res.send(result);
    });

    // ------------PATCH request------------------
    app.patch(
      "/api/v1/admin/update-user/:id",
      verifyToken,
      verfiyAdmin,
      async (req, res) => {
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
      }
    );

    app.patch(
      "/api/v1/admin/update-property/:id",
      verifyToken,
      verfiyAdmin,
      async (req, res) => {
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
      }
    );
    app.patch(
      "/api/v1/admin/advertise-property/:id",
      verifyToken,
      verfiyAdmin,
      async (req, res) => {
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
      }
    );

    app.patch("/api/v1/agent/update-property/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const info = req.body;
      const updatedDoc = {
        $set: {
          property_title: info.property_title,
          property_location: info.property_location,
          property_image: info.property_image,
          price_range: info.price_range,
        },
      };

      const result = await propertyCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    app.patch("/api/v1/agent/change-property-status/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const { status } = req.query;
      const updatedDoc = {
        $set: {
          status: status,
        },
      };

      const result = await offeredCollection.updateOne(filter, updatedDoc);

      res.send(result);
    });

    //saving transaction id
    app.put(
      "/api/v1/user/completed-transaction/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const {
          _id,
          property_id,
          agent_id,
          agent_name,
          agent_image,
          property_title,
          property_image,
          property_location,
          buyer_name,
          buyer_email,
          buyer_id,
          offered_price,
          buying_date,
          status,
          tranx_id,
        } = req.body;

        const updatedDoc = {
          $set: {
            property_id,
            agent_id,
            agent_name,
            agent_image,
            property_title,
            property_image,
            property_location,
            buyer_name,
            buyer_email,
            buyer_id,
            offered_price,
            buying_date,
            status: "bought",
            tranx_id,
          },
        };

        const result = await offeredCollection.updateOne(
          { _id: new ObjectId(id) },
          updatedDoc
        );

        res.send(result);
      }
    );

    // DELETE request
    app.delete(
      "/api/v1/user/remove-wishlist/:itemId",
      verifyToken,
      async (req, res) => {
        const itemId = req.params.itemId;

        const result = await wishlistCollection.deleteMany({
          property_id: itemId,
        });

        res.send(result);
      }
    );

    app.delete(
      "/api/v1/admin/delete-user/:id",
      verifyToken,
      verfiyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const result = await usersCollection.deleteOne({ userId: id });
        res.send(result);
      }
    );

    app.delete(
      "/api/v1/user/delete-property/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const result = await propertyCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      }
    );

    app.delete(
      "/api/v1/user/delete-review/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const result = await reviewsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      }
    );

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
