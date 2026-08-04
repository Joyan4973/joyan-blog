---
title: "Linux 网络编程（15）：IM 聊天系统——网络功能实现：TCP 协议服务端"
published: 2026-08-04T11:15:34Z
updated: 2026-08-04T11:15:34Z
description: "Linux 网络编程课程第 15 课，整理 IM 聊天系统 TCP 服务端的多客户端接收、线程与套接字映射、资源回收，以及网络层向中介者移交数据的实现。"
image: ""
tags:
  - Linux
  - 网络编程
  - IM 聊天系统
  - TCP
  - Winsock
  - 多线程
  - 中介者模式
  - 课程笔记
category: Linux 网络编程
draft: false
pinned: false
comment: true
readingTime: 11
lang: zh_CN
---

# IM 聊天系统——网络功能实现：TCP 协议服务端

本节继续实现 IM 聊天系统的 TCP 服务端，重点解决多个客户端同时连接时的数据接收问题，并建立接收线程与客户端套接字之间的对应关系。

随后完善完整数据包接收、双向通信测试和网络资源回收流程，再把网络层收到的数据交给中介者处理，并分析类之间循环构造导致栈溢出的原因及解决方法。

## 一、TCP 服务端接收多个客户端的总体思路

### 1. 服务端有两类套接字

服务端中的 `m_sock` 是监听套接字，负责 `listen()` 和 `accept()`；每次 `accept()` 成功后返回的 `sock`，才是与某个具体客户端通信的套接字。

```text
                      ┌─ 客户端1 ─ sock1 ─ recvThread1
监听套接字 m_sock ────┼─ 客户端2 ─ sock2 ─ recvThread2
                      └─ 客户端3 ─ sock3 ─ recvThread3
```

发送时，想给哪个客户端发送，就使用哪个客户端对应的 `sock`；接收时也一样，接收哪个客户端的数据，就必须把对应的 `sock` 传给 `recv()`。

### 2. 为什么采用“一客户端一接收线程”

两种方案：

- 把所有客户端套接字放进容器，由一个线程不断轮询。因为 `recv()` 默认阻塞，所以必须改成非阻塞；客户端较多时还会反复检查大量没有数据的套接字，效率较低，并可能产生延迟。
- 每连接一个客户端，就创建一个接收线程。每个线程只负责一个客户端，多个线程同时等待消息，任何一个客户端发来数据，都能由对应线程及时接收。

本项目采用第二种方案：**一个客户端对应一个接收线程，一个接收线程对应一个已连接套接字。**

## 二、STL 容器选择

常见数据结构及特点：

| 数据结构 | 特点 | 本节用途 |
| --- | --- | --- |
| 数组 | 空间连续；已知下标时查找快；中间增删可能移动数据 | 不用于保存线程与套接字关系 |
| 链表 | 空间不连续；增删方便；查找需要从头遍历 | `list` 保存接收线程句柄 |
| 队列 | 先进先出 | 本节未使用 |
| 栈 | 先进后出 | 本节未使用 |
| `map` | 保存 `key-value` 一对一关系，按键查找方便 | 保存“线程 ID—SOCKET” |
| `set` | 只保存一个值，并要求查找方便 | 本节未使用 |

线程和客户端套接字之间是一对一关系，而且后面需要根据当前线程 ID 查找套接字，因此使用：

```cpp
map<unsigned int, SOCKET> m_mapThreadIdToSocket;
```

接收线程的句柄只需要逐个保存、逐个回收，因此使用：

```cpp
list<HANDLE> m_listHandle;
```

### `map` 取值前为什么先判断

如果直接执行：

```cpp
m_mapThreadIdToSocket[threadId]
```

而 `threadId` 不存在，`operator[]` 会在 `map` 中插入该键及其默认值。为了避免产生错误节点，先使用 `count()` 判断：

```cpp
if (m_mapThreadIdToSocket.count(threadId) > 0) {
	// 确认存在后再取值
}
```

## 三、连接成功后创建接收线程

### 1. `acceptThread()` 中新增的局部变量

```cpp
HANDLE handle = nullptr;
unsigned int threadId = 0;
```

