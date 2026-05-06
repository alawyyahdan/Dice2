let ioInstance = null;

function initSocket(server) {
  const { Server } = require('socket.io');

  ioInstance = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  ioInstance.on('connection', (socket) => {
    
    // Admin bergabung ke dashboard CS
    socket.on('join_admin', () => {
      socket.join('admins');
    });

    socket.on('disconnect', () => {
      // ignore
    });
  });

  return ioInstance;
}

function getIo() {
  if (!ioInstance) {
    throw new Error('Socket.io tidak diinisialisasi');
  }
  return ioInstance;
}

module.exports = { initSocket, getIo };
