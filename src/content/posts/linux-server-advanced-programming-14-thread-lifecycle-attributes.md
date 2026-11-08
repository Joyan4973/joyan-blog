---
title: "Linux 服务器高阶编程（14）：线程生命周期、回收分离与属性配置"
published: 2026-11-08T00:00:00Z
updated: 2026-11-08T00:00:00Z
description: "整理线程取消、join 回收、分离与退出方式，介绍线程标识比较、定向信号和线程属性及自定义栈配置。"
image: ""
tags:
  - Linux
  - 线程
  - pthread
  - 线程生命周期
  - 线程属性
  - 线程栈
  - 学习笔记
category: Linux 服务器高阶编程
draft: false
pinned: false
comment: true
readingTime: 20
lang: zh_CN
---

# Linux 服务器高阶编程（14）：线程生命周期、回收分离与属性配置

## 一、先看线程生命周期

```text
pthread_create()
       ↓
线程执行任务
       ↓
正常返回 / pthread_exit() / 响应取消
       ↓
结束后的资源处理
├─ joinable：由另一线程 pthread_join()
└─ detached：结束后自动回收线程相关资源
```

三件事不要混淆：

1. 取消：向目标发出结束请求。
2. 回收：等待目标结束，并处理其结束后保留的资源。
3. 分离：规定线程结束后不再由其他线程 join。

分离不是立即结束线程，发送取消请求也不等于已完成回收。

## 二、`pthread_cancel()`：发送线程取消请求

### 2.1 接口

```c
int pthread_cancel(pthread_t thread);
```

- 参数是目标线程的 pthread ID，不是 PID 或 `ps` 中的 LWP。
- 用主线程取消普通线程。
- 成功返回 0，失败返回错误号。

常用“杀死线程”描述其效果。更准确地说，它发送取消请求；请求何时生效，取决于目标的取消状态和类型。成功返回不保证目标此刻已结束。

### 2.2 默认的延迟取消与取消点

主要使用默认模式：允许取消，延迟响应。

如果线程一直计算、没有经过取消点，即使其他线程发出取消请求，它也可能继续运行。

### 2.3 `pthread_testcancel()`

```c
void pthread_testcancel(void);
```

用途：在调用线程中显式设置取消检查点。

```c
while (1) {
    pthread_testcancel();
}
```

在允许取消且有待处理请求时，它可以使线程响应取消；没有请求或禁止取消时，不会因此结束线程。

### 2.4 取消状态

线程可允许或禁止取消：

- `PTHREAD_CANCEL_ENABLE`：允许取消，默认状态。
- `PTHREAD_CANCEL_DISABLE`：禁止取消；有取消点也不能因此马上取消。

禁用期间的请求不宜理解成彻底丢失，重新启用后仍可能被处理

## 三、三种工作线程对照

### 3.1 版本 A：每秒打印

```c
while (1) {
    printf("普通线程执行中\n");
    sleep(1);
}
```

主线程创建后等待 5 秒，再请求取消：

```c
sleep(5);
pthread_cancel(tid);
while (1)
    sleep(1);
```

普通线程停止继续打印；用 `ps -eLf` 或 `ps -Lf <PID>` 检查线程数量

不要仅凭“不再打印”就认定线程一定已结束，最好结合状态或后续 join 确认。

### 3.2 版本 B：纯死循环

注释掉打印和休眠，留下：

```c
while (1) {
}
```

主线程虽输出“取消普通线程”的提示，普通线程可能仍在，原因是默认延迟取消尚未得到响应机会。

日志语句表示“代码执行到这里”，不等于目标操作已经完成。

### 3.3 版本 C：显式检查取消

工作函数核心：

```c
void *business(void *arg)
{
    int var;
    var = *((int *)arg);
    while (1) {
        //printf(...);
        //sleep(1);
        pthread_testcancel();
    }
    return NULL;
}
```

