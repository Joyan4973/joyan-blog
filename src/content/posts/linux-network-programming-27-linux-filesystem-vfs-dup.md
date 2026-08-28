---
title: "Linux 网络编程（27）：Linux 文件系统——目录操作、VFS 与文件描述符复制"
published: 2026-08-21T00:00:00Z
updated: 2026-08-21T00:00:00Z
description: "Linux 网络编程系列第 27 篇，整理文件属性与路径接口、硬链接和符号链接、unlink 临时文件、目录操作、虚拟文件系统 VFS，以及 dup、dup2 与文件描述符共享。"
image: ""
tags:
  - Linux 工具与文件系统阶段
  - Linux
  - 网络编程
  - 文件系统
  - 目录操作
  - VFS
  - 文件描述符
  - 硬链接
  - 符号链接
  - dup
  - 学习笔记
category: Linux 网络编程
draft: false
pinned: false
comment: true
readingTime: 9
lang: zh_CN
---

# Linux 文件系统：目录操作、VFS 与文件描述符复制

本节继续学习 Linux 文件系统，整理文件属性、路径、链接和目录相关函数，并通过 `unlink` 理解目录项删除与临时文件的实现方式。

随后从虚拟文件系统 VFS 的角度梳理进程、文件描述符与内核文件对象之间的关系，最后总结 `dup` 和 `dup2` 复制文件描述符时的共享行为。

## 一、文件属性与路径相关函数

### 1. `chown`：修改文件所有者和所属组

```c
int chown(const char *path, uid_t owner, gid_t group);
int fchown(int fd, uid_t owner, gid_t group);
int lchown(const char *path, uid_t owner, gid_t group);
```

作用：

- `chown`：按照文件路径修改文件所有者和所属组；
- `fchown`：按照文件描述符修改；
- `lchown`：路径是符号链接时，修改符号链接本身的所有者信息。

注意：

- 函数接收的是数字形式的用户 ID 和组 ID；
- `chown` 命令通常可以写用户名和组名，系统会先查出相应的用户 ID 和组 ID。

### 2. `utime`：修改文件访问时间和修改时间

```c
int utime(const char *filename, const struct utimbuf *times);
```

### 3. `truncate` 与 `ftruncate`：修改文件长度

```c
int truncate(const char *path, off_t length);
int ftruncate(int fd, off_t length);
```

作用：把文件修改为指定长度。

- 新长度小于原长度：文件后面的内容被截断；
- 新长度大于原长度：文件被扩展；
- `O_TRUNC` 只能在打开文件时把长度清零；
- `truncate`、`ftruncate` 可以直接指定目标长度。

### 4. `rename`：文件重命名

```c
#include <stdio.h>

int rename(const char *oldpath, const char *newpath);
```

作用：把 `oldpath` 对应的文件或目录改名为 `newpath`。

### 5. `chdir` 与 `fchdir`：改变当前进程的工作目录

```c
int chdir(const char *path);
int fchdir(int fd);
```

- `chdir`：通过路径改变当前进程的工作目录；
- `fchdir`：通过目录文件描述符改变当前工作目录；
- 功能与 shell 中的 `cd` 命令相似，但改变的是调用进程的工作目录。

### 6. `getcwd`：获得当前工作目录

```c
char *getcwd(char *buf, size_t size);
```

- `buf`：用于保存当前工作目录的缓冲区；
- `size`：缓冲区大小；
- 调用成功后，缓冲区中保存当前进程的绝对工作路径。

### 7. `pathconf` 与 `fpathconf`：查询文件相关配置值

```c
long fpathconf(int fd, int name);
long pathconf(const char *path, int name);
```

常见查询项：

| 查询项 | 含义 |
| --- | --- |
| `_PC_LINK_MAX` | 文件允许拥有的最大硬链接数量 |
| `_PC_NAME_MAX` | 目录中单个文件名允许的最大长度 |
| `_PC_PIPE_BUF` | 管道保证原子写入的数据大小 |

`pathconf` 根据路径查询，`fpathconf` 根据已打开的文件描述符查询。

## 二、硬链接、软链接与文件删除

### 1. `link`：创建硬链接

```c
#include <unistd.h>

int link(const char *oldpath, const char *newpath);
```

硬链接的本质：新增一个目录记录，使新的文件名与原文件名指向同一个 inode，同时把 inode 的硬链接计数加 1。

- 删除一个文件名时，只是删除目录中的记录，并把 inode 的硬链接计数减 1；
- 只有硬链接计数减为 0，并且已经没有进程继续打开该文件时，系统才会真正回收 inode 和数据块；
- 硬链接通常要求位于同一个文件系统中；
- 符号链接没有必须处于同一文件系统的限制；
- 通常不允许普通用户给目录创建硬链接；
- 创建目录记录和增加硬链接计数应当作为原子操作完成。

### 2. `symlink`：创建符号链接

```c
int symlink(const char *target, const char *linkpath);
```

符号链接又叫软链接。它是一个独立文件，文件内容中保存目标路径，因此它与目标文件拥有不同的 inode。

### 3. `readlink`：读取符号链接中保存的路径

```c
ssize_t readlink(const char *path, char *buf, size_t bufsiz);
```

`readlink` 读取的是符号链接文件中保存的目标路径，而不是目标文件的数据内容。

