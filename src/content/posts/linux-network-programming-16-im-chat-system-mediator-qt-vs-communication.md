---
title: "Linux 网络编程（16）：IM 聊天系统——中介者类实现与 Qt、VS 通信"
published: 2026-08-05T13:59:39Z
updated: 2026-08-05T13:59:39Z
description: "Linux 网络编程课程第 16 课，整理 IM 聊天系统中介者类的实现，以及 Qt 客户端、VS 服务端、网络层与 Kernel 之间的数据传递。"
image: ""
tags:
  - Linux
  - 网络编程
  - IM 聊天系统
  - Qt
  - TCP
  - Winsock
  - 中介者模式
  - 信号与槽
  - 课程笔记
category: Linux 网络编程
draft: false
pinned: false
comment: true
readingTime: 8
lang: zh_CN
---

# IM 聊天系统——中介者类实现与 Qt、VS 通信

本节继续完善 IM 聊天系统的分层通信，先让 Qt 客户端正确链接 Winsock，并由 `Kernel` 持有网络中介者、负责网络的打开与关闭。

随后使用 Qt 信号与槽把客户端网络数据传递给业务层，在 VS 服务端通过静态类指针完成中介者对 `Kernel` 的回调，最终串联 Qt 客户端、TCP 网络层、中介者和服务端业务层之间的完整数据流。

## 一、Qt 工程链接 Winsock 库

Qt 客户端调用了 Windows Socket API，因此需要在 `.pro` 文件中链接 `Ws2_32`：

```text
LIBS += -lWs2_32
```

添加或移动源文件后要重新执行 **qmake**，再重新构建。`.pro` 文件中 `SOURCES` 和 `HEADERS` 列出的文件才会进入 Qt 工程的编译过程。

## 二、为什么由 Kernel 打开网络

网络对象不能只在 `main()` 中临时创建，因为后面的注册、登录、聊天等功能都要继续使用它发送数据。

网络中介者保存为 `Kernel` 的成员：

```cpp
INetMediator* m_pMediator;
```

客户端 `Kernel` 构造时完成下面的工作：

1. 创建 `TcpClientMediator`；
2. 连接“收到服务端数据”的信号和槽；
3. 调用 `openNet()` 打开 TCP 客户端网络；
4. 发送 `hello world` 测试数据。

```cpp
m_pMediator = new TcpClientMediator;
connect(m_pMediator, &TcpClientMediator::signals_recvServerData,
        this, &Kernel::slots_recvServerData);

if (!m_pMediator->openNet()) {
    QMessageBox::about(m_pLogin, "提示", "打开网络失败");
    exit(1);
}

m_pMediator->sendData("hello world", sizeof("hello world"), 1);
```

TCP 客户端已经通过 `connect()` 确定了服务器，所以测试代码中的第三个参数在当前实现里没有参与目标选择；真正发送时使用的是客户端内部保存的服务器套接字。

## 三、接收缓冲区的处理原则

网络层按数据包长度动态申请接收空间：

```cpp
char* pack = new char[packLen];
```

强调两点：

- 不要额外写 `pack[len] = '\0'`。当前测试字符串本身已经把结尾的 `\0` 计算在 `sizeof("hello world")` 中，而且以后接收的可能是结构体等二进制数据，不能一律按字符串处理。
- 网络层和中介者层把缓冲区继续向上转交后，不能立即释放。最终使用完数据的 `Kernel` 负责 `delete[]`，否则会出现提前释放或重复释放。

## 四、Qt 信号与槽

### 1. 基本概念

- 信号和槽是 Qt 提供的类间通信机制；
- 使用信号的类必须直接或间接继承 `QObject`，并写 `Q_OBJECT`；
- 信号只声明，不需要自己实现；
- 槽是普通成员函数，需要声明和实现；
- 信号与槽的返回值、参数类型及参数顺序要对应；
- 连接应在信号发送者已经创建之后完成。

### 2. 信号放在 `INetMediator` 基类

`Kernel` 保存的是 `INetMediator*`，所以最终把信号放到 `INetMediator` 基类中，让各种中介者都具有统一的通知接口：

