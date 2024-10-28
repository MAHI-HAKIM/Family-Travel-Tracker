import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "World",
  password: "Mahi.2003",
  port: 5432,
});

db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 3;

let users = [];

let registeredUsers = await db.query("SELECT * FROM users", (err, res) => {
  if (err) {
    console.error("Could not fetch data from DataBase", err.stack);
  } else {
    registeredUsers = res.rows;
  }
});

// Helper function to fetch all users from DB
async function fetchAllUsers() {
  const result = await db.query("SELECT * FROM users");
  return result.rows;
}
// Initialize the users without duplications
async function initializeUsers() {
  const allUsers = await fetchAllUsers();
  return allUsers.map((user) => ({ ...user })); // Avoid reference issues
}
// Fetch a user by their ID
async function getUserByID(userID) {
  const result = await db.query("SELECT * FROM users WHERE id = $1", [userID]);
  return result.rows[0] || null;
}
// Fetch visited countries for a given user
async function fetchVisitedCountries(userID) {
  const result = await db.query(
    "SELECT country_code FROM visited_countries WHERE user_id = $1",
    [userID]
  );
  return result.rows.map((row) => row.country_code);
}
// Check if the user has visited a country
async function checkUserVisited(userID, countryCode) {
  const result = await db.query(
    "SELECT 1 FROM visited_countries WHERE user_id = $1 AND country_code = $2",
    [userID, countryCode]
  );
  return result.rowCount > 0;
}
// Add a new visited country for the user
async function addVisitedCountry(userID, countryCode) {
  await db.query(
    "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
    [countryCode, userID]
  );
}
// Fetch complete user info for rendering
async function getUserInfo(userID) {
  const allUsers = await initializeUsers();
  const userDetails = await getUserByID(userID);
  const visitedCountries = await fetchVisitedCountries(userID);

  return { allUsers, userDetails, visitedCountries };
}

// Route: Home page
app.get("/", async (req, res) => {
  const userInfo = await getUserInfo(currentUserId);
  res.render("index.ejs", {
    countries: userInfo.visitedCountries,
    total: userInfo.visitedCountries.length,
    users: userInfo.allUsers,
    color: userInfo.userDetails.color,
    currentUserId: userInfo.userDetails.id,
  });
});

// Route: Handle country addition
app.post("/add", async (req, res) => {
  const { country, userId } = req.body;

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%'",
      [country.toLowerCase()]
    );

    const countryData = result.rows[0];
    if (!countryData) {
      console.log("Invalid country name. Please try again.");
      return res.redirect("/"); // Redirect instead of re-rendering to avoid duplication
    }

    const visited = await checkUserVisited(userId, countryData.country_code);
    if (!visited) {
      await addVisitedCountry(userId, countryData.country_code);
      console.log(`Added ${countryData.country_code} to user ${userId}`);
    } else {
      console.log("User already visited this country.");
    }

    res.redirect("/"); // Refresh the page with updated data
  } catch (err) {
    console.error("Error adding country:", err);
    res.redirect("/");
  }
});

// Route: Handle user selection
app.post("/user", async (req, res) => {
  const selectedUserId = req.body.user;

  if (selectedUserId === "new") {
    return res.render("new.ejs"); // Render new user creation page
  }

  currentUserId = selectedUserId;
  res.redirect("/"); // Redirect to home with updated user context
});

// Route: Handle new user creation
app.post("/new", async (req, res) => {
  const { name, color } = req.body;

  try {
    const result = await db.query(
      "INSERT INTO users (name, color) VALUES ($1, $2) RETURNING *",
      [name, color]
    );

    const newUser = result.rows[0];
    currentUserId = newUser.id;
    console.log("Created new user:", newUser);

    res.redirect("/"); // Redirect to home with the new user
  } catch (err) {
    console.error("Error creating new user:", err);
    res.redirect("/new");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
