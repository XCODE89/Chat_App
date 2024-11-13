import { showInputModal, showMessageModal, showResultsModal } from "./views/modal.mjs";
import { appendRoomElement, removeRoomElement, updateNumberOfUsersInRoom } from "./views/room.mjs";
import { appendUserElement, changeReadyStatus, removeUserElement, setProgress } from "./views/user.mjs";


const username = sessionStorage.getItem('username');

if (!username) {
    window.location.replace('/signin');
}

const socket = io('', { query: { username } });

let gameCountdownInterval;
let currentIndex = 0;
let correctText = '';
let gameStarted = false;

const createRoomButton = document.getElementById('add-room-btn');
let roomName = '';
if (createRoomButton) {
    createRoomButton.addEventListener('click', () => {
        showInputModal({
            title: 'New Room',
            onChange: (value) => {
                roomName = value;
            },
            onSubmit: () => {
                if (roomName) {
                    socket.emit('createRoom', { roomName, username });
                }
            }
        });
    });
}

socket.on('usernameError', (errorMessage) => {
    showMessageModal({
        message: errorMessage,
        onClose: () => {
            sessionStorage.removeItem('username')
            window.location.replace('/signin');
                
        },
    });
});

socket.emit('getRooms');

socket.on('updateRooms', (rooms) => {
    const roomsContainer = document.querySelector('#rooms-wrapper');
    roomsContainer.innerHTML = '';
    
    rooms.forEach((room) => {
        appendRoomElement({
            name: room.name,
            numberOfUsers: room.users.length,
            onJoin: () => {
                if (!room.users.includes(username)) {
                    socket.emit('joinRoom', { roomName: room.name, username });
                }
            }
        });
    });
});

socket.on('roomJoined', (roomName) => {
    document.getElementById('rooms-page').classList.add('display-none');
    document.getElementById('game-page').classList.remove('display-none');
    document.getElementById('room-name').innerText = roomName;
});

socket.on('roomUsers', (users) => {
    const usersWrapper = document.getElementById('users-wrapper');
    usersWrapper.innerHTML = '';
    let activeUser = username
    users.forEach(user => {
        const { username, ready } = user;
        const isCurrentUser = (username === activeUser);
        appendUserElement({ username, ready, isCurrentUser });
    });
});

socket.on('roomError', errorMessage => {
    showMessageModal({
        message: errorMessage,
        onClose: () => {},
    });
});


socket.on('roomCreated', ({roomName, username}) => {
    socket.emit('joinRoom', {roomName, username});
    const rooms = document.getElementById('rooms-page')
    const room = document.getElementById('game-page')
    rooms.classList.add('display-none')
    room.classList.remove('display-none')
});

const updateReadyStatus = (ready) => {
    socket.emit('updateReadyStatus', { username, ready });
};

socket.on('readyStatusUpdated', ({ username, ready }) => {
    changeReadyStatus({ username, ready });
});

document.getElementById('ready-btn').addEventListener('click', () => {
    const readyButton = document.getElementById('ready-btn');
    const isReady = readyButton.dataset.ready === 'true';
    
    const newReadyState = !isReady;
    updateReadyStatus(newReadyState);

    readyButton.dataset.ready = newReadyState;
    readyButton.textContent = newReadyState ? 'NOT READY' : 'READY';
});

socket.on('startTimer', ({SECONDS_TIMER_BEFORE_START_GAME, SECONDS_FOR_GAME, textId, room}) => {
    const timerElement = document.getElementById('timer');
    const readyButton = document.getElementById('ready-btn');
    const quitButton = document.getElementById('quit-room-btn');
    timerElement.classList.remove('display-none');
    readyButton.classList.add('display-none')
    quitButton.classList.add('display-none')

    let countdown = SECONDS_TIMER_BEFORE_START_GAME;
    timerElement.textContent = countdown;
    socket.emit('unavaibleRoom', room.name)
    const countdownInterval = setInterval(() => {
        countdown--;
        timerElement.textContent = countdown;
        if (countdown === 0) {
            clearInterval(countdownInterval);
            timerElement.classList.add('display-none');
            fetchGameText(textId)
            startGame(SECONDS_FOR_GAME, room);
        }
    }, 1000);
});



