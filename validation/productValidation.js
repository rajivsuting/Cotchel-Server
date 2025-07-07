const Joi = require("joi");

const createProductSchema = Joi.object({
  title: Joi.string().max(255).required(),
  description: Joi.string().max(5000).allow(""),
  images: Joi.array().items(Joi.string().uri()).optional(),
  category: Joi.string().required(),
  subCategory: Joi.string().required(),
  quantityAvailable: Joi.number().integer().min(1).required(),
  price: Joi.number().min(0).required(),
  compareAtPrice: Joi.number().min(0).required(),
  productName: Joi.string().max(255).required(),
  keyHighLights: Joi.array().items(Joi.string()).optional(),
  brand: Joi.string().required(),
  model: Joi.string().required(),
  tags: Joi.array().items(Joi.string()).optional(),
});

module.exports = { createProductSchema };
