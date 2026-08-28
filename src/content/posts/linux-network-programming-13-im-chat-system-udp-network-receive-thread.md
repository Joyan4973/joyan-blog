---
title: "Linux 网络编程（13）：IM 聊天系统——UDP 网络类与接收线程"
published: 2026-08-02T15:22:46Z
updated: 2026-08-02T15:22:46Z
description: "Linux 网络编程系列第 13 篇，整理 IM 聊天系统的 UDP 网络类、数据收发与接收线程，并介绍线程退出、资源回收以及多线程同步问题。"
image: ""
tags:
  - IM 聊天系统阶段
  - Linux
  - 网络编程
  - IM 聊天系统
  - UDP
  - Winsock
  - 多线程
  - 内存管理
  - 学习笔记
category: Linux 网络编程
draft: false
pinned: false
comment: true
readingTime: 13
lang: zh_CN
---

# IM 聊天系统——UDP 网络类与接收线程

本节继续搭建 IM 聊天系统，首先整理公共端口定义以及 `Udp` 网络类的职责，并实现 Winsock 初始化、套接字绑定和 UDP 数据发送。

随后把阻塞式接收放入独立线程，学习 `_beginthreadex()` 的参数与线程入口设计，并进一步整理接收缓冲区复制、线程退出、句柄回收、共享数据竞争和死锁等问题。

## 一、魔法数字与公共定义文件 `def.h`

### 1. 什么是魔法数字

如果代码中直接出现大量没有名字的数字，例如：

```cpp
addr.sin_port = htons(44444);
```

后续阅读代码时，很难立即判断 `44444` 的含义；如果多个文件都使用该端口，修改时还容易漏改。这类缺少语义名称、直接写在代码中的常量通常被称为“魔法数字”。

### 2. 使用宏统一管理

把 UDP 和 TCP 端口写入公共的 `def.h`：

```cpp
#define UDP_PORT 44444
#define TCP_PORT 55555
```

使用时写成：

```cpp
addr.sin_port = htons(UDP_PORT);
```

这样做的好处：

- 名字能够直接说明数字的用途；
- 修改端口时只需改一处；
- 客户端和服务端可以共享同一份定义，减少端口不一致的问题；
- 代码更容易阅读和维护。

## 二、UDP 网络类的整体职责

`Udp` 继承抽象父类 `INet`，需要实现四类核心行为：

| 函数          | 职责                                                        |
| ------------- | ----------------------------------------------------------- |
| `initNet()`   | 加载 Winsock、创建 UDP 套接字、绑定 IP 和端口、创建接收线程 |
| `unInitNet()` | 通知接收线程退出、回收线程资源、关闭套接字、卸载 Winsock    |
| `sendData()`  | 校验参数，按目标 IP 和端口发送一段数据                      |
| `recvData()`  | 循环接收数据，将每一包复制到独立内存，再交给中介者          |

整体关系如下：

```text
主线程
├── 初始化网络
├── 创建 UDP 接收线程
├── 可以继续发送数据或执行其他业务
└── 关闭网络时通知并等待接收线程退出

UDP 接收线程
└── while (m_bRunning)
    ├── recvfrom() 阻塞等待数据
    ├── 收到数据后复制到独立空间
    └── 后续交给中介者处理
```

## 三、`Udp::initNet()`：初始化网络

### 1. 初始化流程

UDP 初始化流程：

1. `WSAStartup()` 加载 Winsock 库；
2. `socket()` 创建 UDP 套接字；
3. 填写本地 `sockaddr_in`；
4. `bind()` 绑定本地 IP 和 UDP 端口；
5. 创建专门负责接收数据的线程。

### 2. `bool` 返回值要特别注意

`initNet()` 的返回类型是 `bool`：

- 初始化成功返回 `true`；
- 初始化失败返回 `false`。

不能沿用以前 `main()` 中失败时 `return 1;` 的写法，因为在布尔值中 `1` 会被解释成 `true`，反而表示成功。

### 3. 套接字保存为成员变量

把套接字设计成 `INet` 的成员 `m_sock`。创建套接字时要给它赋值：

```cpp
m_sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
```

如果写成局部变量，初始化函数结束后，其他成员函数就无法通过统一的 `m_sock` 使用这个套接字。

### 4. 绑定地址

```cpp
sockaddr_in addr = {};
addr.sin_family = AF_INET;
addr.sin_port = htons(UDP_PORT);
addr.sin_addr.S_un.S_addr = ADDR_ANY;
```

- `AF_INET`：使用 IPv4；
- `htons(UDP_PORT)`：把主机字节序的端口转换成网络字节序；
- `ADDR_ANY`：接收发送到本机任意网卡地址、该端口的数据。

## 四、`Udp::sendData()`：发送 UDP 数据

函数声明：

```cpp
bool sendData(char* data, int len, unsigned long to);
```

参数含义：

