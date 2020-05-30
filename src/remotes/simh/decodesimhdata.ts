import {DecodeRegisterData, RegisterData} from '../decodehistinfo';
import {Utility} from '../../misc/utility';



/**
 * The specific handling of Z80 registers in ZEsarUX format.
 * The routines work completely on the cached register string received from ZEsarUX.
 * The cache is set and cleared only from outside this class while e.g. stepping or
 * reverse debugging.
 * This class does not communicate with the zesarux socket on its own.
 */
export class DecodeSimhRegisters extends DecodeRegisterData {
	// Indices for first time search.
	protected pcIndex: number;
	protected spIndex: number;
	protected afIndex: number;
	protected bcIndex: number;
	protected hlIndex: number;
	protected deIndex: number;
	protected ixIndex: number;
	protected iyIndex: number;
	protected af1Index: number;
	protected bc1Index: number;
	protected hl1Index: number;
	protected de1Index: number;
	protected irIndex: number;
	protected imIndex: number;


	/**
	* Called during the launchRequest.
	*/
	constructor() {
		super();

		// Indices for first time search.
		this.pcIndex = -1;
		this.spIndex = -1;
		this.afIndex = -1;
		this.bcIndex = -1;
		this.deIndex = -1;
		this.hlIndex = -1;
		this.ixIndex = -1;
		this.iyIndex = -1;
		this.af1Index = -1;
		this.bc1Index = -1;
		this.hl1Index = -1;
		this.de1Index = -1;
		this.irIndex = -1;
		this.imIndex=-1;
	}


	private getValue(data: RegisterData, identifier: string) {
		const splitData: string[] = data.split("\n");
		const indexField: string = identifier.toLowerCase() + 'Index';
		if (this[indexField] == -1) {
			this[indexField] = splitData.findIndex(text => text.startsWith(identifier + ':'));
			Utility.assert(this[indexField] >= 0);
		}
		try {
			return parseInt(splitData[this[indexField]].split(':')[1], 16);;
		} catch {
			console.log("oh no")
		}
		return 0;
	}

	public parsePC(data: RegisterData): number {
		return this.getValue(data, 'PC');
	}

	public parseSP(data: RegisterData): number {
		return this.getValue(data, 'SP');
	}

	public parseAF(data: RegisterData): number {
		return this.getValue(data, 'AF');
	}

	public parseBC(data: RegisterData): number {
		return this.getValue(data, 'BC');
	}

	public parseHL(data: RegisterData): number {
		return this.getValue(data, 'HL');
	}

	public parseDE(data: RegisterData): number {
		return this.getValue(data, 'DE');
	}

	public parseIX(data: RegisterData): number {
		return this.getValue(data, 'IX');
	}

	public parseIY(data: RegisterData): number {
		return this.getValue(data, 'IY');
	}

	public parseAF2(data: RegisterData): number {
		return this.getValue(data, 'AF1');
	}

	public parseBC2(data: RegisterData): number {
		return this.getValue(data, 'BC1');
	}

	public parseHL2(data: RegisterData): number {
		return this.getValue(data, 'HL1');
	}

	public parseDE2(data: RegisterData): number {
		return this.getValue(data, 'DE1');
	}

	public parseI(data: RegisterData): number {
		return this.getValue(data, 'IR');
	}

	public parseR(data: string): number {
		return this.getValue(data, 'IR');
	}

	public parseIM(data: string): number {
		return 0;
	}
}
