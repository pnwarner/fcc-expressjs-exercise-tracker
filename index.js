const express = require('express')
const app = express()
const cors = require('cors')
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
require('dotenv').config()

mongoose.connect(process.env.MONGO_URI);

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(cors())
app.use(express.static('public'))

const Schema = mongoose.Schema;
const UserExerciseSchema = new Schema({
  username: { type: String, unique: true, required: true },
  count: Number,
  log: [
    {
      description: { type: String, required: true },
      duration: { type: Number, required: true },
      date: String
    }
  ]
});

let UserExercise = mongoose.model("UserExercise", UserExerciseSchema);

const processDate = (date) => {
  if (date === "" || date === undefined) {
    return (new Date(Date.now())).toDateString();
  } else {
    const parts = date.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    const utcDate = new Date(Date.UTC(year, month, day));
    return new Date(utcDate.getTime() + utcDate.getTimezoneOffset() * 60000).toDateString();
  }
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post('/api/users', async (req, res) => {
  const { username: username } = req.body;
  let userExist = false;
  let existingUser;
  try {
    const userList = await UserExercise.find();
    userList.forEach((userObject) => {
      if (userObject.username.toLowerCase() === username.toLowerCase()) { 
        userExist = true;
        existingUser = userObject;
      }
    });
    if (!userExist) {
      const newUser = new UserExercise({username: username, count: 0, log: []});
      const record = await newUser.save();
      res.json({username: record.username, _id: record._id});
    } else {
      res.json({username: existingUser.username, _id: existingUser._id});
    }
  } catch(error) {
    res.json({error: "error"});
  }
});

app.post('/api/users/:id/exercises', async (req, res) => {
  const _id = req.params.id;
  const {description: description, duration: duration, date: date } = req.body;
  let newDate = processDate(date);
  try {
    let user = await UserExercise.findOne({_id: _id});
    let log = user.log;
    log.push({description: description, duration: duration, date: newDate});
    let recordCount = log.length;
    let updatedUser = await UserExercise.findOneAndUpdate({ _id: _id }, { $set: { count: recordCount, log: log }}, { new: true });
    res.json({
      username: updatedUser.username,
      description: updatedUser.log[updatedUser.count -1].description,
      duration: updatedUser.log[updatedUser.count -1].duration,
      date: updatedUser.log[updatedUser.count -1].date,
      _id: _id
    });
  } catch(error) {
    res.json({error: "error"});
  }
});

app.get('/api/users', async (req, res) => {
  const returnList = [];
  const userList = await UserExercise.find();
  userList.forEach((userObj) => {
    tempObj = {
      username: userObj.username,
      _id: userObj._id
    };
    returnList.push(tempObj);
  })
  res.json(returnList);
});

app.get('/api/users/:id/logs', async (req, res) => {
  const _id = req.params.id;
  const { from: qFrom, to: qTo, limit: qLimit } = req.query;
  const userObj = await UserExercise.findOne({_id: _id});
  let log = userObj.log;
  let newLog = [];
  for (let i = 0; i < log.length; i++){
    let addItem = false;
    if (qFrom !== undefined){
      if ((new Date(log[i].date)) >= (new Date(processDate(qFrom)))) {
        addItem = true;
      } 
    }
    if (qTo !== undefined){
      if ((new Date(log[i].date)) <= (new Date(processDate(qTo)))) {
        addItem = true;
      } else {
        addItem = false;
      }
    }
    if ((qFrom === undefined && qTo === undefined) || addItem) {
      newLog.push(log[i]);
    }
  }
  if (qLimit !== undefined) {
    let tempLog = newLog;
    newLog = tempLog.slice(0, qLimit);
  }
  userObj.log = newLog;
  res.json(userObj);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});
