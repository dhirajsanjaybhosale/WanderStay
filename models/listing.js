const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");
const user = require("./user.js")

const listingSchema = new Schema({
  title: { 
    type: String,
    // optional, but recommended
  },
  description: { 
    type: String,
   
  },
  image: {
  url: String,
  filename: String,
},


  price:  Number,
    

  location: { 
    type: String,
   
  },
  country: { 
    type: String,
    
  },
   // Category 
  category: {
        type: String,
        enum: [
            'Beach',
            'City',
            'Mountain',
            'Lake',
            'Ski',
            'Desert',
            'Cabin',
            'Villa',
        ],
        required: true,
    },
  reviews :[
    {
      type:Schema.Types.ObjectId,
      ref:"Review",
    },
  ],
  owner:{
    type:Schema.Types.ObjectId,
    ref:"User",
  },
  geometry:{
    type:{
      type:String,
      enum:["Point"],
      required:true,
    },
    coordinates:{
      type:[Number],
      required:true,
    }
  },
  
});



listingSchema.post("findOneAndDelete",async (listing) =>{
  if (listing) {
    await Review.deleteMany({_id: {$in: listing.reviews}})
  }
});


const Listing = mongoose.models.Listing || mongoose.model("Listing", listingSchema);
module.exports = Listing;
