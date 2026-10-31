---
title: "Linux 服务器高阶编程（9）：进程间通信与进程关系"
published: 2026-10-25T00:00:00Z
updated: 2026-10-25T00:00:00Z
description: "整理匿名管道、FIFO、共享文件映射等进程间通信方式，并梳理 PID、PPID、进程组、会话与控制终端之间的关系。"
image: ""
tags:
  - Linux
  - 进程间通信
  - 管道
  - FIFO
  - mmap
  - 进程组
  - 会话
  - 学习笔记
category: Linux 服务器高阶编程
draft: false
pinned: false
comment: true
readingTime: 37
lang: zh_CN
---

# Linux 服务器高阶编程（9）：进程间通信与进程关系

## 一、IPC 的含义

### 1.1 为什么多个进程不能直接把普通变量当作共享区

IPC 是 Inter-Process Communication，即进程间通信。进程通常拥有各自的虚拟地址空间；`fork()` 之后，父子进程中的普通变量即使名字相同、打印出来的虚拟地址相同，也不意味着后续写入会自动相互可见。

可以把问题理解为：父子进程都拿到了一份可以继续运行的程序状态，但要有意共享数据，仍需要选择适当的共享对象或通信通道。管道提供内核中的传输通道，文件的共享映射则允许不同进程访问同一份底层数据。

### 1.2 IPC 技术

| 技术 | 特点 |
|---|---|
| 匿名管道 `pipe` | 用描述符访问，常由父子继承共享 |
| 有名管道 FIFO | 以文件系统路径作为共同入口 |
| 文件映射 `mmap` | 把文件内容映射到地址空间 |
| System V / POSIX 消息队列 | 以消息为组织单位的通信机制 |
| Socket | 可用于本机或网络通信 |
| Signal | 事件通知和进程控制 |

首先讨论匿名管道、有名管道和文件映射，并说明信号的完整内容放在后面的章节。

## 二、匿名管道：从一个内核通道开始

### 2.1 管道的三个基本特点

从传输介质、方向性和暂存性介绍管道。对于基本的 Linux 匿名管道，可以采用下面的模型：

```text
写端进程的用户缓冲区
        │ write(fds[1], ...)
        ▼
    内核中的管道缓冲区
        │ read(fds[0], ...)
        ▼
读端进程的用户缓冲区
```

管道暂存尚未被读取的数据。数据被读取后，从这条字节流中消费掉；它并不是自动保留历史消息的存档文件。只要通道及相关引用仍存在，就可能继续收发；关闭和退出则会影响通道是否还能被使用。

使用环形队列图帮助理解缓冲区。依赖的是“有限容量、顺序读写、端点状态影响结果”这些接口行为，不需要把图中的布局当作所有内核版本的固定实现。

### 2.2 `pipe()` 的参数与返回值

```c
#include <unistd.h>

int pipe(int pipefd[2]);
```

最基本的使用方式：

```c
int fds[2];
if (pipe(fds) == -1) {
    perror("pipe");
    return 1;
}
```

| 项目 | 含义 |
|---|---|
| `fds[0]` | 管道读端，用于 `read` |
| `fds[1]` | 管道写端，用于 `write` |
| 返回 `0` | 创建成功，数组中获得有效描述符 |
| 返回 `-1` | 创建失败，应检查 `errno` 并终止或转入错误处理 |

**`0`、`1` 是数组下标，不是描述符的固定值。** 在某次运行中，`fds[0]`、`fds[1]` 可能分别是 3 和 4；如果之前打开过其他文件，也可能是其他数字。应始终使用数组保存的实际返回值。

### 2.3 为什么常见写法是先 `pipe()`，再 `fork()`

父进程先创建管道，再创建子进程。子进程继承父进程的文件描述符，因此两者持有的端点引用指向同一个管道对象。

```text
pipe(fds)
    ↓
fork()
    ├─ 父进程：fds[0] ─┐
    │          fds[1] ─┤
    └─ 子进程：fds[0] ─┤── 同一个管道对象
               fds[1] ─┘
```

如果父子各自调用一次 `pipe()`，获得的是各自新建的通道。即使两边打印出的描述符整数碰巧相同，也不能据此认为它们连在一起。

