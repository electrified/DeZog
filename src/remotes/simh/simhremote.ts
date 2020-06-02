
import {Z80Registers} from '../z80registers'; //Z80RegistersClass, Z80_REG,
// import {RefList} from '../misc/refList';
// import {CallStackFrame} from '../callstackframe';
// import {EventEmitter} from 'events';
import { sSocket, SimhSocket } from './simhsocket';
import {GenericWatchpoint, GenericBreakpoint} from '../../genericwatchpoint';
// import {Labels, SourceFileEntry} from '../labels';
// import {Settings, ListFile} from '../settings';
import {Utility} from '../../misc/utility';
// import {BaseMemory} from '../disassembler/basememory';
// import {Opcode, OpcodeFlag} from '../disassembler/opcode';
import {CpuHistory, CpuHistoryClass} from '../cpuhistory'; //StepHistory
// import {Disassembly, DisassemblyClass} from '../misc/disassembly';
import {RemoteBreakpoint, MemoryBank} from '../remotebase';


import { RemoteBase } from "../remotebase";
import { SimhCpuHistory, DecodeSimhHistoryInfo } from './simhcpuhistory';
import { DecodeSimhRegisters } from './decodesimhdata';


export const NO_TIMEOUT = 0;	///< Can be used as timeout value and has the special meaning: Don't use any timeout

export class SimhRemote extends RemoteBase {

	/// Constructor.
	constructor() {
		super();
		// Set decoder
		Z80Registers.decoder=new DecodeSimhRegisters();
		// Reverse debugging / CPU history
		CpuHistoryClass.setCpuHistory(new SimhCpuHistory());
		CpuHistory.decoder = new DecodeSimhHistoryInfo();
	}

	/// Do initialization.
	/// E.g. create a socket or allocate memory.
	/// This is called when the Remote is started by the debugger. I.e. at the start
	/// of a debugging session..
	/// When ready do a this.emit('initialized') or this.emit('error', exception);
	/// Take care to implement the emits otherwise the system will hang on a start.
	/// Please override.
	public async doInitialization(): Promise<void> {
		console.log("Init simh")
		// Create the socket for communication (not connected yet)
		this.setupSocket();

		// Connect zesarux debugger
		sSocket.connectDebugger();
	}

	protected setupSocket() {
		SimhSocket.Init();

		sSocket.on('connected', async () => {
			try {
				sSocket.send('echo Startup');
				sSocket.send('attach n8vem0 SBC_simh.rom');
				sSocket.send('set sio port=68/0/00/00/00/F/00/T');
				sSocket.send('set sio port=6D/0/01/00/20/F/00/F');
				// sSocket.send('set cpu history=32');
				// sSocket.send('expect "Boot Selection?" send "2"; continue');
				// sSocket.send('expect "Slice(0-9)[0]?" send "0"; continue');

				sSocket.send('go');

				// Send 'initialize' to Machine.
				this.emit('initialized');
			} catch(e) {
				// Some error occurred
				this.emit('error', e);
			}
		})
	}


	/**
	 * Stops a remote.
	 * This will e.g. disconnect the socket and un-use all data.
	 * Called e.g. when vscode sends a disconnectRequest
	 * Very much like 'terminate' but does not send the 'terminated' event.
	 */
	public async disconnect(): Promise<void> {
		if (!sSocket)
			return;
		return new Promise<void>(resolve => {
			// Terminate the socket
			sSocket.quit(() => {
				resolve();
			});
		});
	}

	/**
	* Gets the registers from cache. If cache is empty retrieves the registers from
	* the emulator.
    * Override.
	*/
	public async getRegisters(): Promise<void> {
		if (!Z80Registers.getCache()) {
			// Get new data
			return this.getRegistersFromEmulator();
		}
	}

	/**
	 * Retrieve the registers from zesarux directly.
	 * From outside better use 'getRegisters' (the cached version).
	 * @param handler(registersString) Passes 'registersString' to the handler.
	 */
	protected async getRegistersFromEmulator(): Promise<void>  {
		// Check if in reverse debugging mode
		// In this mode registersCache should be set and thus this function is never called.
		Utility.assert(CpuHistory);
		Utility.assert(!CpuHistory.isInStepBackMode());

		return new Promise<void>(resolve => {
			// Get new (real emulator) data
			sSocket.send('examine state', data => {
				Z80Registers.setCache(data);
				resolve();
			});
		});
	}



