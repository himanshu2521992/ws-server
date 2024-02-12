import express from 'express';
import http from 'http';
import SocketService from './services/socket';
import { redisLoader } from './loaders/redisLoader';
import { env } from './env';

const app = express();

(async () => {
	await redisLoader();

	app.get('/', (req, res) => {
		res.sendFile(__dirname + '/public/index.html');
	});

	const server = http.createServer(app);
	const socketService = new SocketService(server);
	const PORT = env.app.port;
	server.listen(PORT, () => {
		console.log(`Application is up and running on *:${PORT}`);
	});
	socketService.initListener();
})();