把匿名管道概括为“用于亲缘进程”。在 `pipe + fork` 模型中，这正是通过继承拿到共同端点的使用方式。更一般地，关键是能否取得同一管道的有效描述符；跨进程传递描述符属于额外机制。

### 2.4 父写子读时关闭哪些端点

```text
父进程                         子进程
close(fds[0])                  close(fds[1])
保留 fds[1] 写端               保留 fds[0] 读端
       └────── 管道数据 ────────────►
```

这一步既是在表达角色，也在保证结束条件正确。例如子进程如果保留自己的写端，那么即使父进程已经关闭写端，内核仍能看到一个写端引用，子进程继续读空管道时可能一直等待，无法得到期望的 EOF。

父进程 `close(fds[0])` 只关闭自己持有的描述符，不会把子进程的读端一并关闭。`fork()` 后描述符数值相同，并不意味着两个进程共享同一张描述符表。

## 三、父写子读

### 3.1 执行顺序

父进程发送 `hi son can u hear me ?`，子进程读取并打印，父进程最后等待回收子进程。

```text
父进程：pipe → fork → 关闭读端 → write → 关闭写端 → wait
子进程：       fork → 关闭写端 → read  → 关闭读端 → 退出
```

用于说明主要调用顺序。

### 3.2 代码

`write_all()` 的任务是把剩余的字节继续写完。一次 `write` 的返回值表示实际写入的字节数；如果小于请求长度，后续调用应从尚未写出的部分继续。

`read()` 的返回值分三类：大于 0 表示拿到这些字节，等于 0 表示在本例中到达流的结束，小于 0 表示发生错误。`read()` 不承诺一次填满缓冲区，也不会自动在接收内容后补字符串结束符。

因此子进程按返回的长度输出，不直接把缓冲区交给 `%s`。如果确实要按 C 字符串打印，应预留一个字节并在有效长度处补 `\0`；二进制数据则应始终按长度处理。

子进程使用 `_exit()` 结束；父进程用 `waitpid()` 回收并检查退出状态。普通情况下，已结束但未被等待回收的子进程会保留退出信息，这和“仍在运行的孤儿进程”是两个概念。

### 3.3 编译、运行与检查

在放有源文件的 Linux 目录执行：

```bash
gcc -std=c11 -Wall -Wextra -O2 pipe_demo.c -o pipe_demo
./pipe_demo
```

应看到：

```text
hi son can u hear me ?
parent: child reaped; child observed EOF
```

检查点是：子进程收到完整文本；父进程关闭写端后，子进程读到 EOF 并结束；父进程确实等待了子进程。如果把父进程的 `close(fds[1])` 移到 `waitpid()` 之后，就会破坏当前的结束协议：父亲在等孩子退出，孩子在等父亲关闭写端。

## 四、管道的关闭、容量与传输方式

### 4.1 端点引用与资源释放

用父子进程的四个描述符说明引用关系。可以把它记为“四个持有的端点描述符”，但实际内核对象及引用计数的层次比一个整数更复杂。编程中应分别问两个问题：是否还有任何读端打开，是否还有任何写端打开。

正常退出也会使内核关闭进程持有的描述符，但长时间运行的程序应在角色确定后立即关闭不使用的端点，避免影响对方的 EOF 或 `SIGPIPE` 行为。

**核对说明：不能使用 `shutdown()` 把普通管道的所有引用清零。** `shutdown()` 用于 socket 的接收或发送方向，普通管道应通过 `close()` 管理端点。

### 4.2 容量与 `PIPE_BUF` 分开理解

需要分清两件事：

| 概念 | 回答的问题 | Linux 中的检查方式 |
|---|---|---|
| 管道容量 | 当前最多能暂存多少字节 | `fcntl(fd, F_GETPIPE_SZ)` |
| `PIPE_BUF` | 多个写者下多大的单次写入有原子性保证 | `fpathconf(fd, _PC_PIPE_BUF)` |

Linux 中 `PIPE_BUF` 为 4096 字节，但管道总容量不能固定记成 4096。容量受系统版本、配置和资源限额影响。小于等于 `PIPE_BUF` 的适当单次写入具有不与其他写者交错的保证；这并不让读端自动得到“每次 read 对应一条消息”的效果。

