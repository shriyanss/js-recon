import { VM } from "vm2";

const execFunc = (code, param) => {
    const vm = new VM({
        timeout: 2000,
        sandbox: {},
    });
    const func = vm.run(code);
    const output = func(param);
    return output;
};

export default execFunc;