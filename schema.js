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
    guests: Joi.number().min(1).optional(),
    bedrooms: Joi.number().min(0).optional(),
    bathrooms: Joi.number().min(0).optional(),
    propertyType: Joi.string().valid('Entire home', 'Villa', 'Apartment', 'Cabin', 'Cottage', 'Chalet', 'Resort', 'Private room', 'Unique stay').optional(),
    instantBook: Joi.boolean().optional(),
    cancellationPolicy: Joi.string().valid('Flexible', 'Moderate', 'Strict').optional(),
    amenities: Joi.alternatives().try(
      Joi.array().items(Joi.string()),
      Joi.string()
    ).optional(),
    pricing: Joi.object({
      weekendPrice: Joi.number().min(0).allow('', null).optional(),
      baseGuests: Joi.number().min(1).allow('', null).optional(),
      extraGuestFee: Joi.number().min(0).allow('', null).optional(),
      seasonalPricing: Joi.alternatives().try(
        Joi.array().items(
          Joi.object({
            name: Joi.string().allow('', null).optional(),
            startDate: Joi.date().allow('', null).optional(),
            endDate: Joi.date().allow('', null).optional(),
            price: Joi.number().min(0).allow('', null).optional()
          })
        ),
        Joi.object()
      ).optional(),
      holidayPricing: Joi.alternatives().try(
        Joi.array().items(
          Joi.object({
            name: Joi.string().allow('', null).optional(),
            startDate: Joi.date().allow('', null).optional(),
            endDate: Joi.date().allow('', null).optional(),
            price: Joi.number().min(0).allow('', null).optional()
          })
        ),
        Joi.object()
      ).optional(),
    }).optional(),
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
    guests: Joi.number().min(1).max(20).optional(),
    totalPrice: Joi.number().optional(),
  }).required()
});

