---
title: "Linux 网络编程（18）：IM 聊天系统——显示好友列表与下线功能实现"
published: 2026-08-10T00:00:00Z
updated: 2026-08-10T00:00:00Z
description: "Linux 网络编程系列第 18 篇，整理 IM 聊天系统的好友列表查询与推送、用户和套接字映射、上下线状态管理，以及 Qt 与 VS 之间的字符编码转换。"
image: ""
tags:
  - IM 聊天系统阶段
  - Linux
  - 网络编程
  - IM 聊天系统
  - Qt
  - MySQL
  - 好友列表
  - 在线状态
  - 字符编码
  - 学习笔记
category: Linux 网络编程
draft: false
pinned: false
comment: true
readingTime: 8
lang: zh_CN
---

# IM 聊天系统：显示好友列表与下线功能实现

本节继续完善 IM 聊天系统的好友功能，首先在业务层建立用户 ID 与客户端套接字的映射，用它完成消息转发并判断用户在线状态。

随后根据登录用户查询本人和好友资料，逐条推送给客户端，并整理好友关系的双向存储与用户下线处理。最后梳理常见字符编码，统一 Qt 客户端和 VS 服务端之间的中文转码流程。

## 一、显示好友列表的整体流程

好友列表不能写成固定数据，因为每次登录的用户可能不同。当前谁登录，就应显示谁的资料以及该用户的好友资料。

将这部分拆成两个公共函数：

```cpp
// 根据当前用户 id 查询自己的信息和好友的信息
void getUserInfoAndFriendInfo(int userId);

// 根据 id 查询用户信息
void getInfoById(int id, PROT_FRIEND_INFO* info);
```

查询本人和查询好友本质上都是“根据一个用户 ID 查询用户资料”，不能重复写两套相同的数据库代码。

## 二、为什么业务层还要保存用户 ID 与套接字

### 1. 登录、注册阶段为什么暂时不需要映射

注册和登录都是数据从哪个套接字来，结果就回到哪个套接字。

请求处理函数中的 `from` 已经告诉服务端回复对象，因此不需要查找其他客户端。

### 2. 后续消息转发为什么必须保存映射

聊天、添加好友、上线通知等业务不是简单原路返回。

例如用户 1 给用户 2 发消息，服务端必须先找到用户 2 所对应的套接字，才能完成转发。

因此，业务层需要保存：

```cpp
map<int, unsigned long> m_mapUserIdToSocket;
```

### 3. 网络层映射与 Kernel 层映射的区别

| 所在层 | 保存的关系 | 关注点 |
| --- | --- | --- |
| `TcpServer` 网络层 | 线程 ID—套接字 | 哪个接收线程使用哪个连接 |
| `Kernel` 业务层 | 用户 ID—套接字 | 某个业务用户对应哪个连接 |

网络层关心线程和连接。

业务层不关心用户运行在哪个接收线程，只关心给某个用户发数据时应使用哪个套接字。

### 4. 保存和删除的时机

客户端连接成功时，用户还没有登录，服务端不知道该连接属于哪个用户。

只有登录成功后，才能保存 `userid -> socket`；用户下线后必须删除该映射，登录失败时不保存。

如果用户下线后仍保留映射，别人再向该用户发送数据时，服务端会取到已经关闭、已经失效的套接字，发送就会失败。

## 三、一张 `map` 同时完成两件事

`m_mapUserIdToSocket` 不只是转发索引，还可以直接表示在线状态。

- 登录成功才加入 `map`，存在即在线；
- 下线时从 `map` 删除，不存在即离线。

因此这张 `map` 有两个用途：

1. 转发数据时，根据用户 ID 查找套接字；
2. 查询资料时，根据用户 ID 是否存在判断在线状态。

## 四、本人和好友资料协议

客户端与服务端使用同一个协议结构体传输本人和好友资料。

结构体既可以表示本人，也可以表示好友。客户端通过 `userid` 是否等于当前登录用户 ID 来区分两者。

## 五、登录成功分支的修改

登录 SQL 同时查询密码和用户 ID：

```sql
select pass, id from t_user where tel = '手机号';
```

查询两列时，`SelectMySql` 的列数参数必须写 2：

```cpp
m_sql.SelectMySql(sql, 2, listRes);
```

查询字段的顺序必须与从 `listRes` 中取值的顺序一致：

```cpp
string pass = listRes.front();
listRes.pop_front();

int userId = stoi(listRes.front());
listRes.pop_front();
```

数据库查询结果存入 `list<string>`，所以用户 ID 取出后要使用 `stoi` 转为 `int`。

登录成功时，顺序上先发送登录成功回复，再推送本人和好友资料。客户端只有先处理登录回复、保存 `userid`，随后收到资料协议时才能正确判断该资料属于本人还是好友。

## 六、根据 ID 查询用户资料：`getInfoById`

### 1. 函数职责

该函数根据用户 ID 填充一个 `PROT_FRIEND_INFO`：