| 参数   | 含义                                               |
| ------ | -------------------------------------------------- |
| `data` | 待发送数据的首地址                                 |
| `len`  | 数据长度                                           |
| `to`   | 目标 IPv4 地址，已经是可直接写入 `sin_addr` 的形式 |

### 1. 先检查参数

```cpp
if (!data || len <= 0) {
    cout << "paramater error" << endl;
    return false;
}
```

- `!data`：传入的是空指针；
- `len <= 0`：没有有效数据可发送。

参数非法时应立即返回，不能继续交给 `sendto()`。

### 2. 填写目标地址

```cpp
sockaddr_in addrTo = {};
addrTo.sin_family = AF_INET;
addrTo.sin_port = htons(UDP_PORT);
addrTo.sin_addr.S_un.S_addr = to;
```

这里的 `to` 必须写入 `addrTo.sin_addr.S_un.S_addr`。否则目标 IP 没有设置，发送行为就不完整。

### 3. 调用 `sendto()`

```cpp
int nSendNum = sendto(
    m_sock,
    data,
    len,
    0,
    (sockaddr*)&addrTo,
    sizeof(addrTo)
);
```

返回 `SOCKET_ERROR` 表示发送失败，应通过 `WSAGetLastError()` 输出错误码，并返回 `false`；发送成功则返回 `true`。

## 五、为什么接收数据必须放在线程中

UDP 使用 `recvfrom()` 接收数据：

```cpp
recvfrom(m_sock, recvBuf, sizeof(recvBuf), 0,
         (sockaddr*)&addrFrom, &addrSize);
```

默认情况下，`recvfrom()` 是阻塞函数：没有数据到达时，调用它的线程会停在这里等待。

如果在 `initNet()` 中直接调用永久循环的 `recvData()`：

- 初始化函数无法返回；
- 主线程不能继续发送数据；
- 后面的业务代码无法运行。

因此把接收工作交给一个独立线程：

- 主线程继续负责初始化、发送和业务流程；
- 接收线程专门阻塞等待网络数据；
- 两部分能够“同时”推进。

这里的“同时”是从程序运行效果看并发执行；CPU 实际如何调度线程，由操作系统决定。

## 六、使用 `_beginthreadex()` 创建接收线程

### 1. 为什么不用 `CreateThread()`

如果线程中要使用 C/C++ 运行库函数，例如字符串、内存分配等函数，更适合使用 `_beginthreadex()`。

- `CreateThread()` 与 `ExitThread()` 是 Windows API 的线程创建/退出方式；
- `_beginthreadex()` 与 `_endthreadex()` 会配合 C/C++ 运行库管理线程相关资源；
- 在线程中使用 C/C++ 运行库时，使用 `_beginthreadex()` 更合适，可避免运行库在线程中申请的资源未被正确清理。

需要包含：

```cpp
#include <process.h>
```

### 2. `_beginthreadex()` 的六个参数

调用形式：

```cpp
m_handle = (HANDLE)_beginthreadex(
    nullptr,
    0,
    &recvThread,
    this,
    0,
    nullptr
);
```

| 位置 | 传值          | 含义                                         |
| ---- | ------------- | -------------------------------------------- |
| 1    | `nullptr`     | 安全属性使用默认值                           |
| 2    | `0`           | 使用默认线程栈大小                           |
| 3    | `&recvThread` | 线程入口函数地址                             |
| 4    | `this`        | 传给线程函数的参数                           |
| 5    | `0`           | 创建后立即运行；也可以用挂起标志创建后再恢复 |
| 6    | `nullptr`     | 不需要接收线程 ID                            |

`_beginthreadex()` 返回的值被保存为线程句柄 `m_handle`，关闭网络时需要用它等待线程并回收资源。

### 3. 线程函数的格式

使用的线程函数声明：

```cpp
static unsigned __stdcall recvThread(void* lpVoid);
```

- `unsigned`：返回值类型；
- `__stdcall`：调用约定；
- `void*`：通用指针参数，可以传入任意对象地址；
- `static`：静态成员函数没有普通成员函数隐含的 `this` 参数，因此可以作为线程入口函数。

### 4. 为什么把 `this` 传入线程

静态成员函数不能直接访问某个对象的非静态成员。创建线程时把当前对象的 `this` 指针作为第四个参数传入，线程函数再转换回来：

```cpp
unsigned __stdcall Udp::recvThread(void* lpVoid)
{
    Udp* pThis = (Udp*)lpVoid;
    pThis->recvData();
    return 1;
}
```

执行关系是：

```text
_beginthreadex(..., &recvThread, this, ...)
                    │             │
                    │             └── 当前 Udp 对象地址
                    └── 新线程入口
                                  ↓
recvThread(void* lpVoid)
    ↓ 强制转换
Udp* pThis
    ↓
pThis->recvData()
```

## 七、循环接收与数据复制

### 1. 接收循环

接收线程通过运行标志控制循环：

```cpp
while (m_bRunning) {
    // recvfrom(...)
}
```

关闭网络时把 `m_bRunning` 改为 `false`，表示不再继续下一次接收。