配套的 `pipe_probe.c` 会查询容量与原子性界限，然后以非阻塞写入填满管道，验证 `EAGAIN`，最后关闭写端、读完剩余数据并验证 EOF。

```bash
gcc -std=c11 -Wall -Wextra -O2 pipe_probe.c -o pipe_probe
./pipe_probe
```

### 4.3 单工、半双工和双工

用三种传输方式帮助理解谁在何时读写。落实到 Linux 的一条普通管道上，`fds[0]` 的角色是读，`fds[1]` 的角色是写，不能通过交换数组名字把读端变成写端。

如果父子都保留两端，仍然只有一条字节流，不能天然区分请求和回复，错误设计时还可能读走自己发出的数据。双向请求与响应的清晰做法是建立两条管道，分别规定一个方向：

```text
父进程 ── request 管道 ──► 子进程
父进程 ◄─ response 管道 ── 子进程
```

每条管道独立关闭不用的端点，分别处理 EOF 和错误。不要把“两个进程都能调用 read/write”当成一个完整的双向通信协议。

## 五、管道读写

以下默认请求的字节数大于 0，使用阻塞 I/O，且没有其他信号或错误打断调用。

| 当前状态 | 读/写结果 | 排查时先看什么 |
|---|---|---|
| 管道为空，但仍有写端打开 | `read()` 等待数据 | 是否真的还有写者，是否遗漏了关闭写端 |
| 管道已满，且仍有读端打开 | `write()` 可能等待腾出空间 | 读端是否持续消费数据 |
| 全部写端关闭 | 先读完剩余数据，再得到 `read() == 0` | 必须检查所有写端副本 |
| 全部读端关闭后继续写 | 触发 `SIGPIPE`；默认处置会终止进程 | 是否仍存在读端，信号是否被忽略或处理 |

这里的“全部”包括父子各自的副本及通过 `dup()` 等方式得到的额外引用。端点关闭是整个通道状态的一部分，不只取决于某一个进程是否执行过一次 `close`。

如果忽略 `SIGPIPE`，相应失败写入会以 `EPIPE` 报错；程序仍需处理失败。非阻塞模式也会改变等待行为：空管道且仍有写端时可能得到 `EAGAIN`，写入空间不足时也可能得到 `EAGAIN`。非阻塞不是“永远成功”。

### 5.1 为什么“没有输出”不能直接判定为死循环

进程可能睡眠在 `read()`、`write()` 或 FIFO 的 `open()` 里。这些情况与用户态一直执行循环不同。调试时先定位停在哪个调用，再检查通道是否有数据、是否还有对端，以及当前进程是否保留了不该保留的描述符。

### 5.2 单独验证 `SIGPIPE`

配套 `pipe_sigpipe.c` 在创建子进程前关闭唯一的读端。子进程恢复 `SIGPIPE` 的默认处置并解除阻塞后向写端发送一个字节；父进程通过等待状态确认子进程是否由该信号终止，同时完成回收。

```bash
gcc -std=c11 -Wall -Wextra -O2 pipe_sigpipe.c -o pipe_sigpipe
./pipe_sigpipe
```

应看到类似：

```text
child terminated by SIGPIPE (13), reaped by parent
```

这个实验只处理自己创建的子进程，不需要向其他进程发送信号。实验程序退出码为 0，表示观察到了预期行为；被信号终止的是其内部的测试子进程。

### 5.3 网络服务端问题

客户端已经退出、服务端发送响应时异常终止的

```c
send(sockfd, buffer, len, MSG_NOSIGNAL);
```

网络发送也要处理连接状态变化。`MSG_NOSIGNAL` 适用于相应的 socket 发送调用，作用是避免该调用产生 `SIGPIPE`；仍必须检查 `send()` 是否返回 `-1` 以及错误码。不能由此推导出“客户端关闭后服务端下一次发送必然以相同方式失败”，实际还受连接状态和时序影响。

## 六、匿名管道的优点、局限与消息格式

使用简单、适合通过继承共享端点、传输无格式字节流等特点。

例如发送方先写 `ABC`，再写 `DEF`；接收方可能一次读到 `ABCDEF`，也可能分成更小的片段。程序不应要求两次 `write` 必然对应两次 `read`。

