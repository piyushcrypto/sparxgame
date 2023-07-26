const express = require('express');
const cors = require('cors');
const app = express();

const httpServer = require('http').createServer(app);
const io = require('socket.io')(httpServer);

const MAX_PLAYERS_PER_ROOM = 2; // Maximum players allowed per room
const rooms = {}; // Object to store rooms and their players
const users = {}; // Object to store the users

io.on('connection', socket => {
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
    } else {
      rooms[room].push(socket.id);
      socket.join(room);
    }

    io.to(room).emit('user-joined', name);
  });

  socket.on('send', message => {
    const room = Object.keys(socket.rooms).find(room => room !== socket.id);
    io.to(room).emit('receive', { message: message, name: users[socket.id] });
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
  console.log(`Server is running on port ${PORT}`);
});
