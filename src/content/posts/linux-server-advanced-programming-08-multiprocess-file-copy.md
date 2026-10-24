---
title: "Linux 服务器高阶编程（8）：多进程文件拷贝"
published: 2026-10-18T01:00:00Z
updated: 2026-10-18T01:00:00Z
description: "整理多进程文件拷贝的参数校验、文件切片、fork 与 execl 分工，以及分段读写的文件 I/O 流程。"
image: ""
tags:
  - Linux
  - 进程
  - 文件拷贝
  - fork
  - execl
  - 文件IO
  - 学习笔记
category: Linux 服务器高阶编程
draft: false
pinned: false
comment: true
readingTime: 5
lang: zh_CN
---

# Linux 服务器高阶编程（8）：多进程文件拷贝

## 一、命令行与参数校验

```bash
./ProcessCopy 源文件 目标文件 [进程数]
# 举例：将 1.png 拷贝为 A.png，指定 30 个进程
./ProcessCopy 1.png A.png 30
```

`[进程数]` 表示可选参数。用户不传时，选用 **1 个进程**作为默认值；并非缺少它就一定报错。C 程序的 `argv[0]` 是程序自身，因此传三个用户参数时 `argc == 4`：`argv[1]` 为源文件、`argv[2]` 为目标文件、`argv[3]` 为进程数。只传两个必填参数时 `argc == 3`。`argv[3]` 是字符串，使用前要转换成整数， `atoi`。判断可选参数前，应先确认 `argc`，不要访问不存在的数组项。

父进程不能拿到参数就立即 `fork`。检查三件事：

1. 参数数量：至少提供源文件和目标文件，即 `argc >= 3`
2. 源文件存在： `access(srcFile, F_OK)` ，返回 `0` 表示存在，非 `0` 表示检查失败；仅检查“存在”并不等于保证后续一定可读，实际打开文件还要检查 `open` 的返回值
3. 进程数合法：设定大致为 **1～100** 的范围，不能让用户随意传负数、零或极大的数量。若校验失败，终止程序，不进入切片和创建子进程步骤

## 二、文件切片

多个进程做的是同一种工作，但各自的**起始偏移量**不同

若各子进程都从文件开头读写，就会重复处理或相互覆盖，不能组成完整副本

切片模块先取得源文件大小 `fileSize`，再结合进程数 `procNum` 得到每块大小 `blockSize`

```c
blockSize = fileSize / procNum;
if (fileSize % procNum != 0) {
    ++blockSize;
}
offset = i * blockSize;  /* 第 i 个子进程的起点，i 从 0 开始 */
```

例如 100 字节交给 5 个进程，`blockSize = 20`，起点为 0、20、40、60、80。103 字节交给 5 个进程时，`blockSize = 21`

用 `lseek(fd, 0, SEEK_END)` 得到文件末尾偏移量，从而获得文件大小

生产代码应检查 `open`、`lseek` 是否失败；文件可能超过 `int` 能表示的范围，文件大小和偏移量更适合使用 `off_t`

## 三、为什么是两个可执行程序

`fork()` 后的子进程能取得循环变量 `i`，所以自己的起始偏移量可用 `i * blockSize` 计算

随后 `execl()` 让它执行单独编译出来的 `Copy`，`execl` 成功会替换子进程的程序映像，不会返回原程序继续往下执行；失败应检查并退出子进程。

交给 `Copy` 的用户参数依次是：源文件、目标文件、`offset`、`blockSize`

因为 `execl` 的参数序列是字符串，两个整数不能直接当作普通命令行字符串传入

先用字符数组保存数字文本，再用 `sprintf` 格式化，最后把字符串传给 `execl`；`Copy` 的 `main` 再把它们解析回整数

```c
execl(copyPath, "Copy", srcFile, dstFile, strOffset, strBlock, (char *)NULL);
```

对应地，`Copy` 程序有自己的 `main(int argc, char *argv[])`：`argv[1]`/`argv[2]` 是两个文件名，`argv[3]`/`argv[4]` 是偏移量与块大小。`execl` 最后的空指针是参数列表终止标记，不能遗漏

子进程完成后，父进程负责阻塞等待并回收，避免留下僵尸进程

## 四、`Copy` 程序的文件 I/O 流程

单段拷贝分为几步：

1. 以只读方式打开源文件，取得源文件描述符；以只写方式打开目标文件。目标文件可能尚不存在，因此 `O_WRONLY | O_CREAT`，创建时指定权限模式
2. 源文件和目标文件的读写位置都移动到该子进程的 `offset`，即分别调用 `lseek(fd, offset, SEEK_SET)`。只移动源文件而不移动目标文件会把各段写到同一位置
3. 使用缓冲区调用 `read` 读取源文件数据，再调用 `write` 写入目标文件
4. 完成后关闭两个文件描述符