```cpp
class INetMediator : public QObject {
    Q_OBJECT
public:
    INetMediator();
    virtual ~INetMediator();

signals:
    void signals_recvServerData(char* pbuf, int len, unsigned long ul);
};
```

加入 `QObject` 和 `Q_OBJECT` 后，构造函数与析构函数移到 `INetMediator.cpp` 中实现：

```cpp
INetMediator::INetMediator():m_pNet(nullptr){}
INetMediator::~INetMediator() {}
```

### 3. 中介者发信号

`TcpClientMediator::transmitData()` 收到网络层转来的数据后，不处理业务，而是发出信号：

```cpp
void TcpClientMediator::transmitData(char* data, int len, unsigned long from)
{
    Q_EMIT signals_recvServerData(data, len, from);
}
```

### 4. Kernel 槽函数接收数据

```cpp
void Kernel::slots_recvServerData(char* pbuf, int len, unsigned long ul)
{
    qDebug() << "slots_recvServerData";
    qDebug() << pbuf;

    // 当前接收的是测试字符串，原有协议分发代码暂时注释。

    if (pbuf) {
        delete[] pbuf;
        pbuf = nullptr;
    }
}
```

原来的协议分发代码会把数据开头解释为协议类型，但当前发送的是 `hello world` 测试字符串，因此先把协议分发部分注释掉。以后发送正式协议结构体时再恢复。

## 五、服务端 `main()` 只启动 TCP 服务

这个项目后续主要使用 TCP，删除 `main.cpp` 中 UDP 和 TCP 客户端的测试创建代码，只保留服务端 `Kernel`：

```cpp
Kernel ker;
if (!ker.startServer()) {
    cout << "打开服务器失败" << endl;
    ker.endServer();
    return 1;
}

while (true) {
    cout << "server is running" << endl;
    Sleep(50000);
}
```

## 六、服务端 Kernel 的职责

服务端 `Kernel` 是各层之间的组织者，主要接口如下：

```cpp
bool startServer();
void endServer();
void dealData(char* data, int len, unsigned long from);
```

### 1. `startServer()`

- 调用中介者的 `openNet()` 打开 TCP 服务端；
- 后续还要在这里连接数据库。

### 2. `endServer()`

- 调用 `closeNet()` 关闭网络；
- 删除中介者对象并置空；
- 后续还要在这里断开数据库连接。

### 3. `dealData()`

暂时使用测试代码：打印客户端发来的内容和长度，然后向该客户端回复测试字符串。

```cpp
cout << "recv:" << data << ", len:" << len << endl;
char s[] = "shjkdshakjCJKSAHKJdcnjkwhfdkjs";
m_pMediator->sendData(s, sizeof(s), from);
```

## 七、服务端中介者怎样把数据交给 Kernel

服务端 `Kernel` 已经持有中介者对象。如果中介者再直接持有一个普通 `Kernel` 对象，会形成双向依赖。使用静态类指针：

```cpp
static Kernel* pKernel;
```

类外初始化：

```cpp
Kernel* Kernel::pKernel = nullptr;
```

在 `Kernel` 构造函数中让它指向当前对象：

```cpp
pKernel = this;
```

于是服务端中介者可以把数据交给业务层：

```cpp
Kernel::pKernel->dealData(data, len, from);
```

## 八、完整数据流

```text
Qt Kernel
  ↓ sendData
TcpClientMediator
  ↓
TcpClient（TCP 发送）
  ↓ 网络
TcpServer（TCP 接收）
  ↓ transmitData
TcpServerMediator
  ↓ Kernel::pKernel->dealData
服务端 Kernel
  ↓ sendData 回复
TcpServerMediator → TcpServer → 网络
  ↓
TcpClient → TcpClientMediator
  ↓ Q_EMIT signals_recvServerData
Qt Kernel::slots_recvServerData
```

网络层只负责收发，中介者层只负责转发，`Kernel` 才负责业务处理。

## 九、三种类间通信方法

1. **构造函数传参并保存指针**：网络层与中介者层采用这种方式；
2. **静态类指针**：服务端中介者回调 `Kernel` 采用这种方式；
3. **Qt 信号和槽**：Qt 客户端中介者把数据通知给 `Kernel` 采用这种方式。