### 2. 为什么不能直接把 `recvBuf` 交给下一层长期使用

`recvBuf` 是接收函数内部反复使用的缓冲区：

```cpp
char recvBuf[4096] = "";
```

收到第一条消息后，如果把 `recvBuf` 的地址直接交给中介者或 `kernel`，接收线程很快又可能用同一块缓冲区接收第二条消息。此时第一条消息还没有处理完，原内容就可能被新数据覆盖。

因此每收到一包数据，都按实际长度申请独立空间并复制：

```cpp
char* pack = new char[nRecvNum];
memcpy(pack, recvBuf, nRecvNum);

// TODO：把新空间中的数据传给中介者
```

这样每个数据包都有自己的内存，不会因为下一次 `recvfrom()` 重用 `recvBuf` 而被覆盖。接收端的下一层处理完数据后，需要与这里约定好使用 `delete[]` 释放 `pack`。

### 3. 为什么使用 `memcpy()`，而不是 `strcpy()`

网络上传输的不一定是字符串，也可能是含有整数、结构体等内容的二进制数据。

- `strcpy()` 把 `\0` 当作字符串结束标志，遇到数据内部的 `\0` 就会提前停止；
- `memcpy()` 按给定字节数复制，不关心数据内容；
- `nRecvNum` 正好是本次实际收到的字节数，因此使用 `memcpy(pack, recvBuf, nRecvNum)` 更适合网络数据包。

## 八、线程退出与资源回收

### 1. 线程相关资源

创建线程后涉及的资源：

- 线程 ID：由系统分配，用于标识线程；
- 线程句柄：用户态程序操作线程内核对象的入口；
- 线程内核对象：由操作系统维护。

线程函数运行结束，并不等于程序保存的句柄自动失效。句柄需要调用 `CloseHandle()` 关闭。

### 2. 先通知线程正常退出

关闭网络时先执行：

```cpp
m_bRunning = false;
```

让接收循环在能够继续执行时自行结束，而不是一上来就强制杀死线程。

### 3. 等待线程结束

```cpp
WaitForSingleObject(m_handle, 50000);
```

- 第一个参数：要等待的线程句柄；
- 第二个参数：最长等待时间，单位为毫秒；
- 如果线程提前结束，等待函数会提前返回；
- 如果达到等待时间仍未结束，会返回 `WAIT_TIMEOUT`。

处理思路：

```cpp
if (WAIT_TIMEOUT == WaitForSingleObject(m_handle, 50000)) {
    TerminateThread(m_handle, -1);
}
```

只有等待超时，才调用 `TerminateThread()` 作为最后手段。

### 4. 回收线程句柄

```cpp
if (m_handle) {
    CloseHandle(m_handle);
    m_handle = nullptr;
}
```

关闭句柄后把它置为 `nullptr`，可以明确表示当前不再持有有效线程句柄，也能避免重复关闭。

### 5. 为什么不建议直接 `TerminateThread()`

强制结束线程时，线程可能正处在任意一行代码上，也可能正持有锁。若它在释放锁之前被强制终止：

- 其他线程可能永远等不到这把锁；
- 共享数据可能处于只修改了一半的状态；
- 资源清理代码可能来不及执行。

因此顺序应是：

```text
设置退出标志 → 等待线程正常退出 → 超时才强制结束 → 关闭线程句柄
```

## 九、多线程共享数据、锁与死锁

### 1. `a++` 并不是不可分割的一步

从源代码看，`a++` 只有一行；但在机器执行层面，大致包含：

1. 从内存读取 `a`；
2. 将读取的值加一；
3. 把结果写回内存。

假设两个线程同时对共享变量 `a` 执行 `a++`，它们可能都先读到相同旧值，再分别写回相同新值。理论上执行两次应增加 2，最终却可能只增加 1，这就是共享数据竞争。

### 2. 为什么需要锁

访问共享资源前加锁，处理完再解锁，可以保证同一时刻只有一个线程修改关键数据：

```text
加锁 → 读取/修改共享数据 → 解锁
```

线程调度顺序由操作系统决定，不能依赖“我认为线程 A 一定先执行完”来保证正确性。

### 3. 死锁风险

如果线程拿到锁后，没有机会释放锁，其他线程就可能一直等待。例如线程持锁时被 `TerminateThread()` 强制结束，就可能留下永远无法正常释放的锁。

所以强制杀线程只是兜底手段，不能作为正常退出方式。

### 4. 接收缓冲区为什么选择复制，而不是长期加锁

若接收线程和业务线程一直围绕同一个 `recvBuf` 加锁，业务处理较慢时，接收线程也会被迫等待，套接字内部的接收缓冲区可能不断积压数据。

采用“每包复制到独立内存”的方法：

- 接收线程快速完成复制后就能继续收下一包；
- 业务线程处理自己的 `pack`；
- 两者不再同时读写同一块 `recvBuf`；
- 代价是每个数据包都需要动态申请和释放一次内存。
