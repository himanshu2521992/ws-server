import Redis from "ioredis";
import { env } from "../env";

let redisClient: Redis;
let redisSub: Redis;
export const redisLoader = async () => {
	const redisUri = env.redis.host;
	try {
		redisClient = new Redis();
		redisSub = new Redis();
		console.log('connected');
	} catch (error) {
		throw error;
	}
};

export { redisClient, redisSub };