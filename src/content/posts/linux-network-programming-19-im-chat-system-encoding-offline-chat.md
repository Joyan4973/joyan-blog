---
title: "Linux 网络编程（19）：IM 聊天系统——转码、下线与聊天功能实现"
published: 2026-08-11T00:00:00Z
updated: 2026-08-11T00:00:00Z
description: "Linux 网络编程系列第 19 篇，整理 IM 聊天系统的用户下线、在线与离线聊天、添加好友请求持久化，以及 Qt 客户端和 VS 服务端之间的中文转码。"
image: ""
tags:
  - IM 聊天系统阶段
  - Linux
  - 网络编程
  - IM 聊天系统
  - Qt
  - MySQL
  - 用户下线
  - 聊天功能
  - 添加好友
  - 字符编码
  - 学习笔记
category: Linux 网络编程
draft: false
pinned: false
comment: true
readingTime: 6
lang: zh_CN
---

# IM 聊天系统：转码、下线与聊天功能实现

本节继续完善 IM 聊天系统，补充客户端退出时的用户下线流程，并实现聊天请求在在线与离线两种状态下的处理。

随后整理添加好友请求的服务端处理逻辑与持久化思路，最后解决 Qt 客户端和 VS 服务端之间传输中文时可能出现的编码问题。

## 一、用户下线功能

### 1.1 哪些窗口关闭后需要结束程序

项目中虽然存在多个界面，但真正会结束客户端程序的主要是：

- 登录界面：用户尚未登录，关闭时只需要回收客户端资源；
- 主界面：用户已经登录，关闭前必须先通知服务端下线，再回收客户端资源。

### 1.2 客户端发送下线请求

主界面关闭时构造 `PROT_FRIEND_OFFLINE`，填写当前用户 ID，然后通过中介者发送给服务端。

`slots_delete()` 负责回收登录窗口、主窗口等客户端资源。

### 1.3 服务端增加协议处理函数

在 `Kernel.h` 中声明下线处理函数：

```cpp
void dealOfflineRq(char* data, int len, unsigned long from);
```

服务端还需要保存“用户 ID—Socket”的映射：

```cpp
map<int, SOCKET> m_mapUserIdToSocket;
```

在协议处理函数数组中注册下线协议：

```cpp
m_protFuncArr[DEF_PROT_FRIEND_OFFLINE - DEF_PROT_BASE]
    = &Kernel::dealOfflineRq;
```

## 二、聊天功能

### 2.1 客户端发送聊天请求

客户端取得自己的用户 ID、好友 ID 和聊天内容，构造 `PROT_CHAT_INFO_RQ` 后发送给服务端。

协议中的主要字段：

- `userid`：消息发送者的用户 ID；
- `friid`：消息接收者的用户 ID；
- `msg`：聊天内容。

### 2.2 服务端注册聊天处理函数

在 `Kernel.h` 中声明：

```cpp
void dealChatRq(char* data, int len, unsigned long from);
```

在协议处理函数数组中注册：

```cpp
m_protFuncArr[DEF_PROT_CHAT_INFO_RQ - DEF_PROT_BASE]
    = &Kernel::dealChatRq;
```

### 2.3 好友在线和不在线时的处理

#### 好友在线

服务端根据 `rq->friid` 从 `m_mapUserIdToSocket` 中找到好友 Socket，将原始聊天请求转发给好友。

#### 好友不在线

服务端构造 `PROT_CHAT_INFO_RS` 返回发送者：

- `result = CHAT_RESULT_FAIL`：本次聊天发送失败；
- `userid = rq->friid`：告诉发送者具体是哪位好友不在线；
- `friid = rq->userid`：保存原发送者 ID；
- `from`：当前请求来源 Socket，因此响应应通过它发回发送者。

### 2.4 客户端处理聊天响应

客户端收到聊天请求时，先将 `pbuf` 转成 `PROT_CHAT_INFO_RQ*`，再根据发送者 ID 把消息显示到对应好友的聊天窗口中。

### 2.5 发送后清空输入框

在聊天窗口的发送槽函数中，发送消息后清空输入框：

```cpp
// 把聊天输入窗口清空
ui->pte_chat_msg->setPlainText("");

// 将聊天内容发送走
emit signals_sendChatMsg(msg);
```

### 2.6 离线聊天消息的设计思路

不能只把离线消息保存在服务器内存中，因为服务器关闭或重启后，内存中的数据会丢失。实际项目中应建立离线消息表，至少保存：

- 发送者 ID；
- 接收者 ID；
- 聊天内容；
- 发送时间。

处理流程：

1. 好友不在线时，将聊天请求写入数据库；
2. 好友登录成功后，查询“接收者 ID 等于当前用户 ID”的离线消息；
3. 将查询结果逐条转发给该用户；
4. 消息发送成功后，从数据库中删除对应记录。

## 三、添加好友功能

### 3.1 客户端构造添加好友请求

客户端填写当前用户 ID、当前用户昵称以及目标好友昵称，然后把请求发送给服务端。

### 3.2 服务端注册添加好友处理函数

在 `Kernel.h` 中声明：

```cpp
void dealAddFriendRq(char* data, int len, unsigned long from);
```

注册协议处理函数：

```cpp
m_protFuncArr[DEF_PROT_ADD_FRIEND_RQ - DEF_PROT_BASE]
    = &Kernel::dealAddFriendRq;
```

### 3.3 服务端添加好友处理流程

```text
收到添加好友请求
        ↓
根据目标昵称查询 t_user
        ↓
查询结果是否为空？
   ├─ 是：返回 ADD_FRI_NOEXIST
   └─ 否：取得目标好友 ID
                ↓
         好友是否在线？
         ├─ 是：把原请求转发给好友
         └─ 否：返回 ADD_FRI_FRIOFF
```

如果 SQL 查询本身执行失败，应把日志中打印出的 SQL 复制到 MySQL Workbench 中单独执行，从而定位字段名、引号或编码等问题。

### 3.4 好友不在线时的持久化设计

添加好友请求表可以保存：

- 添加者 ID；
- 添加者昵称；
- 被添加者 ID；
- 被添加者昵称；
- 添加时间。

处理流程：

1. 被添加者不在线时，把添加好友请求保存到数据库；
2. 被添加者登录后，查询“被添加者 ID 等于当前用户 ID”的记录；
3. 将请求逐条转发给当前登录用户；
4. 发送成功后删除数据库中的对应记录。

同时保存昵称可以减少后续再次查询 `t_user` 表的次数。

## 四、Qt 与 VS 之间的中文转码

### 4.1 为什么英文正常、中文乱码

Qt 客户端和 VS 服务端可能采用不同的字符串编码。英文和数字属于 ASCII 范围，在不同编码中通常相同，因此仅使用英文测试不容易发现问题；中文在不同编码中的字节表示不同，直接传输后可能出现乱码或数据库比较失败。

### 4.2 本节使用的转换方向

- Qt 向 VS 发送中文昵称：`UTF-8 → GB2312`；
- VS 返回中文昵称给 Qt 显示：`GB2312 → UTF-8`。

发送目标好友昵称时：

```cpp
utf8ToGb2312(frinick, addFriRq.frinick, 30);
```

客户端显示服务端返回的昵称前：

```cpp
QString nick = gb2312ToUtf8(pAddFriRs->usernick);
```

### 4.3 转码原则

- 必须使用中文数据进行测试；
- 是否需要转码与开发环境、Qt 版本、编译器和数据库字符集有关；
- 不应在没有验证的情况下把所有字符串都统一转换；
- 出现乱码的字段再转码，显示正常的字段暂时不改。
