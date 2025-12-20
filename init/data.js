const sampleListings = [
  {
    title: "Cozy Beachfront Cottage",
    description:
      "Escape to this charming beachfront cottage for a relaxing getaway with stunning ocean views.",
    image: {
      url: "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b",
      filename: "listingimage",
    },
    price: 1500,
    location: "Malibu",
    country: "United States",
    category: "Beach",
    geometry: {
      type: "Point",
      coordinates: [-118.7798, 34.0259],
    },
  },

  {
    title: "Modern Loft in Downtown",
    description:
      "Stylish loft apartment located in the heart of the city, perfect for urban explorers.",
    image: {
      url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
      filename: "listingimage",
    },
    price: 1200,
    location: "New York City",
    country: "United States",
    category: "City",
    geometry: {
      type: "Point",
      coordinates: [-74.006, 40.7128],
    },
  },

  {
    title: "Mountain Retreat",
    description:
      "Peaceful mountain cabin surrounded by nature, ideal for relaxation and recharging.",
    image: {
      url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d",
      filename: "listingimage",
    },
    price: 1000,
    location: "Aspen",
    country: "United States",
    category: "Mountain",
    geometry: {
      type: "Point",
      coordinates: [-106.8236, 39.1911],
    },
  },

  {
    title: "Historic Villa in Tuscany",
    description:
      "Beautifully restored villa in Tuscany with scenic views of vineyards and rolling hills.",
    image: {
      url: "https://images.unsplash.com/photo-1566073771259-6a8506099945",
      filename: "listingimage",
    },
    price: 2500,
    location: "Florence",
    country: "Italy",
    category: "Villa",
    geometry: {
      type: "Point",
      coordinates: [11.2558, 43.7696],
    },
  },

  {
    title: "Secluded Treehouse Getaway",
    description:
      "Unique treehouse retreat offering peace, privacy, and a true connection with nature.",
    image: {
      url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4",
      filename: "listingimage",
    },
    price: 800,
    location: "Portland",
    country: "United States",
    category: "Cabin",
    geometry: {
      type: "Point",
      coordinates: [-122.6765, 45.5231],
    },
  },

  {
    title: "Beachfront Paradise",
    description:
      "Luxury beachfront condo with direct access to white sandy beaches.",
    image: {
      url: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9",
      filename: "listingimage",
    },
    price: 2000,
    location: "Cancun",
    country: "Mexico",
    category: "Beach",
    geometry: {
      type: "Point",
      coordinates: [-86.8515, 21.1619],
    },
  },

  {
    title: "Rustic Cabin by the Lake",
    description:
      "Cozy cabin located beside a serene lake, perfect for fishing and kayaking.",
    image: {
      url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
      filename: "listingimage",
    },
    price: 900,
    location: "Lake Tahoe",
    country: "United States",
    category: "Lake",
    geometry: {
      type: "Point",
      coordinates: [-119.9772, 38.9399],
    },
  },

  {
    title: "Luxury Penthouse with City Views",
    description:
      "Elegant penthouse offering breathtaking panoramic views of the city skyline.",
    image: {
      url: "https://images.unsplash.com/photo-1622396481328-9b1b78cdd9fd",
      filename: "listingimage",
    },
    price: 3500,
    location: "Los Angeles",
    country: "United States",
    category: "City",
    geometry: {
      type: "Point",
      coordinates: [-118.2437, 34.0522],
    },
  },

  {
    title: "Ski-In/Ski-Out Chalet",
    description:
      "Chalet located directly on the slopes, perfect for ski lovers.",
    image: {
      url: "https://images.unsplash.com/photo-1502784444187-359ac186c5bb",
      filename: "listingimage",
    },
    price: 3000,
    location: "Verbier",
    country: "Switzerland",
    category: "Ski",
    geometry: {
      type: "Point",
      coordinates: [7.2285, 46.096],
    },
  },

  {
    title: "Safari Lodge in Serengeti",
    description:
      "Comfortable safari lodge offering unforgettable wildlife experiences.",
    image: {
      url: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e",
      filename: "listingimage",
    },
    price: 4000,
    location: "Serengeti National Park",
    country: "Tanzania",
    category: "Cabin",
    geometry: {
      type: "Point",
      coordinates: [34.8233, -2.3333],
    },
  },

  {
    title: "Historic Canal House",
    description:
      "Stay in a beautifully preserved canal house in the heart of Amsterdam.",
    image: {
      url: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4",
      filename: "listingimage",
    },
    price: 1800,
    location: "Amsterdam",
    country: "Netherlands",
    category: "City",
    geometry: {
      type: "Point",
      coordinates: [4.9041, 52.3676],
    },
  },

  {
    title: "Private Island Retreat",
    description:
      "Exclusive private island offering ultimate luxury and privacy.",
    image: {
      url: "https://images.unsplash.com/photo-1618140052121-39fc6db33972",
      filename: "listingimage",
    },
    price: 10000,
    location: "Fiji",
    country: "Fiji",
    category: "Beach",
    geometry: {
      type: "Point",
      coordinates: [178.4501, -18.1248],
    },
  },

  {
    title: "Charming Cottage in Cotswolds",
    description:
      "Quaint countryside cottage with classic English charm.",
    image: {
      url: "https://images.unsplash.com/photo-1602088113235-229c19758e9f",
      filename: "listingimage",
    },
    price: 1200,
    location: "Cotswolds",
    country: "United Kingdom",
    category: "Cabin",
    geometry: {
      type: "Point",
      coordinates: [-1.8433, 51.8433],
    },
  },

  {
    title: "Beachfront Bungalow in Bali",
    description:
      "Relax in a beautiful beachfront bungalow with tropical vibes.",
    image: {
      url: "https://images.unsplash.com/photo-1602391833977-358a52198938",
      filename: "listingimage",
    },
    price: 1800,
    location: "Bali",
    country: "Indonesia",
    category: "Beach",
    geometry: {
      type: "Point",
      coordinates: [115.1889, -8.4095],
    },
  },

  {
    title: "Mountain View Cabin in Banff",
    description:
      "Cozy cabin with breathtaking views of the Canadian Rockies.",
    image: {
      url: "https://images.unsplash.com/photo-1521401830884-6c03c1c87ebb",
      filename: "listingimage",
    },
    price: 1500,
    location: "Banff",
    country: "Canada",
    category: "Mountain",
    geometry: {
      type: "Point",
      coordinates: [-115.5708, 51.1784],
    },
  },

  {
    title: "Art Deco Apartment in Miami",
    description:
      "Stylish Art Deco apartment located near Miami Beach.",
    image: {
      url: "https://plus.unsplash.com/premium_photo-1670963964797-942df1804579",
      filename: "listingimage",
    },
    price: 1600,
    location: "Miami",
    country: "United States",
    category: "City",
    geometry: {
      type: "Point",
      coordinates: [-80.1918, 25.7617],
    },
  },

  {
    title: "Tropical Villa in Phuket",
    description:
      "Luxury tropical villa with private infinity pool.",
    image: {
      url: "https://images.unsplash.com/photo-1470165301023-58dab8118cc9",
      filename: "listingimage",
    },
    price: 3000,
    location: "Phuket",
    country: "Thailand",
    category: "Villa",
    geometry: {
      type: "Point",
      coordinates: [98.3394, 7.8804],
    },
  },

  {
    title: "Historic Castle in Scotland",
    description:
      "Live like royalty in this historic castle in the Scottish Highlands.",
    image: {
      url: "https://images.unsplash.com/photo-1585543805890-6051f7829f98",
      filename: "listingimage",
    },
    price: 4000,
    location: "Scottish Highlands",
    country: "United Kingdom",
    category: "Villa",
    geometry: {
      type: "Point",
      coordinates: [-4.2247, 57.4778],
    },
  },

  {
    title: "Desert Oasis in Dubai",
    description:
      "Luxury desert retreat with a private pool and stunning views.",
    image: {
      url: "https://images.unsplash.com/photo-1518684079-3c830dcef090",
      filename: "listingimage",
    },
    price: 5000,
    location: "Dubai",
    country: "United Arab Emirates",
    category: "Desert",
    geometry: {
      type: "Point",
      coordinates: [55.2708, 25.2048],
    },
  },

  {
    title: "Lakefront Cabin in New Hampshire",
    description:
      "Peaceful lakefront cabin surrounded by scenic mountains.",
    image: {
      url: "https://images.unsplash.com/photo-1578645510447-e20b4311e3ce",
      filename: "listingimage",
    },
    price: 1200,
    location: "New Hampshire",
    country: "United States",
    category: "Lake",
    geometry: {
      type: "Point",
      coordinates: [-71.5376, 43.2081],
    },
  },
];

module.exports = sampleListings;
