import * as assert from 'assert';
import {SimhSocket} from '../../../remotes/simh/simhsocket';
import {readFileSync} from 'fs';


suite('SimhSocket', () => {
	let sSocket: SimhSocket;

	setup(() => {
		sSocket = new SimhSocket();
	})

	test("tokenising response", () => {
		const exampleResponse = readFileSync("./src/tests/data/remotes/simh/response1.txt").toString()
		const chunked = sSocket.chunkResponse(exampleResponse);

		assert.equal(chunked.length, 13)

		assert.equal(chunked[0], `Connected to the Altair 8800 (Z80) simulator REM-CON device, line 0
Altair 8800 (Z80) Remote Console
Enter single commands or to enter multiple command mode enter the ^E character
Master Mode Session`)

		assert.equal(chunked[1], `noecho\nUnknown command`)

		assert.equal(chunked[chunked.length - 1],` exa state
AF:     7008
BC:     0200
DE:     85AF
HL:     8330
PC:     00AE0
SP:     04F6
IX:     0000
IY:     06DA
AF1:    0000
BC1:    0000
` )
	})


	test.only("receiveSocket", () => {
		sSocket.enqueue("echo Startup")
		sSocket.enqueue("this is a dummy command")
		sSocket.enqueue("attach n8vem0 SBC_simh.rom")
		sSocket.enqueue("set sio port=68/0/00/00/00/F/00/T")
		sSocket.enqueue("set sio port=6D/0/01/00/20/F/00/F")
		sSocket.enqueue("go")
		sSocket.enqueue("examine state")

		sSocket.receiveSocket(readFileSync("./src/tests/data/remotes/simh/response3.txt"))
	})
})