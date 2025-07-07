const mongoose = require("mongoose");

/**
 * Validates a MongoDB ObjectId
 * @param {string} id
 * @returns {boolean}
 */
exports.validateObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};
