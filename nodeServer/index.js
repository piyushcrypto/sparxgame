const express = require('express');
const fs = require('fs');
const app = express();
const axios = require('axios');
const httpServer = require('http').createServer(app);
const io = require('socket.io')(httpServer);

const MAX_PLAYERS_PER_ROOM = 2; // Maximum players allowed per room
const MAX_ROUNDS_PER_GAME = 10;
const WORDS_PER_ROOM = 10;
const INITIAL_ROUND_TIME = 30000; // 30 seconds
const TIME_DECREMENT_PER_ROUND = 1000;

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
        io.to(newRoom).emit('user-joined', name);
    } else {
        rooms[room].players.push(socket.id);
        socket.join(room);
        io.to(room).emit('user-joined', name);      
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
            }, 5000);
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
    const currentRound = rooms[room].currentRound;
    const correctWord = rooms[room].words[currentRound-1].original;

    if (answer === correctWord && !rooms[room].roundWinner) {
      users[socket.id].score += 1;
      rooms[room].roundWinner = true;
      io.to(room).emit('clear-countdown');
      io.to(room).emit('round-winner', { name: users[socket.id].name });
      setTimeout(() => startRound(room), 2000);
    }
  });

  socket.on('disconnect', () => {
    for (const room in rooms) {
      const index = rooms[room].players.indexOf(socket.id);
      if (index !== -1) {
        rooms[room].players.splice(index, 1);
        io.to(room).emit('room-closed', users[socket.id]); // Inform remaining players that the room has been closed
        delete rooms[room]; // Delete the room
        break;
      }
    }
  });
  
});

const startRound = async (room) => {
  if (!rooms[room]) {
    // Room does not exist, so exit the function
    return;
  }

  if (rooms[room].currentRound >= MAX_ROUNDS_PER_GAME) {
    endGame(room);
    return;
  }

  const originalWord = rooms[room].words[rooms[room].currentRound].original;
  const wordDetails = await fetchWordDetails(originalWord);
  const meaning = JSON.stringify(wordDetails[0]["meanings"][0]["definitions"][0]["definition"]);

  rooms[room].roundWinner = false; // Initialize roundWinner to false
  const shuffledWord = rooms[room].words[rooms[room].currentRound].shuffled;
  io.to(room).emit('start-round', {shuffledWord: shuffledWord, hint: meaning});

  // Store the reference to the timer in the room object
  rooms[room].timer = setTimeout(() => {
    if (!rooms[room] || !rooms[room].roundWinner) { // Check if rooms[room] exists
      if (rooms[room]) {
        io.to(room).emit('round-timeout', originalWord); // Emit a timeout event only if room exists
        io.to(room).emit('clear-countdown');
      }
      startRound(room);
    }
  }, rooms[room].currentRoundTime);

  rooms[room].currentRoundTime -= TIME_DECREMENT_PER_ROUND;
  rooms[room].currentRound += 1;
};


const endGame = (room) => {
  let winner; // Declare winner variable here
  const scores = rooms[room].players.map(playerId => users[playerId].score);
  if (scores[0] > scores[1]) {
    winner = users[rooms[room].players[0]].name;
  } else if (scores[0] < scores[1]) {
    winner = users[rooms[room].players[1]].name;
  } else {
    winner = "No One";
  }
  io.to(room).emit('end-game', { winner: winner });
};


const PORT = 8000;
httpServer.listen(PORT, () => {
  console.log(`Server is up and running.....`);
});