- `handle` 保存新建接收线程的句柄，后面放入 `m_listHandle`。
- `threadId` 通过 `_beginthreadex()` 的最后一个参数取得，后面作为 `map` 的键。

### 2. 接收数据线程函数

```cpp
// 接收数据的线程函数
unsigned __stdcall TcpServer::recvThread(void* lpVoid)
{
	TcpServer* pThis = (TcpServer*)lpVoid;
	pThis->recvData();
	return 1;
}
```

`recvThread()` 本身只负责把 `lpVoid` 转回 `TcpServer*`，然后调用当前对象的 `recvData()`。

## 四、在 `recvData()` 中取得当前线程对应的套接字

线程创建完成后可能立刻开始执行，而 `acceptThread()` 中把 `threadId` 和 `sock` 存入 `map` 的代码可能还没有得到时间片。这样，接收线程可能先进入 `recvData()`，却从 `map` 中取不到套接字。

先休眠一小段时间：

```cpp
Sleep(5);
```

其目的不是等待网络数据，而是等待 `acceptThread()` 先完成：

```cpp
m_mapThreadIdToSocket[threadId] = sock;
```

然后使用：

```cpp
unsigned int threadId = GetCurrentThreadId();
```

取得当前接收线程的 ID，再从 `map` 中查找套接字：

```cpp
SOCKET sock = INVALID_SOCKET;
if (m_mapThreadIdToSocket.count(threadId) > 0) {
	sock = m_mapThreadIdToSocket[threadId];
}
else {
	cout << "sock error" << endl;
	return;
}
```

如果打印 `sock error`，重点排查：

1. `_beginthreadex()` 是否正确取得了 `threadId`；
2. `threadId` 和 `sock` 是否正确存入 `map`；
3. `recvData()` 中取得的是否确实是当前接收线程 ID。

## 五、TCP 服务端接收完整数据包

服务端和客户端的收包流程相同：

1. 先接收数据长度；
2. 根据长度申请空间；
3. 循环接收数据内容，直到当前包全部收完。

区别只在于：客户端使用成员变量 `m_sock`，服务端使用当前接收线程从 `map` 中取得的 `sock`。

### 服务端向原客户端回复时使用哪个套接字

接收数据时使用的 `sock` 就代表数据来自哪个客户端。要给该客户端回复，仍然把这个 `sock` 传给 `sendData()`：

```cpp
sendData(s, sizeof(s), sock);
```

TCP 服务端的 `to` 表示目标客户端对应的 `SOCKET`；UDP 中的 `to/from` 表示 IP。

## 六、连续发送 10 次进行双向通信测试

在 `main.cpp` 中让客户端连续发送 10 次：

```cpp
// 客户端给服务端发10条数据
for (int i = 0; i < 10; i++) {
	pClient->sendData(s, sizeof(s), 1);
}
```

测试目的：

- 检查客户端连续发送多个数据包时，服务端能否逐包接收；
- 检查服务端能否使用收到数据时对应的 `sock` 给客户端回复；
- 检查长度、偏移量和缓冲区处理是否出现越界或错位。

运行时多条线程同时使用 `cout`，日志可能交叉显示。这是线程调度导致的输出混在一起，不一定是漏写了换行。

## 七、TCP 服务端关闭网络与资源回收

TCP 服务端拥有：

- 1 个接受连接线程；
- N 个接收数据线程；
- 1 个监听套接字；
- N 个与客户端通信的已连接套接字。

关闭顺序为：

```text
m_bRunning = false
        ↓
回收接受连接线程
        ↓
循环回收所有接收线程
        ↓
关闭监听套接字
        ↓
循环关闭所有客户端套接字
        ↓
WSACleanup()
```

### 为什么循环中不写 `ite++`

`erase(ite)` 删除当前节点后会返回下一个有效节点，所以是：

```cpp
ite = 容器.erase(ite);
```

如果一边删除当前节点，一边再执行 `ite++`，迭代器处理就会出错或跳过节点。

## 八、网络层收到数据后交给中介者类

### 1. 网络层和中介者层的职责

