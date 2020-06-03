// import { sSocket  } from './simhsocket';
//import { Z80RegistersClass } from '../z80registers';
import {CpuHistoryClass} from '../cpuhistory';
import {HistoryInstructionInfo, DecodeHistoryInfo} from '../decodehistinfo';
// import {Utility} from '../../misc/utility';

/**
 * Use similar data as DecodeRegisterData but with data extension.
 */
export class DecodeSimhHistoryInfo extends DecodeHistoryInfo {

	// The first time the index is searched. Afterwards the stored one is used.
	protected pcContentsIndex=-1;

	// The first time the index is searched. Afterwards the stored one is used.
	protected spContentsIndex=-1;


	/**
	 * Input a line which was retrieved by 'cpu-history get N' and return the opcodes string.
	 * @param line E.g. "PC=0039 SP=ff44 AF=005c BC=ffff HL=10a8 DE=5cb9 IX=ffff IY=5c3a AF'=0044 BC'=174b HL'=107f DE'=0006 I=3f R=06 IM1 IFF-- (PC)=e52a785c"
	 * @return E.g. 0x5C782AE52 as number
	 */
	public getOpcodes(line: HistoryInstructionInfo): number {
		// if (this.pcContentsIndex<0) {
		// 	this.pcContentsIndex=line.indexOf('(PC)=');
		// 	Utility.assert(this.pcContentsIndex>=0);
		// 	this.pcContentsIndex+=5;
		// }
		// const opcodes=line.substr(this.pcContentsIndex, 8);
		// // Change into number (exchange byte positions)
		// const opc=parseInt(opcodes, 16);
		// let result=opc>>>24;
		// result|=(opc>>>8)&0xFF00;
		// result|=(opc<<8)&0xFF0000;
		// //result|=(opc<<24)&0xFF000000
		// result+=(opc&0xFF)*256*65536;	// Otherwise the result might be negative
		return 0;
	}


	/**
	 * Reads the SP content from a given opcode string.
	 * Uses '(SP)=xxxx'  from the input string.
	 * @param line E.g. "PC=0039 SP=ff44 AF=005c BC=ffff HL=10a8 DE=5cb9 IX=ffff IY=5c3a AF'=0044 BC'=174b HL'=107f DE'=0006 I=3f R=06 IM1 IFF-- (PC)=e52a785c (SP)=a2bf"
	 * @returns The (sp), e.g. 0xA2BF
	 */
	public getSPContent(line: string): number {
		// if (this.spContentsIndex<0) {
		// 	this.spContentsIndex=line.indexOf('(SP)=');
		// 	Utility.assert(this.spContentsIndex>=0);
		// 	this.spContentsIndex+=5;
		// }
		// const spString=line.substr(this.spContentsIndex, 4);
		// const sp=parseInt(spString, 16);
		// return sp;
		return 0;
	}
}


/**
 * This class takes care of the ZEsarUX cpu history.
 */
export class SimhCpuHistory extends CpuHistoryClass {

	/**
	 * Init.
	 */
	public init() {
		super.init();
		if(this.maxSize > 0) {
			// zSocket.send('cpu-history enabled yes', () => {}, true);
			// zSocket.send('cpu-history set-max-size '+this.maxSize);
			// zSocket.send('cpu-history clear');
			// zSocket.send('cpu-history started yes');
			// zSocket.send('cpu-history ignrephalt yes');
			// zSocket.send('cpu-history ignrepldxr yes');
		}
		else {
			// zSocket.send('cpu-history enabled no', () => {}, true);
		}
	}


	/**
	 * Retrieves the instruction from ZEsarUX cpu history.
	 * Is async.
	 * @param index The index to retrieve. Starts at 0.
	 * @returns A string with the registers.
	 */
	protected async getRemoteHistoryIndex(index: number): Promise<HistoryInstructionInfo|undefined> {
		return new Promise<string>(resolve => {
			// Utility.assert(index >= 0);
			// sSocket.send('show cpu history ' + index, data => { // 'cpu-history get' starts at 0 too
			// 	if(data.substr(0,5).toLowerCase() == 'error')
					resolve(undefined);
				// else
				// 	resolve(data);
			// });
		});
	}
}
