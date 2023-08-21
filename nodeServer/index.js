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
const MAX_ROUNDS_PER_GAME = 10;
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

const usecaseexample = (word, example) => {
  // Check if word and example are defined and are strings, if word is empty, or if example is empty
  if (typeof word !== 'string' || typeof example !== 'string' || word.length === 0 || example.length === 0) {
    return 'Only one hint available for this question. Hurry up !!!';
  }

  const replacement = '_'.repeat(word.length);
  const regex = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'); // Escape special characters
  return example.replace(regex, replacement);
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
  // Get the stack trace and error details
  const error = new Error(errorMessage);
  const stackTrace = error.stack;

  // Convert the timestamp to Indian Standard Time (IST)
  const timestamp = new Date();
  const offsetIST = 330; // IST offset in minutes
  const dateIST = new Date(timestamp.getTime() + offsetIST * 60 * 1000);
  const formattedDate = dateIST.toISOString();

  // Construct the error object with the message, timestamp, and stack trace
  const errorObj = {
    timestamp: formattedDate,
    error: errorMessage,
    stackTrace: stackTrace,
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
    if (rooms[room].currentRound >= MAX_ROUNDS_PER_GAME || !rooms[room].words || !rooms[room].words[rooms[room].currentRound]) {
      // If the current round exceeds max rounds or the current round word is not defined, end the game
      endGame(room);
      return;
    }

    rooms[room].currentRoundTime = resetCurrentRoundTime(rooms[room].currentRound);
    const originalWord = rooms[room].words[rooms[room].currentRound].original;
    var wordDetails, meaning, example, hint2;

    try {
      wordDetails = await fetchWordDetails(originalWord);
      if (wordDetails[0] && wordDetails[0].meanings) {
        example = wordDetails[0].meanings.map(meaning => (meaning.definitions ? meaning.definitions.map(def => def.example) : [])).flat().filter(Boolean);
        meaning = JSON.stringify(wordDetails[0]["meanings"][0]["definitions"][0]["definition"]);
        if (example.length > 0) {
          hint2 = usecaseexample(originalWord, example[0]);
        } else {
          hint2 = "Only one hint available for this question. Hurry up !!!";
        }
      } else {
        throw new Error("Meanings not found in word details");
      }
    } catch (error) {
      meaning = "Ouch !!! No hint available for the selected word!!!";
      hint2 = "Only one hint available for this question. Hurry up !!!";
    }

    rooms[room].roundWinner = false; // Initialize roundWinner to false

    const currentWord = rooms[room].words[rooms[room].currentRound];
    if (!currentWord || !currentWord.shuffled) {
      // Log the error to the file and return if the current word or shuffled word is not defined
      logErrorToFile(`Word details not found for room: ${room}, round: ${rooms[room].currentRound}`);
      return;
    }

    const shuffledWord = currentWord.shuffled;
    io.to(room).emit('start-round', {currentround: rooms[room].currentRound ,shuffledWord: shuffledWord, hint: meaning, hint2: hint2, roundTime: rooms[room].currentRoundTime});

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
