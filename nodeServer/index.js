const express = require('express');
const cors = require('cors'); // Import the cors middleware
const app = express();

// Use the cors middleware to allow requests from any origin
// Create the http server and pass it to socket.io
const httpServer = require('http').createServer(app);
const io = require('socket.io')(httpServer);

const users = {};
io.on('connection', socket => {
    socket.on('new-user-joined', name =>{
        users[socket.id] = name; 
        socket.broadcast.emit('user-joined', name);
    });
    socket.on('send', message =>{
        socket.broadcast.emit('receive', {message: message, name: users[socket.id]})
    });
    socket.on('disconnect', message=>{
        socket.broadcast.emit('left', users[socket.id]);
        delete users[socket.id];
    });
});

const PORT = 8000;
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