const fetchGameText = async (textId) => {
    try {
        const response = await fetch(`/game/texts/${textId}`);
        const data = await response.json();
        const gameText = data.text;
        document.getElementById('text-container').textContent = gameText;
        document.getElementById('text-container').classList.remove('display-none');
    } catch (error) {
        console.error('Error fetching game text:', error);
    }
};

socket.on('roomError', errorMessage => {
    showMessageModal({
        message: errorMessage,
        onClose: () => {},
    });
});

const startGame = (SECONDS_FOR_GAME, room) => {
    gameStarted = true;
    currentIndex = 0;
    
    const timerElement = document.getElementById('timer');
    timerElement.classList.add('display-none');

    document.getElementById('text-container').classList.remove('display-none');
    document.addEventListener('keydown', handleKeyPress);

    const gameTimerElement = document.getElementById('game-timer');
    const gameTimerSecondsElement = document.getElementById('game-timer-seconds');
    gameTimerElement.classList.remove('display-none');
    
    let countdown = SECONDS_FOR_GAME;
    gameTimerSecondsElement.textContent = countdown;
    gameCountdownInterval = setInterval(() => {
        countdown -= 1;
        gameTimerSecondsElement.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(gameCountdownInterval);
            if(gameStarted) {
                endGame(room);
            }
        }
    }, 1000);
};

const handleKeyPress = (event) => {
    if (!gameStarted) {
        return
    };

    const textContainer = document.getElementById('text-container');
    const text = textContainer.textContent;
    const inputChar = event.key;
    
    if (inputChar === text[currentIndex]) {
        correctText += inputChar;
        currentIndex++;
        updateTextDisplay();
        
        const progress = (currentIndex / text.length) * 100;
        socket.emit('updateProgress', { username, progress });
    }
};

const updateTextDisplay = () => {
    const textContainer = document.getElementById('text-container');
    const remainingPart = textContainer.textContent.slice(currentIndex);
    const highlightedText = `<span class="correct-text">${correctText}</span><span class="current">${remainingPart.charAt(0)}</span>${remainingPart.substring(1)}`;
    textContainer.innerHTML = highlightedText;
};

socket.on('progressUpdate', ({ username, progress }) => {
    setProgress({ username, progress });
});


let usersFinished = []
socket.on('updateUserOrder', (users) => {
    usersFinished = users
})

socket.on('userFinished', (username) => {
    const userElement = document.querySelector(`.user[data-username='${username}']`);
    if (userElement) {
        userElement.classList.add('finished');
    }
});

socket.on('gameFinished', ({room}) => {
    gameStarted=false
    endGame(room)
});

const endGame = (room) => {
    gameStarted = false;
    clearInterval(gameCountdownInterval);
    showResultsModal({
        usersSortedArray: usersFinished,
        onClose: () => {
            const readyButton = document.getElementById('ready-btn');
            readyButton.classList.remove('display-none')
            readyButton.textContent ='READY';
            readyButton.dataset.ready = 'false';
            const quitButton = document.getElementById('quit-room-btn');
            quitButton.classList.remove('display-none')
            
        }
    });
    const timeLeftElement = document.getElementById('game-timer');
    timeLeftElement.classList.add('display-none');

    const textContainer = document.getElementById('text-container');
    textContainer.classList.add('display-none');
    textContainer.textContent = '';
    correctText = '';
    socket.emit('resetUsers', room)
};


socket.on('usersUpdated', (username) => {
    removeUserElement(username)
    if (usersFinished.length > 0) {
        usersFinished = usersFinished. filter(user => user !== username)
    }
});

socket.on('roomRemoved', (roomName) => {
    removeRoomElement(roomName);
});

document.getElementById('quit-room-btn').addEventListener('click', () => {
    document.getElementById('game-page').classList.add('display-none');
    document.getElementById('rooms-page').classList.remove('display-none');
    socket.emit('leaveRoom', { roomName: document.getElementById('room-name').innerText, username });
});


