const express = require('express');
const fs = require('fs');
const app = express();

const httpServer = require('http').createServer(app);
const io = require('socket.io')(httpServer);

const MAX_PLAYERS_PER_ROOM = 2; // Maximum players allowed per room
const MAX_ROUNDS_PER_GAME = 5;
const rooms = {}; // Object to store rooms and their players
const users = {}; // Object to store the users

io.on('connection', socket => {
    const readWordsFromFile = () => {
        try {
            const data = fs.readFileSync('words.json', 'utf8');
            const wordsData = JSON.parse(data);
            return wordsData.words;
        } catch (err) {
            console.error('Error reading words from file:', err);
            return [];
        }
    };

    // Function to select 10 random words
    const getRandomWords = (wordsList, count) => {
        const shuffled = wordsList.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    };
    // Function to get the available room with space for one more player
    const getAvailableRoom = () => {
        for (const room in rooms) {
            if (rooms[room].length < MAX_PLAYERS_PER_ROOM) {
                return room;
            }
        }
        return null;
    };

    //shuffle the words and store key value pair



    socket.on('new-user-joined', name => {
        const room = getAvailableRoom();
        if (!room) {
            //Selecting 10 random words for gameplay
            const wordsList = readWordsFromFile();
            const randomWords = getRandomWords(wordsList, 5);
            const wordPairs = {};
            // Create a new room if no available rooms with space are found
            const newRoom = `room${Date.now()}`;
            rooms[newRoom] = [socket.id];
            socket.join(newRoom);
            socket.emit('room-created', newRoom);
            io.to(newRoom).emit('user-joined', name);
        } else {
            rooms[room].push(socket.id);
            socket.join(room);
        }
        users[socket.id] = name;
        io.to(room).emit('user-joined', name);
    });

    socket.on('send', message => {
        const roomsArray = Array.from(socket.rooms);
        const room = roomsArray.find(roomName => roomName !== socket.id);
        socket.broadcast.to(room).emit('receive', { message: message, name: users[socket.id] });
    });

    socket.on('disconnect', () => {
        for (const room in rooms) {
            const index = rooms[room].indexOf(socket.id);
            if (index !== -1) {
                rooms[room].splice(index, 1);
                io.to(room).emit('left', users[socket.id]);
                if (rooms[room].length === 0) {
                    delete rooms[room]; // Remove the room if no players are left
                }
                break;
            }
        }
    });
});

const PORT = 8000;
httpServer.listen(PORT, () => {
    console.log(`Server is up and running.....`);
});
