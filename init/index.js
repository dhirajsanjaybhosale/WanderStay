const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");
const User = require("../models/user.js");

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/wanderstays";

async function main() {
  await mongoose.connect(MONGO_URL);
  console.log("✅ Connected to DB for initialization");
  await initDB();
  await mongoose.disconnect();
  console.log("✅ Database initialization complete");
}

const demoHosts = [
  {
    username: "wander_host",
    email: "host@wanderstay.com",
    firstName: "Alex",
    lastName: "Morgan",
    role: "host",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
    bio: "Coastal living enthusiast and superhost for 4+ years. Passionate about beachfront villas and seaside stays.",
    categories: ["Beach"]
  },
  {
    username: "marcus_stays",
    email: "marcus@wanderstay.com",
    firstName: "Marcus",
    lastName: "Vance",
    role: "host",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
    bio: "Architect & modern loft designer. Curating premium urban spaces in vibrant city centers worldwide.",
    categories: ["City"]
  },
  {
    username: "elena_villas",
    email: "elena@wanderstay.com",
    firstName: "Elena",
    lastName: "Rostova",
    role: "host",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80",
    bio: "Curator of historic estates, Tuscan villas, and romantic castles. Passionate about architecture and fine dining.",
    categories: ["Villa"]
  },
  {
    username: "sophia_luxury",
    email: "sophia@wanderstay.com",
    firstName: "Sophia",
    lastName: "Laurent",
    role: "host",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=300&q=80",
    bio: "Luxury alpine travel specialist managing high-end ski chalets and scenic mountain sanctuaries.",
    categories: ["Mountain", "Ski"]
  },
  {
    username: "liam_escapes",
    email: "liam@wanderstay.com",
    firstName: "Liam",
    lastName: "Chen",
    role: "host",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80",
    bio: "Sustainable eco-designer offering secluded treehouses, forest cabins, and peaceful lakefront cottages.",
    categories: ["Cabin", "Lake"]
  },
  {
    username: "maya_retreats",
    email: "maya@wanderstay.com",
    firstName: "Maya",
    lastName: "Patel",
    role: "host",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80",
    bio: "Wildlife and wellness retreat host providing unforgettable safari lodges, desert sanctuaries, and tranquil escapes.",
    categories: ["Desert"]
  }
];

const demoAdmin = {
  username: "wander_admin",
  email: "admin@wanderstay.com",
  firstName: "Platform",
  lastName: "Admin",
  role: "admin",
  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80",
  bio: "WanderStay platform administrator."
};

const initDB = async () => {
  await Listing.deleteMany({});

  // Ensure Admin user exists
  let adminUser = await User.findOne({ username: demoAdmin.username });
  if (!adminUser) {
    adminUser = new User({
      username: demoAdmin.username,
      email: demoAdmin.email,
      firstName: demoAdmin.firstName,
      lastName: demoAdmin.lastName,
      role: demoAdmin.role,
      avatar: demoAdmin.avatar,
      bio: demoAdmin.bio,
    });
    await adminUser.setPassword("password123");
    await adminUser.save();
    console.log("✅ Demo admin user created: wander_admin / password123");
  } else {
    adminUser.role = "admin";
    if (demoAdmin.avatar) adminUser.avatar = demoAdmin.avatar;
    await adminUser.save();
  }

  // Ensure all demo hosts exist
  const createdHosts = [];
  for (const hostInfo of demoHosts) {
    let host = await User.findOne({ username: hostInfo.username });
    if (!host) {
      host = new User({
        username: hostInfo.username,
        email: hostInfo.email,
        firstName: hostInfo.firstName,
        lastName: hostInfo.lastName,
        role: "host",
        avatar: hostInfo.avatar,
        bio: hostInfo.bio,
      });
      await host.setPassword("password123");
      await host.save();
      console.log(`✅ Demo host created: ${host.username} (${host.firstName} ${host.lastName}) / password123`);
    } else {
      host.role = "host";
      host.firstName = hostInfo.firstName;
      host.lastName = hostInfo.lastName;
      host.avatar = hostInfo.avatar;
      host.bio = hostInfo.bio;
      await host.save();
      console.log(`✅ Updated existing host: ${host.username}`);
    }
    createdHosts.push({ doc: host, categories: hostInfo.categories });
  }

  // Also upgrade user "Dhiraj" to host if present
  const dhirajUser = await User.findOne({ username: "Dhiraj" });
  if (dhirajUser) {
    dhirajUser.role = "host";
    await dhirajUser.save();
    console.log("✅ Upgraded user Dhiraj to host");
  }

  // Distribute listings among hosts based on category or round-robin
  const formattedData = initData.map((obj, index) => {
    const url = (obj.image && obj.image.url) ? obj.image.url : obj.image;
    const filename = typeof url === 'string'
      ? (url.substring(url.lastIndexOf("/") + 1).split("?")[0] || "listingimage")
      : "listingimage";

    // Match host by category first, fallback to round-robin
    const matchedHost = createdHosts.find((h) => h.categories.includes(obj.category));
    const assignedHost = matchedHost ? matchedHost.doc : createdHosts[index % createdHosts.length].doc;

    return {
      ...obj,
      image: {
        url,
        filename,
      },
      photos: [
        { url, filename }
      ],
      owner: assignedHost._id,
      averageRating: Number((4.6 + (index % 4) * 0.1).toFixed(1)),
      isAvailable: true,
      geometry: obj.geometry || {
        type: "Point",
        coordinates: [77.2090, 28.6139],
      }
    };
  });

  await Listing.insertMany(formattedData);
  console.log(`✅ ${formattedData.length} listings successfully initialized across ${createdHosts.length} hosts`);
};

main().catch((err) => {
  console.error("❌ Initialization error:", err);
});
