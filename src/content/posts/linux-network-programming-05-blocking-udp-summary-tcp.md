---
title: "Linux 网络编程（5）：阻塞、非阻塞 & UDP 总结"
published: 2026-07-22T15:32:13Z
updated: 2026-07-22T15:32:13Z
description: "Linux 网络编程课程第 5 课，整理 Socket 缓冲区、阻塞与非阻塞模式、UDP 协议总结，并介绍 TCP 通信流程及服务端、客户端实现。"
image: ""
tags:
  - Linux
  - 网络编程
  - Socket
  - 阻塞与非阻塞
  - UDP
  - TCP
  - Winsock
  - 课程笔记
category: Linux 网络编程
draft: false
pinned: false
comment: true
readingTime: 20
lang: zh_CN
---

# 阻塞、非阻塞 & UDP 总结

本节从 Socket 的发送缓冲区与接收缓冲区出发，梳理阻塞与非阻塞模式的行为差异，并总结 UDP 面向非连接、保持消息边界、高效但不可靠等核心特点。

随后进入 TCP 网络编程，整理服务端与客户端的通信流程，以及 `listen`、`accept`、`connect`、`send` 和 `recv` 等关键接口，并给出可运行的完整示例。

## Socket 的发送缓冲区与接收缓冲区

**为什么尚未调用 `recvfrom` 也能收到先前的数据**

是数据到达计算机后，不会直接写入程序定义的 `recvBuf`，而是先由操作系统放入该 Socket 对应的**接收缓冲区**。

程序调用 `recvfrom` 时，操作系统再把数据从内核中的接收缓冲区复制到进程的用户空间。

数据发送的过程正好相反：程序调用 `sendto`，先把用户空间中的数据复制到 Socket 的发送缓冲区，再由操作系统调度网卡将数据发出。

**进程虚拟内存与 Socket 所在位置**

32 位 Windows 进程中，每个进程拥有 4 GB 虚拟地址空间，其中 0～2 GB 为用户空间，2～4 GB 为内核空间。

- 用户空间由各进程独立使用，进程之间不能直接访问对方的用户空间。
- 内核空间由操作系统管理。
- 创建 Socket 时，操作系统在内核中维护 Socket，并为它准备发送缓冲区和接收缓冲区。
- 同一进程创建多个 Socket 时，每个 Socket 都有各自对应的收发缓冲区；`recvfrom` 的第一个参数决定从哪个 Socket 的接收缓冲区取数据。
- 虚拟地址不是物理内存的真实地址，操作系统负责完成虚拟地址到物理地址的映射。

**使用 `getsockopt` 查看缓冲区大小**

使用 `SO_RCVBUF` 和 `SO_SNDBUF` 查询接收、发送缓冲区的大小：

```cpp
int recvSize = 0;
int sendSize = 0;
int size = sizeof(int);

getsockopt(s, SOL_SOCKET, SO_RCVBUF, (char*)&recvSize, &size);
getsockopt(s, SOL_SOCKET, SO_SNDBUF, (char*)&sendSize, &size);
```

查询到的发送缓冲区和接收缓冲区均为 65536 字节，也就是 64 KB。

64 KB 是示例环境中 Socket 缓冲区的容量，并不表示应用程序在任何时刻都一定能再写入 64 KB。

发送缓冲区中可能已有尚未被网卡发出的数据，实际剩余空间会随网络繁忙程度变化。

## 阻塞与非阻塞

**阻塞**

等待的事情尚未发生时，当前执行流程会一直等待，不继续向后执行。

特点：

- 等待期间不通过循环反复查询，因此不会用轮询持续占用 CPU。
- 事情一旦发生，等待立即结束，程序能及时知道结果。
- Socket 创建后默认是阻塞模式；没有数据时，阻塞式 `recvfrom` 会停在接收调用处。

**非阻塞**

调用会在很短时间内返回结果。除了成功和真正失败，还可能出现“事情暂时没有发生”的情况。

特点：

- 程序不会一直停在某一次等待上，可以在等待期间处理其他工作。
- 通常需要反复查询，因此查询过程会占用 CPU。
- 事情发生后，不一定在第一时间被发现；只有下一次查询时才知道。
- 应适当加入短暂休眠，避免无意义的高频空转。

**把 Socket 设置为非阻塞模式**

在 UDP 服务端的 `bind` 之后、进入接收循环之前加入：

```cpp
// 设置socket为非阻塞模式
u_long iMode = 1;
ioctlsocket(s, FIONBIO, &iMode);
```

`iMode` 为 0 时启用阻塞模式；非 0 时启用非阻塞模式。

**非阻塞接收处理**

