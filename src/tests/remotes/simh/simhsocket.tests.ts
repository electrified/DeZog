import * as assert from 'assert';
import {SimhSocket, sSocket} from '../../../remotes/simh/simhsocket';
import {Settings} from '../../../settings'
import {readFileSync} from 'fs';
import {GO_COMMAND, GET_REGISTERS} from '../../../remotes/simh/simhremote';

suite('SimhSocket', () => {
	setup(() => {
		const cfgEmpty: any = {
		};
		Settings.Init(cfgEmpty, '');
		SimhSocket.Init();
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
		let responses : string[] = []

		// calling init causes a dummy message to be enqueud. this eats the header
		sSocket.enqueue({command: "attach n8vem0 SBC_simh.rom", handler: data => {responses[0] = data}})
		sSocket.enqueue({command: "set sio port=68/0/00/00/00/F/00/T", handler: data => {responses[1] = data}})
		sSocket.enqueue({command: "set sio port=6D/0/01/00/20/F/00/F", handler: data => {responses[2] = data}})
		sSocket.enqueue({ ...GO_COMMAND, handler: data => {responses[3] = data}})
		sSocket.enqueue({ ...GET_REGISTERS, handler: data => {responses[4] = data}})

		sSocket.queue.forEach(item => item.dispatched = true);

		sSocket.processResponses(readFileSync("./src/tests/data/remotes/simh/response3.txt"))

		assert.equal(responses[0], `attach n8vem0 SBC_simh.rom`)
	})
})