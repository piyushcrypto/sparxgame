const express = require('express');
const rateLimit = require("express-rate-limit"); // Rate limiting package
const fs = require('fs');
const app = express();
const axios = require('axios');
const httpServer = require('http').createServer(app);
const io = require('socket.io')(httpServer, {
  cors: {
    origin: '*', // update this to match the client's origin
    methods: ["GET", "POST"]
  }
});

app.set('trust proxy', 1);
// Rate limiter middleware
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 3 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

const cors = require('cors');

// Enable all CORS requests
app.use(cors());



const MAX_PLAYERS_PER_ROOM = 2; // Maximum players allowed per room
const MAX_ROUNDS_PER_GAME = 2;
const WORDS_PER_ROOM = 10;
const INITIAL_ROUND_TIME = 30000; // 30 seconds
const resetCurrentRoundTime = (round) => INITIAL_ROUND_TIME - round*1000; // Function to reset round time
const rooms = {}; // Object to store rooms and their players
const users = {}; // Object to store the users

const getWords = () => {
  const data = fs.readFileSync('words.json', 'utf8');
  return JSON.parse(data);
};

const shuffleWord = (word) => {
  const letters = word.split('');
  const shuffledLetters = letters.sort(() => 0.5 - Math.random());
  return shuffledLetters.join('');
};

const getRandomWords = (words) => {
  const shuffledWords = words.sort(() => 0.5 - Math.random()).slice(0, WORDS_PER_ROOM);
  return shuffledWords.map(word => ({original: word, shuffled: shuffleWord(word) }));
};

const fetchWordDetails = async (word) => {
  try {
    const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    return response.data;
  } catch (error) {
    return 'Ouch !!! No hint available for the selected word!!!';
  }
};

const logErrorToFile = (errorMessage) => {
  // Construct the error object with the message and timestamp
  const errorObj = {
    timestamp: new Date().toISOString(),
    error: errorMessage,
  };

  // Read the existing errors from the file
  fs.readFile('errorLogs.json', 'utf8', (readErr, data) => {
    if (readErr) {
      console.error('Error reading errors.json:', readErr);
      return;
    }

    // Parse the existing errors and add the new one
    let errors = [];
    if (data) {
      errors = JSON.parse(data);
    }
    errors.push(errorObj);

    // Write the updated errors back to the file
    fs.writeFile('errorLogs.json', JSON.stringify(errors, null, 2), (writeErr) => {
      if (writeErr) {
        console.error('Error writing to errors.json:', writeErr);
      }
    });
  });
};