```cpp
nRecvNum = recvfrom(
    s,
    recvBuf,
    sizeof(recvBuf),
    0,
    (sockaddr*)&addrFrom,
    &size
);

if (nRecvNum > 0) {
    cout << "ip:" << inet_ntoa(addrFrom.sin_addr)
         << "say:" << recvBuf << endl;
}
else {
    if (10035 == WSAGetLastError()) {
        // 非阻塞模式，暂时没有数据，休眠一会继续
        Sleep(50);
        continue;
    }
    else {
        cout << "recvfrom error:" << WSAGetLastError() << endl;
        break;
    }
}
```

错误码 `10035` 表示当前非阻塞操作无法立即完成，也就是此刻暂时没有数据，并不是真正的程序错误。

其对应的 Winsock 名称是 `WSAEWOULDBLOCK`。

**发送时的阻塞与非阻塞**

当发送缓冲区还有足够空间时，阻塞发送和非阻塞发送表现相同，数据都能直接复制进发送缓冲区。

只有发送缓冲区剩余空间不足时才表现出差异：

- 阻塞发送：等待缓冲区腾出足够空间后，再把数据复制进去。
- 非阻塞发送：当前有多少可用空间就处理多少，未处理完的数据由程序继续安排。

## UDP 协议总结

**面向非连接**

UDP 通信前不需要建立连接。接收端可以接收任意客户端发来的数据，既可以一对一，也可以通过广播等方式形成一对多。

**使用数据报通信，保持消息边界**

一次发送形成一个数据报。用较小的 `recvBuf` 接收较大的数据报进行测试：程序没有只取数据报的前半部分，而是返回错误码 `10040`。

这说明 UDP 数据报不能由应用层的某一次 `recvfrom` 随意拆开接收：要么为整个数据报准备足够空间，要么本次接收失败。

错误码 `10040` 对应“消息太长”（`WSAEMSGSIZE`）。

**传输效率高**

UDP 不需要建立连接，也不负责确认、重传和顺序恢复，因此额外控制过程较少，传输效率高。

**不可靠**

UDP 可能产生丢包和乱序；协议本身不负责把丢失的数据重新发送，也不负责恢复正确顺序。是否需要补充可靠性机制，应由具体应用决定。

## TCP 的通信流程

**面向连接、可靠、基于字节流**

TCP 通信前必须先建立连接，类似先接通电话再开始交谈。

| TCP 服务端                    | TCP 客户端                                 |
| ----------------------------- | ------------------------------------------ |
| 加载 Winsock 库               | 加载 Winsock 库                            |
| 创建 TCP Socket               | 创建 TCP Socket                            |
| 绑定 IP 和端口                | 通常不必手动绑定，由系统分配本地地址和端口 |
| `listen` 监听                 | `connect` 发起连接                         |
| `accept` 接受连接             | 连接成功后开始通信                         |
| 先 `recv`，后 `send`          | 先 `send`，后 `recv`                       |
| 关闭通信 Socket 和监听 Socket | 关闭 Socket                                |
| 卸载 Winsock 库               | 卸载 Winsock 库                            |

**`listen`**

```cpp
err = listen(s1, 100);
```

- `s1` 是已经绑定端口的监听 Socket。
- 第二个参数是等待建立连接的客户端队列的最大长度。
- 该数字表示等待队列容量，不是已经建立连接后能够通信的客户端总数。
- 实际项目应结合服务器性能和压力测试结果决定。

**`accept` 与两个 Socket 的分工**

```cpp
s2 = accept(s1, (sockaddr*)&addrClient, &addrSize);
```

- `s1`：监听 Socket，继续负责监听和接受新的连接。
- `s2`：`accept` 成功后返回的通信 Socket，专门与当前客户端收发数据。
- `addrClient`：输出参数，保存来连接的客户端地址信息。
- 一个服务端面对多个客户端时，每次成功接受连接都会得到一个新的通信 Socket。

**TCP 为什么使用 `send`、`recv`**

连接建立后，通信双方已经确定，不需要每次收发都再次提供目标地址或来源地址，因此 TCP 使用 `send` 和 `recv`，参数比 UDP 的 `sendto`、`recvfrom` 少。

## TCP 服务端完整代码

