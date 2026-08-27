---
title: "Linux 网络编程（26）：Linux 文件 I/O 与 ext2 文件系统"
published: 2026-08-20T00:00:00Z
updated: 2026-08-20T00:00:00Z
description: "Linux 网络编程课程第 26 课，整理阻塞与非阻塞 I/O、fcntl、ext2 文件系统布局、inode 寻址、目录与路径查找、硬链接与符号链接，以及 stat、access 和 chmod 等文件接口。"
image: ""
tags:
  - Linux
  - 网络编程
  - 文件 I/O
  - 非阻塞 I/O
  - ext2
  - inode
  - 文件系统
  - 硬链接
  - 符号链接
  - 课程笔记
category: Linux 网络编程
draft: false
pinned: false
comment: true
readingTime: 8
lang: zh_CN
---

# Linux 文件 I/O 与文件系统

本节继续学习 Linux 文件 I/O，首先比较阻塞与非阻塞方式，并通过 `fcntl` 理解如何修改已经打开文件的状态标志。

随后从 ext2 文件系统的块组布局出发，梳理 inode、数据块、目录项和路径查找之间的关系，并总结硬链接、符号链接以及常用文件属性与权限接口。

## 一、阻塞 I/O 与非阻塞 I/O

### 1. 阻塞和非阻塞的区别

阻塞方式下：

- 等待的事情没有发生时，程序一直等待；
- 等待期间不会反复占用 CPU 查询；
- 数据一旦到达，程序能够立即继续处理。

非阻塞方式下：

- 如果暂时没有数据，函数不会一直等待，而是立即返回；
- 程序可以先做其他事情，稍后再来询问；
- 这种反复询问的方式称为轮询；
- 由于程序不是一直等在当前操作上，数据到达后不一定会在第一时间被处理。

常规文件通常不会无限阻塞：读写操作会在有限时间内成功或失败。

终端设备文件和网络文件不同，没有输入或网络数据时，阻塞读可能一直等待。

### 2. 为什么要使用 `fcntl`

标准输入文件在程序启动前已经由系统打开，不能重新调用 `open` 并传入 `O_NONBLOCK`。

`fcntl` 可以修改一个已经打开文件的属性，例如读写、追加和非阻塞等。

```c
#include <unistd.h>
#include <fcntl.h>

int fcntl(int fd, int cmd);
int fcntl(int fd, int cmd, long arg);
int fcntl(int fd, int cmd, struct flock *lock);
```

常用 `cmd` 命令：

| 命令 | 作用 |
| --- | --- |
| `F_GETFL` | 获取文件当前的状态标志 |
| `F_SETFL` | 设置文件新的状态标志 |
| `O_NONBLOCK` | 非阻塞标志 |

### 3. 非阻塞读的三种结果

1. 返回值大于等于 0：读取成功；
2. 返回 `-1`，并且 `errno == EAGAIN`（或 `EWOULDBLOCK`）：暂时没有数据，不是真正的错误；
3. 返回 `-1`，但 `errno` 不是 `EAGAIN`：读取真正出错。

## 二、ext2 文件系统的整体结构

### 1. 从磁盘格式化说起

磁盘格式化的一个重要结果，是把磁盘划分成若干个固定大小的块。

以 4 KB 块为例：

```text
1 block = 4096 byte = 4 KB = 8 sectors
```

一个文件即使只有十几个字节，只要占用了一个数据块，底层也要按一个完整块分配。

大文件则会占用多个块，多个 block 由 block group 进行管理。

### 2. ext2 布局图

```text
[Boot Block 1 KB] |<------------------- ext2 文件系统 ------------------->|
                  | Block Group 0 | Block Group 1 | Block Group 2 | ... |

每个 Block Group 的主要组成：

[超级块][GDT][块位图][inode Bitmap][inode Table][Data Blocks ...]
```

### 3. 各区域作用

| 区域 | 主要作用 |
| --- | --- |
| 超级块 | 记录块大小、文件系统版本、上次挂载时间等文件系统整体信息。多个块组保留副本，便于损坏后恢复 |
| GDT | 记录块位图、inode Bitmap、inode Table、Data Block 的起始位置，以及空闲 inode 等信息 |
| 块位图 | 每个 bit 对应一个 block；`1` 表示已经使用，`0` 表示空闲 |
| inode Bitmap | 每个 bit 对应一个 inode；`1` 表示已经使用，`0` 表示空闲 |
| inode Table | 存放许多 inode 节点。一个 inode 为 128 byte，一个 4 KB 块可存放 32 个 inode |
| Data Block | 以块为单位保存文件内容 |

### 4. inode 保存什么

一个文件分成两部分：

- 文件属性：保存在 inode 中；
- 文件内容：保存在 data block 中。

inode 中主要包含：

- 文件类型与权限；
- 所属用户和用户组；
- 文件大小；
- 访问、修改、状态改变时间；
- 硬链接计数；
- 指向 data block 的数据块指针。

数据块指针把“文件属性”和“文件内容”连接起来。

每个文件需要 inode，但多个硬链接文件名可以共用同一个 inode。一个文件不能同时使用两个独立 inode 来表示自己。