展示即便去掉打印和休眠，也可通过显式取消点响应请求

## 四、`pthread_join()`：等待、回收、取得返回值

### 4.1 默认 joinable

默认属性创建的新线程为可连接状态

```c
PTHREAD_CREATE_JOINABLE
```

可连接线程结束后，需要安排一次成功 join 或适当的分离管理，否则结束后保留的资源可能累积。

这里说的回收不是帮线程自动释放它申请过的一切业务资源，例如任意 `malloc()` 内存仍需程序管理。

### 4.2 接口与参数

```c
int pthread_join(pthread_t thread, void **retval);
```

| 参数 | 含义 |
| --- | --- |
| `thread` | 要等待、回收的目标线程 |
| `retval` | 输出目标线程返回的 `void *` 值；不需要时传 `NULL` |

典型用法：

```c
void *reval = NULL;
int err = pthread_join(tid, &reval);
```

因为需要把一个指针值传出来，所以参数是指针的地址，也就是 `void **`。

目标未结束会等待；目标已结束则可直接完成连接。成功返回 0，失败返回错误号。

## 五、返回 `(void *)9` 与段错误

### 5.1 工作函数

```c
void *business(void *arg)
{
    int seconds = 5;
    while (seconds--) {
        printf("thread 0x%x Runing.. sleep %d\n",
               (unsigned int)pthread_self(), seconds);
        sleep(1);
    }
    return (void *)9;
}
```

目的是返回一个编码值 9，不是分配了一个包含整数 9 的对象。

### 5.2 故意写错的接收方式

```c
printf("%d\n", *((int *)reval));
```

错误在于：把数值为 9 的指针表示，误当成指向合法 `int` 对象的地址，再解引用。

访问这样的无效低地址导致段错误

### 5.3 主函数

```c
int main(void)
{
    int err;
    void *reval = NULL;
    pthread_t tid;
    pthread_create(&tid, NULL, business, NULL);

    printf("master thread 0x%x, call join.\n",
           (unsigned int)pthread_self());
    if ((err = pthread_join(tid, &reval)) > 0) {
        printf("join error:%s\n", strerror(err));
        exit(0);
    }
    printf("join sucess, reval = %ld\n", (long int)reval);
    return 0;
}
```

## 六、`pthread_detach()`：分离线程

### 6.1 接口

```c
int pthread_detach(pthread_t thread);
```

设定目标线程为分离态；线程结束后，相关线程资源不再等待别人 join。

自己设置自己：

```c
pthread_detach(pthread_self());
```

### 6.2 joinable 与 detached

| 比较 | joinable | detached |
| --- | --- | --- |
| 称呼 | 回收态 | 分离态 |
| 结束后管理 | 安排 join | 线程资源自动回收 |
| 能否用 join 取得结果 | 可以 | 不可以 |
| 是否因此立即结束 | 否 | 否 |
| 是否独立于进程生存 | 否 | 否 |

分离后不能再改回 joinable，不应对已经分离的目标再次分离，也不能再 join 它。

### 6.3 如何选择

需要返回值时用回收方式，不需要时可考虑分离。

即便不需要返回值，也可能需要 join 来确认任务确实结束

### 6.4 join 与自分离

工作线程中调用：

```c
pthread_detach(pthread_self());
```

主线程创建后马上：

```c
pthread_join(tid, &reval);
```

多次运行，观察到不同结果，随后尝试在 join 前加入 `sleep(0)` 来改变时序，并显示无效参数等错误。

说明：线程调度次序并不固定，生命周期管理不能让双方互相抢。

## 七、`pthread_equal()`：比较线程 ID

```c
int pthread_equal(pthread_t t1, pthread_t t2);
```

- 返回非零表示相等，返回 0 表示不相等。
- 不是“返回错误号”的接口，不要沿用 `err > 0` 当失败。
- 用于在数组、集合中查找或比较已保存的有效 pthread ID。
- 不应假设 `pthread_t` 在所有平台都是可直接比较的整数。

