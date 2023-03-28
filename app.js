const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const convertStateTableToCamelCase = (requestBody) => {
  return {
    stateId: requestBody.state_id,
    stateName: requestBody.state_name,
    population: requestBody.population,
  };
};

const convertDistrictTableToCamelCase = (requestBody) => {
  return {
    districtId: requestBody.district_id,
    districtName: requestBody.district_name,
    stateId: requestBody.state_id,
    cases: requestBody.cases,
    cured: requestBody.cured,
    active: requestBody.active,
    deaths: requestBody.deaths,
  };
};
function authenticateToken(request, response, next) {
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
}

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await database.get(selectUserQuery);
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2
app.get("/states/", async (request, response) => {
  const selectUserQuery = `
        SELECT 
            *
        FROM
            state;`;
  const dbUser = await db.all(selectUserQuery);
  response.send(dbUser.map((eachObj) => convertStateTableToCamelCase(eachObj)));
});

//API 3
app.get("/states/:stateId/", async (request, response) => {
  const { stateId } = request.params;
  const selectUserQuery = `
        SELECT 
            *
        FROM 
            state
        WHERE 
            state_id = "${stateId}";`;
  const stateArray = await db.get(selectUserQuery);
  response.send(convertStateTableToCamelCase(stateArray));
});

//API 4
app.post("/districts/", async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
        INSERT INTO 
            district(district_name, state_id, cases, cured, active, deaths)
        VALUES 
            (
                '${districtName}',
                ${stateId},
                ${cases},
                ${cured},
                ${active},
                ${deaths}
            );`;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//API 5
app.get("/districts/:districtId/", async (request, response) => {
  const { districtId } = request.params;
  const selectDistrictQuery = `
        SELECT 
            *
        FROM 
            district
        WHERE 
            district_id = "${districtId}";`;
  const result = await db.get(selectDistrictQuery);
  response.send(convertDistrictTableToCamelCase(result));
});

//API 6
app.delete("/districts/:districtId/", async (request, response) => {
  const { districtId } = request.params;
  const deleteDistrictUser = `
        DELETE FROM 
            district
        WHERE 
            district_id = ${districtId};`;
  await db.run(deleteDistrictUser);
  response.send("District Removed");
});

//API 7
app.put("/districts/:districtId/", async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDistrictQuery = `
        UPDATE
            district
        SET 
            "district_name" = '${districtName}';
            "state_id" = ${stateId},
            "cases" = ${cases},
            "cured" = ${cured},
            "active" = ${active},
            "deaths" = ${deaths}
        WHERE 
            district_id = ${districtId};`;
  await db.run(updateDistrictQuery);
  response.send("District Details Updated");
});

//API 8
app.get("/states/:stateId/stats/", async (request, response) => {
  const { stateId } = request.params;
  const selectUserQuery = `
        SELECT 
            SUM(cases),
            SUM(cured),
            SUM(active),
            SUM(deaths)
        FROM
            district
        WHERE
            state_id = ${stateId};`;
  const stats = await db.get(selectUserQuery);
  response.send({
    totalCases: stats["SUM(cases)"],
    totalCured: stats["SUM(cured)"],
    totalActive: stats["SUM(active)"],
    totalDeaths: stats["SUM(deaths)"],
  });
});

module.exports = app;
