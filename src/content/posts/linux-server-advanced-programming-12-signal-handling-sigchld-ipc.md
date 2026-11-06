---
title: "Linux 服务器高阶编程（12）：信号捕捉、子进程回收与信号通信"
published: 2026-11-01T01:00:00Z
updated: 2026-11-01T01:00:00Z
description: "整理信号捕捉的执行过程、EINTR 与未决信号集，通过 SIGCHLD 回收子进程，并使用 sigqueue 实现父子进程通信。"
image: ""
tags:
  - Linux
  - 信号
  - SIGCHLD
  - EINTR
  - sigqueue
  - 进程间通信
  - 学习笔记
category: Linux 服务器高阶编程
draft: false
pinned: false
comment: true
readingTime: 25
lang: zh_CN
---

# Linux 服务器高阶编程（12）：信号捕捉、子进程回收与信号通信

## 一、两个不能屏蔽、忽略或捕捉的信号

### 1.1 `SIGKILL` 与 `SIGSTOP`

回顾屏蔽、忽略和捕捉之后，补充两个例外：

| 信号 | 本次 Ubuntu/x86 环境编号 | 效果 | 能否自行改变其处理方式 |
| --- | --- | --- | --- |
| `SIGKILL` | 9 | 终止进程 | 不能屏蔽、忽略、捕捉 |
| `SIGSTOP` | 19 | 停止进程执行 | 不能屏蔽、忽略、捕捉 |

例如，一个进程即使试图把 `SIGKILL` 加入屏蔽集，也不能据此抵抗终止。

注意：不能屏蔽不等于任何用户都有权向任意进程发送它。发送信号仍然有权限检查。

### 1.2 发送信号也可能失败

向目标进程发送信号，需要具备相应权限。普通用户不能仅凭知道 PID 就任意终止其他权限主体的进程。

区分：

1. 信号根本没有成功发送。
2. 信号已产生，但当前被屏蔽，尚未递送。
3. 信号已经递送，但处理方式是忽略或自定义捕捉。
4. 观察错了进程，或者目标进程已经退出、PID 已变化。

## 二、`SIGSEGV` 实验：发送一个信号，不等于实际发生了内存错误

### 2.1 先屏蔽 `SIGSEGV`

关键代码：

```c
sigset_t newset, oldset;
sigemptyset(&newset);
sigaddset(&newset, SIGSEGV);
sigprocmask(SIG_SETMASK, &newset, &oldset);

while (1);
```

另一终端主动发送：

```bash
kill -11 <目标进程PID>
```

进程没有因此立即结束。这一部分是在验证由命令主动发出的信号可被阻塞。

### 2.2 再主动制造非法写操作

画面中加入的核心语句是：

```c
char *str = "12345";
str[0] = 'A';
```

这里的 `str` 是指针，指向字符串字面量。不能因为它的类型写成 `char *`，就认为字面量所在区域允许修改。

应区分两种操作：

```c
str = 其他地址;      /* 修改指针保存的地址 */
str[0] = 'A';        /* 修改其所指向的内容 */
```

本次实际内存写错误仍导致程序异常终止。实验目的在于说明：给进程发 `SIGSEGV` 与程序真正执行非法访存，不是同一种触发情形。

### 2.3 这一段的技术边界

以“系统发送者权限更高”解释实验差异，但不宜据此建立“root 进程就能安全屏蔽真实段错误”的结论。对于实际执行造成的 `SIGSEGV` 等同步异常，在阻塞状态下产生时有未定义行为边界；不能用屏蔽信号修复非法访存。

真正应修复的是越界、野指针、只读区写入等根因。

## 三、信号捕捉的执行过程

### 3.1 先区分三个时刻

- 产生：某个事件使信号产生。
- 未决：已经产生，但尚未递送。
- 递送与处理：执行默认动作、忽略，或进入安装好的捕捉函数。

因此，“信号发出”不代表捕捉函数已执行完，也不保证它在发送语句之后的某个固定时间点执行。

视频中用用户空间、内核空间和上下切换的图，说明信号检测与原执行流之间的关系。

### 3.2 如何理解执行流被打断

```text
正常用户代码运行
       ↓
进入内核处理相关事件
       ↓
检查可递送的未决信号
       ↓
准备并执行捕捉函数
       ↓
恢复被保存的执行上下文
       ↓
原程序继续运行
```

### 3.3 对“谁先执行完”的正确理解

在单线程、处理函数正常返回的模型中：

1. 主执行流原本正在运行。
2. 信号处理介入，原执行流暂时中断。
3. 捕捉函数先执行并返回。
4. 原执行流才继续。

