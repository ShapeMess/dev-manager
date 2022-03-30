
export const time = (timeout: number) => new Promise(resolve => {
    setTimeout(resolve, timeout);
})