如果要从演示扩展成应用，可以按需要约定换行分隔、定长记录，或“长度字段 + 消息正文”的协议。选择分隔符时需要考虑消息内容是否包含该分隔符；选择长度头时需要校验上限并处理不足一条消息的情况。

## 七、有名管道 FIFO：为通道提供共同入口

### 7.1 为什么需要名字

通过继承让父子得到同一通道的端点。如果两个程序分别从两个终端启动，没有事先继承这些描述符，就需要共同的定位方式。

FIFO 以文件系统中的一个路径提供这种入口。两个进程对同一 FIFO 路径执行 `open()`，然后用普通的描述符读写接口交换数据。

```text
程序 A：open("channel", O_WRONLY)
                    │
             FIFO 路径入口
                    │
程序 B：open("channel", O_RDONLY)

传递的字节经过内核中的管道缓冲区
```

### 7.2 FIFO 文件与普通文件的区别

FIFO 是特殊文件类型，在 `ls -l` 中通常以首字符 `p` 表示。它不是普通磁盘文件，也不等同于字符设备或块设备。路径及权限等元数据存在于文件系统中，但通信字节不会作为普通文件内容写到该路径对应的磁盘数据区。

“与磁盘无关”，适合理解为通信数据不按普通文件持久化，不能扩展为“完全没有文件系统元数据和资源占用”。

### 7.3 创建和查看 FIFO

```bash
mkfifo channel
ls -l channel
```

应看到类似：

```text
prw-r--r-- ... channel
```

具体权限受 `umask` 影响。C 接口为：

```c
#include <sys/stat.h>

if (mkfifo("channel", 0664) == -1) {
    perror("mkfifo");
}
```

`0664` 是八进制权限值；最终权限还会应用进程的 `umask`。如果名称已经存在，不要直接把它当成可用 FIFO，应先验证文件类型，避免误操作同名普通文件。

### 7.4 FIFO 的名称和打开状态具有不同生命周期

路径提供下一次打开时的名字；打开的端点与通信缓冲区有自己的生命周期。所有端点关闭后，不能依靠这个名字保存此前尚未消费的数据。

反过来，删除路径也不等于立即关闭其他进程已经持有的描述符。

```bash
rm -- channel
```

这里删除单个 FIFO 无须递归选项。程序中删除名称可使用 `unlink("channel")`，但仍需安排各进程关闭自己的端点。

## 八、FIFO 的打开规则与双终端

### 8.1 `open()` 也可能等待

| 打开方式 | 另一端未打开时的常见 Linux 行为 |
|---|---|
| 阻塞 `O_RDONLY` | 等待写端打开 |
| 阻塞 `O_WRONLY` | 等待读端打开 |
| `O_RDONLY \| O_NONBLOCK` | 可以打开，之后的读取仍需按端点状态判断 |
| `O_WRONLY \| O_NONBLOCK` | 没有读端时以 `ENXIO` 失败 |
| `O_RDWR` | Linux 允许，但不要将其当作跨平台的默认解决方法 |

“需要同时满足读写两种权限”，应区分为两个问题：进程是否有相应文件访问权限，以及 FIFO 是否已有配对的读写端。只读进程并不因此需要写权限；缺少文件权限通常是失败，等待对端是打开协议的行为。

### 8.2 准备源码与环境

配套的 `fifo_tool.c` 支持两种模式：

```text
fifo_tool read FIFO路径
fifo_tool write FIFO路径 消息
```

程序先检查路径确实是 FIFO。读端循环读取到 EOF；写端发送文本与换行后关闭。它用于单次会话演示，不承担多客户端持续服务的职责。

```bash
gcc -std=c11 -Wall -Wextra -O2 fifo_tool.c -o fifo_tool
mkfifo channel
```

使用 WSL 时，建议把实验目录放在该 Linux 发行版的文件系统内，例如 `/tmp` 下的独立实验目录，避免把 Windows 挂载目录是否支持 FIFO 混进实验。

### 8.3 终端 A：启动读端

```bash
./fifo_tool read channel
```

此时没有写端，程序可能等待在 `open()`，尚未执行到 `read()`。不要因为没有输出就重复启动多个读进程。

### 8.4 终端 B：进入同一个目录并启动写端

```bash
./fifo_tool write channel "hello fifo"
```

终端 A 应打印：

```text
hello fifo
```

