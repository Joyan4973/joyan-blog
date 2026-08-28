---
title: "Linux 网络编程（17）：IM 聊天系统——数据库设计和创建、注册功能实现、登录功能实现"
published: 2026-08-08T14:46:02Z
updated: 2026-08-08T14:46:02Z
description: "Linux 网络编程系列第 17 篇，整理 IM 聊天系统的协议分发、用户与好友数据库设计、MySQL 连接以及注册功能，并为登录请求处理预留入口。"
image: ""
tags:
  - IM 聊天系统阶段
  - Linux
  - 网络编程
  - IM 聊天系统
  - MySQL
  - Qt
  - 协议设计
  - 注册与登录
  - 成员函数指针
  - 学习笔记
category: Linux 网络编程
draft: false
pinned: false
comment: true
readingTime: 13
lang: zh_CN
---

# IM 聊天系统：数据库设计和创建、注册功能实现、登录功能实现

本节继续完善 IM 聊天系统的业务层，首先统一客户端与服务端协议，通过成员函数指针数组把不同协议分发给对应处理函数。

随后设计用户表和好友关系表，在服务端连接 MySQL，并完成注册请求的昵称查重、手机号查重、用户插入和结果回复。登录请求的协议与处理入口已预留，当前笔记内容整理到注册功能测试。

## 一、客户端和服务端的协议必须一致

客户端与服务端的 `def.h` 是通信双方事先约定好的协议。协议编号、结构体、字段顺序、字段类型、数组长度和结果宏都必须一致。

例如，注册请求在服务端是 1000，在客户端也必须是 1000，否则接收方无法正确解析。

```cpp
#define PROTO_COUNT 10

#define DEF_PROT_BASE 1000
#define DEF_PROT_REGISTER_RQ  (DEF_PROT_BASE+0)
#define DEF_PROT_REGISTER_RS  (DEF_PROT_BASE+1)
#define DEF_PROT_LOGIN_RQ     (DEF_PROT_BASE+2)
#define DEF_PROT_LOGIN_RS     (DEF_PROT_BASE+3)

using protType = unsigned int;
```

网络层收到的 `char*` 指向一块结构体数据，不能直接使用 `cout` 或 `qDebug()` 输出整个结构体。需要先转换成对应的结构体指针，再访问各个成员：

```cpp
PROT_REGISTER_RQ* rq = (PROT_REGISTER_RQ*)data;
cout << "nick: " << rq->nick
     << "pass: " << rq->pass
     << ",tel: " << rq->tel << endl;
```

## 二、从 `data` 中取出协议类型

每个协议结构体的第一个成员都是 `prottype`：

```cpp
struct PROT_REGISTER_RQ {
    protType prottype;
    char nick[30];
    char tel[15];
    char pass[20];

    PROT_REGISTER_RQ()
        : prottype(DEF_PROT_REGISTER_RQ), nick{0}, tel{0}, pass{0}
    {}
};
```

`data` 指向结构体的起始地址，也就是第一个成员 `prottype` 的起始位置。

```cpp
protType type = *(protType*)data;
```

理解过程：

```cpp
(protType*)data       // 把 char* 转换成 protType*
*(protType*)data      // 按照 protType 的大小取出数据
```

指针变量保存的是地址，指针类型决定从该地址开始一次操作多少字节。

| 指针类型 | 解引用时一次读取的大小 |
| --- | ---: |
| `char*` | 1 字节 |
| `int*` | 通常为 4 字节 |
| `protType*` | 本项目中为 4 字节 |

## 三、使用成员函数指针数组分发协议

### 1. 不采用大量 `switch-case` 的原因

`switch-case` 容易理解，但协议越来越多时：

- 分支会越来越长，不便于阅读和维护；
- 查找需要依次比较多个 `case`，分支越多，比较次数越多。

本项目的协议号连续排列。协议号减去 `DEF_PROT_BASE` 后，正好得到 0—9 的数组下标：

```cpp
int index = type - DEF_PROT_BASE;
```

数组下标代表协议类型，数组元素保存处理函数的地址：

```text
协议 1000 -> 下标 0 -> dealRegisterRq
协议 1001 -> 下标 1 -> 服务端不处理回复协议，元素为空
协议 1002 -> 下标 2 -> dealLoginRq
```

### 2. `Kernel.h` 中的相关声明

