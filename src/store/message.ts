import { Redis } from "ioredis";
import { redisClient } from "../loaders/redisLoader";

/* abstract */ class MessageStore {
	saveMessage(message: { from: string, to: string }) { }
	findMessagesForUser(userID: string) { }
}

const CONVERSATION_TTL = 24 * 60 * 60;

export class RedisMessageStore extends MessageStore {
	redisClient: Redis;
	constructor() {
		super();
		this.redisClient = redisClient;
	}

	saveMessage(message: { from: string, to: string }) {
		const value = JSON.stringify(message);
		this.redisClient
			.multi()
			.rpush(`messages:${message.from}`, value)
			.rpush(`messages:${message.to}`, value)
			.expire(`messages:${message.from}`, CONVERSATION_TTL)
			.expire(`messages:${message.to}`, CONVERSATION_TTL)
			.exec();
	}

	async findMessagesForUser(userID: string) {
		return this.redisClient
			.lrange(`messages:${userID}`, 0, -1)
			.then((results) => {
				return results.map((result) => JSON.parse(result));
			});
	}
}