	/**
	 * Sets the value for a specific register.
	 * Reads the value from the emulator and returns it in the promise.
	 * Note: if in reverse debug mode the function should do nothing and the promise should return the previous value.
	 * @param register The register to set, e.g. "BC" or "A'". Note: the register name has to exist. I.e. it should be tested before.
	 * @param value The new register value.
	 * @return Promise with the "real" register value.
	 */
	public async setRegisterValue(register: string, value: number): Promise<number> {
		// Utility.assert(false);	// override this
		return 0;
	}

	/**
	 * 'continue' debugger program execution.
	 * @returns A Promise with a string.
	 * Is called when it's stopped e.g. when a breakpoint is hit.
	 * reason contains the stop reason as string.
	 */
	public async continue(): Promise<string> {
		return new Promise<string>(resolve => {
			sSocket.send('go', data => {
				Z80Registers.clearCache();
				this.clearCallStack();

				resolve(data);
			}, NO_TIMEOUT);
		});
	}

	/**
	 * 'pause' the debugger.
	 */
	public async pause(): Promise<void> {
		sSocket.send('\x05', () => {}, -1, true);
	}

	/**
	 * 'reverse continue' debugger program execution.
	 * The Promise resolves when it's stopped e.g. when a breakpoint is hit.
	 * @returns A string with the break reason. (Never undefined)
	 */
	public async reverseContinue(): Promise<string> {
		// Utility.assert(false);	// override this
		return "";
	}

	/**
	 * 'step over' an instruction in the debugger.
	 * @returns A Promise with:
	 * 'instruction' is the disassembly of the current line.
	 * 'breakReasonString' a possibly text with the break reason.
	 */
	public async stepOver(): Promise<{instruction: string, breakReasonString?: string}> {
		return this.stepInto();
	}


	/**
	 * 'step into' an instruction in the debugger.
	 * @returns A Promise:
	 * 'instruction' is the disassembly of the current line.
	 * 'breakReasonString' a possibly text with the break reason. This is mainly to keep the
	 * record consistent with stepOver. But it is e.g. used to inform when the
	 * end of the cpu history is reached.
	 */
	public async stepInto(): Promise<{instruction: string,breakReasonString?: string}> {
		return new Promise<{instruction: string, breakReasonString?: string}>(resolve => {
			// Normal step into.
			this.getRegisters().then(() => {
				const pc=Z80Registers.getPC();
				sSocket.send('examine -m '+ pc, instruction => {
					// Clear register cache
					Z80Registers.clearCache();
					sSocket.send('step', async result => {
						// Clear cache
						Z80Registers.clearCache();
						this.clearCallStack();
						// Handle code coverage
						// this.handleCodeCoverage();
						// Read the spot history
						await CpuHistory.getHistorySpotFromRemote();
						resolve({instruction});
					});
				});
			});
		});
	}


	/**
	 * 'step out' of current subroutine.
	 * @returns A Promise with a string containing the break reason.
	 * 'breakReasonString' a possibly text with the break reason.
	 */
	public async stepOut(): Promise<string> {
		// Utility.assert(false);	// override this
		return '';
	}


	/**
	 * Sets one watchpoint in the remote.
	 * Watchpoints result in a break in the program run if one of the addresses is written or read to.
	 * Promises is execute when last watchpoint has been set.
	 * @param wp The watchpoint to set. Will set 'bpId' in the 'watchPoint'.
	 */
	public async setWatchpoint(wp: GenericWatchpoint): Promise<void> {
		// Utility.assert(false);	// override this
	}


	/**
	 * Removes one watchpoint from the remote.
	 * Promises is execute when last watchpoint has been set.
	 * @param wp The watchpoint to renove. Will set 'bpId' in the 'watchPoint' to undefined.
	 */
	public async removeWatchpoint(wp: GenericWatchpoint): Promise<void> {
		// Utility.assert(false);	// override this
	}


	/**
	 * Enables/disables all assert breakpoints set from the sources.
	 * Promise is called when ready.
	 * @param enable true=enable, false=disable.
	 */
	public async enableAssertBreakpoints(enable: boolean): Promise<void>{
		// Utility.assert(false);	// override this
	}

