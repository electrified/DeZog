import { Socket } from 'net';
import { Log, LogSocket } from '../../log';
import { Settings } from '../../settings';

/**
 * A command send to Zesarux debugger as it is being put in the queue.
 */
class CommandEntry {
	public command: string|undefined;	///< The command string
	public handlers: Array<Function> | undefined;	///< The handler being executed after receiving data.
	public timeout: number;		///< The timeout until a response is expected.
	public dispatched: boolean;
	public noResponse: boolean;
	constructor(command: string|undefined, handler: (data: string) => void | undefined, dispatched: boolean, timeout: number, noResponse: boolean = false) {
		this.command = command;
		this.handlers = [handler];
		this.timeout = timeout;
		this.dispatched = dispatched;
		this.noResponse = noResponse;
	}
}

enum SocketState {
	UNCONNECTED,
	CONNECTING,
	CONNECTED_WAITING_ON_WELCOME_MSG,
	CONNECTED
};

enum ConsoleState {
	UNAVAILABLE,
	AVAILABLE
};

const CONNECTION_TIMEOUT = 1000;	///< 1 sec

export class SimhSocket extends Socket {

	protected state: SocketState;	///< connected, etc.

	protected consoleState : ConsoleState;

	private queue: Array<CommandEntry>;

	// private lastCallQueue: Array<()=>void>;

	// Holds the incomplete received message.
	private receivedDataChunk: string;

	/// This value is set during initialization. It is the time that is
	/// waited on an answer before the connection is disconnected.
	/// In ms.
	/// See settings 'socketTimeout'.
	protected messageTimeout: number;

	/**
	 * Static init method. Creates a new socket object.
	 * Used in the launchRequest.
	 */
	public static Init() {
		sSocket = new SimhSocket();
		sSocket.init();
	}

	protected init() {
		this.unref();

		this.messageTimeout = Settings.launch.simh.socketTimeout*1000;
		this.state = SocketState.UNCONNECTED;
		this.consoleState = ConsoleState.UNAVAILABLE;
		this.queue = new Array<CommandEntry>();

		// Wait on first text from zesarux after connection
		var cEntry = new CommandEntry('this is a dummy command', data => {
			this.state = SocketState.CONNECTED;
			LogSocket.log('First text from simh received!');
			this.emit('connected');	// data transmission may start now.
		}, true, 0);
		this.queue.push(cEntry);
		this.emitQueueChanged();
	}

	public connectDebugger() {
		console.log("connecting debugger to simh")

		this.state = SocketState.CONNECTING;

		this.on('data', data => {
			this.receiveSocket(data);
		});

		this.on('close', () => {
			LogSocket.log('Socket close: disconnected from server');
			this.state = SocketState.UNCONNECTED;
		});

		this.on('error', err => {
			LogSocket.log('Socket: ' + err);
			this.state = SocketState.UNCONNECTED;
		});

		this.on('timeout', () => {
			switch(this.state) {
				case SocketState.CONNECTING:
				{
					const err = new Error('Connection timeout!');
					LogSocket.log('Socket timeout: ' + err);
					this.emit('error', err);
				}
				break;

				case SocketState.CONNECTED_WAITING_ON_WELCOME_MSG:
				{
					const err = new Error('Connected Simh, but Simh does not communicate!');
					LogSocket.log('Simh does not communicate: ' + err);
					this.emit('error', err);
				}
				break;

				case SocketState.CONNECTED:
				{
					const err = new Error('Simh did not answer in time!');
					LogSocket.log('Simh did not answer in time: ' + err);
					this.emit('error', err);
				}
				break;
			}
		});

		this.on('end', () => {
			this.state = SocketState.UNCONNECTED;
			LogSocket.log('Socket end: disconnected from server');
		});

		this.setTimeout(CONNECTION_TIMEOUT);
		const port = Settings.launch.simh.port;
		const hostname = Settings.launch.simh.hostname;
		this.connect(port, hostname, () => {

			// this.state = SocketState.CONNECTED;

			console.log("connected")
			// this.emit('connected');
			LogSocket.log('Socket: Connected to simh server!');
		});

	}

