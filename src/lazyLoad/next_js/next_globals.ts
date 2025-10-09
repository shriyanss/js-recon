export let buildId: string | null = null;

export const setBuildId = (id: string): void => {
    buildId = id;
};

export const getBuildId = (): string | null => {
    return buildId;
};
