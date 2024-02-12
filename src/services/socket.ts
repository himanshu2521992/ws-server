import { Server, Socket } from "socket.io";
import { SocketEvents } from "../utils/constant";
import { RedisSessionStore, RedisMessageStore, InMemorySocketStore } from "../store";
import { redisClient, redisSub } from '../loaders/redisLoader';

export interface Message {
	message: string;
}
// Declare the property you want to add to the Socket interface
declare module 'socket.io' {
	interface Socket {
		username: string;
	}
}

export default class SocketService {
	private _io: Server;
	constructor(server: any) {
		console.log('Init socket service');
		this._io = new Server(server, {
			cors: {
				origin: ["http://localhost:8080", "http://localhost:8081"],
			}
		});
		redisSub.subscribe("MESSAGES", (err: any, count: any) => {
			if (err) {
				// Just like other commands, subscribe() can fail for some reasons,
				// ex network issues.
				console.error("Failed to subscribe: %s", err.message);
			} else {
				// `count` represents the number of channels this client are currently subscribed to.
				console.log(
					`Subscribed successfully! This client is currently subscribed to ${count} channels.`
				);
			}
		});
	}
	get io() {
		return this._io;
	}

	initListener() {
		console.log('Initialize socket listeners');
		const io = this._io;
		const sessionStore = new RedisSessionStore();
		const messageStore = new RedisMessageStore();
		const socketStore = new InMemorySocketStore();
		io.use(async (socket, next) => {
			const username = socket.handshake.auth.username;
			if (!username) {
				return next(new Error("invalid username"));
			}
			(socket as any).username = username;
			next();
		});

		redisSub.on('message', (channel: string, message: string) => {
			if (channel === 'MESSAGES') {
				const { content, from, to } = JSON.parse(message);
				console.log(from, ' says ', content);
				const socket = socketStore.findSocket(from);
				if (socket) {
					socket.to(to).emit("private message", { content, from, to });
				}
			}
		});
		io.on(SocketEvents.CONNECT, async (socket: Socket) => {
			console.log('New socket conencted', socket.id);
			socketStore.saveSocket(socket.username, socket);
			// persist session
			await sessionStore.saveSession(socket.username, { username: socket.username, connected: true });

			// emit session details
			socket.emit("session", {
				username: socket.username,
			});

			socket.join(socket.username);

			// fetch existing users
			const users: any = [];
			const [messages, sessions] = await Promise.all([
				messageStore.findMessagesForUser(socket.username),
				sessionStore.findAllSessions(),
			]);
			const messagesPerUser = new Map();
			messages.forEach((message) => {
				const { from, to } = message;
				const otherUser = socket.username === from ? to : from;
				if (messagesPerUser.has(otherUser)) {
					messagesPerUser.get(otherUser).push(message);
				} else {
					messagesPerUser.set(otherUser, [message]);
				}
			});

			sessions.forEach((session: any) => {
				users.push({
					username: session.username,
					connected: session.connected,
					messages: messagesPerUser.get(session.username) || [],
				});
			});
			socket.emit("users", users);

			// notify existing users
			socket.broadcast.emit("user connected", {
				username: socket.username,
				connected: true,
				messages: [],
			});

			// forward the private message to the right recipient (and to other tabs of the sender)
			socket.on("private message", async ({ content, to }: { content: string, to: string }) => {
				const message = {
					content,
					from: socket.username,
					to,
				};
				await redisClient.publish('MESSAGES', JSON.stringify(message));
				// socket.to(to).emit("private message", content);
				messageStore.saveMessage(message);
			});

			socket.on(SocketEvents.DISCONNECT, async () => {
				console.log('user disconnected');
				const matchingSockets = await io.in(socket.username).allSockets();
				const isDisconnected = matchingSockets.size === 0;
				if (isDisconnected) {
					// notify other users
					socket.broadcast.emit("user disconnected", socket.username);
					// update the connection status of the session
					sessionStore.saveSession(socket.username, { username: socket.username, connected: false });
				}
			});
		});
	}
}
