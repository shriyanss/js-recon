
export let requests = [];
export const addRequest = (url) => {
    requests.push(url);
};

export const getRequest = () => {
    return requests.shift();
};

export const isEmpty = () => {
    return requests.length === 0;
};