```cpp
#define _WINSOCK_DEPRECATED_NO_WARNINGS
#include <iostream>
#include <Winsock2.h>

#pragma comment(lib, "Ws2_32.lib")
using namespace std;

int main()
{
    // 1、加载库
    WORD version = MAKEWORD(2, 2);
    WSADATA data = {};
    int err = WSAStartup(version, &data);

    if (0 != err) {
        cout << "WSAStartup fail" << endl;
        return 1;
    }

    if (data.wVersion == version) {
        cout << "WSAStartup success" << endl;
    }
    else {
        cout << "WSAStartup version error" << endl;
        WSACleanup();
        return 1;
    }

    // 2、创建套接字（TCP协议）
    SOCKET s1 = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (INVALID_SOCKET == s1) {
        cout << "socket error:" << WSAGetLastError() << endl;
        WSACleanup();
        return 1;
    }
    else {
        cout << "socket success" << endl;
    }

    // 3、绑定IP和端口
    sockaddr_in addr = {};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(6666);
    addr.sin_addr.S_un.S_addr = ADDR_ANY;
    err = bind(s1, (sockaddr*)&addr, sizeof(addr));
    if (SOCKET_ERROR == err) {
        cout << "bind error:" << WSAGetLastError() << endl;
        closesocket(s1);
        WSACleanup();
        return 1;
    }
    else {
        cout << "bind success" << endl;
    }

    // 4、监听
    err = listen(s1, 100/*等待连接的客户端队列的最大长度*/);
    if (SOCKET_ERROR == err) {
        cout << "listen error:" << WSAGetLastError() << endl;
        closesocket(s1);
        WSACleanup();
        return 1;
    }
    else {
        cout << "listen success" << endl;
    }

    sockaddr_in addrClient = {};
    int addrSize = sizeof(addrClient);
    SOCKET s2 = INVALID_SOCKET;
    char sendBuf[1024] = "";
    char recvBuf[1024] = "";
    int nSendNum = 0;
    int nRecvNum = 0;

    while (true) {
        // 5、接受连接
        s2/*接受连接成功产生的socket，专门用来跟当前客户端收发数据*/ =
            accept(s1, (sockaddr*)&addrClient/*来连接的客户端的地址信息*/, &addrSize);

        if (INVALID_SOCKET == s2) {
            // 接受连接失败
            cout << "accept error:" << WSAGetLastError() << endl;
            break;
        }
        else {
            cout << "accept success:" << inet_ntoa(addrClient.sin_addr) << endl;
        }

        // 连接成功，开始通信
        while (true) {
            // 6、接收数据
            nRecvNum = recv(s2, recvBuf, sizeof(recvBuf), 0);
            if (nRecvNum > 0) {
                // 接收数据成功
                cout << "client say:" << recvBuf << endl;
            }
            else {
                cout << "recv error:" << WSAGetLastError() << endl;
                break;
            }

            // 从终端输入要发送的数据
            cin >> sendBuf;

            // 7、发送数据
            nSendNum = send(s2, sendBuf, strlen(sendBuf) + 1, 0);
            if (SOCKET_ERROR == nSendNum) {
                cout << "send error:" << WSAGetLastError() << endl;
                break;
            }
        }

        // 结束通信，关闭当前客户端的socket
        closesocket(s2);
    }

    // 8、关闭套接字
    closesocket(s1);

    // 9、卸载库
    WSACleanup();
    return 0;
}
```

## TCP 客户端完整代码

```cpp
#define _WINSOCK_DEPRECATED_NO_WARNINGS
#include <iostream>
#include <Winsock2.h>

#pragma comment(lib, "Ws2_32.lib")
using namespace std;

int main()
{
    // 1、加载库
    WORD version = MAKEWORD(2, 2);
    WSADATA data = {};
    int err = WSAStartup(version, &data);

    if (0 != err) {
        cout << "WSAStartup fail" << endl;
        return 1;
    }

    if (data.wVersion == version) {
        cout << "WSAStartup success" << endl;
    }
    else {
        cout << "WSAStartup version error" << endl;
        WSACleanup();
        return 1;
    }

    // 2、创建套接字（TCP）
    SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (INVALID_SOCKET == s) {
        cout << "socket error:" << WSAGetLastError() << endl;
        WSACleanup();
        return 1;
    }
    else {
        cout << "socket success" << endl;
    }

    // 3、连接服务端
    sockaddr_in addrServer = {};
    addrServer.sin_family = AF_INET;
    addrServer.sin_port = htons(6666);
    addrServer.sin_addr.S_un.S_addr = inet_addr("127.0.0.1");

    err = connect(s, (sockaddr*)&addrServer, sizeof(addrServer));
    if (SOCKET_ERROR == err) {
        cout << "connect error:" << WSAGetLastError() << endl;
        closesocket(s);
        WSACleanup();
        return 1;
    }
    else {
        cout << "connect success" << endl;
    }

    char sendBuf[1024] = "";
    char recvBuf[1024] = "";
    int nSendNum = 0;
    int nRecvNum = 0;

    while (true) {
        // 从终端输入要发送的数据
        cin >> sendBuf;

        // 4、发送数据
        nSendNum = send(s, sendBuf, strlen(sendBuf) + 1, 0);
        if (SOCKET_ERROR == nSendNum) {
            cout << "send error:" << WSAGetLastError() << endl;
            break;
        }

        // 5、接收数据
        nRecvNum = recv(s, recvBuf, sizeof(recvBuf), 0);
        if (nRecvNum > 0) {
            cout << "server say:" << recvBuf << endl;
        }
        else {
            cout << "recv error:" << WSAGetLastError() << endl;
            break;
        }
    }

    // 6、关闭套接字、卸载库
    closesocket(s);
    WSACleanup();
    return 0;
}
```
