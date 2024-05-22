export const fetcher = (url: string) => fetch(url).then((r) => r.json());
export const randBetween = (min:number, max:number):number => {
    return Math.floor(Math.random() * (max - min) + min);
}