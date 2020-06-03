import * as assert from 'assert';
import {DecodeSimhRegisters} from '../../../remotes/simh/decodesimhdata';
import {readFileSync} from 'fs';


suite('DecodeSimhRegisters', () => {
	let simhRegisters: DecodeSimhRegisters;
	const exampleResponse = readFileSync("./src/tests/data/remotes/simh/examine_state.txt").toString()

	setup(() => {
		simhRegisters = new DecodeSimhRegisters();
	})

	test("parsePC", () => {
		assert.equal(simhRegisters.parsePC(exampleResponse),0xFE2B)
		assert.equal(simhRegisters.parsePC(exampleResponse),0xFE2B)
	})
})