## 八、`pthread_kill()`：给指定线程发信号

```c
#include <pthread.h>
#include <signal.h>

int pthread_kill(pthread_t thread, int sig);
```

与进程 `kill()` 的区别在于目标参数：一个使用 PID，一个使用同进程内的 pthread ID。

信号行为是进程级的，屏蔽字是线程级的。不能以为定向给一个线程发送 `SIGKILL` 就只杀那一个线程；终止等默认动作会影响整个进程。

### 8.1 信号参数为 0

```c
int err;
err = pthread_kill(tid, 0);
if (err == ESRCH) {
    /* 未找到目标 */
}
else {
    /* 此分支说明目标存在 */
}
```

`ESRCH` 来自 `<errno.h>`，这里仍检查返回值，不是检查 `errno`。

### 8.2 不能把它当成万能“线程存活检测器”

信号 0 不实际发送信号，只做错误检查。使用生命周期已经结束的线程 ID 属于危险操作，可能未定义，并非保证返回 `ESRCH`。而且 `else` 也不能一律认定存活，要区分其他错误。

可靠管理应依靠明确的线程生命周期与同步设计，不是对任意旧 ID 反复探测。

## 九、`pthread_exit()` 与四种退出方式

```c
void pthread_exit(void *retval);
```

让调用线程结束，提供一个可由 join 接收的值。它不会正常返回到下一条语句。

| 方式 | main 中使用 | 工作函数中使用 |
| --- | --- | --- |
| `return` | 从 main 返回导致进程终止 | 从线程入口函数返回，结束该线程 |
| `exit()` | 终止进程及其线程 | 同样终止整个进程 |
| `pthread_cancel(tid)` | 请求取消目标 | 同样可请求取消有效目标 |
| `pthread_exit(value)` | 结束主线程，其他线程可继续 | 结束调用线程，其他线程可继续 |

这里的 `return` 指从线程入口或 main 返回；普通辅助函数中的 `return` 只是返回调用者，不能一律理解成线程结束。

### 9.1 进程可以没有仍在运行的主线程吗

可以。主线程通过线程级退出后，其他线程可继续执行；最后一个线程结束后，进程也随之结束。

### 9.2 普通线程也能创建线程

把工作线程改为再调用一次 `pthread_create()`，指定新的工作函数 `b2`，观察到三个线程。

```text
主线程 → 创建普通线程 A
              ↓
         A 创建普通线程 B
```

## 十、本章基础接口汇总

进入属性前回顾八个基础接口：

| 接口 | 用途 |
| --- | --- |
| `pthread_create()` | 创建线程 |
| `pthread_self()` | 得到自己的 ID |
| `pthread_cancel()` | 请求取消目标 |
| `pthread_join()` | 等待、回收、取返回值 |
| `pthread_detach()` | 设置分离 |
| `pthread_equal()` | 比较 ID |
| `pthread_kill()` | 向线程发信号 |
| `pthread_exit()` | 退出调用线程 |

## 十一、线程属性：先设置，再创建

```c
pthread_attr_t attr;
```

线程属性可理解为创建模板，不是一个已经运行的线程，也不应直接访问其内部成员。

方向：调度优先级、警戒区、分离状态、栈地址、栈大小。

### 11.1 初始化与销毁

```c
pthread_attr_init(&attr);
/* 获取或修改属性，用来创建线程 */
pthread_attr_destroy(&attr);
```

初始化为默认属性；不用时销毁属性对象

### 11.2 三个不同生命周期

- `attr`：创建配置对象。
- 线程：执行任务的对象。
- 手动分配的栈内存：由开发者管理的存储。

销毁属性对象，不等于回收线程，也不等于释放开发者 `malloc()` 的栈内存

## 十二、直接创建分离态线程

### 12.1 获取分离状态