```cpp
class Kernel {
public:
    static Kernel* pKernel;

    using DealFunc = void (Kernel::*)(char*, int, unsigned long);

    Kernel();
    ~Kernel();

    void setProtocolFunArray();
    bool startServer();
    void endServer();
    void dealData(char* data, int len, unsigned long from);
    void dealRegisterRq(char* data, int len, unsigned long from);
    void dealLoginRq(char* data, int len, unsigned long from);

private:
    INetMediator* m_pMediator;
    CMySql m_sql;
    DealFunc m_protFuncArr[PROTO_COUNT];
};
```

`DealFunc` 指向的函数必须属于 `Kernel` 类，返回值为 `void`，参数为 `char*`、`int`、`unsigned long`。

### 3. 初始化处理函数数组

```cpp
void Kernel::setProtocolFunArray()
{
    cout << __func__ << endl;

    memset(m_protFuncArr, 0, sizeof(m_protFuncArr));

    m_protFuncArr[DEF_PROT_REGISTER_RQ - DEF_PROT_BASE]
        = &Kernel::dealRegisterRq;
    m_protFuncArr[DEF_PROT_LOGIN_RQ - DEF_PROT_BASE]
        = &Kernel::dealLoginRq;
}
```

该函数必须在服务器启动时调用，否则数组中没有保存处理函数地址：

```cpp
bool Kernel::startServer()
{
    cout << __func__ << endl;
    setProtocolFunArray();

    // 打开网络、连接数据库
    // ...
}
```

### 4. 服务端统一分发数据

```cpp
void Kernel::dealData(char* data, int len, unsigned long from)
{
    cout << __func__ << endl;

    protType type = *(protType*)data;
    int index = type - DEF_PROT_BASE;

    if (index >= 0 && index < PROTO_COUNT) {
        DealFunc pF = m_protFuncArr[index];
        if (pF) {
            (this->*pF)(data, len, from);
        }
        else {
            cout << "type2: " << type << endl;
        }
    }
    else {
        cout << "type1: " << type << endl;
    }

    delete[] data;
}
```

成员函数指针必须结合对象调用：

```cpp
(this->*pF)(data, len, from);
```

### 5. `type1` 和 `type2` 的排查

出现 `type1`，说明数组下标不在有效范围内，常见原因：

1. 网络层收到的数据有问题；
2. 仍在发送原来的测试字符串，而不是协议结构体；
3. `data` 在分发前被提前释放；
4. 发送长度填写错误。

出现 `type2`，说明协议号有效，但对应函数指针为空，常见原因：

1. 服务端收到了它不负责处理的协议，例如回复协议；
2. 新增处理函数后，没有把函数地址保存到数组；
3. `setProtocolFunArray()` 没有被调用。

### 6. 接收缓冲区的回收

处理函数执行完毕后，数据才使用完，因此在 `dealData()` 末尾统一回收：

```cpp
delete[] data;
```

不能在网络层或业务处理完成前提前释放。客户端也遵循相同原则。

## 四、数据库设计

数据存放在表中，表存放在数据库中。本项目创建数据库 `20251018im`，再创建用户表和好友关系表。

### 1. 用户表 `t_user`

| 字段 | 类型 | 约束 | 作用 |
| --- | --- | --- | --- |
| `id` | `BIGINT` | 主键、自增、非空 | 程序内部使用的用户编号 |
| `nick` | `VARCHAR(30)` | 唯一、非空 | 昵称 |
| `tel` | `VARCHAR(11)` | 唯一、非空 | 手机号 |
| `pass` | `VARCHAR(20)` | 非空 | 密码 |
| `feeling` | `VARCHAR(100)` | 可空 | 个性签名 |
| `iconid` | `INT` | 可空 | 头像图片编号 |

```sql
CREATE TABLE t_user (
    id BIGINT NOT NULL AUTO_INCREMENT,
    nick VARCHAR(30) NOT NULL UNIQUE,
    tel VARCHAR(11) NOT NULL UNIQUE,
    pass VARCHAR(20) NOT NULL,
    feeling VARCHAR(100),
    iconid INT,
    PRIMARY KEY (id)
);
```

`id` 不是让用户记忆和输入的号码，而是供程序内部标识用户、建立表之间的关系。

`iconid` 保存头像文件的数字编号，不保存整张图片。

### 2. 好友关系表 `t_friend`

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `idA` | `BIGINT` | 当前用户 ID |
| `idB` | `BIGINT` | 好友 ID |