	/**
	 * If messages are still pending the messages is queued.
	 * Otherwise the message is directly send.
	 * After the message is executed the 'handler' is called.
	 * Additionally the timeout can be set until when a response is expected.
	 * @param command The message to send to ZEsarUX.
	 * @param handler Is called when the response is received. Can be undefined.
	 * @param suppressErrorHandling Normally a warning is output to the UI if a return value (from ZEsarUx)
	 * starts with the text "error". If suppressErrorHandling is true this
	 * is not signalled to the user.
	 * @param timeout The timeout in ms or 0 if no timeout should be used. Default is 100ms. Normally use -1 (or omit) to use the timeout from the Settings.
	 */
	public send(command: string, handler: {(data)} | undefined = (data) => {}, timeout: number = this.messageTimeout, noResponse : boolean = false) {
		if (!noResponse && this.queue.length > 0 && this.queue[this.queue.length - 1].command === command) {
			console.log("attaching handler to previous command as the same")
			this.queue[this.queue.length - 1].handlers?.push(handler)
		} else {
			// Create command entry
			var cEntry = new CommandEntry(command, handler, false, timeout, noResponse);
			this.queue.push(cEntry);
			this.emitQueueChanged();
			console.log("queueing " + cEntry.command + " depth " + this.queue.length)
		}

		if (this.queue.filter(cmd => !cmd.dispatched).length ==1) {
			// Send command
			this.sendSocket();
		}
	}

	/**
	 * Sends the oldest command in the queue through the socket.
	 */
	private sendSocket() {
		// Check if any command in the queue
		let dispatchedQueue = this.queue.filter(cmd => cmd.dispatched);

		if(dispatchedQueue.length > 1)
			return;

		// Send oldest command
		let cEntryIdx = this.queue.findIndex(cmd => !cmd.dispatched);

		if (cEntryIdx >= 0) {
			let cEntry = this.queue[cEntryIdx];

			if(cEntry.noResponse) {
				this.queue.splice(cEntryIdx, 1);
			}

			this.sendSocketCmd(cEntry);
		}
	}


	/**
	 * Sends a cmd through the socket.
	 * @param cmd The command to send.
	 */
	private sendSocketCmd(cmd: CommandEntry) {
		// check if connected
		if(this.state != SocketState.CONNECTED)
			return;

		// if(this.consoleState != ConsoleState.AVAILABLE)
		// 	return;
		// Send command
		if(cmd == undefined)
			return;
		// normal processing

		console.log("write " + cmd.command + " depth " + this.queue.length);

		let command = cmd.command + '\n';
		this.log('=>', "'"+cmd.command+"'");

		// Set timeout
		this.setTimeout(0);//cmd.timeout);

		// this.consoleState = ConsoleState.UNAVAILABLE;

		// Send
		this.write(command);
		this.write("#\n");

		cmd.dispatched = true;
	}

	/**
	 * Receives data from the socket.
	 */
	private receiveSocket(data: Buffer) {
		const sData = data.toString();
		if(!sData) {
			LogSocket.log('Error: Received ' + data.length + ' bytes of undefined data!');
			return;
		}

		this.receivedDataChunk += sData;

		const processedResponses = this.chunkResponse(this.receivedDataChunk)

		const remaining = processedResponses.pop()

		this.receivedDataChunk = remaining ? remaining : ''

		processedResponses.forEach(resp => this.processRecdData(resp))

		this.sendSocket()
	}



	/**
	 * Given a block of reponse text, removes the delimiters
	 *
	 *
	 * @param input
	 */
	public chunkResponse(input: string) : string[] {
		var responses : string[] = [];

		let promptIndex = [-1, 0];

		while((promptIndex = this.getPromptIndex(input))[0] >= 0) {
			const command = input.substring(0, promptIndex[0]).trim()

			input = input.substring(promptIndex[0] + promptIndex[1])

			const filteredCommand = command.split('\n')
				.map(ln => ln.trim())
				.filter(line => line.length > 0 && line != '#')

			if (filteredCommand.length != 0) {
				responses.push(filteredCommand.join('\n'))
				// console.log(promptIndex + " " + filteredCommand.join('\n'))
			}
		}
		responses.push(input)
		return responses
	}

	protected getPromptIndex(input: string): number[] {
		const tokens = [
			'sim>',
			'SIM>',
			'#'
		]

		const indexes = tokens.map( t => [input.indexOf(t), t.length]).reduce((acc, curr) => {
			if(acc[0] == -1) {
				return curr;
			}
			if (curr[0] >= 0 && curr[0] <= acc[0]) {
				return curr;
			}
			return acc;
		})

		return indexes;
	}

