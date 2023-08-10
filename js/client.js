const socket = io('http://localhost:8000');
const form = document.getElementById('send-container');
const messageInput = document.getElementById('messageInp');
const answerInput = document.getElementById('answerInp'); // Assume an input box for answers
const messageContainer = document.querySelector(".messagecontainer");
const timerElement = document.getElementById('timer'); // Assume a display element for the timer
const MAX_ROUNDS_PER_GAME = 10;
const INITIAL_ROUND_TIME = 10000; // 10 seconds
const TIME_DECREMENT_PER_ROUND = 500;

let currentRoundTime = INITIAL_ROUND_TIME; // Initialize round time

const append = (message, position = 'center') => {
  const messageElement = document.createElement('div');
  messageElement.innerText = message;
  messageElement.classList.add('message');
  messageElement.classList.add(position);
  messageContainer.append(messageElement);
};

let Username = prompt("Enter your Username for Joining");

// Keep prompting the user until a non-empty, non-null value is entered
while (!Username || Username.trim() === '') {
  Username = prompt("Username cannot be empty. Enter your Username for Joining");
}

socket.emit('new-user-joined', Username);

socket.on('user-joined', name => {
  append(`${name} joined.`, 'left');
});

socket.on('receive', data => {
  append(`${data.name}: ${data.message}`, 'right');
});

socket.on('room-created', newRoom => {
  append(`Room ${newRoom} created. Waiting for second player to join.`);
});
socket.on('gameStartTimer', ()=> {
  //implement a popup of 3 sec which initializez the game start
  setTimeout(() => {
    console.log("3")
  },1000);
  setTimeout(() => {
    console.log("2")
  },1000);
  setTimeout(() => {
    console.log("1")
  },1000);
  setTimeout(() => {
    console.log("0")
  },1000);
  
});

socket.on('start-round', shuffledWord => {
  append(`New round started! Unscramble the word: ${shuffledWord}`);
  answerInput.value = ''; // Clear the answer input box

  // Start the countdown timer
  let timeRemaining = currentRoundTime;
  timerElement.innerText = `Time remaining: ${timeRemaining / 1000} seconds`;
  const countdown = setInterval(() => {
    timeRemaining -= 500; // Decrease by 1 second
    timerElement.innerText = `Time remaining: ${timeRemaining / 1000} seconds`;
    if (timeRemaining <= 0) {
      clearInterval(countdown);
      timerElement.innerText = "Time's up!";
    }
  }, 1000);

  currentRoundTime -= TIME_DECREMENT_PER_ROUND; // Decrease the time for the next round
});

socket.on('round-winner', data => {
  append(`${data.name} won the round!`);
});

socket.on('round-timeout', () => {
  append(`Time's up for this round!`);
});

socket.on('end-game', data => {
  append(`Game over! The winner is ${data.winner}!`);
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = messageInput.value;
  append(`You: ${message}`, 'left');
  socket.emit('send', message);
  messageInput.value = '';
});

// Handle submission of answers
// answerInput.addEventListener('change', (e) => {
//   const answer = answerInput.value;
//   socket.emit('player-answer', answer);
// });