```sql
CREATE TABLE t_friend (
    idA BIGINT,
    idB BIGINT
);
```

好友关系采用双向存储。例如用户 1 和用户 2 是好友，需要保存：

```text
idA = 1, idB = 2
idA = 2, idB = 1
```

这样查询用户 1 的好友时，只需使用 `idA = 1`。双向存储使用了更多空间，但简化了查询条件，体现“用空间换时间”。

## 五、服务端连接和断开数据库

`CMySql` 作为 `Kernel` 的普通成员变量：

```cpp
CMySql m_sql;
```

启动服务器时，先打开网络，再连接数据库：

```cpp
bool Kernel::startServer()
{
    cout << __func__ << endl;
    setProtocolFunArray();

    if (!m_pMediator->openNet()) {
        cout << "打开服务端网络失败" << endl;
        return false;
    }

    char ip[] = "127.0.0.1";
    char name[] = "root";
    char pass[] = "自己的数据库密码";
    char db[] = "20251018im";

    if (!m_sql.ConnectMySql(ip, name, pass, db)) {
        cout << "连接数据库失败" << endl;
        return false;
    }
    else {
        cout << "连接数据库成功" << endl;
    }

    return true;
}
```

`ConnectMySql` 的参数依次为服务器 IP、用户名、密码、数据库名、端口号。默认端口为 3306，使用默认值时可以不传。

本机数据库使用 `127.0.0.1`；密码必须填写自己安装 MySQL 时设置的密码。

关闭服务器时，先关闭网络，再断开数据库：

```cpp
void Kernel::endServer()
{
    cout << __func__ << endl;

    if (m_pMediator) {
        m_pMediator->closeNet();
        delete m_pMediator;
        m_pMediator = nullptr;
    }

    m_sql.DisConnect();
}
```

## 六、注册功能实现

### 1. 注册流程

```text
收到注册请求
    |
    +-- 按昵称查询
    |      +-- 查到：回复“昵称已被注册”，结束
    |
    +-- 按手机号查询
    |      +-- 查到：回复“手机号已被注册”，结束
    |
    +-- 昵称和手机号都不存在
           +-- 插入用户信息
           +-- 回复“注册成功”
```

客户端和服务端的结果宏必须同步：

```cpp
#define REGISTER_SUCC 0
#define REGISTER_NICK_EXISTS 1
#define REGISTER_TEL_EXISTS 2
```

### 2. `SelectMySql` 的返回值和查询结果

```cpp
m_sql.SelectMySql(sql, columnCount, listRes);
```

- 函数返回值表示 SQL 是否执行成功；
- `columnCount` 表示本次查询的列数；
- `listRes` 保存真正的查询结果。

不能把函数返回的 `bool` 当作“是否查到数据”。是否查到数据，应判断 `listRes`：

```cpp
if (listRes.size() != 0) {
    // 查到了数据
}
```

### 3. 使用 `sprintf_s` 拼接 SQL

```cpp
char sql[1024] = "";
sprintf_s(sql,
          "select nick from t_user where nick = '%s';",
          rq->nick);
```

查询结果不符合预期时，应把程序实际拼出的 SQL 打印出来，再复制到 MySQL 客户端中直接执行，判断是 SQL 错误还是程序逻辑错误。

### 4. Qt 客户端处理注册回复

```cpp
void Kernel::deal_registerRs(char* pbuf, int len, unsigned long ul)
{
    PROT_REGISTER_RS* pRegisterRs = (PROT_REGISTER_RS*)pbuf;

    if (pRegisterRs->result == REGISTER_SUCC) {
        QMessageBox::information(m_pLogin, "提示", "注册成功");
    }
    else if (pRegisterRs->result == REGISTER_NICK_EXISTS) {
        QMessageBox::information(m_pLogin, "提示", "注册失败，昵称已被注册");
    }
    else if (pRegisterRs->result == REGISTER_TEL_EXISTS) {
        QMessageBox::information(m_pLogin, "提示", "注册失败，电话号已被注册");
    }
}
```

### 5. 注册测试

| 测试数据 | 预期结果 |
| --- | --- |
| 新昵称、新手机号 | 注册成功 |
| 已存在的昵称 | 提示昵称已被注册 |
| 新昵称、已存在的手机号 | 提示手机号已被注册 |

三个分支都执行到，才能证明注册流程完整。
