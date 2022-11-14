import express from "express";
import {MongoClient} from "mongodb";
import dotenv from "dotenv";
import joi from 'joi'
import dayjs from "dayjs"

dotenv.config();
const app = express();
app.use(express.json());
const mongoClient = new MongoClient(process.env.MONGO_URI)
const now = dayjs().locale("pt-br").format("HH:mm:ss");

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
        await db.collection('messages').insertOne({from: req.body.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: now})
        res.sendStatus(201);

    }   catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
})

app.post('/messages', async(req, res) => {
    try{
        const validation = messageSchema.validate(req.body)
        if(validation.error){
            const errors = validation.error.details.map(detail => detail.message);
            res.send(errors).status(422);
            return;
        }
        await db.collection('messages').insertOne({from: req.headers.name, to:req.body.to, text:req.body.text, type:req.body.type, time: now})
        console.log(req.headers)
        res.sendStatus(201);
    } catch (err) {
        console.log(err);
        res.sendStatus(422);
    }
})

app.get('/messages', async(req, res) => {
    try{
        const allMessages = await db.collection('messages').find().toArray();
        res.send(allMessages).status(201)
    } catch (err) {
        console.log(err);
        res.sendStatus(422);
    }
})




app.listen(5000, () => console.log("Server running at port 5000"))