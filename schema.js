const Joi = require('joi');

module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    price: Joi.number().required(),
    country: Joi.string().required(),
    location: Joi.string().required(),
    category: Joi.string().valid('Beach','City','Mountain','Lake','Ski','Desert','Cabin','Villa'),
    image: Joi.string().allow('', null),
    isAvailable: Joi.boolean().optional(),
  }).required()
});

module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().min(1).max(5).required(),
    comment: Joi.string().required(),
  }).required()
});

module.exports.bookingSchema = Joi.object({
  booking: Joi.object({
    checkIn: Joi.date().required(),
    checkOut: Joi.date().required(),
    totalPrice: Joi.number().required(),
  }).required()
});

