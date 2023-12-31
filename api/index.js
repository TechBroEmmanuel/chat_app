const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const User = require("./models/User")
const Message = require("./models/message")
const jwt = require("jsonwebtoken");
const cors = require("cors")
const cookieParser = require('cookie-parser')
const bcrypt = require('bcrypt');
const ws = require('ws');


dotenv.config();
console.log(process.env.MONGO_URL)
mongoose.connect(process.env.MONGO_URL);
const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10)

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
            res.json(userData);
        });
    } else {
        res.status(401).json('no token');
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const foundUser = await User.findOne({ username });
    if (foundUser) {
        const passOk = bcrypt.compareSync(password, foundUser.password);
        if (passOk) {
            jwt.sign({ userId: foundUser._id, username }, jwtSecret, {}, (err, token) => {
                res.cookie('token', token, { sameSite: 'none', secure: true }).json({
                    id: foundUser._id,
                });
            });
        }
    }
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
        const createdUser = await User.create({
            username: username,
            password: hashedPassword,
        });
        jwt.sign({ userId: createdUser._id, username }, jwtSecret, {}, (err, token) => {
            if (err) throw err;
            res.cookie('token', token, { sameSite: 'none', secure: true }).status(201).json({
                id: createdUser._id,
            });
        });
    } catch (err) {
        if (err) throw err;
        res.status(500).json('error');
    }
});


const server = app.listen(4000);
const wss = new ws.WebSocket.Server({ server })
wss.on('connection', (connection, req) => { 
    //read username  and id from the cookie for this connection
    const cookies = req.headers.cookie;
    if (cookies) {
        //split it cos there can be several cookies
        const tokenCookieString = cookies.split(';').find(str => str.startsWith('token='));
        if (tokenCookieString) {
            //grab only the token and leave out token=
            const token = tokenCookieString.split('=')[1];
            if (token) {
                jwt.verify(token, jwtSecret, {}, (err, userData) => { 
                    if (err) throw err;
                    const { userId, username } = userData;
                    connection.userId = userId;
                    connection.username = username;
                });
            }
        }
    }

    // receive & send mesage
    connection.on('message', async (message) => {
        const messageData = JSON.parse(message.toString());
        const { recipient, text } = messageData;
        if (recipient, text) {
          const messageDoc =  await Message.create({
                sender: connection.userId,
                recipient,
                text,
            });

            [...wss.clients].filter(c => c.userId === recipient).forEach( c => c.send(JSON.stringify({text, sender: connection.userId, id: messageDoc._id})))
        }
    });

    // notify everyone about who is online when someone connects
    [...wss.clients].forEach(client => {
        client.send(JSON.stringify({
         online: [...wss.clients].map(c => ({ userId: c.userId, username: c.username }))
             
        }
        ))
    })
});