---
title: "Linux 网络编程（3）：基于 UDP 协议通信的服务端实现 2 & ARP 和 RARP"
published: 2026-07-20T15:25:04Z
updated: 2026-07-20T15:25:04Z
description: "Linux 网络编程课程第 3 课，补全 UDP 客户端实现，并整理数据封装与解封装、单播/组播/广播、ARP、DNS 和路由转发等知识。"
image: ""
tags:
  - Linux
  - 网络编程
  - 计算机网络
  - UDP
  - ARP
  - DNS
  - 路由
  - 课程笔记
category: Linux 网络编程
draft: false
pinned: false
comment: true
readingTime: 16
lang: zh_CN
---

# 基于 UDP 协议通信的服务端实现 2 & ARP 和 RARP

本节在上一课 UDP 服务端的基础上补全客户端实现，并进一步整理数据传输中的封装与解封装、单播/组播/广播、ARP 地址解析、DNS 域名解析以及路由转发过程。

客户端与服务端仍采用严格的一问一答模式：客户端先发送，服务端先接收。理解这套程序之后，可以把 socket 编程与底层网络协议的实际工作过程联系起来。

## 客户端整体流程

```text
加载 Winsock 库
    ↓
创建 UDP 套接字
    ↓
填写服务端的 IPv4 地址和端口
    ↓
循环：发送数据 → 接收数据
    ↓
关闭套接字
    ↓
卸载 Winsock 库
```

服务端先执行“接收”，所以客户端必须先执行“发送”。当前程序采用严格的一问一答顺序，还不能做到双方随时同时发言。

**完整客户端代码**

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
	sockaddr_in addrServer = {};
	addrServer.sin_family = AF_INET;
	addrServer.sin_port = htons(12345);

	addrServer.sin_addr.S_un.S_addr = inet_addr("192.168.1.200");

	char sendBuf[4096] = "";
	char recvBuf[4096] = "";

	sockaddr_in addrFrom = {};
	int size = sizeof(addrFrom);
	while (true) {
		// 3、发送数据
		cin >> sendBuf;

		int nSendNum = sendto(s,sendBuf,strlen(sendBuf) + 1,0,(sockaddr*)&addrServer,sizeof(addrServer));

		if (SOCKET_ERROR == nSendNum) {
			cout << "sendto error: " << WSAGetLastError() << endl;
			break;
		}

		// 4、接收数据
		int nRecvNum = recvfrom(s, recvBuf, sizeof(recvBuf), 0, (sockaddr*)&addrFrom, &size);

		if (nRecvNum > 0) {
			cout << "server say: " << recvBuf << endl;
		}
		else {
			cout << "recvfrom error: "<< WSAGetLastError() << endl;
			break;
		}
	}

	//关闭套接字 卸载库
	closesocket(s);
	WSACleanup();
}
```

## 客户端代码细节

**服务端地址 `addrServer`**

```cpp
sockaddr_in addrServer = {};
addrServer.sin_family = AF_INET;
addrServer.sin_port = htons(12345);
addrServer.sin_addr.S_un.S_addr = inet_addr("192.168.1.200");
```

- `AF_INET`：使用 IPv4
- `htons(12345)`：把主机字节序的端口号转换为网络字节序
- `inet_addr(...)`：把点分十进制的 IP 字符串转换为网络函数所需的整数形式
- `addrServer` 必须写在循环外，因为每次发送的目标都是同一个服务端

如果 `inet_addr` 在 Visual Studio 中出现弃用警告，通过在文件开头定义 `_WINSOCK_DEPRECATED_NO_WARNINGS` 关闭该警告

**sendto**

```cpp
int nSendNum = sendto(
    s,
    sendBuf,
    strlen(sendBuf) + 1,
    0,
    (sockaddr*)&addrServer,
    sizeof(addrServer)
);
```

各参数含义：

1. `s`：UDP 套接字；
2. `sendBuf`：要发送的数据；
3. `strlen(sendBuf) + 1`：发送字符串内容及末尾的 `\0`；
4. `0`：默认标志；
5. `(sockaddr*)&addrServer`：接收端，即服务端地址；
6. `sizeof(addrServer)`：服务端地址结构体的大小。

**`recvfrom`**

```cpp
int nRecvNum = recvfrom(
    s,
    recvBuf,
    sizeof(recvBuf),
    0,
    (sockaddr*)&addrFrom,
    &size
);
```

各参数含义：

1. `s`：客户端 UDP 套接字；
2. `recvBuf`：保存接收到的数据；
3. `sizeof(recvBuf)`：接收缓冲区的容量；
4. `0`：使用默认接收方式；
5. `(sockaddr*)&addrFrom`：输出参数，用于保存实际发送数据的一方的地址；
6. `&size`：输入时表示 `addrFrom` 的容量，输出时表示实际得到的地址长度。

调用成功后：

- `nRecvNum` 表示收到的数据字节数；
- `recvBuf` 保存服务端回复的数据；
- `addrFrom` 保存回复者的 IP 和端口；
- `size` 保存地址结构体的实际长度。

**客户端与服务端的区别**

| 对比项                 | UDP 服务端                   | UDP 客户端                 |
| ---------------------- | ---------------------------- | -------------------------- |
| 加载库、创建套接字     | 相同                         | 相同                       |
| 是否显式绑定           | 使用 `bind` 绑定固定 IP/端口 | 本例没有主动 `bind`        |
| 第一项通信操作         | 先 `recvfrom`                | 先 `sendto`                |
| 接收时是否保存来源地址 | 要保存客户端地址，以便回复   | 已知固定服务端             |
| 发送目标               | 回复刚刚发来数据的客户端     | 发送给预先填写的服务端地址 |
| 关闭与清理             | `closesocket`、`WSACleanup`  | 相同                       |

**客户端为什么不写 `bind`**

不主动调用 `bind` 不等于客户端没有端口。只要通过网络发送数据，进程就必须使用端口：

- 客户端第一次发送数据时，如果没有显式绑定端口，操作系统会分配一个临时端口；
- 在这一次进程运行期间，客户端持续使用这个已分配端口；
- 进程关闭并重新运行后，系统下次分配的端口可能不同；
- 服务端必须使用固定端口，因为客户端需要提前知道应把数据发到哪里。

谁需要先等待接收，谁通常就需要提前绑定一个固定、可知的端口。

客户端也可以主动 `bind`。但若客户端和服务端运行在同一台计算机上，二者不能占用冲突的本地 IP/端口组合；在不同设备上，相同端口号可以分别使用，因为端口只要求在本机范围内满足唯一性约束。

**至此，客户端实现结束**

## 数据传输中的封装与解封装

**发送端逐层封装**

```text
应用层：用户数据
    ↓ 加 UDP 头（源端口、目的端口）
