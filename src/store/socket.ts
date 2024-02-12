import { Socket } from "socket.io";

/* abstract */ class SocketStore {
	findSocket(id: string) { }
	saveSocket(id: string, session: Socket) { }
}

export class InMemorySocketStore extends SocketStore {
	socketMap: Map<any, any>;
	constructor() {
		super();
		this.socketMap = new Map();
	}

	findSocket(id: string) {
		return this.socketMap.get(id);
	}

	saveSocket(id: string, session: Socket) {
		this.socketMap.set(id, session);
	}
}
