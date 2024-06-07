const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
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
    strict: true,
    deprecationErrors: true,
  },
})


async function run() {
  try {
    const mealsCollection=client.db('HostelManagementDb').collection('meals')
    const bookingsCollection=client.db('HostelManagementDb').collection('bookings')
    const usersCollection=client.db('HostelManagementDb').collection('users')
    const requestsCollection=client.db('HostelManagementDb').collection('requests')
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
      const {category,}=req.query
      const query={
      }
      if(category && category!=='null'&&category!=='All Meals'&&category!=='undefined')query.category=category
    
      const result=await mealsCollection.find(query).toArray()
      res.send(result) 
    })
app.get('/api/meals',async (req, res) => {  
  const {category,search,minPrice, maxPrice}=req.query
      const query={
        title: { $regex: search, $options: 'i' },
      }
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
    // update review count and add review api
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
        const result=await bookingsCollection.findOne(query,)
        res.send(result)
      })
      // save a user data in db
    app.put('/user', async (req, res) => {
      const user = req.body
      const query = { email: user?.email }
      // check if user already exists in db
      const isExist = await usersCollection.findOne(query)
      if (isExist) {
        if (user.badge === 'Silver'||'Gold'||'Platinum') {
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
      const result = await usersCollection.find().toArray()
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