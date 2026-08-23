const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const { port, clientOrigin } = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');
const { startSweeper } = require('./jobs/sweeper');
const { registerSeatSocket } = require('./sockets/seatSocket');

const authRoutes = require('./routes/auth.routes');
const venueRoutes = require('./routes/venue.routes');
const eventRoutes = require('./routes/event.routes');
const bookingRoutes = require('./routes/booking.routes');
const waitlistRoutes = require('./routes/waitlist.routes');
const organiserRoutes = require('./routes/organiser.routes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: clientOrigin } });

app.set('io', io); // controllers reach the socket server via req.app.get('io')

app.use(cors({ origin: clientOrigin }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/organiser', organiserRoutes);

app.use(errorHandler);

registerSeatSocket(io);
startSweeper(io);

server.listen(port, () => console.log(`Ticket booking API listening on :${port}`));

module.exports = { app, server };
