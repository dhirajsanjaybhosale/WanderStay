const express = require("express");
const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

main()
  .then(() => console.log("connected to DB"))
  .catch((err) => console.log(err));

async function main() {
  await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
  await Listing.deleteMany({});

  const formattedData = initData.map((obj) => {
    const url = obj.image.url;
    const filename = url
      .substring(url.lastIndexOf("/") + 1)
      .split("?")[0];

    return {
      ...obj,
      image: {
        url,
        filename,
      },
      owner: "68da8a200859f634a071fdf6",
    };
  });

  await Listing.insertMany(formattedData);
  console.log("data was initialized");
};

initDB();