传输层：UDP 报文段
    ↓ 加 IP 头（源 IP、目的 IP）
网络层：IP 数据报
    ↓ 加帧头（源 MAC、目的 MAC）和帧尾/CRC
数据链路/物理传输：帧
```

- 端口用于找到主机中的具体进程；
- IP 地址用于跨网络找到目标主机；
- MAC 地址用于当前链路上的实际交付；
- CRC 用于检测帧在传输中是否发生错误。

**接收端逐层解封装**

接收端按相反顺序处理：

1. 检查目的 MAC 是否属于本机接口，并检查帧与 CRC；
2. 去掉帧头、帧尾，把 IP 数据报交给网络层；
3. 检查目的 IP，再去掉 IP 头；
4. 根据目的端口查找对应进程；
5. 若没有进程使用该目的端口，这份数据无法交付给应用；
6. 找到进程后去掉 UDP 头，最终得到原始用户数据。

必须记住的层次关系：

| 信息/协议         | 所在层次       | 主要作用                       |
| ----------------- | -------------- | ------------------------------ |
| TCP、UDP、端口    | 传输层         | 区分进程                       |
| IP 地址           | 网络层         | 标识主机和网络、支持路由       |
| MAC 地址、帧、CRC | 数据链路层相关 | 完成当前链路上的交付与差错检测 |

## 单播、组播和广播

**单播**

- 一对一通信；
- 发送者指定一个目标设备；
- 本节 UDP 客户端与服务端的通信属于单播。

**广播**

- 一个设备发送，广播域内的所有设备都能收到；
- 发送者不关心接收者具体是谁；
- 可把一个子网简单理解为一个广播域；
- 普通路由器不会把二层广播无限转发到其他广播域，否则容易形成广播泛滥。

**组播**

- 一个设备向选定的一组成员发送；
- 类似只给群组成员发送消息；
- 与广播相比，组播关心“接收者是否属于目标组”，而广播域中的广播不挑选具体成员。

## ARP 地址解析协议

ARP（Address Resolution Protocol，地址解析协议）用于：

> 已知目标 IPv4 地址时，获取当前链路交付所需的目标 MAC 地址。

应用程序只填写目标 IP，底层在发送帧之前还需要目的 MAC，因此系统要进行 ARP 解析。

ARP 属于 TCP/IP 协议族，和 IP、TCP、UDP、ICMP、IGMP 等协议共同构成 TCP/IP 协议体系。

**ARP 报文中的主要字段**

| 字段          | 要点                                            |
| ------------- | ----------------------------------------------- |
| 硬件类型      | 以太网为 `1`                                    |
| 协议类型      | IPv4 为 `0x0800`                                |
| 硬件地址长度  | MAC 地址长度为 `6` 字节                         |
| 协议地址长度  | IPv4 地址长度为 `4` 字节                        |
| 操作码        | `1` 表示 ARP Request，`2` 表示 ARP Reply        |
| 发送端 MAC/IP | 请求发送者自己的地址                            |
| 目标 MAC/IP   | 要解析的目标地址；请求中未知的目标 MAC 填全 `0` |

抓包时还会看到以太网帧的 EtherType：ARP 帧对应 `0x0806`；这与 ARP 报文内部表示 IPv4 的协议类型 `0x0800` 不是同一个字段。

常见缩写：

- `src`：source，源；
- `dst`：destination，目的；
- `sender`：发送端；
- `target`：目标端。

**ARP 请求与应答流程**

假设 PC1 知道 PC2 的 IP，但不知道 PC2 的 MAC：

1. PC1 构造 ARP Request；
2. 请求中填写 PC1 的源 IP、源 MAC和 PC2 的目标 IP，未知的目标 MAC 填全 `0`；
3. PC1 使用广播发送请求，以太网目的 MAC 为 `FF:FF:FF:FF:FF:FF`；
4. 广播域内所有设备收到请求并比较目标 IP；
5. 目标 IP 不是自己的设备丢弃该请求；
6. PC2 发现目标 IP 是自己，生成 ARP Reply；
7. Reply 中带回 PC2 的 IP 和 MAC，并通常以单播回复 PC1；
8. PC1 取得 PC2 的 MAC，此后双方可以进行正常单播通信。

ARP 请求“谁是这个 IP”使用广播；对应主机回答“这个 IP 是我，我的 MAC 是……”使用单播。

**ARP 代理**

广播不会跨越普通路由器传播。当目标主机不在本地广播域时，本地主机的 ARP 广播不能直接到达远端主机。

路由器可以代替远端目标对本地主机作出 ARP 应答，使发送端得到路由器接口的 MAC，并把后续帧交给路由器；路由器再将数据转发到外部网络。替目标主机作出这种响应的路由器称为 ARP 代理。

**免费 ARP**

主机开机或配置网络时，可以发送一个“目标 IP 也是自己的 IP”的 ARP 请求，这类报文称为免费 ARP。

主要作用：

1. **检测 IP 冲突**：正常情况下不应有另一台主机对“自己的 IP”作出响应；若收到响应，说明本地网络存在重复 IP；
2. **通告/更新地址映射**：告诉广播域内其他主机自己的 IP 与 MAC，使对方新增或更新 ARP 缓存。

**ARP 缓存表**

操作系统维护 IP 与 MAC 的对应关系。发送数据前并不是每次都立即广播 ARP 请求，而是：

```text
先查 ARP 缓存
├─ 找到映射：直接使用对应 MAC 发送
└─ 未找到映射：发送 ARP Request → 收到 Reply → 写入缓存 → 再发送数据
```

缓存空间有限，记录还带有时间信息；长期未使用或过期的旧记录会被删除。这样既减少广播，又能让地址变化后重新解析。

## DNS 域名解析

**DNS 的作用**

便于人记忆的域名解析为网络通信需要的 IP 地址

以访问 `www.163.com` 为例：

1. 主机先查询本地缓存/本地 DNS 服务器；
2. 若未命中，本地 DNS 向根 DNS 服务器查询；
3. 根服务器不保存全球所有具体主机记录，而是告知 `.com` 顶级域服务器的位置；
4. 本地 DNS 再向 `.com` 顶级域服务器查询；
5. 顶级域服务器告知负责 `163.com` 的权威 DNS 服务器；
6. 本地 DNS 向权威服务器查询 `www.163.com` 的 IP；
7. 得到结果后返回给客户端，并把结果写入缓存。

两类查询思路：

- 由本地 DNS 逐级询问，每一级告诉下一步该问谁；
- 某一级服务器继续代为向下查询，最终把结果逐级返回。

对应理解为迭代查询和递归查询。

**DNS 缓存**

- 本地主机和 DNS 服务器都会利用缓存；
- 不只可以缓存“域名 → IP”，也可以缓存已查询过的域服务器地址；
- 首次访问较冷门域名时可能较慢，因为要逐级查询；
- 后续访问若缓存仍有效，可以直接取出结果；
- DNS 缓存也会过期，过期后需要重新查询。

## 路由数据转发过程

**路由表记录什么**

路由器保存路由表，核心信息包括：

- 目的网络；
- 到达该目的网络应交给哪个下一跳；
- 应从哪个接口发送。

路由器不一定知道从当前位置到目标的完整路径，只需要知道当前这一跳应把数据交给谁。

**每一跳的处理过程**

1. 路由器接口收到目的 MAC 属于自己的帧；
2. 去掉当前链路的帧头，取出 IP 数据报；
3. 查看目的 IP，根据路由表选择下一跳和出口接口；
4. 为下一段链路重新封装帧；
5. 新帧的源 MAC 是当前路由器出口接口 MAC；
6. 新帧的目的 MAC 是下一跳设备/路由器接口 MAC；
7. 下一台路由器重复同样过程，直到目标主机。

**IP 与 MAC 在转发中的区别**

- 源 IP 和目的 IP表示端到端的通信双方，转发途中基本保持不变；
- 源 MAC 和目的 MAC 只服务于当前一段链路，每经过一个路由器都要重新封装和改变；
- 目标主机收到的帧中，源 MAC 通常是最后一跳路由器接口的 MAC，而不是远端源主机的 MAC。

**路由信息的学习与变化**

路由器会与相邻路由器交换可达网络信息，使“某网络应交给哪个下一跳”逐步传播。

现实网络中的设备和链路会变化，路由信息也要动态更新；如果更新消息到达顺序不同或信息暂时不一致，可能出现错误路由、绕路或丢包。

因此课堂图示是对实际复杂路由过程的简化。
