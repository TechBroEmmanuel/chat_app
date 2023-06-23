const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const User = require("./models/User")
const jwt = require("jsonwebtoken");
const cors = require("cors")
const cookieParser =  require('cookie-parser')


dotenv.config();
console.log(process.env.MONGO_URL)
mongoose.connect(process.env.MONGO_URL);
const jwtSecret = process.env.JWT_SECRET;

const app = express();
app.use(express.json())
app.use(cookieParser())
const corsOptions = {
    origin: "http://localhost:3000", 
    credentials: true
}

app.use(cors(corsOptions))

app.get('/test', (req, res) => {
    res.json('test ok');
})

app.get('/profile', (req, res) => {
    const token = req.cookies?.token;
    if (token) {
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
            if (err) throw err;
            res.json({ userData });
        })
    } else {
        res.status(401).json('no token found')
    }
   
})

app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    try {
        const createdUser = await User.create({ username, password });
        jwt.sign({ userId: createdUser._id, username }, jwtSecret, {}, (err, token) => {
            if (err) throw err;
            res.cookie('token', token, {sameSite:'none', secure:true}).status(201).json({
                id: createdUser._id,
            });
        });
    } catch (err) {
        if (err.status === 11000) {
            // Duplicate key error
            res.status(409).json("Username already exists");
        } else {
            res.status(500).json("Error registering user");
        }
    }
});


app.listen(4000);

//  