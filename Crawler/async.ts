module Vasync {
    export let asyncCallBack = (thenFunc: () => void, waits: Array<any>,funcName:string) => {
        let waitSignal = new Array<boolean>(waits.length);
        let checkSignal = () => {
            for (let i in waitSignal) {
                if (!waitSignal[i]) {
                    return;
                }
            }
            for (let i in waitSignal) {
                waitSignal[i] = false;
            }
            thenFunc();
        };
        for (let i in waits) {
            let index = Number(i);
            waitSignal[index] = false;
            let instance = waits[index];
            let name = funcName + "PackagingTest";
            instance[name] = instance[funcName];
            instance[funcName] = function () {
                waitSignal[index] = true;
                if (arguments.length < 1) {
                    instance[name]();
                } else {
                    instance[name].apply(instance,arguments);
                }
                checkSignal();
            }
        }
    }
    export let waitallthen = (thenFunc: () => void, waits: Array<[any, string]>) => {
        let waitSignal = new Array<boolean>(waits.length);
        let checkSignal = () => {
            for (let i in waitSignal) {
                if (!waitSignal[i]) {
                    return;
                }
            }
            for (let i in waitSignal) {
                waitSignal[i] = false;
            }
            thenFunc();
        };

        for (let i in waits) {
            waitSignal[i] = false;
            let instance = waits[i][0];
            let funcname = waits[i][1];
            instance[funcname + "_original"] = instance[funcname];
            let funcstr: string = instance[funcname].toString();
            let paramStartPos = funcstr.indexOf('(');
            let paramEndPos = funcstr.indexOf(')');
            let paramstr = funcstr.substr(paramStartPos + 1, paramEndPos - paramStartPos - 1);
            let params = paramstr.split(',');
            let newfunction = "function (";
            if (params.length != 0) {
                newfunction += params[0];
            }
            for (let i = 1; i < params.length; i++) {
                newfunction += "," + params[i];
            }
            newfunction += ") { ";
            newfunction += " this." + funcname + "_original(";
            if (params.length != 0) {
                newfunction += params[0];
            }
            for (let i = 1; i < params.length; i++) {
                newfunction += "," + params[i];
            }
            newfunction += " );";
            newfunction += "(function () { " +
                    "waitSignal[" + i + "] = true;" +
                    "checkSignal();" +
                    "}) (); " +
                "}";

            eval("instance[funcname] = " + newfunction);

            //let insertpos = funcstr.lastIndexOf('}');
            //let before = funcstr.substr(0, insertpos);
            //let after = funcstr.substr(insertpos, funcstr.length - insertpos);
            //let insert = "(function () { " +
            //    "waitSignal[" + i + "] = true;" +
            //    "checkSignal();" +
            //    "}) (); "
            //eval("instance[funcname] = " + before + insert + after);
        }
    }

//// example :
//let then = () => { console.log("then"); }
//
    export class VSyncObj {
        constructor() { }
        FinishFunc() { }
    }

    export function createAWaitAll(waitCount: number, then: () => void): Array<VSyncObj> {
        let rtVal = new Array<VSyncObj>();
        let waits = new Array<[any, string]>();
        for (let i = 0; i < waitCount; i++) {
            rtVal.push(new VSyncObj());
            waits.push([rtVal[i], "FinishFunc"]);
        }
        waitallthen(then, waits);
        return rtVal;
    }
//
//let wait1 = new VObj("wait1");
//let wait2 = new VObj("wait2");
//let wait3 = new VObj("wait3");

//waitallthen(then, [[wait1, "testFunc"], [wait2, "testFunc"], [wait3, "testFunc"]]);
//
//wait1.testFunc();
//wait2.testFunc();
//wait3.testFunc();
}
export { Vasync }