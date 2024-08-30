class MyPromise {
  #status = "pending"; //规范2.1.1  初始状态为 pending
  #result = undefined; //返回结果
  //接收一个 fn 函数,
  constructor(fn) {
    this.queue = []; //添加一个队列，存储onFulfilled, onRejected
    const resolve = (data) => {
      //规范2.1.2  不能转换为其他任何状态
      if (this.#status !== "pending") return;
      setTimeout(() => {
        this.#status = "fulfilled"; //规范2.1.2  状态变为 fulfilled
        this.#result = data;
        //2.2.6.1 如果/当promise被实现时，所有相应的onFulfilled回调函数必须按照它们发起then调用的顺序执行。
        this.queue.map((callbacks) => {
          const task = callbacks[0];
          task(data);
        });
      });
    };
    //规范 2.1.3.2  有一个失败原因
    const reject = (reason) => {
      //规范2.1.3  不能转换为其他任何状态
      if (this.#status !== "pending") return;
      setTimeout(() => {
        this.#status = "rejected"; //2.1.3    状态变为 rejected
        this.#result = reason;
        //2.2.6.2 如果/当promise被拒绝时，所有相应的onRejected回调函数必须按照它们发起then调用的顺序执行。
        this.queue.map((callbacks) => {
          const task = callbacks[1];
          task(reason);
        });
      });
    };

    // 如果函数执行过程中出错，状态变为rejected
    try {
      // this.queue.push([resolve, reject]);
      fn(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }
  //2.2.1 有一个then方法,有两个可选参数
  then(onFulfilled, onRejected) {
    //2.2.1.1 如果onFulfilled不是一个函数，它必须被忽略
    //2.2.5 onFulfilled和onRejected必须作为函数被调用（即没有this值

    onFulfilled =
      typeof onFulfilled === "function" ? onFulfilled : (data) => data;
    // 2.2.1.2 如果onRejected不是一个函数，它必须被忽略
    //2.2.5 onFulfilled和onRejected必须作为函数被调用（即没有this值

    onRejected =
      typeof onRejected === "function"
        ? onRejected
        : (reason) => {
            throw reason;
          };
    //2.2.7 必须返回一个 promise
    const p2 = new MyPromise((resolve, reject) => {
      //2.2.2.2 在promise实现之前不得调用onFulfilled。
      if (this.#status === "fulfilled") {
        //2.2.4 onFulfilled或onRejected不能在执行上下文堆栈中只包含平台代码之前调用。
        setTimeout(() => {
          try {
            const x = onFulfilled(this.#result);
            this.#resolvePromise(p2, x, resolve, reject);
          } catch (e) {
            //2.2.7.2 如果onFulfilled或onRejected抛出异常e，则promise2必须以e作为原因被拒绝
            reject(e);
          }
        });
      }
      //2.2.3.2 在promise被拒绝之前不得调用它。
      if (this.#status === "rejected") {
        //2.2.2.1 它必须在promise实现后调用，并以promise的值作为其第一个参数。
        setTimeout(() => {
          try {
            const x = onRejected(this.#result);
            this.#resolvePromise(p2, x, resolve, reject);
          } catch (e) {
            //2.2.7.2 如果onFulfilled或onRejected抛出异常e，则promise2必须以e作为原因被拒绝
            reject(e);
          }
        });
      }
      //2.2.6then方法可以在同一个promise上多次调用。
      if (this.#status === "pending") {
        this.queue.push([
          () => {
            setTimeout(() => {
              try {
                let x = onFulfilled(this.#result);
                this.#resolvePromise(p2, x, resolve, reject);
              } catch (e) {
                reject(e);
              }
            });
          },
          () => {
            setTimeout(() => {
              try {
                let x = onRejected(this.#result);
                this.#resolvePromise(p2, x, resolve, reject);
              } catch (e) {
                reject(e);
              }
            });
          },
        ]);
      }
    });
    return p2;
  }
  /**
   * 对resolve()、reject() 进行改造增强 针对resolve()和reject()中不同值情况 进行处理
   * @param  {promise} promise2 promise1.then方法返回的新的promise对象
   * @param  {[type]} x         promise1中onFulfilled或onRejected的返回值
   * @param  {[type]} resolve   promise2的resolve方法
   * @param  {[type]} reject    promise2的reject方法
   */
  #resolvePromise(promise2, x, resolve, reject) {
    //2.3.1 如果promise和x引用同一个对象，则以TypeError为原因拒绝promise
    if (x === promise2) {
      return reject(new TypeError("Chaining cycle detected for promise"));
    }
    //2.3.2 如果x是一个promise，采用其状态
    if (x instanceof MyPromise) {
      if (x.#status === "pending") {
        x.then(
          (y) => {
            this.#resolvePromise(promise2, y, resolve, reject);
          },
          () => {
            reject(x.#result);
          }
        );
      }
      if (x.#status === "fulfilled") {
        resolve(x.#result);
      }
      if (x.#status === "rejected") {
        reject(x.#result);
      }
    }
    //2.3.3 否则，如果x是一个对象或函数：
    //注意x不能为null
    else if (x !== null && (typeof x === "object" || typeof x === "function")) {
      var then;
      try {
        //2.3.3.2
        then = x.then;
        if (typeof then === "function") {
          //定义called表示y,r是否被调用过
          let called = false;
          //2.3.3.3.4
          try {
            then.call(
              x,
              //2.3.3.3.1
              (y) => {
                //2.3.3.3.3
                if (called) return;
                called = true;
                this.#resolvePromise(promise2, y, resolve, reject);
              },
              //2.3.3.3.2
              (r) => {
                //2.3.3.3.3
                if (called) return;
                called = true;
                reject(r);
              }
            );
          } catch (e) {
            //2.3.3.3.4.1
            if (called) return;
            //2.3.3.3.4.2
            reject(e);
          }
        } else {
          resolve(x);
        }
      } catch (e) {
        //2.3.3.3
        reject(e);
      }
    }
    //2.3.4 如果x不是对象或函数，则用x来实现promise。
    else {
      resolve(x);
    }
  }
}
MyPromise.deferred = function () {
  let result = {};
  result.promise = new MyPromise((resolve, reject) => {
    result.resolve = resolve;
    result.reject = reject;
  });
  return result;
};
module.exports = MyPromise;

console.log("1");
var p = new MyPromise((resolve, reject) => {
  setTimeout(() => {
    console.log("2");
    resolve(4);
    console.log("3");
  });
});
p.then((res) => {
  console.log("resolve1", res);
  return new MyPromise((resolve, reject) => {
    resolve(123);
  });
}, undefined).then(
  (res) => {
    console.log("resolve2", res);
  },
  (reason) => {
    console.log("reject2", reason);
  }
);
console.log("5");
