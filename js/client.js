const socket = io('http://localhost:8000');
const messageform = document.getElementById('send-container');
const answerform = document.getElementById('answer-container');
const messageInput = document.getElementById('messageInp');
const answerInput = document.getElementById('answerInp'); // Assume an input box for answers
const messageContainer = document.querySelector(".messagecontainer");
const questionContainer = document.querySelector(".questioncontainer");
const timerContainer = document.querySelector('.timercontainer');
const hintContainer = document.querySelector('.hintcontainer'); // Assume a display element for the timer
const MAX_ROUNDS_PER_GAME = 10;
const INITIAL_ROUND_TIME = 30000; // 30 seconds
const TIME_DECREMENT_PER_ROUND = 1000;
let countdown = 0;
let currentRoundTime = INITIAL_ROUND_TIME; // Initialize round time

const append = (message, position = 'center') => {
  const messageElement = document.createElement('div');
  messageElement.innerText = message;
  messageElement.classList.add('message');
  messageElement.classList.add(position);
  messageContainer.append(messageElement);
};

const questionappend = (question, position = 'center') => {
  const questionElement = document.createElement('div');
  questionElement.innerText = question;
  questionElement.classList.add('question');
  questionContainer.append(questionElement);
}

const timerappend = (time, position = 'center') => {
  const timerElement = document.createElement('div');
  timerElement.innerText = time;
  timerElement.classList.add('time');
  timerContainer.append(timerElement);
}

const hintappend = (hint, position = 'center') => {
  const hintElement = document.createElement('div');
  hintElement.innerText = hint;
  hintElement.classList.add('hint');
  hintContainer.append(hintElement);
}

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

socket.on('clear-countdown', ()=>{
  countdown = 0;
  timerContainer.innerHTML = '';
})
socket.on('start-round', data => {
  questionContainer.innerHTML = ''; 
  hintContainer.innerHTML = '';
  questionappend(`New round started! Unscramble the word: ${data.shuffledWord}`);
  hintappend(`Hint: Meaning : ${data.hint}`)
  answerInput.value = ''; // Clear the answer input box
  // Start the countdown timer
  let timeRemaining = currentRoundTime;
  timerappend(timeRemaining/1000);
  countdown = setInterval(() => {
    timerContainer.innerHTML = '';
    timeRemaining -= 1000; // Decrease by 1 second
    timerappend(timeRemaining/1000);
    if (timeRemaining <= 0) {
      clearInterval(countdown);
      timerContainer.innerHTML = '';
    }
  }, 1000);

  currentRoundTime -= TIME_DECREMENT_PER_ROUND; // Decrease the time for the next round
});

socket.on('round-winner', data => {
  questionContainer.innerHTML = ''; 
  questionappend(`${data.name} won the round!`);
});

socket.on('round-timeout', originalWord => {
  questionContainer.innerHTML = ''; 
  questionappend(`Round Timed Out. The correct answer is ${originalWord}!`);
});

socket.on('end-game', data => {
  append(`Game over! The winner is ${data.winner}!`);
});

messageform.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = messageInput.value;
  append(`You: ${message}`, 'left');
  socket.emit('send', message);
  messageInput.value = '';
});

answerform.addEventListener('submit', (e) => {
  e.preventDefault();
  const answer = answerInput.value;
  socket.emit('player-answer', answer);
  answerInput.value = '';
});

// Handle submission of answers
// answerInput.addEventListener('change', (e) => {
//   const answer = answerInput.value;
//   socket.emit('player-answer', answer);
// });
