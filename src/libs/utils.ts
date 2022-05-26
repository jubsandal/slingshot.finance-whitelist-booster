export function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

export function randSleep(max: number = 5000, min: number = 100) {
    let ms = Math.round(Math.random() * (max-min) + min)
    return new Promise(resolve => setTimeout(resolve, ms));
}
