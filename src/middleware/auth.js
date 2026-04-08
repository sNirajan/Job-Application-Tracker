/*
* Auth middleware. Reads from cookies first
* read the access token from the incoming request
* verify that the token is real and not expired
* extract the user id from the token
* attach that user id to req
* allow the request to continue
* If the token is missing or bad, it stops the request by throwing an unauthorized error.
*/

const jwt = require("jsonwebtoken");
const config = require("../config");
const { UnauthorizedError } = require("../utils/errors");

function auth(req, res, next) {
  // Cookie first (browser - req.cookies?.accessToken), Authorization header second (curl/Postman - req.headers.authorization?.replace("Bearer ", "")
  
  const token = req.cookies?.accessToken
    || req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    throw new UnauthorizedError("No token provided");
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    req.userId = decoded.sub;
    next();
  } catch (err) {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

module.exports = auth;