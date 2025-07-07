const Joi = require("joi");

const registerSchema = Joi.object({
  fullName: Joi.string().required().max(100),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  phoneNumber: Joi.string().pattern(/^(\+91[-\s]?)?[789]\d{9}$/),
  dateOfBirth: Joi.date().less("now"),
  gender: Joi.string().valid("Male", "Female", "Other"),
  role: Joi.string().valid("Admin", "Seller", "Buyer"),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

module.exports = { registerSchema, loginSchema };
