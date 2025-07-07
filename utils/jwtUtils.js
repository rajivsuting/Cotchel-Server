const jwt = require("jsonwebtoken");

const createTokens = (user) => {
  const accessToken = jwt.sign(
    {
      _id: user._id,
      role: user.role,
      name: user.fullName,
      isVerifiedSeller: user.isVerifiedSeller,
      sellerDetails: user.sellerDetails,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_SECRET, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
};

module.exports = { createTokens };
