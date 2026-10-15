/**
 * WanderStay Amenities Catalog & Helper Utilities
 * Provides standardized amenity definitions, icons, categories, and lookup functions.
 */

const ALL_AMENITIES = [
  {
    id: 'wifi',
    name: 'Wi-Fi',
    icon: 'fa-solid fa-wifi',
    category: 'Essentials',
    description: 'Fast wireless internet access throughout the property'
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    icon: 'fa-solid fa-kitchen-set',
    category: 'Essentials',
    description: 'Fully equipped space where guests can prepare meals'
  },
  {
    id: 'pool',
    name: 'Pool',
    icon: 'fa-solid fa-water-ladder',
    category: 'Features',
    description: 'Private or shared swimming pool for relaxation'
  },
  {
    id: 'parking',
    name: 'Parking',
    icon: 'fa-solid fa-square-parking',
    category: 'Facilities',
    description: 'Free dedicated vehicle parking on premises'
  },
  {
    id: 'air-conditioning',
    name: 'Air Conditioning',
    icon: 'fa-solid fa-snowflake',
    category: 'Comfort',
    description: 'Climate-controlled cooling for warm days'
  },
  {
    id: 'tv',
    name: 'TV',
    icon: 'fa-solid fa-tv',
    category: 'Essentials',
    description: 'High-definition television with entertainment options'
  },
  {
    id: 'washer',
    name: 'Washer',
    icon: 'fa-solid fa-soap',
    category: 'Facilities',
    description: 'In-unit washing machine available for guest laundry'
  },
  {
    id: 'workspace',
    name: 'Workspace',
    icon: 'fa-solid fa-laptop',
    category: 'Comfort',
    description: 'Dedicated desk and comfortable chair suitable for remote work'
  },
  {
    id: 'breakfast',
    name: 'Breakfast',
    icon: 'fa-solid fa-mug-saucer',
    category: 'Dining',
    description: 'Complimentary morning breakfast provided by the host'
  },
  {
    id: 'pet-friendly',
    name: 'Pet Friendly',
    icon: 'fa-solid fa-paw',
    category: 'Features',
    description: 'Pets and assistance animals are warmly welcomed'
  },
  {
    id: 'gym',
    name: 'Gym',
    icon: 'fa-solid fa-dumbbell',
    category: 'Facilities',
    description: 'Fitness room or workout equipment on premises'
  },
  {
    id: 'hot-tub',
    name: 'Hot Tub',
    icon: 'fa-solid fa-hot-tub-person',
    category: 'Features',
    description: 'Private relaxing hot tub or bubbling jacuzzi'
  },
  {
    id: 'balcony',
    name: 'Balcony',
    icon: 'fa-solid fa-cloud-sun',
    category: 'Outdoor',
    description: 'Private outdoor balcony, patio, or scenic terrace'
  },
  {
    id: 'heating',
    name: 'Heating',
    icon: 'fa-solid fa-fire',
    category: 'Comfort',
    description: 'Central or room heating system for cooler evenings'
  }
];

// Quick name lookup map
const AMENITY_MAP = new Map();
ALL_AMENITIES.forEach(a => {
  AMENITY_MAP.set(a.name.toLowerCase(), a);
  AMENITY_MAP.set(a.id.toLowerCase(), a);
});

/**
 * Returns complete list of all standardized amenities
 */
function getAllAmenities() {
  return ALL_AMENITIES;
}

/**
 * Looks up detailed amenity metadata by name or id with graceful fallback
 */
function getAmenityDetails(nameOrId) {
  if (!nameOrId) return null;
  const key = String(nameOrId).trim().toLowerCase();
  if (AMENITY_MAP.has(key)) {
    return AMENITY_MAP.get(key);
  }
  // Fallback for custom or legacy string
  return {
    id: key.replace(/\s+/g, '-'),
    name: String(nameOrId).trim(),
    icon: 'fa-solid fa-circle-check',
    category: 'Other',
    description: 'Provided by host'
  };
}

/**
 * Groups all amenities by category
 */
function getCategorizedAmenities() {
  const categories = {};
  ALL_AMENITIES.forEach(a => {
    if (!categories[a.category]) {
      categories[a.category] = [];
    }
    categories[a.category].push(a);
  });
  return categories;
}

module.exports = {
  ALL_AMENITIES,
  getAllAmenities,
  getAmenityDetails,
  getCategorizedAmenities
};
