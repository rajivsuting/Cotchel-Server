// Success response
const successResponse = (res, message) => {
  return res.status(200).json({
    status: "success",
    message,
  });
};

// Success response with data
const successResponseWithData = (res, message, data) => {
  return res.status(200).json({
    status: "success",
    message,
    data,
  });
};

const errorResponse = (res, message) => {
  return res.status(500).json({
    status: "error",
    message,
  });
};

module.exports = {
  successResponse,
  successResponseWithData,
  errorResponse,
};