	protected processRecdData(commandResponse: string) {
		let cEntry: CommandEntry | undefined;

		//Simulation stopped, PC: 00C75 (AND 01h)
		//Breakpoint, PC: 00100 (JP 0604h)
		if(this.queue && this.queue.length > 0) {
			if (commandResponse.indexOf("Simulation stopped") >= 0 || commandResponse.indexOf("Breakpoint") >= 0) {
				const goIndex = this.queue.findIndex(cmd => cmd.command == "go")
				cEntry = this.queue.splice(goIndex, 1)[0];
				this.emitQueueChanged();
			} else if (commandResponse.indexOf("Simulator Running") >= 0 ) {
				//discard
			} else {
				const nonGoCommand = this.queue.findIndex(cmd => cmd.dispatched && cmd.command !== "go")
				if (nonGoCommand >=0) {
					cEntry = this.queue.splice(nonGoCommand, 1)[0];
					this.emitQueueChanged();
				}
			}
		}

		if(cEntry) {
			// Execute handler
			if (commandResponse.indexOf("Invalid remote console command") >= 0 ) {
				console.log("discarding command/response: " + cEntry.command + "resp " + commandResponse)
			} else if(cEntry != undefined) {
				console.log("response recd " + cEntry.command + " depth " + this.queue.length + " text " + commandResponse.replace('\n','').substring(0,20))
				cEntry.handlers?.forEach(handler => handler(commandResponse))
			}

		}
	}


	/**
	 * Signals that the queue has changed.
	 * Used by the Unit Tests to find out when to start the
	 * unit tests.
	 */
	protected emitQueueChanged() {
		this.emit('queueChanged', this.queue.length);
	}

	/**
	 * Prints out a formatted log.
	 * @param prefix Use either '=>' for sending or '<=' for receiving.
	 * @param text The text to log. Can contain newlines.
	 */
	protected log(prefix: string, text: string|undefined) {
		if(!LogSocket.isEnabled())
			return;

		// Prefixes
		prefix += ' ';
		const prefixLen = prefix.length;
		const nextPrefix = ' '.repeat(prefixLen);

		// Log
		if(text == undefined)
			text = "(undefined)";
		const arr = text.split('\n');
		for(const line of arr) {
			LogSocket.log(prefix + line);
			prefix = nextPrefix;
		}

		// Log also globally, first line only
		let globLine = prefix + arr[0];
		if(arr.length > 1)
			globLine += ' ...';
		Log.log(globLine);
	}

	public async quit(handler = ()=>{}) {
		// Clear queues
		this.queue.length = 0;
		// this.lastCallQueue.length = 0;

		// Exchange listeners
		// this.myRemoveAllListeners();

		// Keep the data listener
		this.on('data', data => {
			this.receiveSocket(data);
		});

		// inform caller
		let handlerCalled = false;
		const func = () => {
			if(handlerCalled)
				return;
			handlerCalled = true;
			// sSocket.myRemoveAllListeners();
			handler();
		}
		// The new listeners
		this.once('error', () => {
			LogSocket.log('Socket error (should be close).');
			func();
			sSocket.end();
		});
		this.once('timeout', () => {
			LogSocket.log('Socket timeout (should be close).');
			func();
			sSocket.end();
		});
		this.once('close', () => {
			LogSocket.log('Socket closed. OK.');
			this.state = SocketState.UNCONNECTED;
			func();
		});
		this.once('end', () => {
			LogSocket.log('Socket end. OK.');
			this.state = SocketState.UNCONNECTED;
			func();
		});


		// Terminate if connected
		if(this.state == SocketState.CONNECTED ) {
			// Terminate connection
			LogSocket.log('Quitting:');
			// this.setTimeout(QUIT_TIMEOUT);
			this.send('\n');	// Just for the case that we are waiting on a breakpoint.
			// this.send('cpu-history enabled no', () => {}, true);
			this.send('set remote nomaster', data => {
				sSocket.end();
			});
			return;
		}

		// Otherwise just end (and call func)
		this.end();

		// If already destroyed directly call the handler
		if(this.destroyed)
			handler();
		else
			this.destroy();
	}
}


/// zSocket is the singleton object that should be accessed.
export let sSocket: SimhSocket;