### 4. `unlink`：删除目录记录

```c
int unlink(const char *pathname);
```

1. 如果是符号链接，删除符号链接本身；
2. 如果是硬链接，硬链接计数减 1；当计数为 0 时，才具备释放数据块和 inode 的条件；
3. 如果文件的硬链接计数为 0，但仍被进程打开，则要等进程关闭该文件后，内核才真正删除文件；
4. 可以利用该特性创建临时文件：先 `open` 或 `creat`，再立即 `unlink`。

## 三、利用 `unlink` 创建临时文件

### 1. 为什么删除后还能继续操作

`unlink` 删除的是目录项。

只要进程仍然持有已经打开的文件描述符，内核中的文件对象仍然有效，进程就可以继续读写。

### 2. 这种方式的优点

- 临时文件不再通过文件名暴露给其他进程；
- 程序正常结束时，关闭文件描述符后由内核回收；
- 程序异常退出时，内核也会回收进程持有的文件描述符；
- 可以减少程序异常退出后残留临时文件的问题。

## 四、目录操作函数

### 1. 创建和删除目录

```c
int mkdir(const char *pathname, mode_t mode);
```

```c
int rmdir(const char *pathname);
```

- `mkdir`：创建目录；
- `rmdir`：删除空目录。

### 2. 目录为什么不能像普通文件一样随意写

目录本身也是一种文件，但目录中的记录维护了文件名与 inode 的对应关系。

应用程序可以读取目录记录，却不能像写普通文件一样直接任意修改目录内容。

创建、删除和重命名目录项应通过文件系统提供的函数完成。

### 3. 打开目录：`opendir`

```c
DIR *opendir(const char *name);
```

成功时返回 `DIR *`，失败时返回 `NULL`。

### 4. 读取目录项：`readdir`

```c
struct dirent *readdir(DIR *dirp);
```

每调用一次 `readdir`，读取一个目录项；要读取整个目录，需要循环调用，直到返回 `NULL`。

主要字段：

| 字段 | 含义 |
| --- | --- |
| `d_ino` | inode 编号 |
| `d_off` | 到下一个目录项的偏移量 |
| `d_reclen` | 当前目录项的记录长度 |
| `d_type` | 文件类型 |
| `d_name` | 文件名 |

### 5. 其他目录函数

```c
void rewinddir(DIR *dirp);
long telldir(DIR *dirp);
void seekdir(DIR *dirp, long loc);
int closedir(DIR *dirp);
```

- `rewinddir`：把目录读取位置重新移到开头；
- `telldir`：获得当前目录读取位置；
- `seekdir`：移动到指定目录读取位置；
- `closedir`：关闭目录流。

## 五、虚拟文件系统 VFS

### 1. 为什么需要 VFS

Linux 可以使用不同类型的文件系统。

不同文件系统保存和组织数据的方式不完全相同，但应用程序仍然可以统一使用 `open`、`read`、`write`、`close` 等函数。

VFS 位于应用程序和具体文件系统之间。

VFS 对上提供统一接口，对下调用具体文件系统的实现，因此应用程序通常不必关心底层文件系统类型。

### 2. 进程、文件描述符与文件对象

以 32 位系统的典型地址空间划分为例：

- 用户空间：0～3 GB；
- 内核空间：3～4 GB。

进程在内核中有自己的进程控制信息，其中保存文件描述符表。

文件描述符表中的每一个有效项，都指向内核中的一个打开文件对象。

内核文件对象中包含或关联的信息包括：

- 当前读写位置（文件偏移量）；
- 文件打开标志；
- 文件操作函数指针；
- 目录项信息；
- 引用计数；
- 对应的 inode 信息。

### 3. `file_operations` 与 `inode_operations`

`file_operations` 用于已打开文件上的操作：

- `open`；
- `close`；
- `read`；
- `write`；
- 文件定位。

`inode_operations` 用于 inode 或目录项相关操作：

- `chmod`；
- `link`；
- `unlink`。

VFS 通过这些操作接口，找到具体文件系统提供的实现函数。

### 4. 多个文件描述符共享一个文件对象

如果两个文件描述符指向同一个内核文件对象，它们就会共享文件偏移量。

例如：

1. 通过第一个文件描述符写入 `hello`，偏移量移动到 5；
2. 再通过第二个文件描述符写入 `world`；
3. 因为二者共享偏移量，所以结果接在后面，形成 `helloworld`。

如果两个进程分别独立打开同一个文件，则通常会形成两个不同的文件对象，各自拥有自己的文件偏移量。

此时两个进程都可能从文件开头写入，后写入的数据可能覆盖先写入的数据。

## 六、`dup` 与 `dup2`

### 1. 函数声明

```c
int dup(int oldfd);
int dup2(int oldfd, int newfd);
```

### 2. `dup`

`dup(oldfd)` 从当前进程的文件描述符表中分配一个新的文件描述符，使它与 `oldfd` 指向同一个内核文件对象。

因此：

- 两个文件描述符指向同一打开文件；
- 两者共享文件偏移量；
- 两者共享文件状态标志。

### 3. `dup2`

`dup2(oldfd, newfd)` 让指定的 `newfd` 指向 `oldfd` 当前指向的内核文件对象。
