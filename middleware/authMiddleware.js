const jwt = require("jsonwebtoken");

exports.verifyToken = (req, res, next) => {
  const accessToken = req.cookies?.accessToken;

  if (!accessToken) {
    return res.status(401).json({ error: "Access token missing" });
  }

  jwt.verify(accessToken, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expired", reAuth: true });
      }

      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = user;
    next();
  });
};

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ error: "User not authenticated" });
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: "Access denied" });
    next();
  };

exports.optionalAuth = (req, res, next) => {
  const accessToken = req.cookies?.accessToken;
  if (!accessToken) {
    req.user = null;
    return next();
  }

  jwt.verify(accessToken, process.env.JWT_SECRET, (err, user) => {
    req.user = err ? null : user;
    next();
  });
};
