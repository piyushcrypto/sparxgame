const express = require('express');
const fs = require('fs');
const app = express();

const httpServer = require('http').createServer(app);
const io = require('socket.io')(httpServer);

const MAX_PLAYERS_PER_ROOM = 2; // Maximum players allowed per room
const MAX_ROUNDS_PER_GAME = 5;
const rooms = {}; // Object to store rooms and their players
const users = {}; // Object to store the users
const chosenwords = [];

io.on('connection', socket => {
    //funtion to get random alphabet 
    function getRandomAlphabet() {
        const alphabets = 'abcdefghijklmnopqrstuvwxyz';
        const randomIndex = Math.floor(Math.random() * alphabets.length);
        return alphabets[randomIndex];
    }
    // Function to get the available room with space for one more player
    const getAvailableRoom = () => {
        for (const room in rooms) {
            if (rooms[room].length < MAX_PLAYERS_PER_ROOM) {
                return room;
            }
        }
        return null;
    };

    socket.on('new-user-joined', name => {
        const room = getAvailableRoom();
        if (!room) {
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
        users[socket.id] = { name: name, score: 0, chosenAlphabets: [] }; // Initialize score to 0 and chosenAlphabets to an empty array
        io.to(room).emit('user-joined', name);
    });
    

    socket.on('send', message => {
        const roomsArray = Array.from(socket.rooms);
        const room = roomsArray.find(roomName => roomName !== socket.id);
        socket.broadcast.to(room).emit('receive', { message: message, name: users[socket.id] });
    });

    socket.on('yourturn', () => {
         const roomsArray = Array.from(socket.rooms);
         const room = roomsArray.find(roomName => roomName !== socket.id);
         var alphabet = getRandomAlphabet();
         io.to(room).emit('add-tile', alphabet);
    });

    socket.on('snatchit', () => {
        //const roomsArray = Array.from(socket.rooms);
        //const room = roomsArray.find(roomName => roomName !== socket.id);
        //implement logic to check whether the word is present or not in dictionary
        
    });

    socket.on('alphabet', chosenword =>{
        const roomsArray = Array.from(socket.rooms);
        const room = roomsArray.find(roomName => roomName !== socket.id);
        users[socket.id].chosenAlphabets.push(chosenword);
        removeFromList(chosenword)
    })

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
