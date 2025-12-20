const review = require('./models/review');

const Joi = require('joi');



module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    price: Joi.number().required(),
    country: Joi.string().required(),
    location: Joi.string().required(),
    category: Joi.string()
      .valid('Beach','City','Mountain','Lake','Ski','Desert','Cabin','Villa')
      .required()
  }).required()
});

module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().min(1).max(5).required(),
    body: Joi.string().required()
  }).required()
});

module.exports.reviewSchema= Joi.object({
  review:Joi.object({
    rating:Joi.number().required().min(1).max(5),
    comment:Joi.string().required()
  }).required(),
});
