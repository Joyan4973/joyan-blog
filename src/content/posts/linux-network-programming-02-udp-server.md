---
title: "Linux 网络编程（2）：基于 UDP 协议通信的服务端实现"
published: 2026-07-17T00:00:00Z
updated: 2026-07-17T00:00:00Z
description: "Linux 网络编程课程第 2 课，整理 UDP 服务端的基本流程，以及 Winsock2 初始化、套接字创建、地址绑定、数据接收与发送等实现细节。"
image: ""
tags:
  - Linux
  - 网络编程
  - 计算机网络
  - UDP
  - 课程笔记
category: Linux 网络编程
draft: false
pinned: false
comment: true
readingTime: 20
lang: zh_CN
---

# 基于 UDP 协议通信的服务端实现

UDP 服务端的基本流程是固定的：

```text
加载 Winsock 库
    ↓
创建 UDP 套接字 socket
    ↓
绑定本地 IP 和端口 bind
    ↓
循环接收数据 recvfrom
    ↓
向消息来源发送数据 sendto
    ↓
关闭套接字 closesocket
    ↓
卸载 Winsock 库 WSACleanup
```

这里规定服务端先接收、后发送。因此它是一个顺序执行、阻塞式的简单通信模型，暂时不能实现双方同时收发；后续可通过多线程、异步或 I/O 复用改进。

## C/S 架构与 B/S 架构

| 对比项         | C/S（Client/Server）           | B/S（Browser/Server）        |
| -------------- | ------------------------------ | ---------------------------- |
| 客户端         | 每个应用通常有自己的专用客户端 | 使用浏览器作为通用客户端     |
| 客户端是否固定 | 固定，不同应用的客户端不同     | 不固定，兼容的浏览器都能访问 |
| 通信协议       | 可以自定义，常用 TCP 或 UDP    | 基本固定为 HTTP 或 HTTPS     |
| 例子           | 游戏客户端、微信客户端         | 网站、Web 管理系统           |

## 通信前要创建并绑定 socket

**socket 是通信的基石**

创建 socket 时先确定地址族、套接字类型和协议；服务端随后通过 `bind` 把本地 IP、端口写入 socket。远端 IP 和端口在接收数据时由 `recvfrom` 返回，在发送数据时作为 `sendto` 的目标地址。

**socket 是操作系统资源**

## 静态库与动态库

Winsock API 是操作系统提供的库函数，所以使用前要完成头文件声明、链接库导入和运行库初始化。

| 项目               | 静态库                       | 动态库                              |
| ------------------ | ---------------------------- | ----------------------------------- |
| Windows 常见扩展名 | `.lib`                       | `.dll`，通常配套一个导入 `.lib`     |
| Linux 常见扩展名   | `.a`                         | `.so`                               |
| 链接方式           | 库代码被复制进 EXE           | EXE 中保存导入信息，运行时加载 DLL  |
| 发布               | 通常只发布 EXE               | 需要同时发布 EXE 和 DLL             |
| 体积与内存         | EXE 较大，多进程可能各存一份 | DLL 可被多个进程共享，EXE 较小      |
| 更新               | 库修改后通常要重新链接 EXE   | 接口不变时可只替换 DLL              |
| 调用               | 理论上少一次查找             | 运行时需要通过导入信息定位 DLL 函数 |

动态库配套的 `.lib` 主要保存函数导入信息，真正的函数实现位于 `.dll` 中。

## Winsock2 的准备工作

**头文件、链接库和兼容宏**

```cpp
#define _WINSOCK_DEPRECATED_NO_WARNINGS

#include <iostream>
#include <cstring>
#include <Winsock2.h>

#pragma comment(lib, "Ws2_32.lib")
```

- `<Winsock2.h>`：声明 Winsock2 的类型、常量和函数；
- `Ws2_32.lib`：Winsock2 的导入库；
- `#pragma comment(lib, ...)`：让 Visual Studio 链接指定库；
- `_WINSOCK_DEPRECATED_NO_WARNINGS`：用于关闭 `inet_ntoa` 等旧接口的弃用警告。必须写在包含 Winsock 头文件之前。

**`WSAStartup`：加载并初始化 Winsock**

```cpp
WORD version = MAKEWORD(2, 2);
WSADATA data = {};

int err = WSAStartup(version, &data);
if (err != 0) {
    cout << "WSAStartup fail" << endl;
    return 1;
}
```

参数含义：

- `MAKEWORD(2, 2)`：请求 Winsock 2.2；
- `version`：期望加载的版本号；
- `data`：由系统写入实际加载的 Winsock 信息，因此传入地址 `&data`；
- 返回 `0` 表示成功，非 `0` 表示失败。

初始化成功后还要核对实际版本：

```cpp
if (data.wVersion != version) {
    WSACleanup();
    cout << "WSAStartup version error" << endl;
    return 1;
}
```

## 创建 UDP 套接字

**`socket` 函数**

