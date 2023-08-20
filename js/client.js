const socket = io('http://localhost:8000');
const messageform = document.getElementById('send-container');
const answerform = document.getElementById('answer-container');
const messageInput = document.getElementById('messageInp');
const answerInput = document.getElementById('answerInp'); // Assume an input box for answers
const messageContainer = document.querySelector(".messagecontainer");
const questionContainer = document.querySelector(".questioncontainer");
const timerContainer = document.querySelector('.timercontainer');
const scoreContainer = document.querySelector('.scorecontainer');
const hintContainer = document.querySelector('.hintcontainer'); // Assume a display element for the timer
const MAX_ROUNDS_PER_GAME = 10;
const INITIAL_ROUND_TIME = 30000; // 30 seconds
let TIME_DECREMENT_PER_ROUND = 1000;
let currRoundWinner = false;
let playerScore = 0;
let opponentScore = 0;
const resetCurrentRoundTime = () => INITIAL_ROUND_TIME - TIME_DECREMENT_PER_ROUND; // Function to reset round time
var countdown;

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

const questionwordappend = (questionword) => {
  const questionElement = document.createElement('div');
  questionElement.innerText = questionword;
  questionElement.classList.add('questionword');
  questionContainer.append(questionElement);
}

const timerappend = (time, position = 'center') => {
  const timerElement = document.createElement('div');
  timerElement.innerText = time;
  timerElement.classList.add('time');
  timerContainer.append(timerElement);
}
// const nameappend = (name) => {
//   const nameElement = document.createElement('div');
//   nameElement.innerText = name;
//   nameElement.classList.add('name');
//   nameContainer.append(nameElement);
// }
const hintappend = (hint, position = 'center') => {
  const hintElement = document.createElement('div');
  hintElement.innerText = hint;
  hintElement.classList.add('hint');
  hintContainer.append(hintElement);
}
const scoreappend = (score) => {
  const scoreElement = document.createElement('div');
  scoreElement.innerText = score;
  scoreElement.classList.add('score');
  scoreContainer.append(scoreElement);
}
let Username = 'abcd';
// let Username = prompt("Enter your Username for Joining");

// // Keep prompting the user until a non-empty, non-null value is entered
// while (!Username || Username.trim() === '') {
//   Username = prompt("Username cannot be empty. Enter your Username for Joining");
// }

socket.emit('new-user-joined', Username);

socket.on('user-joined', data => {
  append(`${data.name} joined.`);
});

socket.on('receive', data => {
  append(`${data.name}: ${data.message}`, 'right');
});
socket.on('player-two-joined', name => {
  questionContainer.innerHTML = '';
  questionappend(`${name} joined. Starting Knockout in 5 seconds.`);
});

socket.on('room-created', newRoom => {
  questionappend(`Room ${newRoom} created. Waiting for second player to join.`);
});

socket.on('room-closed', data => {
  questionContainer.innerHTML = '';
  clearInterval(countdown)
  questionappend(`Player 2 exited the Room. Creating a new room for you in 3 Seconds.  `);
  setTimeout(() => {
    // Reload the page after the logic is executed
    location.reload();
  }, 3000);
});

socket.on('start-round', data => {
  timerContainer.innerHTML = ''; 
  questionContainer.innerHTML = ''; 
  hintContainer.innerHTML = '';
  questionappend(`New round started! Unscramble the word`);
  questionwordappend(`${data.shuffledWord}`);
  hintappend(`Hint 1: ${data.hint}`);
  answerInput.value = ''; // Clear the answer input box
  let timertime = data.roundTime
  countdown = setInterval(() => {
    timerContainer.innerHTML = '';
    timertime -= 1000; // Decrease by 1 second
    timerappend(timertime / 1000);
  }, 1000);
  TIME_DECREMENT_PER_ROUND = TIME_DECREMENT_PER_ROUND + 1000;
});

socket.on('round-winner', data => {
  clearInterval(countdown)
  questionContainer.innerHTML = ''; 
  if (data.socketid === socket.id) {
    playerScore++;
  } else {
    opponentScore++;
  }
  // Update the score container
  document.getElementById('scorecontainer').textContent = `${playerScore}:${opponentScore}`; 
  questionappend(`${data.name} won the round! The correct word was : ${data.correctword}`,'right');
  append(`${data.name} won the round number ${data.round} ! The correct word was : ${data.correctword}`);
});

socket.on('round-timeout', data => {
  questionContainer.innerHTML = ''; 
  clearInterval(countdown)
  questionappend(`Round number ${data.currentRound} Timed Out.`);
  append(`Round number ${data.currentRound} Timed Out ! The correct answer is ${data.originalWord}!`);
});

socket.on('end-game', data => {
  questionContainer.innerHTML = '';
  questionappend(`Game over! The winner is ${data.winner}!\nStarting a new match in 3 Seconds.`);
  setTimeout(() => {
    // Reload the page after the logic is executed
    questionContainer.innerHTML = '';
    location.reload();
  }, 3000); 
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

