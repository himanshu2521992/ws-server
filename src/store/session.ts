import { Redis } from "ioredis";
import { redisClient } from "../loaders/redisLoader";

/* abstract */ class SessionStore {
	findSession(id: string) { }
	saveSession(id: string, session: string) { }
	findAllSessions() { }
}

const SESSION_TTL = 24 * 60 * 60;
const mapSession = ([username, connected]: (string | null)[]) =>
	username ? { username, connected: connected === "true" } : undefined;

export class RedisSessionStore extends SessionStore {
	private redisClient: Redis;
	constructor() {
		super();
		this.redisClient = redisClient;
	}

	async findSession(id: string) {
		const val = await this.redisClient
			.hmget(`session:${id}`, "username", "connected");
		console.log(val);
		return mapSession(val);
	}

	async saveSession(id: string, { username, connected }: any) {
		await this.redisClient
			.multi()
			.hset(
				`user:${id.toLowerCase()}`,
				"username",
				username,
				"connected",
				connected
			)
			.expire(`session:${id}`, SESSION_TTL)
			.exec();
	}

	async findAllSessions() {
		const keys = new Set();
		let nextIndex = 0;
		do {
			const [nextIndexAsStr, results] = await this.redisClient.scan(
				nextIndex,
				"MATCH",
				"user:*",
				"COUNT",
				"100"
			);
			nextIndex = parseInt(nextIndexAsStr, 10);
			results.forEach((s) => keys.add(s));
		} while (nextIndex !== 0);
		const commands: any[] = [];
		keys.forEach((key) => {
			commands.push(["hmget", key, "username", "connected"]);
		});
		return this.redisClient
			.multi(commands)
			.exec()
			.then((results) => {
				return results!
					.map(([err, session]: any) => (err ? undefined : mapSession(session)))
					.filter((v) => !!v);
			});
	}
}