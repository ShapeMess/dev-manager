
import { spawn } from 'child_process'; 
import c from 'chalk';
import EventProxy from './EventProxy.class';
import treeKill from 'tree-kill';

import type cp from 'child_process'
import type * as T from '../Types'

export interface Options extends cp.SpawnOptions {
    name: string
    messages: T.Messages
}

export default class Process {

    declare public process: cp.ChildProcess;
    declare public alive: boolean;
    public status?: 'alive'|'dead'|'terminated';
    public restarted = false;

    public onClose = new EventProxy<never>();
    public onSpawn = new EventProxy<never>();
    private $msg: T.Messages;

    private $spawnCommand: string;
    private $spawnArgv: string[];
    private $spawnOptions: Options;

    constructor(command: string, argv: string[], options?: Options) {

        this.$spawnCommand = command;
        this.$spawnArgv = argv;
        this.$spawnOptions = options!;
        this.$msg = options!.messages;

        this.$spawn(command, argv, options);
        this.$registerEvents();

        this.onClose.set(() => console.error(c.redBright(this.$msg.processClosed?.replace('%s', this.$spawnOptions!.name))));

    }

    private $spawn(command: string, argv: string[], options?: cp.SpawnOptions & Options) {

        this.process = spawn(command, argv, {
            stdio: ['ignore', 'inherit', 'inherit'],
            shell: true,
            ...options
        });

    }

    private $registerEvents() {

        this.process.on('spawn', () => {
            this.alive = true;
            this.status = 'alive';
            this.onSpawn.emit();
            // Allow close events in case the process was restarted.
            this.onClose.paused = false;
        });

        this.process.on('close', () => {
            this.alive = false;
            if (this.status !== 'terminated') this.status = 'dead';
            this.onClose.emit();
        });
    }

    public restart = () => new Promise<void>((resolve, reject) => {
        try {

            this.onClose.paused = true;
            this.restarted = true;

            treeKill(this.process.pid!, (err) => {
                if (err) console.error(err)
                else {
                    console.log(c.yellow(this.$msg.processRestarting?.replace('%s', this.$spawnOptions.name)));
                    this.$spawn(this.$spawnCommand, this.$spawnArgv, this.$spawnOptions);
                    this.$registerEvents();
                    resolve();
                }
            }); 
        } 
        catch (err) {
            console.log(err);
            reject();
        }
    })

    public revive = () => {
        this.restarted = true;
        this.$spawn(this.$spawnCommand, this.$spawnArgv, this.$spawnOptions);
        this.$registerEvents();
    }

    public killSilent = () => new Promise<void>((resolve, reject) => {
        try {

            this.onClose.paused = true;

            treeKill(this.process.pid!, (err) => {
                if (err) console.error(err)
                else {
                    console.log(c.yellow(this.$msg.processForceClosed?.replace('%s', this.$spawnOptions.name)));
                    this.status = 'terminated';
                    resolve();
                }
            }); 
        } 
        catch (err) {
            console.log(err);
            reject();
        }
    })

}