因此，不能把捕捉函数理解为“旁边另外开了一个线程，主函数同时继续跑”。

也不能把这句话无限扩大：处理函数如果终止进程、不返回或进行其他控制转移，原执行流未必还能继续。

### 3.4 关于执行权限的核对说明

“保持内核权限调用用户捕捉函数”。Linux 实际会准备信号上下文并返回用户态执行处理函数；返回后通过信号跳板和 `sigreturn` 恢复现场。

## 四、捕捉函数与共享数据：为什么容易发生异常

### 4.1 作用域可见，不代表使用安全

假设有全局变量：

```c
int var = 700;
```

主函数可以访问，捕捉函数也可以访问。但这只是语言层面的可见性，不能推出它们的读写一定安全。

举例：

1. 主逻辑把中间结果计算到 705。
2. 此时信号到达，执行捕捉函数。
3. 捕捉函数把同一变量改为 706。
4. 主逻辑恢复后继续计算，使用的已不是它预期的中间值。

问题在于异步打断和共享状态，而不在于变量是不是能被编译器找到。

### 4.2 不只全局整数会出问题

实际设计中让处理函数尽量短，不在其中执行复杂业务。并非一切全局变量都绝对禁用；例如设置合适的 `volatile sig_atomic_t` 标志是常见做法，但这不代表任意全局结构、容器或复杂运算都安全。

### 4.3  `printf()` 不代表生产代码安全

为了观察效果，在捕捉函数中直接打印。

`printf()` 等标准 I/O 函数不是异步信号安全函数

### 4.4 不会为捕捉函数新建一个进程或线程

通过 CPU 时间片说明：信号处理仍使用当前执行上下文的资源，不是凭空多出一个能并行干活的执行单元。

处理函数耗时过长，会推迟原执行流恢复；不能把信号捕捉当作免费的后台任务。

## 五、阻塞调用被中断：`EINTR`

### 5.1 用网络接收理解阻塞

以 `recv()` 为例：

```text
网络数据到达 → socket 接收缓冲区 → recv() → 用户缓冲区
```

在默认阻塞模式下，当没有可返回的数据且连接等状态允许继续等待时，`recv()` 可能阻塞。

随后改用终端输入做实验，原因是更容易手动触发、观察。

### 5.2 最基础的终端输入输出实验

核心流程：

```c
read(STDIN_FILENO, buffer, sizeof(buffer));
write(STDOUT_FILENO, buffer, strlen(buffer));
```

- `STDIN_FILENO`：标准输入文件描述符。
- `STDOUT_FILENO`：标准输出文件描述符。
- 没有输入时，终端上的 `read()` 等待。
- 输入一行并回车后，程序读取，再输出到屏幕。

这一阶段主要验证“等待输入”的阻塞现象，并不是完整健壮的字符串处理示例。

### 5.3 安装一个空的 `SIGINT` 捕捉函数

捕捉函数几乎不做事：

```c
void sig_do(int n)
{
    //null
}
```

但“处理函数没有业务操作”不等于“这个信号对执行流没有影响”。进入并返回处理函数本身，就可能影响原本阻塞的系统调用。

### 5.4 代码

```c
#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <signal.h>
#include <errno.h>

void sig_do(int n)
{
    //null
}

int main(void)
{
    char buffer[1024];
    //信号捕捉设定
    struct sigaction act, oact;
    act.sa_handler = sig_do;
    act.sa_flags = 0;
    sigemptyset(&act.sa_mask);
    sigaction(SIGINT, &act, &oact);

    while (1) {
        printf("等待用户键入数据...(阻塞)\n");
        if ((read(STDIN_FILENO, buffer, sizeof(buffer))) == -1) {
            if (errno == EINTR) {
                printf("read 函数被强制中断..\n");
            }
            else {
                perror("read call failed");
            }
        }
        write(STDOUT_FILENO, buffer, strlen(buffer));
        bzero(buffer, sizeof(buffer));
    }
}
```

## 六、未决信号集的获取与逐位打印

### 6.1 三类信息不要混淆

| 信息 | 表示什么 | 涉及的接口 |
| --- | --- | --- |
| 信号屏蔽字 | 当前阻止递送哪些信号 | `sigprocmask()` |
| 未决信号集 | 哪些信号已产生但尚未递送 | `sigpending()` |
| 信号处理方式 | 递送时采取什么动作 | `sigaction()` |

信号被加入屏蔽字后，未决位并不会因此自动变成 1。必须先有相应信号产生，才有未决状态。

