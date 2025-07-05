export interface Chunk {
    id: string;
    description: string;
    loadedOn: [];
    containsFetch: boolean;
    exports: string;
    callStack: [];
    code: string;
    imports: [];
    file: string;
}

export interface Chunks {
    "": Chunk;
}