### 5. 文件的存储过程

1. 从 GDT 查看当前块组是否还有空闲 inode；没有则检查下一个块组；
2. 根据 GDT 找到 inode Bitmap、inode Table、Block Bitmap 和 Data Block 的位置；
3. 在 inode Bitmap 中找到空闲位并置 `1`，在对应 inode 中写入文件属性；
4. 根据文件大小寻找足够的空闲 data block，并把相应 Block Bitmap 位设为 `1`；
5. 将文件内容写入 data block；
6. 把这些 data block 的地址写入 inode 的数据块指针。

### 6. 文件为什么删除得很快

删除文件时，系统主要把该文件占用的 inode Bitmap 和 Block Bitmap 标志位清零，表示这些空间可以重新分配，并不需要立刻逐字节擦除所有 data block。

因此：

- 复制大文件需要真正写入大量 data block，耗时较长；
- 删除大文件主要是释放空间使用权，通常很快；
- 被删除文件的数据在被新内容覆盖前，物理上可能仍存在，因此存在数据恢复的可能；
- 若要避免旧数据被恢复，需要用新数据覆盖相应存储区域；仅做软件层面的删除不等于物理清除。

## 三、inode 的直接与间接寻址

以 32 位地址、4 KB 块进行计算。

inode 的数据块指针区域为 60 byte，一个地址为 4 byte，因此能保存 15 个地址，即 `block[0]` 到 `block[14]`。

| 指针 | 寻址方式 | 可表示的数据空间 |
| --- | --- | ---: |
| `block[0]`～`block[11]` | 12 个直接地址，直接指向 data block | `12 × 4 KB = 48 KB` |
| `block[12]` | 一级间接寻址：先指向一个保存地址的块 | `1024 × 4 KB = 4 MB` |
| `block[13]` | 二级间接寻址 | `1024² × 4 KB = 4 GB` |
| `block[14]` | 三级间接寻址 | `1024³ × 4 KB = 4 TB` |

## 四、目录、目录项与路径查找

### 1. 目录也是文件

目录是特殊文件。

一个 4096 byte 的目录会占用一个 data block，其中保存若干条目录项。

每条记录包含：

| 字段 | 含义 |
| --- | --- |
| 文件名 | 当前目录下的名字 |
| inode 编号 | 用来定位对应 inode |
| 文件类型 | 普通文件、目录、设备文件等 |
| 记录长度 | 当前目录项所占长度 |

文件类型编码：

| 编码 | 类型 |
| ---: | --- |
| 0 | Unknown |
| 1 | Regular file |
| 2 | Directory |
| 3 | Character device |
| 4 | Block device |
| 5 | Named pipe |
| 6 | Socket |
| 7 | Symbolic link |

根目录固定使用 inode 编号 2。

根据路径查找文件时，系统先从根目录 inode 开始，读取目录的 data block，在目录项中根据名字找到下一级 inode 编号，再逐层向下查找。

### 2. 使用 `vi` 浏览目录

```bash
vi project/
```

## 五、硬链接与符号链接

### 1. 创建方式

```bash
# 硬链接
ln aa aa_h

# 符号链接（软链接）
ln -s aa aa_s
```

### 2. 底层区别

| 对比项 | 硬链接 | 符号链接（软链接） |
| --- | --- | --- |
| inode | 与原文件共用同一个 inode | 申请新的 inode |
| data block | 与原文件共用 | 通过目标文件名或路径寻找原文件 |
| 硬链接计数 | 创建后计数加 1 | 不增加原文件硬链接计数 |
| 删除原文件后 | 只要链接计数不为 0，仍可访问内容 | 链接失效，但符号链接文件本身仍存在 |
| 重新创建同名目标 | 不受影响 | 会重新指向新建的同名文件 |
| 限制 | 必须位于同一文件系统，不能建立指向目录的硬链接 | 不受该限制 |

硬链接的本质是多个文件名对应同一个 inode。

删除其中一个名字只会让硬链接计数减 1；只有计数变为 0 时，系统才回收 inode 和数据块。

符号链接类似 Windows 的快捷方式，依靠目标的文件名或路径查找文件。

## 六、获取文件属性：`stat`、`fstat`、`lstat`

```c
int stat(const char *path, struct stat *buf);
int fstat(int fd, struct stat *buf);
int lstat(const char *path, struct stat *buf);
```

区别：

- `stat`：通过路径查找文件；遇到符号链接时继续跟踪，得到目标文件属性；
- `fstat`：通过已经打开的文件描述符查找文件；
- `lstat`：通过路径查找，但不跟踪符号链接，得到符号链接文件本身的属性。

## 七、`access` 与 `chmod`

### 1. `access` 检查文件

```c
int access(const char *pathname, int mode);
```

| `mode` | 判断内容 |
| --- | --- |
| `R_OK` | 是否具有读权限 |
| `W_OK` | 是否具有写权限 |
| `X_OK` | 是否具有执行权限 |
| `F_OK` | 文件是否存在 |

### 2. `chmod` 修改权限

```c
int chmod(const char *path, mode_t mode);
int fchmod(int fd, mode_t mode);
```
