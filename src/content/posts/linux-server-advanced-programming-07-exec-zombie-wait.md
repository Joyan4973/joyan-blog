---
title: "Linux 服务器高阶编程（7）：exec、僵尸进程与 wait 系列"
published: 2026-10-18T00:00:00Z
updated: 2026-10-18T00:00:00Z
description: "整理 exec 程序映像替换、僵尸进程的形成与回收，以及 wait、waitpid 和子进程退出状态判断。"
image: ""
tags:
  - Linux
  - 进程
  - exec
  - 僵尸进程
  - waitpid
  - 学习笔记
category: Linux 服务器高阶编程
draft: false
pinned: false
comment: true
readingTime: 10
lang: zh_CN
---

# Linux 服务器高阶编程（7）：exec、僵尸进程与 wait 系列

## 一、`execl()`：让当前进程运行另一个程序

### 1. 它解决什么问题

`exec` 为进程“用户层重载”：现有进程不必重新实现某个命令或程序的功能，而可以直接加载那个**可执行文件**

`ls -l` 用来解释命令行参数与 `argv` 的对应关系

`exec` 加载的是**可执行文件的程序映像**，并不是把另一个已经运行的进程连同堆栈原样复制过来

也**不会**因为 `execl()` 而额外创建一个进程

### 2. 参数怎么写

`execl` 的声明可查 `man execl`

```c
execl(可执行文件的路径, argv[0], argv[1], ..., (char *)NULL);
```

- 第一个实参是**要加载的文件路径**。系统命令可先用 `which ls`、`which date` 查实际位置；自编程序可用 `pwd` 找当前目录，再加上程序文件名
- 后面的可变参数组成新程序的 `argv`。例如命令 `ls -l` 对应 `argv[0] = "ls"`、`argv[1] = "-l"`；`argc` 为 2。路径实参与 `argv[0]` 不是同一个参数，不能把第一个参数误当作 `argv[0]`
- 参数列表最后必须有空指针作结束标记。可写 `(char *)NULL`，不要忘记。这里的空指针是给 `execl` 标记列表结束的，不算新程序的一个普通命令行参数
- 成功时，原程序映像已被替换，`execl()` **不会返回**到原来的下一行；失败才返回 `-1`，可用 `perror()` 查原因

### 3. “重生”示意图

进程调用 `execl` 后，旧的代码、数据、堆栈等用户态程序映像被新可执行文件的映像取代，新程序从自己的入口开始运行。此前已经执行到 `execl` 的旧代码，成功后不会再接着执行

**保持不变的关键点**是当前进程仍是同一个进程：PID 不因 `exec` 而改变，父子关系也不会因此改变

子进程执行 `exec` 之后，仍由原来的父进程负责回收

所以，若希望子进程先做自己编写的准备工作，再去执行另一程序，顺序应是：

```text
父进程 fork()
    └─ 子进程：自定义准备代码 → execl(...) → 新程序开始运行
父进程：继续自己的工作 → wait / waitpid 回收子进程
```

在这条路径上，`execl` 成功之后写在旧程序中的语句不会执行

代码若运行到紧接着的 `perror("execl")`，就表示加载失败

## 二、僵尸进程

让一个父进程通过 `fork` 创建子进程，子进程稍后调用 `exit`

退出时，子进程的执行资源已经释放，但系统仍需暂时保存退出状态、PID 等供父进程读取的信息

**已终止、尚未被父进程等待回收**的子进程称为僵尸进程；用 `ps` 查看时，状态中可见 `Z`，有时命令列还会出现 `<defunct>`

可以用“验尸”比喻父进程取得子进程为何结束的结果：父进程可能要知道子进程是正常结束、以什么状态码退出，还是被信号终止

因此系统不会在子进程刚退出时就把可供父进程读取的记录全部抹去

父进程之后调用等待接口，取得所需状态并完成回收

这里要分清三件事：

1. **退出**：子进程停止执行，绝大部分运行资源已释放
2. **短暂僵尸状态**：退出信息还留着，等待父进程读取；它不会继续执行代码
3. **回收**：父进程调用 `wait` 或 `waitpid`，内核移除剩余的退出记录

长期不回收称为“内存泄漏”

更准确地说，短暂僵尸状态是正常生命周期的一环；**持续积累大量未回收子进程**才会持续占用内核进程表项、PID 等有限资源，严重时影响新进程创建

## 三、`wait()`：父进程阻塞等待并回收

头文件是 `<sys/wait.h>`。典型调用：

```c
pid_t ended = wait(NULL);      /* 只回收，不取退出状态 */

int status = 0;
pid_t another = wait(&status); /* 同时取得编码后的退出状态 */
```

`wait(NULL)` 不意味着“不回收”，只是**不把退出状态写入变量**；传 `&status` 则可以随后判断退出原因，“验尸可选，释放剩余记录必做”