```cpp
SOCKET s = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
```

三个参数：

| 参数       | 取值          | 含义                 |
| ---------- | ------------- | -------------------- |
| 地址族     | `AF_INET`     | IPv4 地址            |
| 套接字类型 | `SOCK_DGRAM`  | 数据报套接字，即 UDP |
| 具体协议   | `IPPROTO_UDP` | 使用 UDP 协议        |

补充对比：TCP 通常使用 `SOCK_STREAM` 和 `IPPROTO_TCP`。

**基于 UDP 协议通信的服务端实现**

```cpp
if (s == INVALID_SOCKET) {
    cout << "socket error: " << WSAGetLastError() << endl;
    WSACleanup();
    return 1;
}
```

- 成功：返回 `SOCKET`；
- 失败：返回 `INVALID_SOCKET`；
- Winsock 系列函数的错误码使用 `WSAGetLastError()` 获取；
- 此时 socket 未创建成功，只需卸载库，不需要调用 `closesocket`。

## 使用 `sockaddr_in` 描述 IPv4 地址

IPv4 编程通常填写 `sockaddr_in`：

```cpp
struct sockaddr_in {
    short          sin_family;  // 地址族
    unsigned short sin_port;    // 端口
    struct in_addr sin_addr;    // IPv4 地址
    char           sin_zero[8]; // 填充
};
```

初始化服务端地址：

```cpp
sockaddr_in addr = {};
addr.sin_family = AF_INET;
addr.sin_port = htons(12345);
addr.sin_addr.S_un.S_addr = htonl(INADDR_ANY);
```

**为什么端口要用 `htons`**

网络协议规定多字节整数使用大端字节序。主机字节序不一定是大端，因此端口要转换：

- `htons`：host to network short，主机短整数转网络字节序；
- `ntohs`：network to host short；
- `htonl`：host to network long；
- `ntohl`：network to host long。

此处端口使用 `12345`。端口号理论上可自行选择，但应尽量避免与系统服务或其他应用冲突。

端口规则：同一时刻，一个端口通常只能被一个进程占用；一个进程可以使用多个端口。

**`INADDR_ANY` 的含义**

`INADDR_ANY` 表示服务端监听本机所有可用 IPv4 网卡地址。

- 接收方可绑定所有网卡，发到任一对应本机 IP 的数据都能接收；
- 发送方仍然必须选择一个明确的目标 IP，不能把同一份数据“同时发给所有网卡”。

## 绑定本地 IP 和端口

```cpp
int err = bind(s, reinterpret_cast<sockaddr*>(&addr), sizeof(addr));
```

`bind` 的作用：声明当前进程的这个 socket 使用哪个本地 IP 和端口。

参数：

1. 要绑定的 socket；
2. 本地地址结构的地址；
3. 地址结构的字节数。

API 接收通用的 `sockaddr*`，而 IPv4 代码使用 `sockaddr_in`，所以要进行指针类型转换。

错误处理：

```cpp
if (err == SOCKET_ERROR) {
    cout << "bind error: " << WSAGetLastError() << endl;
    closesocket(s);
    WSACleanup();
    return 1;
}
```

`bind` 失败时 socket 已经创建，所以必须先 `closesocket`，再 `WSACleanup`。

## 接收 UDP 数据：`recvfrom`

**函数原型**

```cpp
int recvfrom(
    SOCKET s,
    char* buf,
    int len,
    int flags,
    sockaddr* from,
    int* fromlen
);
```

参数解释：

| 参数      | 方向      | 含义                         |
| --------- | --------- | ---------------------------- |
| `s`       | 输入      | 使用哪个已绑定的 socket 接收 |
| `buf`     | 输出      | 接收数据的缓冲区             |
| `len`     | 输入      | 缓冲区长度                   |
| `flags`   | 输入      | 标志位；传 `0`，表示默认方式 |
| `from`    | 输出      | 发送方的 IP 和端口           |
| `fromlen` | 输入/输出 | 地址结构长度；必须传变量地址 |

准备变量：

```cpp
char recvBuf[4096] = "";
sockaddr_in addrFrom = {};
int addrFromSize = sizeof(addrFrom);
```

调用：

```cpp
int nRecvNum = recvfrom(
    s,
    recvBuf,
    sizeof(recvBuf),
    0,
    reinterpret_cast<sockaddr*>(&addrFrom),
    &addrFromSize
);
```

关键点：

- 成功时返回收到的字节数；用 `nRecvNum > 0` 判断成功；
- 失败时返回 `SOCKET_ERROR`，用 `WSAGetLastError()` 获取错误码；
- `addrFrom` 由系统回填，告诉服务端数据来自哪个 IP、哪个端口；
- `addrFromSize` 必须先保存 `sizeof(addrFrom)`，最后传 `&addrFromSize`；常量本身没有可取的地址；
- 默认的 `recvfrom` 是阻塞调用：没有数据时程序会停在这里等待，并不是死循环或崩溃。