```c
int detachstate;
pthread_attr_getdetachstate(&attr, &detachstate);

if (detachstate == PTHREAD_CREATE_JOINABLE) {
    /* 回收态 */
}
else if (detachstate == PTHREAD_CREATE_DETACHED) {
    /* 分离态 */
}
```

关键字必须是：

```c
PTHREAD_CREATE_JOINABLE
PTHREAD_CREATE_DETACHED
```

### 12.2 两种分离方式怎样选

- 少数已创建的 joinable 线程需要改为分离：使用 `pthread_detach()`。
- 一开始就确定批量线程应是分离态：提前设置属性，再按模板创建。

## 十三、属性实验与两次排错

工作函数 `bs()` 持续休眠。主线程依次：

1. 初始化属性。
2. 读取默认分离状态并打印。
3. 设置 `PTHREAD_CREATE_DETACHED`。
4. 用 `&attr` 创建线程。
5. 故意尝试 join，观察错误。

### 13.1 编译时线程库选项

```bash
gcc pthread_exitstatus.c -lpthread -o app
```

正确配置线程构建选项，并检查每个接口返回值

### 13.2 打印了未赋值的 `err`

```c
int err;
if ((err = pthread_join(tid, NULL)) > 0) {
    printf("join error:%s\n", strerror(err));
    exit(0);
}
```

 `exit(0)` 是进程级退出，而且 0 通常表示正常状态

## 十四、获取属性中的栈信息

```c
void *stackaddr = NULL;
size_t stacksize;
pthread_attr_t attr;
pthread_attr_init(&attr);
pthread_attr_getstack(&attr, &stackaddr, &stacksize);
```

类型与参数关系：

- 地址用 `void *` 保存，输出时传其地址。
- 大小用 `size_t` 保存，输出时也传其地址。
- 查询的是属性对象中配置的信息，不是凭空找到某个运行线程的实际栈。

## 十五、自定义栈：申请内存、设置属性、创建线程

### 15.1 采用的方式

```c
pthread_attr_t attr;
pthread_attr_init(&attr);

void *stackaddr = NULL;
size_t stacksize = 0x100000;
stackaddr = (void *)malloc(stacksize);

pthread_attr_setstack(&attr, stackaddr, stacksize);
pthread_create(&tid, &attr, business, NULL);
```

`0x100000` 是 1048576 字节，即 1 MiB。

此片段是流程示意，`tid`、工作函数及头文件等需配齐；`malloc()`、属性设置、创建也都应检查失败。

### 15.2 循环创建的演示主体

```c
void *business(void *arg)
{
    while (1)
        sleep(1);
}

int main(void)
{
    int number = 0;
    pthread_attr_t attr;
    pthread_attr_init(&attr);
    void *stackaddr = NULL;
    size_t stacksize = 0x100000;
    int err;
    pthread_t tid;
    while (1) {
        //自行申请空间
        if ((stackaddr = (void *)malloc(stacksize)) == NULL) {
            perror("malloc failed");
            exit(0);
        }
        //设置属性
        pthread_attr_setstack(&attr, stackaddr, stacksize);
        if ((err = pthread_create(&tid, &attr, business, NULL)) > 0) {
            printf("thread create error:%s\n", strerror(err));
            exit(0);
        }
        printf("thread number %d\n", ++number);
    }
}
```

典型头文件仍包括 `<stdio.h>`、`<stdlib.h>`、`<unistd.h>`、`<string.h>`、`<pthread.h>`。

每次循环申请不同的空间，是因为多个仍运行的线程不能共用同一块栈存储。

### 15.3 强调的结论

不要为了盲目增加线程数量，随意缩小线程栈。栈越小，对递归、较大局部对象、调用深度等越敏感，溢出可能影响整个进程。

先评估真实任务的栈需求，再决定属性。默认配置能满足多数练习，不需要为了数字好看就改栈。
