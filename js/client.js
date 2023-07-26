 const socket = io('http://localhost:8000');
 const form = document.getElementById('send-container');
 const messageInput =document.getElementById('messageInp');
 const messageContainer = document.querySelector(".container");
 //const audio = new Audio('ting.mp3');
 const append = (message, position)=>{
   const messageElement = document.createElement('div');
   messageElement.innerText = message;
   messageElement.classList.add('message');
   messageElement.classList.add(position);
   messageContainer.append(messageElement);
};

const Username = prompt("Enter your Username for Joining");
 socket.emit('new-user-joined', Username);
 socket.on('user-joined', name=>{
    append(`${name} joined.`, 'left');
 })
 socket.on('receive', data =>{
   append(`${data.name}: ${data.message}`, 'right');
})

socket.on('room-created', newRoom =>{
  append(`Room ${newRoom} created. Waiting for second player to join.`)
})

form.addEventListener('submit',(e)=>{
   e.preventDefault();
   const message = messageInput.value ;
   append(`You: ${message}`, 'left');
   socket.emit('send', message);
   messageInput.value = '';
});
