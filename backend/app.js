// server.js
const express = require("express");
const path = require("path");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const cors = require("cors");
const dbPath = path.join(__dirname, "financeTracker.db");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const router = express.Router();

//middleware
app.use(cors());
const jsonMiddleware = express.json();
app.use(jsonMiddleware);

let db = null;

const initializeDBandServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Start server
    app.listen(3000, () => {
      console.log("Server is running on http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DataBase error is ${error.message}`);
    process.exit(1);
  }
};

// Initialize SQLite database
initializeDBandServer();

const transactions = [];

// Register User
app.post("/register/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `select * from user where username='${username}'`;
  const userDBDetails = await db.get(getUserQuery);

  if (userDBDetails !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `insert into user(username,password,name,gender) values 
          ('${username}','${hashedPassword}')`;
      await db.run(createUserQuery);
      response.send("User created successfully");
    }
  }
});

// Authentication middleware
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// Routes

//login API
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      response.send("Login Success!");
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

//  reports
app.get("/reports/:id", authenticateToken, async (req, res) => {
  const userId = req.params;
  const getReportsQuery = `SELECT category, SUM(amount) AS total FROM transactions WHERE user_id =${userId} GROUP BY category;`;
  const reportsArray = await db.all(getReportsQuery);
  response.send(reportsArray);
});

// CRUD Operations for transactions
app.get("/transactions/:id", authenticateToken, async (req, res) => {
  const { username } = req;
  const { userId } = req.params;
  const getTransactionsQuery = `SELECT * FROM transactions WHERE username =${username} AND user_id=${userId};`;
  const transactionsArray = await db.all(getTransactionsQuery);
  response.send(transactionsArray);
});

app.post("/transactions", authenticateToken, async (req, res) => {
  const { username } = req;
  const { date, category, amount } = req.body;
  const addTransactionsQuery = `INSERT INTO 
    transactions (username, date, category, amount)
     VALUES ('${username}','${date}','${category}', ${amount});`;
  const dbresponse = await db.run(addTransactionsQuery);
  response.send("transaction added success fully");
});

app.put("/transactions/:id/", authenticateToken, async (request, response) => {
  const id = request.params;
  const transactionDetails = request.body;
  const { date, category, amount } = transactionDetails;
  const updateTransactionQuery = `UPDATE transactions
    SET 
     date='${date}',
     category = '${category}',
     amount = ${amount}
    WHERE 
     user_id= ${id};`;
  const dbresponse = await db.run(updateTransactionQuery);
  response.send(`Transaction Details Updated`);
});

app.delete("/transactions/:id", authenticateToken, (req, res) => {
  const { username } = req;
  const { id } = req.params;
  const deleteTransactionQuery = `DELETE FROM transactions WHERE user_id = ${id};`;
});

module.exports = app;