注意 `status` 不是直接可打印的退出码；解码用的宏未系统展开，不宜直接把整数值当 `exit(n)` 的 `n`

`wait` 的行为取决于子进程状态：

- 有子进程但尚未退出：调用者阻塞等待，直到有可回收的子进程或等待被中断
- 已有退出的子进程：可以立即回收其中一个，并返回它的 PID
- 没有可等待的子进程，或发生错误：返回 `-1`，应结合 `errno` 判断原因

**一次成功调用只回收一个子进程**

多个子进程都需回收时可以循环调用，且必须留意何时结束循环；不能把“返回 `-1`”一概理解为某个子进程异常退出

## 四、`waitpid()`：选定等待对象，并可选择非阻塞

```c
#include <sys/types.h>
#include <sys/wait.h>

pid_t result = waitpid(pid, status_pointer, options);
```

`wait` 等任意一个子进程

`waitpid` 的第一个参数可指定等待范围，第三个参数可控制等待方式

**`waitpid` 默认也会阻塞**；只有使用 `WNOHANG` 时，目标尚未结束才会立即返回

| `pid` 参数 | 等待范围 |
| --- | --- |
| `> 0` | 指定 PID 的那个子进程。 |
| `0` | 与调用者处于同一进程组的子进程。 |
| `-1` | 任意一个子进程，范围类似 `wait`。 |
| `< -1` | 进程组 ID 为 `-pid` 的子进程。 |

“同组”“跨组”都**仍然只限调用者自己的子进程**；`waitpid` 不能回收别人的子进程，也不能让兄弟进程相互回收

第二个参数与 `wait` 一样：传 `NULL` 表示不取退出状态，传 `&status` 表示取得编码后的状态。第三个参数传 `WNOHANG` 可作非阻塞轮询；传 `0` 则按默认阻塞方式等待。

| 返回值 | `WNOHANG` 场景中的意义                                 |
| --- | --- |
| `> 0` | 成功回收一个子进程；值为该子进程 PID |
| `0` | 选定范围内有子进程，但当前没有已经退出、可回收的子进程 |
| `-1` | 出错或没有符合条件的可等待子进程；用 `errno` 区分 |

### 轮询与父进程自己的工作

父进程反复调用 `waitpid(-1, NULL, WNOHANG)`；返回正数时说明回收成功，返回 0 时继续执行自己的 `business`，稍后再来查询

相对于一直阻塞在 `wait` 上，这能让回收和父进程任务交替进行，但过于频繁的空转会增加开销

```c
#include <errno.h>
#include <stdio.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

void parent_business(void);  /* 示例中的父进程任务 */

void reap_children(void)
{
    for (;;) {
        pid_t ended = waitpid(-1, NULL, WNOHANG);
        if (ended > 0) {
            printf("reaped child %ld\n", (long)ended);
        } else if (ended == 0) {
            parent_business();
            sleep(1);  /* 避免持续空转 */
        } else if (errno == EINTR) {
            continue;  /* 被信号打断，可重试 */
        } else if (errno == ECHILD) {
            break;     /* 已无可等待的子进程 */
        } else {
            perror("waitpid");
            break;
        }
    }
}
```

如果把 `wait` 写在父子分支之后的公共路径，却忘记让子进程在自己的工作区结束，那么子进程也可能执行这段代码；它没有自己的子进程时，`wait` 会失败

## 五、检查子进程怎样结束

正常退出包括从 `main` 返回、调用 `exit(n)`；另一类是运行期间被信号终止

父进程先用 `wait(&status)`取得编码后的状态，再配合 `<sys/wait.h>` 中的宏判断，**不能直接把 `status` 本身当作退出码**。

| 判断宏 | 为真时再使用 | 得到什么 |
| --- | --- | --- |
| `WIFEXITED(status)` | `WEXITSTATUS(status)` | 子进程正常退出的状态码 |
| `WIFSIGNALED(status)` | `WTERMSIG(status)` | 终止子进程的信号编号 |

调用顺序很重要：先判断 `WIFEXITED`，成立才读 `WEXITSTATUS`；若 `WIFSIGNALED` 成立，才读 `WTERMSIG`

```c
int status = 0;
pid_t ended;

while ((ended = wait(&status)) > 0) {
    if (WIFEXITED(status)) {
        printf("child %ld exited, code=%d\n",
               (long)ended, WEXITSTATUS(status));
    } else if (WIFSIGNALED(status)) {
        printf("child %ld killed by signal %d\n",
               (long)ended, WTERMSIG(status));
    }
}
```

用循环创建两个子进程：第一个睡约 5 秒后 `exit(8)`，第二个持续运行。父进程循环 `wait(&status)`；先回收到第一个，输出退出码 8；再从另一个终端查看第二个 PID，用 `kill -11 <PID>` 给它发 11 号信号，父进程随后判断为信号终止，输出信号编号 11