### 6.2  `output_pset()`

函数名保留为 `output_pset`，用途是打印集合，不是修改集合。

```c
void output_pset(sigset_t pset)
{
    int signo;
    for (signo = 1; signo < 32; signo++) {
        if (sigismember(&pset, signo))
            putchar('1');
        else
            putchar('0');
    }
    putchar('\n');
}
```

循环范围是 1 到 31，所以每行输出 31 个字符，左起第一位表示信号 1，第二位表示信号 2，而不是直接把 `sigset_t` 的内存打印出来。

### 6.3 屏蔽三个信号并观察未决状态

画面中的主体逻辑：

```c
int main(void)
{
    //屏蔽SIGINT SIGQUIT SIGSEGV
    sigset_t set, oset;
    sigemptyset(&set);
    sigaddset(&set, SIGINT);
    sigaddset(&set, SIGQUIT);
    sigaddset(&set, SIGSEGV);
    sigprocmask(SIG_SETMASK, &set, &oset);

    sigset_t pset;
    while (1) {
        sigpending(&pset);//获取进程未决信号集
        output_pset(pset);
        sleep(1);
    }
}
```

与上面的函数组合时需要相应的标准 I/O、信号和 `unistd` 头文件。原画面展示的是资料中的主体片段，不是声称仅有一个头文件就足够。

### 6.4 预期观察

1. 没有发送这些信号时，相关位置是 0。
2. 按 `Ctrl+C`，`SIGINT` 产生但被屏蔽，第 2 位显示 1。
3. 按 `Ctrl+\`，`SIGQUIT` 产生但被屏蔽，第 3 位显示 1。
4. 用另一终端主动 `kill -11 <PID>`，观察第 11 位。

这里应使用主动发信号观察，不要用实际非法内存写入代替。

重复发送同一种普通信号，不能指望某一位变为 2、3、4。这个实验显示的是成员状态，不是信号次数计数器。

## 七、使用 `SIGCHLD` 改善子进程回收

### 7.1 为什么不一直轮询

把以前的方式归为主动回收：

- 直接阻塞 `wait()`：父进程停下来等子进程状态变化。
- 不停调用非阻塞 `waitpid(..., WNOHANG)`：父进程反复主动查询。

前者不一定浪费 CPU，但会阻塞当前执行流；后者是否浪费取决于查询频率，紧密轮询尤其不合适。

采用事件通知思路：父进程先安装处理函数，平时执行自身任务；等子进程退出通知到达，再执行回收操作。

### 7.2 `SIGCHLD` 通知与回收的关系

本例中，子进程退出后，父进程收到 `SIGCHLD`。

注意两件事：

1. 收到通知不等于已回收资源。
2. 捕捉 `SIGCHLD` 后仍需要 `wait()` / `waitpid()` 取得状态、完成回收。

因此，新方案并不是“不用 `waitpid()`”，而是改变它的调用时机。

`SIGCHLD` 也可能对应子进程停止、继续等状态变化，不能把任何一次通知都绝对等同为“一个子进程刚退出”。

### 7.3 必须在 `fork()` 前安装捕捉

若先创建子进程，再慢慢安装处理函数，快速退出的子进程可能先结束，形成通知与安装之间的时序窗口。

本例顺序：

```text
父进程安装 SIGCHLD 捕捉
             ↓
循环 fork() 创建子进程
             ↓
父进程执行其他任务
             ↓
收到通知后进入回收函数
```

### 7.4 第一版为什么漏回收

最初的处理函数只尝试回收一次：

```c
pid_t zpid;
if ((zpid = waitpid(-1, NULL, WNOHANG)) > 0)
    printf("parent wait sucess, zpid %d\n", zpid);
```

这段逻辑隐含了一个错误假设：每个退出的子进程都一定对应一次独立的处理函数执行。

但普通信号不排队，同类信号处于未决状态时会合并。本例创建十个子进程，短时间内相继退出，不能用 `SIGCHLD` 的处理次数代表退出子进程数量。

多次运行，残留僵尸数量不固定。这说明它是时序相关问题，而不是“少写了固定两次回收”。

### 7.5 最关键的修改：`if` 改为 `while`

```c
void sig_wait(int n)
{
    pid_t zpid;
    //最大次数回收，利用一个信号将当前可回收的全部回收
    while ((zpid = waitpid(-1, NULL, WNOHANG)) > 0)
        printf("parent wait sucess, zpid %d\n", zpid);
}
```

一条通知的含义应理解为“可能有状态需要处理，去检查”，而不是“只准处理一个”。

`waitpid()` 在这里的参数：

- `-1`：任意子进程。
- `NULL`：本例不接收详细退出状态。
- `WNOHANG`：没有可立即返回的状态时不阻塞。
- 返回值大于 0：本轮得到一个子进程 PID，继续检查下一个。
- 返回 0：仍有子进程，但当前没有满足条件的状态。
- 返回 -1：出错，例如已没有可等待的子进程；真实项目应进一步判断 `errno`。

必须保留 `WNOHANG` 的意义：循环排空已退出子进程后，不应再堵在仍运行的子进程上。

### 7.6 代码

```c
#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <signal.h>
#include <sys/wait.h>

