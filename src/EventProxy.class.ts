
type GenericCallback<Item> = (arg: Item) => any;

export default class EventProxy<ArgType = any> {

    private _handlers: GenericCallback<ArgType>[] = [];
    public paused = false;
    public value: ArgType | undefined;

    constructor(arg?: ArgType) {
        this.value = arg;
    }

    public set = (subscriber: GenericCallback<ArgType>) => {
        this._handlers.push(subscriber);
    }

    /**
     * Removes the subscriber.
     */
    public remove = (subscriber: GenericCallback<ArgType>) => {
        const index = this._handlers.indexOf(subscriber);
        if (index > -1) this._handlers.splice(index, 1);
    }

    /**
     * Emits the event to all subscribers.
     */
    public emit(arg?: ArgType) {
        if (!this.paused) {
            this._handlers.forEach(handler => {
                //@ts-ignore
                handler(arg);
            });
        }
    }
}