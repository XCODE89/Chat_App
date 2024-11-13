import { Server } from 'socket.io';

import * as config from './config.js';
import { texts } from '../data.js';
import { Room } from '../interfaces/IRoom.js';

const activeUsers: Set<string> = new Set();
const rooms: Map<string, Room> = new Map();

export default (io: Server) => {
    const checkGameEnd = (room: Room) => {
        const allFinished = room.users.every(user => user.progress === 100 );
        if (allFinished) {
            io.to(room.name).emit('gameFinished', {room});
            }
        }

    io.on('connection', socket => {
        const { username }: { username: string } = socket.handshake.query as { username: string };

        if (activeUsers.has(username)) {
            socket.emit('usernameError', "User already exists");
            socket.disconnect(true);
            return;
        }

        activeUsers.add(username);

        socket.on('getRooms', () => {
            const roomsList: Room[] = Array.from(rooms.values()).filter(room => room.users.length < config.MAXIMUM_USERS_FOR_ONE_ROOM);
            socket.emit('updateRooms', roomsList);
        });

        socket.on('createRoom', ({roomName, username}) => {
            if (rooms.has(roomName)) {
                socket.emit('roomError', 'Room already exists');
                return;
            }

            rooms.set(roomName, { name: roomName, users: [] });
            socket.join(roomName);
            socket.emit('roomCreated', {roomName, username});
            io.emit('updateRooms', Array.from(rooms.values()));
        });

        socket.on('joinRoom', ({roomName, username}) => {
            const room = rooms.get(roomName);
            if (room && room.users.length < config.MAXIMUM_USERS_FOR_ONE_ROOM) {
                room.users.push({ username, ready: false, progress: 0 });
                socket.join(roomName);
                socket.emit('roomJoined', roomName);

                io.emit('updateRooms', Array.from(rooms.values()).filter(room => room.users.length < config.MAXIMUM_USERS_FOR_ONE_ROOM));
                io.to(roomName).emit('roomUsers', room.users.map(user => ({ username: user.username, ready: user.ready })));
            }
        });

        socket.on('unavaibleRoom', roomName => {
            io.emit('updateRooms', Array.from(rooms.values()).filter(room => room.name != roomName))

        })
        
        socket.on('leaveRoom', ({ roomName, username }) => {
            let room = rooms.get(roomName);
            if (room) {
                room.users = room.users.filter(user => user.username !== username);
                socket.leave(roomName);
                if (room.users.length === 0) {
                    rooms.delete(roomName); 
                    io.emit('roomRemoved', roomName);
                } else {
                    io.emit('updateRooms', Array.from(rooms.values()));
                    io.to(roomName).emit('usersUpdated', username);
                    const allUsersReady = room.users.every(user => user.ready);
                    if (room.users.length>1 && allUsersReady) {
                        const textId = Math.floor(Math.random() * texts.length);
                        io.to(room.name).emit('startTimer', {SECONDS_TIMER_BEFORE_START_GAME:config.SECONDS_TIMER_BEFORE_START_GAME, SECONDS_FOR_GAME:config.SECONDS_FOR_GAME, textId, room});
                    }
                    checkGameEnd(room)
                }
            }
        });

        socket.on('updateReadyStatus', ({ username, ready }) => {
            rooms.forEach(room => {
                const user = room.users.find(user => user.username === username);
                if (user) {
                    user.ready = ready;
                    io.to(room.name).emit('readyStatusUpdated', { username, ready });

                    const allUsersReady = room.users.every(user => user.ready);
                    
                    if (room.users.length>1 && allUsersReady) {
                        const textId = Math.floor(Math.random() * texts.length);
                        io.to(room.name).emit('startTimer', {SECONDS_TIMER_BEFORE_START_GAME:config.SECONDS_TIMER_BEFORE_START_GAME, SECONDS_FOR_GAME:config.SECONDS_FOR_GAME, textId, room});
                    }
                }
            });
        });

        socket.on('updateProgress', ({ username, progress }) => {
            const room = Array.from(rooms.values()).find(room => room.users.some(user => user.username === username));
            
            if (room) {
                const user = room.users.find(user => user.username === username);
                if (user) {
                    user.progress = progress;
                }
                io.to(room.name).emit('progressUpdate', { username, progress });

                const sortedUsers = room.users.sort((a, b) => b.progress - a.progress); 
                io.to(room.name).emit('updateUserOrder', sortedUsers.map(user => user.username));
                if (progress === 100) {
                    io.to(room.name).emit('userFinished', username);
                    checkGameEnd(room);
                }
            }
        });

        socket.on('resetUsers', (roomName)=>{
            const room = rooms.get(roomName.name);
            if (room) {
                room.users.forEach(user => {
                    user.progress = 0;
                    user.ready = false;
                });
                io.to(roomName.name).emit('roomUsers', room.users);
            }
        })
        
        socket.on('disconnect', () => {
            activeUsers.delete(username);
            console.log(rooms)

            rooms.forEach((room, roomName) => {
                room.users = room.users.filter(user => user.username !== username);
                io.to(roomName).emit('usersUpdated', username);

                if (room.users.length === 0) {
                    rooms.delete(roomName);
                    io.emit('roomRemoved', roomName);
                } else {
                    io.emit('updateRooms', Array.from(rooms.values()));
                    checkGameEnd(room)
                }
            });
        });

    });
}