写进程关闭后，读端消费完数据并读到 EOF，随后退出。两个终端必须使用同一个 FIFO 路径；如果分别在不同工作目录运行 `mkfifo channel`，相同文件名可能对应完全不同的对象。

### 8.5 反向启动与错误排查

也可以先启动写端，观察它等待，再启动读端。检查思路是：先核实路径与类型，再看权限，然后判断停在 `open`、`read` 还是 `write`，最后检查对端是否已经退出。

如果一个读端已消费数据，另一个读端不能指望再读到同一份历史消息。FIFO 默认不是向所有读者广播的系统；多个读者会从同一个流中竞争数据。

## 九、文件映射：从“消费消息”转向“共享内容”

### 9.1 `mmap`

管道中的字节读走后会被消费。文件映射呈现的是另一种使用方式：进程通过内存地址访问一份映射数据，读操作本身不将内容从映射区域删除；数据可以持续存在，直到被覆盖或对象生命周期结束。

| 对比项 | 管道 / FIFO | 文件共享映射 |
|---|---|---|
| 常见访问形式 | `read()`、`write()` | 对映射指针所指内容进行读写 |
| 读取后的内容 | 从通道中消费掉 | 可以再次读取 |
| 顺序组织 | 字节流 | 由应用定义结构和位置 |
| 等待新消息 | 阻塞 I/O 可以参与完成 | 需要另外设计通知与同步 |
| 多方一致性 | 仍需定义消息协议 | 仍需定义互斥、发布与读取规则 |

共享映射提供访问共同数据的基础，但不会自动成为完整的消息队列。

### 9.2 `mmap()` 的六个参数

```c
#include <sys/mman.h>

void *mmap(void *addr, size_t length, int prot,
           int flags, int fd, off_t offset);
```

| 参数 | 使用方式                        | 含义 |
|---|---|---|
| `addr` | `NULL` | 由系统选择映射地址 |
| `length` | `sizeof(shared_t)` | 映射的字节范围，必须大于 0 |
| `prot` | `PROT_READ` 或加入 `PROT_WRITE` | 允许通过该映射进行哪些访问 |
| `flags` | `MAP_SHARED` | 使用共享映射 |
| `fd` | 事先打开的普通文件 | 作为映射来源的对象 |
| `offset` | `0` | 从文件的哪个位置开始映射 |

成功返回映射起始地址，失败返回 `MAP_FAILED`，不能按 `NULL` 判断失败。文件偏移需满足页对齐要求；这份实验从偏移 0 开始。

### 9.3 为什么不同进程中的指针值可以不同

```text
进程 A 的虚拟地址范围 ─┐
                     ├─ 同一文件对应的共享数据
进程 B 的虚拟地址范围 ─┘
```

两边映射到各自地址空间中的位置，不必具有相同的数值。共享的是底层数据，而不是“所有进程都能使用一个指针值”。因此跨进程数据结构通常存偏移、索引或实际内容，不能直接把进程 A 的普通指针交给进程 B 解引用。

## 十、为映射准备文件、权限和消息结构

### 10.1 先让文件长度覆盖实际访问范围

用 `ftruncate()` 扩大文件，使映射区有足够空间存放结构体：

```c
typedef struct {
    int id;
    char data[4096];
} shared_t;

int fd = open("shared.bin", O_RDWR | O_CREAT, 0600);
/* 实际代码必须检查 fd 和 ftruncate 的返回值。 */
ftruncate(fd, (off_t)sizeof(shared_t));
```

注意结构体的总大小应使用 `sizeof(shared_t)`。数组长 4096 并不代表整个结构体只有 4096 字节，它还包含 `id` 及可能的对齐填充。

“没有有效业务数据”和“文件长度为 0”不同。创建共享区时可以先获得足够长度，再设置初始字段。把文件清空理解成初始化共享区；一般文件映射并不要求源文件没有内容。

### 10.2 三种容易混淆的失败

| 情况 | 应怎样理解和排查 |
|---|---|
| `length == 0` | 映射请求本身无效 |
| `MAP_SHARED + PROT_WRITE` 与文件打开方式不匹配 | 写共享映射应以合适的读写权限打开文件 |
| 文件实际长度不足 | `mmap()` 可能返回成功，后续访问文件结尾之后的页却触发 `SIGBUS` |

