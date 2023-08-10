const express = require('express');
const fs = require('fs');
const app = express();

const httpServer = require('http').createServer(app);
const io = require('socket.io')(httpServer);

const MAX_PLAYERS_PER_ROOM = 2; // Maximum players allowed per room
const MAX_ROUNDS_PER_GAME = 10;
const WORDS_PER_ROOM = 10;
const INITIAL_ROUND_TIME = 10000; // 10 seconds
const TIME_DECREMENT_PER_ROUND = 500;

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
        rooms[newRoom] = { players: [socket.id], words: [] };
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
            socket.emit('gameStartTimer');
            setTimeout(() => {
                    // Game to be executed after the 4-second delay
                    // Initialize round time
                startRound(room);
            }, 4000);
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
    const correctWord = rooms[room].words[currentRound].original;

    if (answer === correctWord && !rooms[room].roundWinner) {
      users[socket.id].score += 1;
      rooms[room].roundWinner = true;
      io.to(room).emit('round-winner', { name: users[socket.id].name });
      setTimeout(() => startRound(room), 2000);
    }
  });

  socket.on('disconnect', () => {
    for (const room in rooms) {
      const index = rooms[room].players.indexOf(socket.id);
      if (index !== -1) {
        rooms[room].players.splice(index, 1);
        io.to(room).emit('left', users[socket.id]);
        if (rooms[room].players.length === 0) {
          delete rooms[room];
        }
        break;
      }
    }
  });
});

const startRound = (room) => {
  if (rooms[room].currentRound >= MAX_ROUNDS_PER_GAME) {
    endGame(room);
    return;
  }
  rooms[room].roundWinner = false;
  const shuffledWord = rooms[room].words[rooms[room].currentRound].shuffled;
  io.to(room).emit('start-round', shuffledWord);

  setTimeout(() => {
    if (!rooms[room].roundWinner) {
      io.to(room).emit('round-timeout');
      startRound(room);
    }
  }, rooms[room].currentRoundTime);

  rooms[room].currentRoundTime -= TIME_DECREMENT_PER_ROUND;
  rooms[room].currentRound += 1;
};

const endGame = (room) => {
  const scores = rooms[room].players.map(playerId => users[playerId].score);
  if(scores[0] > scores[1]){
    const winner = users[rooms[room].players[0]].name;
  }
  else if(scores[0] < scores[1]){
    const winner = users[rooms[room].players[1]].name;
  }
  else{
    const winner = "No One";
  }
  //const winner = scores[0] > scores[1] ? users[rooms[room].players[0]].name : users[rooms[room].players[1]].name;
  io.to(room).emit('end-game', { winner: winner });
};

const PORT = 8000;
httpServer.listen(PORT, () => {
  console.log(`Server is up and running.....`);
});
