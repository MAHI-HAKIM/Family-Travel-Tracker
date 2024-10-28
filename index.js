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
    console.error("Could not fetch data from DB", err.stack);
  } else {
    registeredUsers = res.rows;
  }
});

function initializeUsers() {
  users = registeredUsers.map((user) => ({ ...user })); // Copy users to avoid reference issues
}

async function getUserInfo(userID) {
  try {
    const visitedCountriesByUser = await fetchVisitedCountries(userID);
    const userDetail = await getUserByID(userID);

    // Use async/await correctly for the query
    const result = await db.query("SELECT * FROM users");
    const allUsers = result.rows; // Store all users from the query

    // Create the userInfo object
    const userInfo = {
      visitedCountry: visitedCountriesByUser,
      userDetails: userDetail,
      allUsers: allUsers,
    };

    return userInfo;
  } catch (err) {
    console.error("Error fetching user info:", err);
    throw err; // Re-throw the error if you need to handle it later
  }
}

async function checkUserVisited(userID, code) {
  console.log(`CHECKING IF USER ${userID} VISITED ${code}`);

  let visited = false;

  try {
    const result = await db.query(
      "SELECT * FROM visited_countries WHERE user_id = $1 AND country_code = $2",
      [userID, code] // Pass parameters in a single array
    );

    if (result.rows.length > 0) {
      visited = true;
      console.log(`HE visited ${code} before.`);
    } else {
      console.log(`He did not visit ${code} before.`);
    }
  } catch (error) {
    console.error("Error checking visited countries:", error);
  }

  return visited;
}
async function fetchVisitedCountries(clickedUserID) {
  const result = await db.query(
    "SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = $1;",
    [clickedUserID]
  );
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}
async function getUserByID(user_ID) {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [
      user_ID,
    ]);
    if (result.rows.length === 0) {
      console.log("User not found");
      return null;
    }
    console.log("User found:", result.rows[0]);
    return result.rows[0];
  } catch (err) {
    console.error("Error fetching user by ID:", error);
    throw error;
  }
}

async function addVisitedCountry(userID, code) {
  try {
    await db.query(
      "INSERT INTO visited_countries (country_code , user_id) VALUES ($1,$2)",
      [code, userID]
    );
    console.log(`Added ${code} to user ${userID} successfully`);
  } catch (err) {
    console.error("Error adding visited country:", err);
    throw err;
  }
}
app.get("/", async (req, res) => {
  initializeUsers(); // Ensure users are initialized without duplication

  const userInfo = await getUserInfo(users[0].id);

  res.render("index.ejs", {
    countries: userInfo.visitedCountry,
    total: userInfo.visitedCountry.length,
    users: userInfo.allUsers,
    color: userInfo.userDetails.color,
    currentUserId: userInfo.userDetails.id,
  });
});

app.post("/add", async (req, res) => {
  const { country, userId } = req.body; // Get the country and userId from the form

  // console.log(`Adding country: ${country} to user ID: ${userId}`);

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [country.toLowerCase()]
    );
    const data = result.rows[0];
    // console.log("Fetched Country", data);

    if (!data) {
      console.log("Invalid country name. Please try again.");

      let userInfo = await getUserInfo(userId);

      res.render("index.ejs", {
        countries: userInfo.visitedCountry,
        total: userInfo.visitedCountry.length,
        users: userInfo.allUsers,
        color: userInfo.userDetails.color,
        currentUserId: userInfo.userDetails.id,
      });
    } else {
      let visitedCountry = await checkUserVisited(userId, data.country_code);

      if (visitedCountry) {
        console.log("User already visited this country");
        let userInfo = await getUserInfo(userId);
        res.render("index.ejs", {
          countries: userInfo.visitedCountry,
          total: userInfo.visitedCountry.length,
          users: userInfo.allUsers,
          color: userInfo.userDetails.color,
          currentUserId: userInfo.userDetails.id,
        });
      } else {
        console.log("User not visited this country");
        addVisitedCountry(userId, data.country_code);
        let userInfo = await getUserInfo(userId);
        res.render("index.ejs", {
          countries: userInfo.visitedCountry,
          total: userInfo.visitedCountry.length,
          users: userInfo.allUsers,
          color: userInfo.userDetails.color,
          currentUserId: userInfo.userDetails.id,
        });
      }
    }
  } catch (err) {
    console.log("Unable to perform things here");
    console.log(err);
  }
});

app.post("/user", async (req, res) => {
  const result = req.body.user; // Extract the 'user' value from req.body

  console.log("Submitted value:", result);

  if (result === "new") {
    console.log("NEW TO BE CREATED");
    return res.render("new.ejs"); // Render the page to add a new user
  } else {
    currentUserId = result;

    const userInfo = await getUserInfo(currentUserId);

    console.log("user Visited Country ", userInfo.visitedCountry);

    res.render("index.ejs", {
      countries: userInfo.visitedCountry,
      total: userInfo.visitedCountry.length,
      users: userInfo.allUsers,
      color: userInfo.userDetails.color,
      currentUserId: currentUserId,
    });
  }
});

app.post("/new", async (req, res) => {
  //Hint: The RETURNING keyword can return the data that was inserted.
  //https://www.postgresql.org/docs/current/dml-returning.html
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