- 网络层负责收发原始数据。
- 网络层收到一个完整数据包后，不在网络层继续处理业务，而是调用中介者的 `transmitData()`。
- 中介者负责把数据继续交给上层处理；本节先用打印和回复消息进行测试。

统一接口：

```cpp
virtual void transmitData(char* data, int len, unsigned long from) = 0;
```

参数含义：

| 参数 | 含义 |
| --- | --- |
| `data` | 接收到的数据内容 |
| `len` | 接收到的数据长度 |
| `from` | 数据来自谁；UDP 中是 IP，TCP 中是 SOCKET |

### 2. `INet` 保存中介者指针

```cpp
class INetMediator;
class INet {
public:
	INet() :m_sock(INVALID_SOCKET), m_handle(nullptr), m_bRunning(true), m_pMediator(nullptr){}
	virtual ~INet() {}

	// 省略其他成员

protected:
	SOCKET m_sock;
	HANDLE m_handle;
	bool m_bRunning;
	INetMediator* m_pMediator;
};
```

### 3. 使用前置声明解决头文件循环包含

`INet` 需要使用 `INetMediator*`，`INetMediator` 又需要使用 `INet*`。如果两个头文件互相 `#include`，就会形成循环包含。

先声明，后使用：

```cpp
// INet.h
class INetMediator;
```

```cpp
// INetMediator.h
class INet;
```

前置声明适用于这里只定义指针的情况。老师同时强调：被前置声明的类必须真实存在于项目中，类名不能写错。

去掉间接包含关系后，`main.cpp` 中的 `Sleep()`、`inet_addr()` 若无法识别，在 `main.cpp` 中补充：

```cpp
#include <Windows.h>
```

## 九、循环构造导致的 `stack overflow`

### 1. 出错写法的调用链

最初在 `Udp` 构造函数中再次创建中介者对象：

```text
main：new UdpMediator
        ↓
UdpMediator 构造：new Udp
        ↓
Udp 构造：new UdpMediator
        ↓
再次进入 UdpMediator 构造……
```

两个类不断互相 `new`，构造函数无限递归，最终出现 `stack overflow`（栈溢出）。

### 2. 正确思路：传递已有对象，不再创建第二个对象

`main()` 已经创建了一个 `UdpMediator` 对象，不需要在 `Udp` 中再创建新的中介者。应当把已有对象的指针通过构造函数参数传入。

`Udp.h`：

```cpp
Udp(INetMediator*);
```

`Udp.cpp`：

```cpp
#include "Udp.h"
#include "../mediator/UdpMediator.h"

Udp::Udp(INetMediator* p) {
	m_pMediator = p;
}
```

`UdpMediator.cpp`：

```cpp
UdpMediator::UdpMediator() {
	m_pNet = new Udp(this);
}
```

这里的 `this` 指向当前正在构造的 `UdpMediator` 对象。它先作为参数传给 `Udp` 构造函数中的 `p`，再赋给网络层成员 `m_pMediator`。因此 `Udp` 可以回调原来已经存在的中介者对象，不会再次创建中介者。

## 十、UDP 数据移交中介者的测试

UDP 接收成功后，先按照实际接收长度申请空间并复制数据，再把新空间交给中介者：

```cpp
if (nRecvNum > 0) {
	// 接收数据成功，按照数据长度申请一个新的空间
	char* pack = new char[nRecvNum];
	// 把接收到的数据拷贝到新的空间中
	memcpy(pack, recvBuf, nRecvNum);
	// 把新空间的数据传给中介者
	m_pMediator->transmitData(pack, nRecvNum, addrFrom.sin_addr.S_un.S_addr);
}
```

`UdpMediator::transmitData()` 中的测试代码：

```cpp
void UdpMediator::transmitData(char* data, int len, unsigned long from) {
	// 测试代码：打印接收到的数据
	cout << "UdpMediator recv:" << data << ", len:" << len << endl;
}
```

运行后，原来由 `Udp::recvData()` 打印的内容变成由 `UdpMediator::transmitData()` 打印，说明数据已经从网络层到达中介者层。