io.on('connection', socket => {

  const getAvailableRoom = () => {
    for (const room in rooms) {
      if (rooms[room].players && rooms[room].players.length < MAX_PLAYERS_PER_ROOM) {
        return room;
      }
    }
    return null;
  };

  socket.on('new-user-joined', name => {
    const room = getAvailableRoom();
    if (!room) {
        const newRoom = `room${Date.now()}`;
        rooms[newRoom] = { players: [socket.id], words: [], timer: null };
        socket.join(newRoom);
        socket.emit('room-created', newRoom);
        io.to(newRoom).emit('user-joined', {name: name,  socketid: socket.id});
    } else {
        rooms[room].players.push(socket.id);
        socket.join(room);
        io.to(room).emit('user-joined', {name: name,  socketid: socket.id});   
        io.to(room).emit('player-two-joined', name);         
    }
    users[socket.id] = { name: name, score: 0 };
    if(room){
        if(rooms[room].players.length == MAX_PLAYERS_PER_ROOM){
            const words = getWords();
            const randomWordsWithShuffled = getRandomWords(words);
            rooms[room].words = randomWordsWithShuffled;
            rooms[room].currentRound = 0;
            rooms[room].currentRoundTime = INITIAL_ROUND_TIME;
            setTimeout(() => {
            //initialize the round start
                startRound(room);
            }, 3000);
        } 
    } 
  });

  socket.on('send', message => {
    const roomsArray = Array.from(socket.rooms);
    const room = roomsArray.find(roomName => roomName !== socket.id);
    socket.broadcast.to(room).emit('receive', { message: message, name: users[socket.id].name });
  });

  socket.on('player-answer', answer => {
    const roomsArray = Array.from(socket.rooms);
    const room = roomsArray.find(roomName => roomName !== socket.id);
    if (!rooms[room]) return; // To make sure the room exists
  
    const currentRound = rooms[room].currentRound;
    const correctWord = rooms[room].words[currentRound - 1].original;
  
    if (answer === correctWord && !rooms[room].roundWinner) {
      users[socket.id].score += 1;
      clearTimeout(rooms[room].timer);
      rooms[room].roundWinner = true;
      io.to(room).emit('round-winner', { socketid: socket.id, name: users[socket.id].name , correctword: correctWord, round: currentRound, score: users[socket.id].score});
      setTimeout(() => startRound(room), 2000);
    }
  });
  

  socket.on('disconnect', () => {
    for (const room in rooms) {
      const index = rooms[room].players.indexOf(socket.id);
      if (index !== -1) {
        rooms[room].players.splice(index, 1);
        clearTimeout(rooms[room].timer);
        rooms[room].timer = null;
        io.to(room).emit('room-closed', users[socket.id]); // Inform remaining players that the room has been closed
        delete rooms[room]; // Delete the room
        break;
      }
    }
  });
  
});

const startRound = async (room) => {
  if (!rooms[room]) {
    // Log the error to the file
    logErrorToFile(`Room does not exist: ${room}`);
    return;
  }

  try {
    if (rooms[room].currentRound >= MAX_ROUNDS_PER_GAME) {
      endGame(room);
      return;
    }
    rooms[room].currentRoundTime = resetCurrentRoundTime(rooms[room].currentRound);
    const originalWord = rooms[room].words[rooms[room].currentRound].original;
    var wordDetails;
    var meaning;
    try {
      wordDetails = await fetchWordDetails(originalWord);
      meaning = JSON.stringify(wordDetails[0]["meanings"][0]["definitions"][0]["definition"]);
    } catch (error) {
      wordDetails = await fetchWordDetails(originalWord);
      meaning = JSON.stringify(wordDetails[0]["meanings"][0]["definitions"][0]["definition"]);
    }

    rooms[room].roundWinner = false; // Initialize roundWinner to false
    const shuffledWord = rooms[room].words[rooms[room].currentRound].shuffled;
    io.to(room).emit('start-round', {shuffledWord: shuffledWord, hint: meaning, roundTime: rooms[room].currentRoundTime});

    const timerId = setTimeout(() => {
      if (rooms[room]) { // Check if rooms[room] exists
        if (!rooms[room].roundWinner) {
          clearTimeout(timerId);
          rooms[room].timer = null; // Nullify the timer;
          io.to(room).emit('round-timeout', {originalWord: originalWord, currentRound: rooms[room].currentRound}); // Emit a timeout event only if room exists
          startRound(room);
        }
      }
    }, rooms[room].currentRoundTime);

    rooms[room].timer = timerId;
    rooms[room].currentRound += 1;
  } catch (error) {
    // Log the error to the file
    logErrorToFile(`Error starting round for room: ${room}\n${error}`);
  }
};


const endGame = (room) => {
  let winner;
  const scores = rooms[room].players.map(playerId => users[playerId].score);
  if (scores[0] > scores[1]) {
    winner = users[rooms[room].players[0]].name;
  } else if (scores[0] < scores[1]) {
    winner = users[rooms[room].players[1]].name;
  } else {
    winner = "No One !!! Both have Equal Scores.";
  }
  io.to(room).emit('end-game', { winner: winner });
};


const PORT = 8000;
httpServer.listen(PORT, () => {
  console.log(`Server is up and running.....`);
});
