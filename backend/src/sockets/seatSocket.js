// Clients join a room per event (`event:<id>`) when viewing its seat map, so seat-status
// broadcasts only go to people actually looking at that show.
function registerSeatSocket(io) {
  io.on('connection', (socket) => {
    socket.on('event:join', (eventId) => socket.join(`event:${eventId}`));
    socket.on('event:leave', (eventId) => socket.leave(`event:${eventId}`));
  });
}

module.exports = { registerSeatSocket };
