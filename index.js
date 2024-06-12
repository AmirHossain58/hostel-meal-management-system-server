const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId, serialize } = require('mongodb')
const jwt = require('jsonwebtoken')

const port = process.env.PORT || 8000
// 



// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())



// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log(token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4j3msur.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    // strict: true,
    deprecationErrors: true,
  },
})


async function run() {
  try {
    const mealsCollection=client.db('HostelManagementDb').collection('meals')
    const bookingsCollection=client.db('HostelManagementDb').collection('bookings')
    const usersCollection=client.db('HostelManagementDb').collection('users')
    const requestsCollection=client.db('HostelManagementDb').collection('requests')
    const upcomingMealsCollection=client.db('HostelManagementDb').collection('upcomingMeals')
    await mealsCollection.createIndex({
      category: 'text',
      title: 'text',
      description: 'text',
      'admin.name': 'text',
      'reviews.reviewer': 'text',
      'reviews.comment': 'text'
    });
    console.log("Indexes created successfully");
    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })


    
    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })
    // get all the meals from db
    app.get('/meals',async(req,res)=>{
      const {category,sortLikes,sortReviews}=req.query
      const query={
      }
      if(category && category!=='null'&&category!=='All Meals'&&category!=='undefined')query.category=category
      let options = {}
      if (sortLikes) options = { sort: { like: sortLikes === 'asc' ? 1 : -1 } }
      if (sortReviews) options = { sort: { reviewCount: sortReviews === 'asc' ? 1 : -1 } }
      const result=await mealsCollection.find(query,options).toArray()
      res.send(result) 
    }) 
    // get all the upcoming Meals from db
    app.get('/upcoming-meals',async(req,res)=>{
      const {sortLikes}=req.query
      console.log(sortLikes);
      const query={
      }
      let options = {}
      if (sortLikes) options = { sort: { like: sortLikes === 'asc' ? 1 : -1 } }
      const result=await upcomingMealsCollection.find(query,options).toArray()
      res.send(result) 
    }) 
     // get a upcoming Meals from db
    app.get('/upcoming-meals/:id',async(req,res)=>{
      const id=req.params.id
      console.log(id);
      const query={_id:new ObjectId(id)}
      const result=await upcomingMealsCollection.findOne(query)
      res.send(result) 
    }) 
     // save a upcoming-meals
     app.post('/upcoming-meals',async(req,res)=>{
      const mealData=req.body
      result= await upcomingMealsCollection.insertOne(mealData)
      res.send(result) 
    })
    app.delete('/meals/:id',async(req,res)=>{
      const id=req.params.id
      console.log(id); 
      const query={_id:new ObjectId(id)}
      const result=await mealsCollection.deleteOne(query)
      res.send(result) 
    })
    app.get('/api/meals',async (req, res) => {  
      const {category,search,minPrice, maxPrice}=req.query
          let query={
            // title: { $regex: search, $options: 'i' },
            // $text: { $search: search }
          }
          console.log(154,search);
          if(search)query={$text: { $search: search }}
          if (minPrice !== undefined && maxPrice !== undefined) {
            query.price = { $gte: parseFloat(minPrice), $lte: parseFloat(maxPrice) }; 
          }
          if(category && category!=='null'&&category!=='All Meals'&&category!=='undefined')query.category=category
      const page = 1;
      const pageSize = 10;
      const meals=await mealsCollection.find(query).toArray()
      const totalMeals = meals.length;
      const totalPages = Math.ceil(totalMeals / pageSize);

      const paginatedMeals = meals.slice((page - 1) * pageSize, page * pageSize);
      res.json({
        meals: paginatedMeals,
        nextPage: page < totalPages ? page + 1 : null,
      });
    });
    // save a meal
    app.post('/meals',async(req,res)=>{
      const mealData=req.body
      console.log(mealData);
      result= await mealsCollection.insertOne(mealData)
      res.send(result) 
    }) 
    // update A meal
    app.put('/meals/update/:id',async(req,res)=>{
      const{id}=req.params
      const meal=req.body
      const query={_id:new ObjectId(id)}
      const options = { upsert: true };
        const newReview = {
          $set: {
           ...meal
          },
        };
        const result= await mealsCollection.updateOne(query,newReview,options)
       res.send(result)
       
    })
     // delete  a requested meal  
     app.delete('/upcoming-meals/:id',async(req,res)=>{
      const {id}=req.params
      console.log(id);
      const query={_id:new ObjectId(id)}
      const result=await upcomingMealsCollection.deleteOne(query)
      res.send(result) 
    })
    // update A meal upcoming-meals
    app.put('/upcoming-meals/update/:id',async(req,res)=>{
      const{id}=req.params
      const meal=req.body
      const query={_id:new ObjectId(id)}
      const options = { upsert: true };
        const newReview = {
          $set: {
           ...meal
          },
        };
        const result= await upcomingMealsCollection.updateOne(query,newReview,options)
       res.send(result) 
      
    })

    // get a meal  from db by _id
    app.get('/meals/:id',async(req,res)=>{
      const{id}=req.params
      const query={_id:new ObjectId(id)}
      const result=await mealsCollection.findOne(query) 
      res.send(result)
    })
    // update like count api
    app.put('/meals/like/:id',async(req,res)=>{
      const{id}=req.params
      const {like}=req.body
      const query={_id:new ObjectId(id)}
      const options = { upsert: true };
        const updateDoc = {
          $set: {
           like:like,
          },
        };
        const result= await mealsCollection.updateOne(query,updateDoc,options)
       return res.send(result)
       
    })
    // update upcoming-meals like count api
    app.put('/upcoming-meals/like/:id',async(req,res)=>{
      const{id}=req.params
      const {like}=req.body
      const query={_id:new ObjectId(id)}
      const options = { upsert: true };
        const updateDoc = {
          $set: {
           like:like,
          },
        };
        const result= await upcomingMealsCollection.updateOne(query,updateDoc,options)
       return res.send(result)
       
    })
    // update review  add review 
    app.put('/meals/review/:id',async(req,res)=>{
      const{id}=req.params
      const review=req.body
      const query={_id:new ObjectId(id)}
      const options = { upsert: true };
        const newReview = {
          $push: {
            reviews:review,
          },
        };
        const result= await mealsCollection.updateOne(query,newReview,options)
       res.send(result)
      
    })
    // update upcoming-meals review count and add review 
    app.put('/upcoming-meals/review/:id',async(req,res)=>{
      const{id}=req.params
      const review=req.body
      const query={_id:new ObjectId(id)}
      const options = { upsert: true };
        const newReview = {
          $push: {
            reviews:review,
          },
        };
        const result= await upcomingMealsCollection.updateOne(query,newReview,options)
       res.send(result)
      
    })
    // add liker info 
    app.put('/upcoming-meals/likerInfo/:id',async(req,res)=>{
      const{id}=req.params
      const likesInfo=req.body
      const query={_id:new ObjectId(id)}
      const options = { upsert: true };
        const newLikesInfo = {
          $push: {
            likesInfo:likesInfo,
          },
        };
        const result= await upcomingMealsCollection.updateOne(query,newLikesInfo,options)
       res.send(result)
      
    })
    //  create-payment-intent
    app.post('/create-payment-intent',async(req,res)=>{
    const {price}=req.body 
    const priceInCent = parseInt(price) * 100
    if (!price || priceInCent < 1) return
    // generate clientSecret
    const { client_secret } = await stripe.paymentIntents.create({
      amount: priceInCent,
      currency: 'usd',
      // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
      automatic_payment_methods: {
        enabled: true,
      },
    })
    // send client secret as response
    res.send({ clientSecret: client_secret })
    })
      // Save a booking data in db
      app.post('/booking', async (req, res) => {
        const bookingData = req.body
        // save room booking info
        const result = await bookingsCollection.insertOne(bookingData)
        // send email to guest
        // sendEmail(bookingData?.guest?.email, {
        //   subject: 'Booking Successful!',
        //   message: `You've successfully booked a room through StayVista. Transaction Id: ${bookingData.transactionId}`,
        // })
        // send email to host
        // sendEmail(bookingData?.host?.email, {
        //   subject: 'Your room got booked!',
        //   message: `Get ready to welcome ${bookingData.guest.name}.`,
        // })
  
        res.send(result)
      })
      // get all requested meal by user email from db
      app.get('/requested-meals/:email',async(req,res)=>{
        const {email}=req.params
        const query={requesterEmail:email}
        const result=await requestsCollection.find(query).toArray()
        res.send(result)  
      }) 
      // get all requested from db
      app.get('/requested-meals',async(req,res)=>{
        const{search}=req.query
        const query={
          $or: [
            { requesterEmail: { $regex: search, $options: 'i' } }, // Search by email
            { requesterName: { $regex: search, $options: 'i' } }     // Search by name
          ]
          // requesterEmail: { $regex: search, $options: 'i' },
          // requesterName: { $regex: search, $options: 'i' },
        }
        const result=await requestsCollection.find(query).toArray()
        res.send(result)  
      }) 
      // change meal stats 
      app.put('/requested-meals/:id',async(req,res)=>{
        const{id}=req.params
        const status=req.body
        const query={_id:new ObjectId(id)}
          const newReview = {
            $set: {
             ...status
            },
          };
          const result= await requestsCollection.updateOne(query,newReview)
         res.send(result)
        
      })
      // admin meals added count 
      app.get('/meals-added/:email',async(req,res)=>{
        const {email}=req.params
        const query={'admin.email':email}
        const result=await mealsCollection.find(query).toArray()
        res.send(result)   
      }) 
      // delete  a requested meal  
      app.delete('/requested-meals/:id',async(req,res)=>{
        const {id}=req.params
        const query={_id:new ObjectId(id)}
        const result=await requestsCollection.deleteOne(query)
        res.send(result) 
      })  
      // get all reviews by user email from db
      app.get('/reviews/:email',async(req,res)=>{ 
        const {email}=req.params
        const query={'reviews.email':email}
        const pipeline = [
          { $unwind: "$reviews" }, // Unwind the reviews array
          { $match: { "reviews.email": email } }, // Match the reviews with the given email
          { $project: { _id: 0, review: "$reviews" ,title:'$title',like:'$like',image:'$image',mealId:'$_id'} }
        ]
        const result=await mealsCollection.aggregate(pipeline).toArray()
        res.send(result) 
      }) 
      // get all reviews for admin from db
      app.get('/reviews',async(req,res)=>{ 
        const pipeline = [
          { $unwind: "$reviews" }, // Unwind the reviews array
          { $project: { _id: 0, review: "$reviews" ,title:'$title',like:'$like',image:'$image',mealId:'$_id',reviewCount:'$reviewCount'} }
        ]
        const result=await mealsCollection.aggregate(pipeline).toArray()
        res.send(result) 
      }) 
      // delete  a review  
      app.put('/meals-review/:id',async(req,res)=>{
        const{id}=req.params
      const {reviewId}=req.body
      console.log(id,reviewId); 
      const query={_id:new ObjectId(id)}
        const deleteReview = { 
          $pull: {
            reviews: {"reviewId":reviewId } 
          },
        };
        const result=await mealsCollection.updateOne(query,deleteReview)
        res.send(result)   
      })  
      // edit a review
      app.put('/meals-review-edit/:id',async(req,res)=>{
        const{id}=req.params
      const {reviewId,comment,rating}=req.body
      const query={_id:new ObjectId(id),'reviews.reviewId':reviewId}
        const editReview = {
           $set: { "reviews.$.rating": rating, "reviews.$.comment": comment } 
          }
        const result=await mealsCollection.updateOne(query,editReview)
        res.send(result)   
      })  

      // Meal-request requester data save in db 
      app.post('/Meal-request', async (req, res) => {
        const requestData = req.body 
        // save room booking info
        const result = await requestsCollection.insertOne(requestData)
        // send email to guest
        // sendEmail(bookingData?.guest?.email, {
        //   subject: 'Booking Successful!',
        //   message: `You've successfully booked a room through StayVista. Transaction Id: ${bookingData.transactionId}`,
        // })
        // send email to host
        // sendEmail(bookingData?.host?.email, {
        //   subject: 'Your room got booked!',
        //   message: `Get ready to welcome ${bookingData.guest.name}.`,
        // })
        res.send(result)
      }) 
      app.get('/booking/:email',async(req,res)=>{
        const {email}=req.params
        const query={email:email}
        const result=await bookingsCollection.findOne(query)
        res.send(result)
      })
      // get payments history form db by user email
      app.get('/payments/:email',async(req,res)=>{
        const {email}=req.params
        console.log(email);
        const query={email:email}
        const result=await bookingsCollection.find(query).toArray()
        res.send(result)
      })
      // save a user data in db
    app.put('/user', async (req, res) => {
      const user = req.body
      console.log(user);
      const query = { email: user?.email }
      // check if user already exists in db
      const isExist = await usersCollection.findOne(query)
      if (isExist) {
        if (user?.badge === 'Silver' ||user?.badge ==='Gold'||user?.badge ==='Platinum') {
          console.log(434,user?.badge);
          // if existing user try to change his role
          const result = await usersCollection.updateOne(query, {
            $set: { badge: user?.badge },
          })
          return res.send(result)
        } else { 
          // if existing user login again
          return res.send(isExist)
        }
      }

      // save user for the first time
      const options = { upsert: true }
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      }
      const result = await usersCollection.updateOne(query, updateDoc, options)
      // welcome new user
      // sendEmail(user?.email, {
      //   subject: 'Welcome to Stayvista!',
      //   message: `Hope you will find you destination`,
      // })
      res.send(result)
    })

    // get a user info by email from db
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email
      const result = await usersCollection.findOne({ email })
      res.send(result)
    })

    // get all users data from db
    app.get('/users', verifyToken, async (req, res) => {
      const {search}=req.query
      console.log(search);
      const query={
        $or: [
          { name: { $regex: search, $options: 'i' } }, // Search by username
          { email: { $regex: search, $options: 'i' } }     // Search by email
        ]
      }
      const result = await usersCollection.find(query).toArray()
      res.send(result)
    })
      //update a user role
      app.patch('/users/update/:email', async (req, res) => {
        const email = req.params.email
        const user = req.body
        const query = { email }
        const updateDoc = {
          $set: { ...user, timestamp: Date.now() },
        }
        const result = await usersCollection.updateOne(query, updateDoc)
        res.send(result)
      })
    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from Hostel Management System Server..')
})

app.listen(port, () => {
  console.log(`Hostel Management System is running on port ${port}`)
})