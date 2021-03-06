
import Process from './Process.class';
import EventProxy from './EventProxy.class';
import * as u from './Utils';
import treeKill from 'tree-kill';
import c from 'chalk';

import type cp from 'child_process';
import type * as T from '../Types';

interface ProcessInitPram {
    /**
     * Process name for use in the CLI.
     */
    name: string
    /**
     * Command used to spawn the child process.
     */
    command: string,
    /** 
     * Amount of time to wait before spawning another process. 
     * Useful for compilers that might take a few seconds to initialize 
     * before throwing possible errors. Default: 500ms. 
     */
    wait?: number,
    /** 
     * Specifies if the Manager should exit after the process had 
     * thrown an error. False by default. 
     */
    exitOnError?: boolean
    /**
     * Standard process spawn options.
     */
    options?: cp.SpawnOptionsWithoutStdio | undefined
}

const defaultMessages: T.Messages = {
    processSpawning: 'Spawning "%s"',
    processSpawned: 'Process "%s" started.',
    processRespawning: 'Reviving process "%s".',
    processClosed: 'Process "%s" closed unexpectedly',
    processForceClosed: 'Killed process "%s".',
    processRestarting: 'Restarting process "%s".',

    startSequenceError: 'An error had accured while spawning child processes.',

    startProcessSuccess: 'Successfully spawned all child processes.',
    managerExit: 'Closing the process manager.'
}

export default class Manager {

    public process: T.ObjectOf<Process> = {};
    public messages: T.Messages;

    public closing = new EventProxy<boolean>(false);
    public onFinished = new EventProxy<boolean>();

    /** Specifies the default delay between spawning new processes. */
    public spawnGap = 300;

    private $toSpawn: ProcessInitPram[];

    constructor(toSpawn: ProcessInitPram[], messages: T.Messages) {
        this.messages = {...defaultMessages, ...messages};
        this.$toSpawn = toSpawn;
    }

    /**
     * Starts the manager and all the child scripts.
     * @returns boolean depending on if the operation was successful.
     */
    public start = () => new Promise<void>(async resolve => {

        const spawnProcess = (processInit: ProcessInitPram) => new Promise<void>((resolve, reject) => {
            try {

                console.log(c.yellowBright(this.messages.processSpawning?.replace('%s', processInit.name)))

                let argv = processInit.command.split(' ');
                let command = <string>argv.shift();
    
                // Spawn a process
                const process = new Process(command, argv, {
                    ...processInit.options,
                    name: processInit.name,
                    messages: this.messages
                });

                // Spawn processes one by one to avoid some errors
                process.onSpawn.set(() => {
                    
                    // Log to console that the process had started.
                    console.log(c.yellowBright(this.messages.processSpawned?.replace('%s', processInit.name)));

                    // Don't do anything if the process had been restarted.
                    if (!process.restarted) {
                        // Exit the main process if the child childs dies
                        process.onClose.set(() => this.exit());
                        // Prevent child from emitting the close event if the manager is closing to prevent multiple exit calls
                        this.closing.set((isClosing) => process.onClose.paused = isClosing);
        
                        this.process[processInit.name] = process;

                        // Spawn the next process if all others are alive
                        if (this.closing.value === false) resolve();
                        // If one of them had died
                        else reject();
                        
                    }
                })
            }
            catch (err) {
                reject(err);
            }
        });

        try {
            for (let i = 0; i < this.$toSpawn.length; i++) {
                await spawnProcess(this.$toSpawn[i]);
                await u.time(this.$toSpawn[i].wait || this.spawnGap);
            }
            // Everything had spawned properly and no process had died.
            console.log(c.greenBright(this.messages.startProcessSuccess));
            resolve();
        } 
        catch (error) {
            console.error(c.redBright(this.messages.startSequenceError));
            console.error(error);
            resolve();
        }
    });

    /**
     * Reloads a script of a given name without restarting the entire master process.
     */
    public restart = (scriptName: string) => new Promise<"success"|"failed"|"unknown_name">(async (resolve) => {
        try {
            if (this.process[scriptName]) {
                await this.process[scriptName].restart();
                resolve('success')
            }
            else resolve("unknown_name");
        } 
        catch (err) {
            console.error(err);
            resolve("failed");
        }
    });
    
    /**
     * Terminates a script of a given name without restarting the entire master process.
     */
    public terminate = (scriptName: string) => new Promise<"success"|"failed"|"unknown_name">(async (resolve) => {
        try {
            if (this.process[scriptName]) {
                await this.process[scriptName].killSilent();
                resolve('success')
            }
            else resolve("unknown_name");
        } 
        catch (err) {
            console.error(err);
            resolve("failed");
        }
    });
    
    /**
     * Attempts to revive a script of a given name.
     */
    public revive = (scriptName: string): "success"|"unknown_name"|"not_terminated" => {
        if (this.process[scriptName]) {
            if (this.process[scriptName].status === 'terminated') this.process[scriptName].revive();
            else return 'not_terminated';
            return 'success';
        }
        return 'unknown_name';
    }

    /**
     * Kills all the child processes and exits.
     */
    public exit() {
        // Prevent closing twice
        if (this.closing.value === false) {

            console.log(c.redBright(this.messages.managerExit));

            this.closing.emit(true);
            let p = Object.keys(this.process);
            let counter = 0;
    
            const kill = () => {
                if (counter === p.length) {
                    process.exit()
                }
                else {
                    let i = counter++;
                    const pid = <number>this.process[p[i]].process.pid;
                    
                    // Only attempt to kile alive procsses to prevent taskkill error
                    if (this.process[p[i]].alive) {
                        treeKill(pid, (err) => {
                            if (err) console.error(err);
                            else console.log(c.redBright(this.messages.processForceClosed!.replace('%s', p[i])))
                            kill();
                        });
                    }
                    else kill();
                }
            }
    
            kill();
        }
    }

}