		/**
	 * Set all log points.
	 * Called at startup and once by enableLogPoints (to turn a group on or off).
	 * Promise is called after the last logpoint is set.
	 * @param logpoints A list of addresses to put a log breakpoint on.
	 * @param enable Enable or disable the logpoints.
	 * @returns A promise that is called after the last watchpoint is set.
	 */
	public async enableLogpoints(logpoints: Array<GenericBreakpoint>, enable: boolean): Promise<void> {
		// Utility.assert(false);	// override this
	}


	/**
	 * Sets breakpoint in the Remote.
	 * Sets the breakpoint ID (bpId) in bp.
	 * This method is called also each time a breakpoint is manually set via the
	 * vscode UI.
	 * If set from UI the breakpoint may contain a condition and also a log.
	 * After creation the breakpoint is added to the 'breakpoints' array.
	 * @param bp The breakpoint.
	 * @returns The used breakpoint ID. 0 if no breakpoint is available anymore.
	 */
	public async setBreakpoint(bp: RemoteBreakpoint): Promise<number> {
		return new Promise<number>(resolve => {
			sSocket.send('\x05', () => {}, -1, true);
			sSocket.send('br ' + bp.address);
		});
	}


	/**
	 * Clears one breakpoint.
	 * Breakpoint is removed at the Remote and removed from the 'breakpoints' array.
	 */
	protected async removeBreakpoint(bp: RemoteBreakpoint): Promise<void> {
		// Utility.assert(false);	// override this
	}


	/**
	 * Sends a command to the emulator.
	 * Override if supported.
	 * @param cmd E.g. 'get-registers'.
	 * @returns A Promise in remote (emulator) dependend format.
	 */
	public async dbgExec(cmd: string): Promise<string> {
		cmd=cmd.trim();
		if (cmd.length==0) {
			// No command given
			throw new Error('No command given.');
		}

		// Send command to ZEsarUX
		return new Promise<string>(resolve => {
			sSocket.send(cmd, data => {
				// Call handler
				resolve(data);
			});
		});
	}


	/**
	 * Reads a memory dump and converts it to a number array.
	 * @param address The memory start address.
	 * @param size The memory size.
	 * @param handler(data, addr) The handler that receives the data. 'addr' gets the value of 'address'.
	 */
	public async readMemoryDump(address: number, size: number): Promise<Uint8Array> {
		// Utility.assert(false);	// override this
		return new Uint8Array();
	}


	/**
	 * Writes a memory dump.
	 * @param address The memory start address.
	 * @param dataArray The data to write.
	 */
	public async writeMemoryDump(address: number, dataArray: Uint8Array): Promise<void> {
		// Utility.assert(false);	// override this
	}

		/**
	 * Reads the memory pages, i.e. the slot/banks relationship from zesarux
	 * and converts it to an arry of MemoryBanks.
	 * @returns A Promise with an array with the available memory pages.
	 */
	public async getMemoryBanks(): Promise<MemoryBank[]> {
		return [];
	}


	/**
	 * Resets the T-States counter. Used before stepping to measure the
	 * time.
	 */
	public async resetTstates(): Promise<void> {
	}


	/**
	 * Returns the number of T-States (since last reset).
	 * @returns The number of T-States or 0 if not supported.
	 */
	public async getTstates(): Promise<number> {
		return 0;
	}


	/**
	 * Returns the current CPU frequency
	 * @returns The CPU frequency in Hz (e.g. 3500000 for 3.5MHz) or 0 if not supported.
	 */
	public async getCpuFrequency(): Promise<number> {
		return 0;
	}


	/**
	 * This method is called by the DebugSessionClass before a step (stepOver, stepInto, stepOut,
	 * continue, stepBack, etc.) is called.
	 * It can be overridden e.g. to clear/initialize some stuff
	 * e.g. coverage.
	 */
	public startProcessing() {
	}


	/**
	 * This method is called by the DebugSessionClass after a step (stepOver, stepInto, stepOut,
	 * continue, stepBack, etc.) is called.
	 * It can be overridden e.g. to do something at the end of a step.
	 * E.g. emit coverage.
	 */
	public stopProcessing() {
	}
}