更严谨地处理文本时，应根据返回长度补结束符：

```cpp
if (nRecvNum > 0) {
    int end = (nRecvNum < static_cast<int>(sizeof(recvBuf)))
        ? nRecvNum
        : static_cast<int>(sizeof(recvBuf)) - 1;
    recvBuf[end] = '\0';
}
```

## IP 地址转换

地址结构中的 IP 以整数形式保存，直接打印不便阅读

```cpp
cout << "ip: " << inet_ntoa(addrFrom.sin_addr)
          << " say: " << recvBuf << endl;
```

涉及两个方向：

- `inet_addr("192.168.1.10")`：点分十进制字符串转网络地址整数；
- `inet_ntoa(addrFrom.sin_addr)`：网络地址转点分十进制字符串。

`inet_ntoa` 属于旧接口，所以 Visual Studio 可能给出弃用提示，通过 `_WINSOCK_DEPRECATED_NO_WARNINGS` 关闭警告；新项目更推荐 `inet_pton` 和 `inet_ntop`。

## 发送 UDP 数据：`sendto`

**函数原型**

```cpp
int sendto(
    SOCKET s,
    const char* buf,
    int len,
    int flags,
    const sockaddr* to,
    int tolen
);
```

与 `recvfrom` 对比：

- `recvfrom` 的缓冲区和来源地址是输出参数；
- `sendto` 的数据、目标地址都是输入参数；
- `recvfrom` 的最后一个长度参数是指针；
- `sendto` 的最后一个长度参数是普通整数。

服务端回复刚刚发来消息的客户端，因此目标地址直接使用 `addrFrom`：

```cpp
char sendBuf[4096] = "";
cin >> sendBuf;

int nSendNum = sendto(
    s,
    sendBuf,
    static_cast<int>(strlen(sendBuf)) + 1,
    0,
    reinterpret_cast<sockaddr*>(&addrFrom),
    addrFromSize
);
```

`strlen(sendBuf) + 1` 中的 `+1` 是为了把字符串结尾的 `\0` 一并发送。这样接收方可直接按 C 字符串打印。

失败处理：

```cpp
if (nSendNum == SOCKET_ERROR) {
    cout << "sendto error: " << WSAGetLastError() << endl;
    break;
}
```

## 完整服务端代码

```cpp
#define _WINSOCK_DEPRECATED_NO_WARNINGS
#include<iostream>
#include<Winsock2.h>

#pragma comment(lib,"Ws2_32.lib")
using namespace std;
int main() {
	//1、加载库
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
		WSACleanup();
		cout << "WSAStartup version error" << endl;
		return 1;
	}
	//2、创建套接字
	SOCKET s = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
	if (INVALID_SOCKET == s) {
		cout << "socket error: " << WSAGetLastError() << endl;
		WSACleanup();
		return 1;
	}
	else {
		cout << "socket success" << endl;
	}
	//3、绑定端口和ip
	sockaddr_in addr = {};
	addr.sin_family = AF_INET;
	addr.sin_port = htons(12345);
	addr.sin_addr.S_un.S_addr = INADDR_ANY;
	err = bind(s,(sockaddr*)&addr,sizeof(addr));
	if (SOCKET_ERROR == err) {
		cout << "bind error:" << WSAGetLastError() << endl;
		closesocket(s);
		WSACleanup();
		return 1;
	}
	else {
		cout << "bind success" << endl;
	}
	int nRecvNum = 0;
	int nSendNum = 0;
	char recvBuf[4096] = "";
	char sendBuf[4096] = "";
	sockaddr_in addrFrom = {};
	int size = sizeof(addrFrom);
	while (true) {
		//4、接收数据
		nRecvNum = recvfrom(s, recvBuf, sizeof(recvBuf), 0, (sockaddr*)&addrFrom, &size);
		if (nRecvNum > 0) {
			cout << "ip: " << inet_ntoa(addrFrom.sin_addr) << "say: " << recvBuf << endl;
		}
		else {
			cout << "recvfrom error:" << WSAGetLastError() << endl;
			break;
		}
		cin >> sendBuf;
		nSendNum = sendto(s, sendBuf, strlen(sendBuf) + 1, 0, (sockaddr*)&addrFrom, size);
		if (SOCKET_ERROR == nSendNum) {
			cout << "sendto error: " << WSAGetLastError() << endl;
			break;
		}
		closesocket(s);
		WSACleanup();
	}

	//7、卸载库
	WSACleanup();
	return 0;
}
```

**结果**

```text
WSAStartup success
socket success
bind success
```

随后没有继续输出，是因为程序进入 `recvfrom`，而客户端尚未实现，没有数据发来。`recvfrom` 是阻塞函数，因此会一直等待，直到：

1. 收到 UDP 数据；或
2. 手动结束程序；或
3. 发生错误。

实现客户端后，客户端一发送数据，服务端才会从 `recvfrom` 返回并继续执行打印与回复逻辑。