void sig_wait(int n)
{
    pid_t zpid;
    while ((zpid = waitpid(-1, NULL, WNOHANG)) > 0)
        printf("parent wait sucess, zpid %d\n", zpid);
}

int main(void)
{
    pid_t pid;
    int i;
    //创建进程之前，父进程完成捕捉设定
    struct sigaction act, oact;
    act.sa_handler = sig_wait;
    act.sa_flags = 0;
    sigemptyset(&act.sa_mask);
    sigaction(SIGCHLD, &act, &oact);

    for (i = 0; i < 10; i++) {
        pid = fork();
        if (pid == 0)
            break;
    }

    if (pid > 0) {
        while (1)
            sleep(1);
    }
    else if (pid == 0) {
        printf("child i %d, pid %d, exit\n", i, getpid());
        exit(1);
    }
    else {
        perror("fork call failed");
        exit(0);
    }
}
```

子进程 `break` 的作用是防止它继续执行创建循环；否则进程总数会偏离“一个父进程创建十个子进程”的设计。

此处的错误分支、返回码、处理函数内打印均是演示写法，不是健壮性审查通过的模板。

### 7.7 测试

```bash
gcc signal_wait.c -o app
./app
```

另开终端：

```bash
ps aux
```

检查子进程是否残留为 `Z` / `<defunct>`；多运行几次比较单次回收版与循环回收版。

## 八、信号 IPC：父子进程交叉报数

### 8.1 功能目标

通过信号在父子进程间传递一个整数：

```text
父首次发送 1
     ↓ SIGUSR1
子收到 1，打印，加一后回传 2
     ↓ SIGUSR2
父收到 2，打印，加一后回传 3
     ↓ SIGUSR1
子收到 3，打印，加一后回传 4
     ↓
继续交替
```

重点是数值真的通过信号附带数据传递，不是让两个进程各自运行无关的计数循环。

### 8.2 选择什么信号

本例使用：

| 方向 | 信号 | 接收方需要做什么 |
| --- | --- | --- |
| 父 → 子 | `SIGUSR1` | 子安装捕捉函数 |
| 子 → 父 | `SIGUSR2` | 父安装捕捉函数 |

本环境中编号分别是 10、12，代码仍使用符号名。

原因：用户自定义用途更适合这两个信号，避免随意占用 `SIGINT`、`SIGQUIT` 等已有语义的信号。

两个信号的默认动作都是终止，所以必须在允许信号递送之前准备好接收逻辑。

## 九、发送信号时携带数据：`sigqueue()`

### 9.1 接口

```c
int sigqueue(pid_t pid, int sig, const union sigval value);
```

参数含义：

- `pid`：目标进程。
- `sig`：信号。
- `value`：随信号传递的整数或指针值。

和之前使用的 `kill()` 相比，这里多了用于携带数据的第三个参数。

### 9.2 `union sigval`

```c
union sigval {
    int sival_int;
    void *sival_ptr;
};
```

这是联合体，不是两个互相独立的数据槽。只传整数：

```c
union sigval val;
val.sival_int = 1;
```

不要一会儿给 `sival_int` 赋值，又认为 `sival_ptr` 里同时还保存着另一份独立消息。

传递指针值不代表把指针所指向的整块内存也复制到了另一进程。跨进程使用地址必须另有有效的共享映射和协议，不能当作字符串、结构体自动传输机制。

### 9.3 子给父发消息

```c
sigqueue(getppid(), SIGUSR2, val);
```

`getppid()` 用于取得父进程 PID。

### 9.4 父给子发消息：区分简写与可靠方法

```c
sigqueue(getpid() + 1, SIGUSR1, val);
```

并发创建其他进程等因素都可能打破 PID 连续关系

实际应保留 `fork()` 在父进程中返回的子 PID；三参数处理函数还可通过发送者信息确定回传目标。

## 十、三参数捕捉函数：怎样取得信号附带的数据

### 10.1 一参数形式不直接提供负载

以前使用：

```c
void sig_do(int n);