因此要在映射前用 `fstat()` 检查文件，在本例中保证文件至少有 `sizeof(shared_t)` 字节。不要把“映射成功”当作“后续访问任意偏移都安全”。

权限规则也不能简化成所有映射一律只能与 `open()` 的读写标志完全相同。例如可读文件上的可写私有映射涉及写时复制，与可写共享映射不同。

### 10.3 `MAP_SHARED` 与 `MAP_PRIVATE`

| 类型 | 本进程修改的用途 | 对其他映射者或文件的影响 |
|---|---|---|
| `MAP_SHARED` | 修改共享区域 | 用于共享修改，并可回写文件 |
| `MAP_PRIVATE` | 保留本进程的私有修改 | 写时复制，修改不作为共享修改写回原文件 |

`MAP_PRIVATE` 不代表调用时立即完整复制整个文件，也不宜当作并发修改下的严格快照保证。需要跨进程交换本例中的结构体内容时，使用共享映射，并另外解决访问顺序。

## 十一、映射实验：初始化、写入、读取、再次读取

### 11.1 实验范围

配套 `mmap_tool.c` 把初始化、写入和读取分成独立进程调用。先让写进程完成，再启动读进程。

它能验证：不同程序运行实例通过同一个文件交换数据；读取不会消费掉内容；修改后的内容可以由后续进程再次映射读取。

### 11.2 完整代码

```c
#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>

typedef struct {
    int id;
    char data[4096];
} shared_t;

int main(int argc, char **argv)
{
    int init = argc == 3 && strcmp(argv[1], "init") == 0;
    int reading = argc == 3 && strcmp(argv[1], "read") == 0;
    int writing = argc == 5 && strcmp(argv[1], "write") == 0;
    if (!init && !reading && !writing) {
        fprintf(stderr, "usage: %s init FILE | read FILE | write FILE ID TEXT\n", argv[0]);
        return 1;
    }
    int id = 0;
    if (writing) {
        char *end;
        errno = 0;
        long value = strtol(argv[3], &end, 10);
        if (errno || end == argv[3] || *end || value < INT_MIN || value > INT_MAX ||
            strlen(argv[4]) >= sizeof(((shared_t *)0)->data)) {
            fputs("invalid ID or message too long\n", stderr); return 1;
        }
        id = (int)value;
    }
    int flags = init ? O_RDWR | O_CREAT | O_EXCL : reading ? O_RDONLY : O_RDWR;
    int fd = open(argv[2], flags, 0600);
    if (fd == -1) { perror("open"); return 1; }
    if (init) {
        if (ftruncate(fd, (off_t)sizeof(shared_t)) == -1) {
            perror("ftruncate"); close(fd); return 1;
        }
        printf("created %zu-byte mapping file\n", sizeof(shared_t));
        return close(fd) == -1 ? 1 : 0;
    }
    struct stat st;
    if (fstat(fd, &st) == -1) { perror("fstat"); close(fd); return 1; }
    if (!S_ISREG(st.st_mode) || st.st_size < (off_t)sizeof(shared_t)) {
        fputs("mapping file must be a regular file of sufficient size\n", stderr);
        close(fd); return 1;
    }
    int prot = reading ? PROT_READ : PROT_READ | PROT_WRITE;
    shared_t *ptr = mmap(NULL, sizeof(*ptr), prot, MAP_SHARED, fd, 0);
    if (ptr == MAP_FAILED) { perror("mmap"); close(fd); return 1; }
    int failed = 0;
    if (writing) {
        ptr->id = id;
        snprintf(ptr->data, sizeof(ptr->data), "%s", argv[4]);
        if (msync(ptr, sizeof(*ptr), MS_SYNC) == -1) { perror("msync"); failed = 1; }
        if (!failed) puts("updated shared mapping");
    } else {
        printf("id=%d\ndata=%.*s\n", ptr->id, (int)sizeof(ptr->data), ptr->data);
    }
    if (munmap(ptr, sizeof(*ptr)) == -1) { perror("munmap"); failed = 1; }
    if (close(fd) == -1) { perror("close"); failed = 1; }
    return failed;
}
```

