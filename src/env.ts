import dotenv from 'dotenv';
// Load environment variables from .env file
dotenv.config();

export const env = {
	app: {
		port: process.env.PORT || 3000,
	},
	redis: {
		host: process.env.REDIS_HOST || '',
	}
}