act.sa_handler = sig_do;
act.sa_flags = 0;
```

这里 `n` 是信号编号，不是别人发送过来的报数值。

不能把 `SIGUSR1` 的编号 10 当成对方发送的数据 1、2、3。

### 10.2 使用 `sa_sigaction` 与 `SA_SIGINFO`

```c
void sig_do(int n, siginfo_t *info, void *arg);

struct sigaction act, oact;
act.sa_sigaction = sig_do;
act.sa_flags = SA_SIGINFO;
sigemptyset(&act.sa_mask);
```

两个设置必须配套：三参数函数放在 `sa_sigaction` 中，同时在 `sa_flags` 中指定 `SA_SIGINFO`。不能仅把函数签名改成三个参数，却仍按一参数方式安装。

### 10.3 收发对应关系

| 发送侧 | 接收侧写法 | 含义 |
| --- | --- | --- |
| `val.sival_int` | `info->si_int` | 整数消息 |
| `val.sival_ptr` | `info->si_ptr` | 指针值消息 |
| 信号参数 `sig` | 处理函数参数 `n` | 信号编号，不是消息内容 |

也可在接口文档中看到 `info->si_value.sival_int`、`info->si_value.sival_ptr` 的表示方式。

## 十一、父子交叉报数的代码

### 11.1 父进程处理函数

按画面中的关键实现整理：

```c
void sig_parent(int n, siginfo_t *info, void *arg)
{
    //打印
    printf("parent pid %d , code [%d]\n", getpid(), info->si_int);
    union sigval val;
    val.sival_int = ++(info->si_int);
    //回传
    sigqueue(getpid() + 1, SIGUSR1, val);
    usleep(300000);
}
```

流程是“打印收到的值 → 加一 → 回传”，不是在处理函数里写一个永不退出的报数循环。

### 11.2 子进程处理函数

```c
void sig_child(int n, siginfo_t *info, void *arg)
{
    //打印
    printf("child pid %d , code [%d]\n", getpid(), info->si_int);
    union sigval val;
    val.sival_int = ++(info->si_int);
    //回传
    sigqueue(getppid(), SIGUSR2, val);
    usleep(300000);
}
```

两者区别主要是输出标识、回传目标 PID、回传信号类型。

`usleep()` 在此用于放慢演示速度，不是处理启动竞态的方法。

### 11.3 安装与首次发送：先保留有问题的版本

```c
int main(void)
{
    //父进程对SIGUSR2进行捕捉设定
    struct sigaction act, oact;
    act.sa_sigaction = sig_parent;
    act.sa_flags = SA_SIGINFO;
    sigemptyset(&act.sa_mask);
    sigaction(SIGUSR2, &act, &oact);

    //创建子进程
    pid_t pid;
    pid = fork();
    if (pid > 0) {
        //first send
        union sigval val;
        val.sival_int = 1;
        sigqueue(getpid() + 1, SIGUSR1, val);
        while (1)
            sleep(1);
    }
    else if (pid == 0) {
        struct sigaction act, oact;
        act.sa_sigaction = sig_child;
        act.sa_flags = SA_SIGINFO;
        sigemptyset(&act.sa_mask);
        sigaction(SIGUSR1, &act, &oact);
        //捕捉设定完毕，等待信号
        while (1)
            sleep(1);
    }
    else {
        //error
    }
}
```

本例函数放在 `main()` 之前，主体涉及 `<stdio.h>`、`<unistd.h>`、`<signal.h>`、`<sys/types.h>` 等声明。

### 11.4 为什么处理函数外不需要再写回传循环

每次收到信号，系统都会按捕捉配置进入对应处理函数：

```text
收到一个 → 处理一次 → 回传一个 → 对方再收到一个
```

这是事件驱动的重复，不是函数内部主动无限循环。

`main()` 中的 `while (1) sleep(1);` 用于让进程维持存在，避免执行到末尾直接退出。它与首次发送前插入延时“等孩子准备好”不是同一用途。

### 11.5 运行中出现的延时错误

程序只打印少量内容，看上去停止报数。检查发现曾把微秒延时写成：

```c
sleep(300000);
```

`sleep()` 参数单位是秒，300000 秒当然不是很短的暂停。后来改为：

```c
usleep(300000);
```

300000 微秒为 0.3 秒。

排查“没继续输出”时，先检查单位、实际等待时长和程序是否仍存活，不要立即认定为死锁。
