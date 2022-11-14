import express from "express";
import {MongoClient, ObjectId} from "mongodb";
import dotenv from "dotenv";
import joi from 'joi'
import dayjs from "dayjs"
import cors from "cors";


dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());
const mongoClient = new MongoClient(process.env.MONGO_URI)

const participantSchema = joi.object({
    name:joi.string().required(),
    lastStatus: joi.number()
});

const messageSchema = joi.object({
    from: joi.string(),
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("private_message", "message").required(),
    time: joi.string()}
)


let db;

mongoClient.connect().then(() => {
    db = mongoClient.db("uolInfo")
}).catch( err => console.log(err))


app.get("/participants", async (req, res) => {
    try{
        const user = await db.collection('participants').find().toArray()
        res.send(user).status(200)
    }
    catch (err){
        console.log(err);
        res.sendStatus(500);
    }

})

app.post('/participants', async(req, res) => {
    try{
        const validation = participantSchema.validate(req.body);
        if(validation.error){
            const errors = validation.error.details.map(detail => detail.message);
            res.send(errors).status(422);
            return;
        }
        const userExists = await db.collection('participants').find({name: req.body.name}).toArray()
        if(userExists.length !== 0){
            console.log("Usuario já existe")
            console.log(userExists)
            res.sendStatus(409)
            return;
        }

        await db.collection('participants').insertOne({name: req.body.name, lastStatus: Date.now()});
        await db.collection('messages').insertOne({from: req.body.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().locale("pt-br").format("HH:mm:ss")})
        res.sendStatus(201);

    }   catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
})

app.post('/messages', async(req, res) => {
    try{
        const validation = messageSchema.validate(req.body);
        if(validation.error){
            const errors = validation.error.details.map(detail => detail.message);
            res.send(errors).status(422);
            return;
        }
        const userAvailable = await db.collection('participants').find({name: req.headers.user}).toArray();
        if(userAvailable.length === 0){
            console.log(userAvailable)
            res.sendStatus(422);
            return;
        }
        await db.collection('messages').insertOne({from: req.headers.user, to:req.body.to, text:req.body.text, type:req.body.type, time: dayjs().locale("pt-br").format("HH:mm:ss")});
        res.sendStatus(201);
    } catch (err) {
        console.log(err);
        res.sendStatus(422);
    }
})

app.get('/messages', async(req, res) => {
    try{
        if(req.query.limit){
            const allMessages = await db.collection('messages').find({$or: [{from: req.headers.user}, {to: req.headers.user}, {type: "message"}, {type: "status"}]}).limit(Number(req.query.limit)).toArray();
        res.send(allMessages).status(201);
        return;
        }
        const allMessages = await db.collection('messages').find({$or: [{from: req.headers.user}, {to: req.headers.user}, {type: "message"}, {type: "status"}]}).toArray();
        res.send(allMessages).status(201);
    } catch (err) {
        console.log(err);
        res.sendStatus(422);
    }
})

app.post('/status', async(req, res) => {
    try{
        const participantExists = await db.collection('participants').find({name:req.headers.user}).toArray();
        if(participantExists.length !== 0){
            await db.collection('participants').update({name: req.headers.user}, {$set:{lastStatus:Date.now()}});
            res.sendStatus(200);
            return;
        }
        res.sendStatus(404);
        return;
    }catch(err) {
        console.log(err);
        res.sendStatus(422);
    }
})

async function userOnline(){
    const timeNow = Date.now();
    const users = await db.collection('participants').find().toArray();
    users.map((user) => {
        if(timeNow - user.lastStatus >10000){
            db.collection('participants').deleteOne({_id: ObjectId(user._id)});
            db.collection('messages').insertOne({
                from: user.name,
                to: "Todos",
                text: "sai da sala...",
                type: "status",
                time: dayjs().locale("pt-br").format("HH:mm:ss"),
              });
        }
    });
    

}

setInterval(userOnline, 15000);

app.listen(5000, () => console.log("Server running at port 5000"));