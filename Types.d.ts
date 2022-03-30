
export type ObjectOf<item = any> = Object & { [key: string]: item };

export type Messages = {
    processClosed?: string
    processForceClosed?: string
    processRestarting?: string
    processSpawning?: string

    startSequenceError?: string
    startProcessSuccess?: string

    managerExit?: string
}