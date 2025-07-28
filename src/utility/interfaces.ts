export interface Chunk {
    id: string;
    description: string;
    loadedOn: [];
    containsFetch: boolean;
    isAxiosClient: boolean;
    exports: string[];
    callStack: [];
    code: string;
    imports: string[];
    file: string;
}

export interface Chunks {
    [key: string]: Chunk;
}

export interface FoundJsFiles {
    [key: string]: string;
}