- `userid`：直接使用传入的 ID；
- `status`：根据在线 `map` 判断；
- `nick`、`feeling`、`imgid`：从 `t_user` 查询。

### 2. 为什么要判断 `listRes.size() == 3`

SQL 查询了三列，并且用户 ID 唯一，正常结果应该恰好是一行、三个字符串。如果不是 3，常见原因：

1. SQL 语句或 ID 写错，没有查到该用户；
2. `SelectMySql` 的列数参数不是 3；
3. 协议、表字段或查询顺序写错。

调试方法：把日志中打印的 SQL 复制到 MySQL Workbench 单独执行。

## 七、查询并逐条发送本人及好友资料

### 1. 为什么查到一条就发送一条

没有把全部好友资料拼成一个大数据包，而是查询一条就发送一条：

1. 好友非常多时，所有资料合并后数据量很大，一个包不方便承载；
2. 全部查询完成再发送会让客户端长时间空白，逐条推送能让界面逐步出现资料，体验更好。

### 2. 好友关系表的查询方式

好友关系采用双向存储：

```text
1 与 2 是好友：保存 (1, 2) 和 (2, 1)
```

因此，查询用户 `userId` 的好友列表只需要：

```sql
select idB from t_friend where idA = userId;
```

## 八、客户端处理本人和好友资料

### 1. 注册处理函数

客户端的协议处理函数数组中必须保存 `deal_friendInfo`。

### 2. 处理函数

判断依据不是“第一个包一定是本人”，而是比较协议中的 `userid` 与主窗口保存的当前登录用户 ID。

这样即使网络数据到达顺序发生变化，仍能正确分类。

### 3. 登录成功时先保存 `userid`

服务端应先发送 `PROT_LOGIN_RS`，再发送 `PROT_FRIEND_INFO`，客户端才能在处理资料时使用正确的当前用户 ID。

## 九、好友关系为什么双向存储

在 `t_friend` 中为一对好友插入两条记录，例如：

```sql
insert into t_friend values (1, 2);
insert into t_friend values (2, 1);
```

优点：

- 查询用户 1 的好友只需查 `idA = 1`；
- 查询用户 2 的好友只需查 `idA = 2`；
- 用额外空间换取更简单、更快的查询。

## 十、下线状态的核心原则

在线映射的生命周期为：

```text
登录成功 -> 加入 m_mapUserIdToSocket -> USER_ONLINE
用户下线 -> 从 m_mapUserIdToSocket 删除 -> USER_OFFLINE
```

下线处理至少要完成两件事：

1. 从业务层在线 `map` 中删除 `userid -> socket`；
2. 后续查询该用户资料时，将其状态设置为 `USER_OFFLINE`。

如果需要让已经在线的好友立即刷新图标，还应向好友发送用户下线协议：

```cpp
#define DEF_PROT_FRIEND_OFFLINE (DEF_PROT_BASE + 9)
```

## 十一、常见字符编码的关系

| 编码 | 要点 |
| --- | --- |
| ASCII | 最早用于英文字符；标准 ASCII 使用 7 位，通常存放在 1 字节中 |
| ANSI | 不是一套全球统一编码；在不同系统区域中可能对应不同本地编码 |
| GB2312 | 在 ASCII 基础上扩展常用简体中文 |
| GBK | 扩展 GB2312，包含更多汉字 |
| GB18030 | 在 GBK 基础上继续补充字符，覆盖范围更大 |
| Unicode | 为字符分配统一码点，解决不同地区编码标准不统一的问题 |
| UTF-8 | Unicode 的一种变长编码实现，英文通常 1 字节，中文通常 3 字节 |

应区分两个概念：

- Unicode 是统一的字符集合和码点标准；
- UTF-8 是 Unicode 的一种编码方式。

UTF-8 的特点：

- 单字节字符最高位为 0；
- 多字节字符的首字节用前导 1 表示总字节数；
- 后续字节以 `10` 开头；
- 与 ASCII 兼容。

## 十二、转码统一放在客户端

约定：

```text
Qt -> VS：发送前，UTF-8 转 GB2312
VS -> Qt：接收后，GB2312 转 UTF-8
```

Qt 明确知道自身使用 UTF-8，VS 端继续按当前项目的 GB2312 工作。

### 1. 头文件声明

```cpp
// gb2312 转 utf8
QString gb2312ToUtf8(char* src);

// utf8 转 gb2312
void utf8ToGb2312(QString src, char* dst, int len);
```

### 2. `QTextCodec` 与 `QByteArray`

- `QTextCodec::codecForName("gb2312")`：取得 GB2312 编解码器；
- `toUnicode()`：把 GB2312 字节转换成 Qt 可使用的 Unicode/`QString`；
- `fromUnicode()`：把 `QString` 转成 GB2312 字节；
- `QByteArray::data()`：取得字节数组首地址，以便写入协议中的 `char[]`。
