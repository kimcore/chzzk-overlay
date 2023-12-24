export interface Badge {
    name: string;
    src: string;
}

export interface Chat {
    uid: string;
    time: number;
    nickname: string;
    badges: Badge[];
    color: number | string;
    emojis: Record<string, string>;
    message: string;
}