代码中的 `O_EXCL` 用于让初始化操作只创建新文件。普通读取和写入阶段不会再次调用 `ftruncate()`。

### 11.3 顺序操作

```bash
gcc -std=c11 -Wall -Wextra -O2 mmap_tool.c -o mmap_tool
./mmap_tool init shared.bin
./mmap_tool write shared.bin 42 "hello mmap"
./mmap_tool read shared.bin
./mmap_tool read shared.bin
```

两次读取都应得到：

```text
id=42
data=hello mmap
```

再执行：

```bash
./mmap_tool write shared.bin 43 "second message"
./mmap_tool read shared.bin
```

读取结果应更新为 `id=43` 及 `second message`。这和 FIFO 的“读走即消费”形成直接对照。

### 11.4 `msync`、`munmap` 与 `close` 各做什么

| 调用 | 作用 |
|---|---|
| `msync(ptr, size, MS_SYNC)` | 请求将映射修改同步回文件，并等待该同步完成 |
| `munmap(ptr, size)` | 解除本进程的这段映射 |
| `close(fd)` | 关闭打开文件得到的描述符 |

映射成功后，文件描述符可以关闭而不立即使映射失效；本例为了便于理解，在结束阶段集中处理。无论采用哪种顺序，`munmap` 后都不能继续使用已解除映射的地址。

**`msync()` 处理文件回写，不负责互斥，也不是通知读者“消息已完整”的协议。** 如果一个进程更新 `id` 后尚未更新 `data`，另一个进程就读取，可能得到不一致的组合。需要并发通信时，应根据应用设计锁、信号量、通知通道等同步方案。

### 11.5 对“mmap 一定更快”的理解

用减少一次内核到用户缓冲区的数据复制解释文件映射的收益。这是理解其应用价值的一条线索，但不构成所有工作负载上的性能结论。页错误、访问模式、文件大小、访问次数、内存压力等都会影响结果。

## 十二、进程间关系

在文件映射之后转入进程关系。这里首先要把父子关系与管理分组分开。

| 标识 | 含义 | 常用读取方式 |
|---|---|---|
| PID | 进程自身的标识 | `getpid()` |
| PPID | 当前父进程的标识 | `getppid()` |
| PGID | 所属进程组的标识 | `getpgrp()` |
| SID | 所属会话的标识 | `getsid(0)` |

父子关系描述创建与回收关系；进程组和会话则服务于进程组织、作业控制和终端关系。改变分组并不等于重新 `fork()`，也不会因为 PGID 变了就自动把原来的父子关系取消。

### 12.1 亲缘关系与程序替换

先区分直接父子与更远的祖先关系，再说明终端启动程序的一般思路：shell 创建子进程，子进程通过 `exec` 系列函数执行目标程序。

```text
shell
  └─ fork 得到的子进程
       └─ exec 加载目标程序
            └─ 目标程序还可以继续 fork 创建子进程
```

`exec` 主要替换进程执行的程序映像，不等于再创建一个新 PID。由交互 shell 启动普通外部程序是理解这一结构的常见场景；shell 内建命令、优化方式和不同终端启动路径可能不同。

图示中的 `init → login → bash` 适合作为传统登录流程示意，不应把图中某个中间程序或具体 PID 固定套到所有桌面、容器及 WSL 环境。

### 12.2 查看当前系统中的关系

```bash
ps ajx
```

先看输出表头，重点找 PPID、PID、PGID、SID，以及终端相关列。为了使列含义更直接，也可以使用：

```bash
ps -eo pid,ppid,pgid,sid,tty,stat,comm
```

观察时以数值关系为重点，例如某个进程的 `PID == PGID` 是否成立，而不是记住出现的具体号码。

## 十三、进程组：把多个进程作为一项作业管理

### 13.1 进程组与组长

进程组中的进程具有相同 PGID；PID 与该 PGID 相同的进程是组长。新创建的子进程通常继承父进程的 PGID，除非后续由程序或 shell 调整。

```text
进程组 PGID=3000
    ├─ 进程 PID=3000（组长）
    ├─ 进程 PID=3001
    └─ 进程 PID=3002
```

这张图没有规定所有成员必须互为父子。父子树和进程组是两种不同的关系，观察时可以同时画出来，避免把它们混成一张树。

组长先退出，不意味着其余成员自动退出。组还能继续存在，直到没有成员。

