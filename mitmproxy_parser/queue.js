
export let requests = [];
export const addRequest = (url) => {
    requests.push(url);
    console.log("request added", url);
};

export const getRequest = () => {
    return requests.shift();
};

export const isEmpty = () => {
    return requests.length === 0;
};

// after the response is received, these can be used
export let responses = [];

export const addResponse = (url, response) => {
    responses[url] = response;
    console.log("response added", url);
};

export const getResponse = (url) => {
    const response = responses[url];
    if (response) {
        delete responses[url];
        return response;
    }
    return;
};