### 13.2 查询与设置

```c
#include <unistd.h>

pid_t pgid = getpgrp();
int rc = setpgid(pid, pgid);
```

对当前进程使用下面的写法，表示让它进入以自身 PID 标识的组：

```c
if (setpgid(0, 0) == -1) {
    perror("setpgid");
}
```

`pid == 0` 表示当前进程；`pgid == 0` 表示以目标进程 PID 作为组 ID。加入另一个已有组时，需要满足同一会话等限制；调用者可以操作哪些进程、子进程是否已经 `exec`、目标是否为会话首进程，也会影响结果。

 `setpgid(getpid, 8000)` 不能原样复制：`getpid` 是函数名，调用应写 `getpid()`，而且 `8000` 必须是满足条件的实际组 ID，不能仅凭数字创建一个任意目标组。

## 十四、会话与控制终端

### 14.1 会话位于进程组之上

一个会话可以包含多个进程组，每个进程组属于一个会话。建立新会话的进程是该会话的首进程，初始时它同时是新组的组长：

```text
会话 SID=5000
    ├─ 进程组 PGID=5000
    │      └─ 会话首进程 PID=5000
    ├─ 进程组 PGID=5100
    │      ├─ PID=5100
    │      └─ PID=5101
    └─ 其他进程组
```

这个层次与 shell 的前台、后台作业管理有关。“当前属于哪个会话”和“父进程是谁”仍是不同的问题。

### 14.2 `getsid()` 与 `setsid()`

```c
pid_t current_sid = getsid(0);
pid_t new_sid = setsid();
```

`setsid()` 成功后，调用进程成为新会话的首进程和新进程组的组长，新会话最初没有控制终端。此时应观察到：

```text
PID == PGID == SID
```

已经是进程组组长的进程不能直接成功调用 `setsid()`。常见结构是先 `fork()`，由子进程调用；是否成功仍需检查返回值。

### 14.3 完整观察程序

配套 `proc_ids.c` 打印父进程、子进程创建会话前和创建会话后的四个 ID。它随后退出，并由父进程回收，便于重复运行。

```c
#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

static void show(const char *label)
{
    printf("%s: pid=%ld ppid=%ld pgid=%ld sid=%ld\n", label,
           (long)getpid(), (long)getppid(), (long)getpgrp(), (long)getsid(0));
}

int main(void)
{
    setvbuf(stdout, NULL, _IONBF, 0);
    show("parent");
    pid_t pid = fork();
    if (pid == -1) { perror("fork"); return 1; }
    if (pid == 0) {
        show("child before setsid");
        if (setsid() == -1) { perror("setsid"); _exit(1); }
        show("child after setsid");
        int correct = getpid() == getpgrp() && getpid() == getsid(0);
        _exit(correct ? 0 : 1);
    }
    int status;
    pid_t result;
    do { result = waitpid(pid, &status, 0); }
    while (result == -1 && errno == EINTR);
    if (result == -1) { perror("waitpid"); return 1; }
    return WIFEXITED(status) && WEXITSTATUS(status) == 0 ? 0 : 1;
}
```

编译运行：

```bash
gcc -std=c11 -Wall -Wextra -O2 proc_ids.c -o proc_ids
./proc_ids
```

实测的一组输出：

```text
parent: pid=490 ppid=443 pgid=443 sid=443
child before setsid: pid=491 ppid=490 pgid=443 sid=443
child after setsid: pid=491 ppid=490 pgid=491 sid=491
```

重要的是三点：子进程最初继承组和会话；成功调用后自身 PID、PGID、SID 相等；PPID 仍然是 490，说明父子关系并没有因此断开。你的具体数字会不同。

### 15.4 “关闭终端以后程序是否继续运行”不能只看一个调用

通过终端关闭引出脱离控制终端。需要核对的是，`setpgid()` 只改变进程组，不等于 `setsid()` 创建新会话。终端挂断和 shell 退出可能涉及 `SIGHUP`、前台进程组、shell 的作业处理方式以及程序的信号处置，不能一律写成“会话结束必然杀死所有成员”。

实终端、重定向标准输入输出、守护进程化等行为混入实验。要实现长期运行的服务，还需按照实际运行方式处理这些问题。
